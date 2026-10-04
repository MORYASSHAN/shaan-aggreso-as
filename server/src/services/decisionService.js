import {
  ACTION,
  ACTION_TO_VISIBILITY,
  ACTOR_TYPE,
  APPEAL_OUTCOME,
  APPEAL_STATUS,
  AUDIT,
  CASE,
  DECISION_OUTCOME,
  DECISION_STAGE,
  ERROR,
  MODERATOR_ROLES,
  ROLES,
} from '../constants.js';
import { withTransaction } from '../db.js';
import { Analysis, Appeal, Case, Content, Decision } from '../models/index.js';
import { recommendedClauses } from '../moderation/combine.js';
import { appError } from '../utils/AppError.js';
import * as auditService from './auditService.js';
import * as policyService from './policyService.js';

// THE ONLY MODULE THAT CHANGES content.visibility OR RESOLVES AN APPEAL.
// Every path in here requires a human moderator. AI and system actors are refused.

export function assertHuman(actor) {
  if (actor?.type !== ACTOR_TYPE.USER) {
    throw appError(ERROR.HUMAN_REQUIRED, 'Only a human moderator can make this decision.');
  }
  if (!MODERATOR_ROLES.includes(actor.role)) {
    throw appError(ERROR.FORBIDDEN, 'Only moderators can make decisions.');
  }
}

async function setVisibility(contentId, action, { actor, policyVersion, requestId, session }) {
  const content = await Content.findById(contentId).session(session);
  const next = ACTION_TO_VISIBILITY[action];
  if (content.visibility === next) return;
  const before = content.visibility;
  content.visibility = next;
  await content.save({ session });
  await auditService.record(
    {
      actor,
      action: AUDIT.VISIBILITY_CHANGED,
      entity: { type: 'content', id: contentId },
      before: { visibility: before },
      after: { visibility: next },
      policyVersion,
      requestId,
    },
    session,
  );
}

async function assertClausesExist(clauseCodes, finalAction, policyVersion) {
  if (finalAction !== ACTION.NONE && clauseCodes.length === 0) {
    throw appError(ERROR.VALIDATION_FAILED, 'Choose at least one clause for this action.', {
      fields: { clauseCodes: ['Choose at least one clause for this action.'] },
    });
  }
  const policy = await policyService.getVersion(policyVersion);
  const unknown = clauseCodes.filter((code) => !policyService.findClause(policy, code));
  if (unknown.length) {
    throw appError(ERROR.VALIDATION_FAILED, `Not in policy v${policyVersion}: ${unknown.join(', ')}.`, {
      fields: { clauseCodes: [`Unknown clause: ${unknown.join(', ')}`] },
    });
  }
}

async function toInitialDecision(input, analysis) {
  if (input.outcome === DECISION_OUTCOME.APPROVED) {
    return { finalAction: analysis.recommendation.proposedAction, clauseCodes: recommendedClauses(analysis) };
  }
  if (input.outcome === DECISION_OUTCOME.REJECTED) return { finalAction: ACTION.NONE, clauseCodes: [] };
  await assertClausesExist(input.clauseCodes, input.finalAction, analysis.policyVersion);
  return { finalAction: input.finalAction, clauseCodes: input.clauseCodes };
}

async function explainConflict(caseId, analysisId) {
  const kase = await Case.findById(caseId).lean();
  if (!kase) return appError(ERROR.NOT_FOUND, 'Case not found.');
  if (kase.status === CASE.AWAITING_REVIEW && String(kase.currentAnalysisId) !== String(analysisId)) {
    const current = await Analysis.findById(kase.currentAnalysisId).lean();
    return appError(
      ERROR.STALE_ANALYSIS,
      `This case was re-analysed under policy v${current?.policyVersion}. Reload to see the new analysis.`,
    );
  }
  return appError(ERROR.INVALID_TRANSITION, `This case is ${kase.status} and cannot be decided now.`);
}

