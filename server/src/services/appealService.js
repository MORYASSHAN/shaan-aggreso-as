import { config } from '../config.js';
import {
  ACTION,
  ACTOR_TYPE,
  APPEAL_STATUS,
  AUDIT,
  CASE,
  DECISION_STAGE,
  ERROR,
  ROLES,
} from '../constants.js';
import { withTransaction } from '../db.js';
import { Analysis, Appeal, Case, Content, Decision, User } from '../models/index.js';
import { summarizeAppeal } from '../moderation/ai/appealAssistant.js';
import { appError } from '../utils/AppError.js';
import * as auditService from './auditService.js';
import { applyDecision, assertHuman } from './decisionService.js';
import { enqueue } from './jobQueue.js';
import * as policyService from './policyService.js';

const SYSTEM = { type: ACTOR_TYPE.SYSTEM };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure routing rule: senior moderators who did not make the original decision,
 * fewest open appeals first. Returns null when nobody is eligible.
 */
export function chooseReviewer(seniors, openCounts, originalReviewerId) {
  const eligible = seniors.filter((s) => String(s._id) !== String(originalReviewerId));
  if (eligible.length === 0) return null;
  const load = (s) => openCounts.get(String(s._id)) ?? 0;
  return [...eligible].sort((a, b) => load(a) - load(b) || String(a._id).localeCompare(String(b._id)))[0];
}

async function routeAppeal(originalReviewerId, session) {
  const seniors = await User.find({ role: ROLES.SENIOR }).session(session).lean();
  const counts = await Appeal.aggregate([
    { $match: { status: APPEAL_STATUS.PENDING, assignedReviewerId: { $ne: null } } },
    { $group: { _id: '$assignedReviewerId', open: { $sum: 1 } } },
  ]).session(session);
  const openCounts = new Map(counts.map((c) => [String(c._id), c.open]));
  return chooseReviewer(seniors, openCounts, originalReviewerId);
}

async function loadAppealable(decisionId, actor) {
  const decision = await Decision.findById(decisionId).lean();
  if (!decision) throw appError(ERROR.NOT_FOUND, 'Decision not found.');
  const kase = await Case.findById(decision.caseId).lean();
  const content = await Content.findById(kase.contentId).lean();
  if (String(content.authorId) !== actor.id)
    throw appError(ERROR.FORBIDDEN, 'Only the author of the content can appeal.');
  if (decision.stage !== DECISION_STAGE.INITIAL)
    throw appError(ERROR.INVALID_TRANSITION, 'An appeal decision is final.');
  if (decision.finalAction === ACTION.NONE) {
    throw appError(
      ERROR.INVALID_TRANSITION,
      'No action was taken on this content, so there is nothing to appeal.',
    );
  }
  if (await Appeal.exists({ decisionId }))
    throw appError(ERROR.ALREADY_APPEALED, 'This decision has already been appealed.');
  if (decision.createdAt.getTime() + config.APPEAL_WINDOW_DAYS * DAY_MS < Date.now()) {
    throw appError(
      ERROR.INVALID_TRANSITION,
      `Appeals must be made within ${config.APPEAL_WINDOW_DAYS} days.`,
    );
  }
  return { decision, kase, content };
}

function scheduleSummary(appeal, { decision, content, requestId }) {
  enqueue(
    'appeal-summary',
    async () => {
      const policy = await policyService.getActive();
      const decidedUnder = await policyService.getVersion(decision.policyVersion);
      const clauses = decision.clauseCodes
        .map((code) => policyService.findClause(decidedUnder, code))
        .filter(Boolean);
      const aiSummary = await summarizeAppeal({
        content,
        decision,
        clauses,
        statement: appeal.statement,
        evidence: appeal.evidence,
        policyChanged: policy.version !== decision.policyVersion,
        requestId,
      });
      // Stored as a labelled suggestion for the reviewer; it never resolves anything.
      if (aiSummary) await Appeal.updateOne({ _id: appeal._id }, { $set: { aiSummary } });
    },
    { requestId },
  );
}

/** Author submits an appeal: once per decision, within the window, only for an action other than none. */
export async function submit({ decisionId, statement, evidence, actor, requestId }) {
  const { decision, kase, content } = await loadAppealable(decisionId, actor);
  let appeal;
  try {
    appeal = await withTransaction(async (session) => {
      const moved = await Case.findOneAndUpdate(
        { _id: kase._id, status: CASE.RESOLVED },
        { $set: { status: CASE.APPEAL_PENDING } },
        { new: true, session },
      );
      if (!moved) throw appError(ERROR.INVALID_TRANSITION, 'This case cannot be appealed now.');
      const reviewer = await routeAppeal(decision.reviewerId, session);
      const [created] = await Appeal.create(
        [
          {
            caseId: kase._id,
            decisionId,
            authorId: actor.id,
            statement,
            evidence,
            assignedReviewerId: reviewer?._id ?? null,
          },
        ],
        { session },
      );
      const entity = { type: 'appeal', id: created._id };
      const base = { entity, policyVersion: decision.policyVersion, requestId };
      await auditService.record({ ...base, actor, action: AUDIT.APPEAL_SUBMITTED, after: created }, session);
      if (reviewer) {
        await auditService.record(
          {
            ...base,
            actor: SYSTEM,
            action: AUDIT.APPEAL_ASSIGNED,
            after: { assignedReviewerId: reviewer._id, name: reviewer.name },
          },
          session,
        );
      }
      return created;
    });
  } catch (err) {
    if (err?.code === 11000)
      throw appError(ERROR.ALREADY_APPEALED, 'This decision has already been appealed.');
    throw err;
  }
  scheduleSummary(appeal, { decision, content, requestId });
  return appeal.toObject();
}

