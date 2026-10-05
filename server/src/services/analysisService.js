import { ACTOR_TYPE, AUDIT, CASE, ERROR, LIMITS, UNRESOLVED_STATUSES } from '../constants.js';
import { withTransaction } from '../db.js';
import { Analysis, Case, Content, Decision, Report } from '../models/index.js';
import { reviewContent } from '../moderation/ai/reviewer.js';
import { combine } from '../moderation/combine.js';
import { runRules } from '../moderation/rules/index.js';
import { appError } from '../utils/AppError.js';
import * as auditService from './auditService.js';
import * as policyService from './policyService.js';

const SYSTEM = { type: ACTOR_TYPE.SYSTEM };

async function authorHistory(authorId, excludeContentId) {
  const contentIds = await Content.find({ authorId, _id: { $ne: excludeContentId } }).distinct('_id');
  const caseIds = await Case.find({ contentId: { $in: contentIds } }).distinct('_id');
  return Decision.find({ caseId: { $in: caseIds } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
}

async function recentTexts(content) {
  const since = new Date(content.createdAt.getTime() - LIMITS.REPEAT_WINDOW_MS);
  const recent = await Content.find({
    authorId: content.authorId,
    _id: { $ne: content._id },
    createdAt: { $gte: since, $lte: content.createdAt },
  })
    .select('body')
    .lean();
  return recent.map((c) => c.body);
}

async function loadInputs(kase) {
  const content = await Content.findById(kase.contentId).lean();
  const [parent, reports, history, recent, policy] = await Promise.all([
    content.postId ? Content.findById(content.postId).lean() : null,
    Report.find({ caseId: kase._id }).lean(),
    authorHistory(content.authorId, content._id),
    recentTexts(content),
    policyService.getActive(),
  ]);
  return { content, parent, reports, history, recent, policy };
}

// pending_analysis → auto_cleared or awaiting_review. Other unresolved statuses keep their status.
function nextStatus(current, autoClear) {
  if (current !== CASE.PENDING_ANALYSIS) return current;
  return autoClear ? CASE.AUTO_CLEARED : CASE.AWAITING_REVIEW;
}

async function saveAnalysis({ kase, policy, ruleFindings, ai, combined, fromVersion, requestId }) {
  return withTransaction(async (session) => {
    const [analysis] = await Analysis.create(
      [
        {
          caseId: kase._id,
          policyVersion: policy.version,
          ruleFindings,
          aiFindings: combined.aiFindings,
          recommendation: combined.recommendation,
          aiRunId: ai.aiRunId,
        },
      ],
      { session },
    );
    await Analysis.updateMany(
      { caseId: kase._id, _id: { $ne: analysis._id }, superseded: false },
      { $set: { superseded: true } },
      { session },
    );
    const status = nextStatus(kase.status, combined.autoClear);
    const policyChanged = fromVersion != null && fromVersion !== policy.version;
    // Filter on the status we loaded, so a decision made while the AI was running is never overwritten.
    const updated = await Case.findOneAndUpdate(
      { _id: kase._id, status: kase.status },
      {
        $set: {
          status,
          currentAnalysisId: analysis._id,
          priority: combined.priority,
          ...(policyChanged && { policyChangedFrom: fromVersion }),
        },
      },
      { new: true, session },
    );
    if (!updated) throw appError(ERROR.INVALID_TRANSITION, 'The case changed while it was being analysed.');
    const entity = { type: 'case', id: kase._id };
    const base = { actor: SYSTEM, entity, policyVersion: policy.version, requestId };
    await auditService.record(
      {
        ...base,
        action: ai.ok ? AUDIT.ANALYSIS_COMPLETED : AUDIT.ANALYSIS_FAILED,
        after: {
          analysisId: analysis._id,
          aiRunId: ai.aiRunId,
          aiStatus: ai.ok ? 'ok' : ai.status,
          proposedAction: combined.recommendation.proposedAction,
          needsHuman: combined.recommendation.needsHuman,
        },
      },
      session,
    );
    if (status === CASE.AUTO_CLEARED) {
      await auditService.record(
        { ...base, action: AUDIT.CASE_AUTO_CLEARED, before: { status: kase.status }, after: { status } },
        session,
      );
    }
    if (policyChanged) {
      await auditService.record(
        {
          ...base,
          action: AUDIT.CASE_REEVALUATED,
          before: { policyVersion: fromVersion },
          after: { policyVersion: policy.version, analysisId: analysis._id },
        },
        session,
      );
    }
    return analysis;
  });
}

// Never changes content; only a human decision does that.
export async function analyzeCase(caseId, { fromVersion = null, requestId = null } = {}) {
  const kase = await Case.findById(caseId).lean();
  if (!kase) throw appError(ERROR.NOT_FOUND, 'Case not found.');
  if (!UNRESOLVED_STATUSES.includes(kase.status)) {
    throw appError(ERROR.INVALID_TRANSITION, `A ${kase.status} case cannot be re-analysed.`);
  }
  const { content, parent, reports, history, recent, policy } = await loadInputs(kase);
  const ruleFindings = runRules(content.body, policy, { recentTexts: recent });
  const ai = await reviewContent({ policy, content, parent, reports, ruleFindings, history, requestId });
  const combined = combine({
    ruleFindings,
    ai: ai.ok ? ai.review : null,
    policy,
    trigger: kase.trigger,
    reportCount: kase.reportCount,
  });
  return saveAnalysis({ kase, policy, ruleFindings, ai, combined, fromVersion, requestId });
}