async function decideInitial({ caseId, input, actor, requestId }) {
  const analysis = await Analysis.findOne({ _id: input.analysisId, caseId }).lean();
  if (!analysis) throw await explainConflict(caseId, input.analysisId);
  const { finalAction, clauseCodes } = await toInitialDecision(input, analysis);
  const policyVersion = analysis.policyVersion;
  return withTransaction(async (session) => {
    // Filter on current status and analysis so two moderators can't decide the same case.
    const kase = await Case.findOneAndUpdate(
      { _id: caseId, status: CASE.AWAITING_REVIEW, currentAnalysisId: input.analysisId },
      { $set: { status: CASE.RESOLVED } },
      { new: true, session },
    );
    if (!kase) throw await explainConflict(caseId, input.analysisId);
    const [decision] = await Decision.create(
      [
        {
          caseId,
          stage: DECISION_STAGE.INITIAL,
          reviewerId: actor.id,
          outcome: input.outcome,
          finalAction,
          clauseCodes,
          rationale: input.rationale ?? '',
          policyVersion,
          analysisId: analysis._id,
        },
      ],
      { session },
    );
    await setVisibility(kase.contentId, finalAction, { actor, policyVersion, requestId, session });
    await auditService.record(
      {
        actor,
        action: AUDIT.DECISION_MADE,
        entity: { type: 'case', id: caseId },
        after: decision,
        policyVersion,
        requestId,
      },
      session,
    );
    return decision.toObject();
  });
}

async function toAppealDecision(input, original, policyVersion) {
  if (input.outcome === APPEAL_OUTCOME.UPHELD) {
    return { finalAction: original.finalAction, clauseCodes: original.clauseCodes };
  }
  if (input.outcome === APPEAL_OUTCOME.OVERTURNED) return { finalAction: ACTION.NONE, clauseCodes: [] };
  await assertClausesExist(input.clauseCodes, input.finalAction, policyVersion);
  return { finalAction: input.finalAction, clauseCodes: input.clauseCodes };
}

async function decideAppeal({ appealId, input, actor, requestId }) {
  const appeal = await Appeal.findById(appealId).lean();
  if (!appeal) throw appError(ERROR.NOT_FOUND, 'Appeal not found.');
  const original = await Decision.findById(appeal.decisionId).lean();
  // Checked here as well as in appealService: the guard must hold whoever calls it.
  if (String(original.reviewerId) === String(actor.id)) {
    throw appError(ERROR.SAME_REVIEWER, 'The original moderator cannot review this appeal.');
  }
  if (actor.role !== ROLES.SENIOR) throw appError(ERROR.FORBIDDEN, 'Only senior moderators resolve appeals.');
  const kaseBefore = await Case.findById(appeal.caseId).lean();
  const analysis = await Analysis.findById(kaseBefore.currentAnalysisId).lean();
  const policyVersion = analysis.policyVersion;
  const { finalAction, clauseCodes } = await toAppealDecision(input, original, policyVersion);
  return withTransaction(async (session) => {
    const kase = await Case.findOneAndUpdate(
      { _id: appeal.caseId, status: CASE.APPEAL_PENDING },
      { $set: { status: CASE.APPEAL_RESOLVED } },
      { new: true, session },
    );
    if (!kase) throw appError(ERROR.INVALID_TRANSITION, 'This appeal has already been resolved.');
    const [decision] = await Decision.create(
      [
        {
          caseId: kase._id,
          stage: DECISION_STAGE.APPEAL,
          reviewerId: actor.id,
          outcome: input.outcome,
          finalAction,
          clauseCodes,
          rationale: input.rationale,
          policyVersion,
          analysisId: analysis._id,
        },
      ],
      { session },
    );
    const resolved = await Appeal.findOneAndUpdate(
      { _id: appealId, status: APPEAL_STATUS.PENDING, assignedReviewerId: actor.id },
      { $set: { status: APPEAL_STATUS.RESOLVED, resolutionDecisionId: decision._id } },
      { new: true, session },
    );
    if (!resolved)
      throw appError(ERROR.INVALID_TRANSITION, 'This appeal is resolved or assigned to someone else.');
    await setVisibility(kase.contentId, finalAction, { actor, policyVersion, requestId, session });
    const base = { actor, policyVersion, requestId };
    await auditService.record(
      { ...base, action: AUDIT.DECISION_MADE, entity: { type: 'case', id: kase._id }, after: decision },
      session,
    );
    await auditService.record(
      {
        ...base,
        action: AUDIT.APPEAL_RESOLVED,
        entity: { type: 'appeal', id: appealId },
        before: appeal,
        after: resolved,
      },
      session,
    );
    return { decision: decision.toObject(), appeal: resolved.toObject() };
  });
}

/**
 * The only function in the codebase that changes content.visibility or resolves an appeal.
 * stage 'initial': decide an awaiting_review case. stage 'appeal': resolve an appeal_pending case.
 * Visibility, decision and audit event are written in one transaction: all succeed or none do.
 */
export async function applyDecision({
  caseId,
  appealId,
  input,
  actor,
  requestId,
  stage = DECISION_STAGE.INITIAL,
}) {
  assertHuman(actor);
  if (stage === DECISION_STAGE.APPEAL) return decideAppeal({ appealId, input, actor, requestId });
  return decideInitial({ caseId, input, actor, requestId });
}