export async function list(actor, { status }) {
  const filter = { status };
  // Senior moderators see appeals assigned to them and unassigned ones; admins see unassigned ones only.
  filter.$or =
    actor.role === ROLES.ADMIN
      ? [{ assignedReviewerId: null }]
      : [{ assignedReviewerId: actor.id }, { assignedReviewerId: null }];
  const appeals = await Appeal.find(filter)
    .sort({ createdAt: 1 })
    .populate('authorId', 'name')
    .populate('assignedReviewerId', 'name')
    .lean();
  const decisions = await Decision.find({ _id: { $in: appeals.map((a) => a.decisionId) } }).lean();
  return appeals.map((appeal) => {
    const decision = decisions.find((d) => String(d._id) === String(appeal.decisionId));
    return {
      ...appeal,
      decision: decision && {
        finalAction: decision.finalAction,
        clauseCodes: decision.clauseCodes,
        policyVersion: decision.policyVersion,
      },
      noEligibleReviewer: !appeal.assignedReviewerId,
    };
  });
}

function canResolve(appeal, original, actor) {
  if (appeal.status !== APPEAL_STATUS.PENDING || actor.role !== ROLES.SENIOR) return false;
  if (String(original.reviewerId) === actor.id) return false;
  return (
    !appeal.assignedReviewerId ||
    String(appeal.assignedReviewerId._id ?? appeal.assignedReviewerId) === actor.id
  );
}

/** The three panels: original decision, appeal evidence, final outcome. */
export async function getDetail(appealId, actor) {
  const appeal = await Appeal.findById(appealId)
    .populate('authorId', 'name')
    .populate('assignedReviewerId', 'name')
    .lean();
  if (!appeal) throw appError(ERROR.NOT_FOUND, 'Appeal not found.');
  const original = await Decision.findById(appeal.decisionId).populate('reviewerId', 'name role').lean();
  const kase = await Case.findById(appeal.caseId).lean();
  const [content, originalAnalysis, currentAnalysis, resolution] = await Promise.all([
    Content.findById(kase.contentId).populate('authorId', 'name').lean(),
    Analysis.findById(original.analysisId).lean(),
    Analysis.findById(kase.currentAnalysisId).lean(),
    appeal.resolutionDecisionId
      ? Decision.findById(appeal.resolutionDecisionId).populate('reviewerId', 'name role').lean()
      : null,
  ]);
  const parent = content.postId ? await Content.findById(content.postId).lean() : null;
  return {
    appealId: appeal._id,
    caseId: kase._id,
    caseStatus: kase.status,
    content,
    parent,
    originalDecision: { decision: original, analysis: originalAnalysis },
    appealEvidence: {
      statement: appeal.statement,
      evidence: appeal.evidence,
      author: appeal.authorId,
      submittedAt: appeal.createdAt,
      aiSummary: appeal.aiSummary,
      assignedReviewer: appeal.assignedReviewerId,
      currentAnalysis:
        String(currentAnalysis?._id) !== String(originalAnalysis?._id) ? currentAnalysis : null,
      policyChanged:
        currentAnalysis && originalAnalysis
          ? currentAnalysis.policyVersion !== originalAnalysis.policyVersion
          : false,
    },
    finalOutcome: resolution,
    status: appeal.status,
    canResolve: canResolve(appeal, original, actor),
  };
}

// An unassigned appeal is claimed by the first eligible senior moderator who resolves it.
async function claimIfUnassigned(appeal, actor, requestId) {
  if (appeal.assignedReviewerId) return;
  await withTransaction(async (session) => {
    const claimed = await Appeal.findOneAndUpdate(
      { _id: appeal._id, status: APPEAL_STATUS.PENDING, assignedReviewerId: null },
      { $set: { assignedReviewerId: actor.id } },
      { new: true, session },
    );
    if (!claimed) return;
    await auditService.record(
      {
        actor,
        action: AUDIT.APPEAL_ASSIGNED,
        entity: { type: 'appeal', id: appeal._id },
        after: { assignedReviewerId: actor.id },
        requestId,
      },
      session,
    );
  });
}

/** A second, different moderator resolves the appeal. The AI has no vote. */
export async function resolve({ appealId, input, actor, requestId }) {
  assertHuman(actor);
  const appeal = await Appeal.findById(appealId).lean();
  if (!appeal) throw appError(ERROR.NOT_FOUND, 'Appeal not found.');
  if (appeal.status !== APPEAL_STATUS.PENDING)
    throw appError(ERROR.INVALID_TRANSITION, 'This appeal has already been resolved.');
  const original = await Decision.findById(appeal.decisionId).lean();
  if (String(original.reviewerId) === String(actor.id)) {
    await auditService.recordDenied({
      actor,
      reason: 'The original moderator tried to resolve the appeal of their own decision.',
      entity: { type: 'appeal', id: appeal._id },
      requestId,
    });
    throw appError(ERROR.SAME_REVIEWER, 'The original moderator cannot review this appeal.');
  }
  if (actor.role !== ROLES.SENIOR) throw appError(ERROR.FORBIDDEN, 'Only senior moderators resolve appeals.');
  if (appeal.assignedReviewerId && String(appeal.assignedReviewerId) !== String(actor.id)) {
    throw appError(ERROR.FORBIDDEN, 'This appeal is assigned to another senior moderator.');
  }
  await claimIfUnassigned(appeal, actor, requestId);
  return applyDecision({ appealId, input, actor, requestId, stage: DECISION_STAGE.APPEAL });
}
