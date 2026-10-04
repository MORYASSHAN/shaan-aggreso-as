import { AUDIT, CASE, ERROR } from '../constants.js';
import { withTransaction } from '../db.js';
import { AiRun, Analysis, Appeal, Case, Content, Decision, Report } from '../models/index.js';
import { AI_UNAVAILABLE } from '../moderation/combine.js';
import { appError } from '../utils/AppError.js';
import { excerpt } from '../utils/text.js';
import { analyzeCase } from './analysisService.js';
import * as auditService from './auditService.js';
import * as policyService from './policyService.js';

const PRIORITY_BANDS = { high: { $gte: 70 }, medium: { $gte: 40, $lt: 70 }, low: { $lt: 40 } };

async function caseIdsForPolicyVersion(version) {
  return Analysis.find({ policyVersion: version, superseded: false }).distinct('caseId');
}

function toQueueRow(kase, content, analysis) {
  const rec = analysis?.recommendation;
  return {
    _id: kase._id,
    status: kase.status,
    trigger: kase.trigger,
    priority: kase.priority,
    reportCount: kase.reportCount,
    createdAt: kase.createdAt,
    policyChangedFrom: kase.policyChangedFrom,
    content: content && {
      _id: content._id,
      type: content.type,
      excerpt: excerpt(content.body),
      visibility: content.visibility,
    },
    policyVersion: analysis?.policyVersion ?? null,
    proposedAction: rec?.proposedAction ?? null,
    severity: rec?.severity ?? null,
    confidence: rec?.confidence ?? null,
    needsHumanReasons: rec?.needsHumanReasons ?? [],
    aiUnavailable: Boolean(rec?.needsHumanReasons?.some((r) => r.startsWith(AI_UNAVAILABLE))),
  };
}

/** The moderation queue: sorted by priority, then oldest first. */
export async function listQueue({ status, priority, trigger, policyVersion, page, limit }) {
  const filter = { status };
  if (priority) filter.priority = PRIORITY_BANDS[priority];
  if (trigger) filter.trigger = trigger;
  if (policyVersion) filter._id = { $in: await caseIdsForPolicyVersion(policyVersion) };
  const [cases, total] = await Promise.all([
    Case.find(filter)
      .sort({ priority: -1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Case.countDocuments(filter),
  ]);
  const [contents, analyses] = await Promise.all([
    Content.find({ _id: { $in: cases.map((c) => c.contentId) } }).lean(),
    Analysis.find({ _id: { $in: cases.map((c) => c.currentAnalysisId).filter(Boolean) } }).lean(),
  ]);
  const byId = (list) => new Map(list.map((x) => [String(x._id), x]));
  const contentById = byId(contents);
  const analysisById = byId(analyses);
  const items = cases.map((k) =>
    toQueueRow(k, contentById.get(String(k.contentId)), analysisById.get(String(k.currentAnalysisId))),
  );
  return { items, total, page, limit };
}

/** Case detail: content, context, the current analysis and older analyses. */
export async function getCase(caseId) {
  const kase = await Case.findById(caseId).lean();
  if (!kase) throw appError(ERROR.NOT_FOUND, 'Case not found.');
  const content = await Content.findById(kase.contentId).populate('authorId', 'name role').lean();
  const [parent, reports, analyses, decisions, appeals] = await Promise.all([
    content.postId ? Content.findById(content.postId).populate('authorId', 'name').lean() : null,
    Report.find({ contentId: content._id }).sort({ createdAt: 1 }).populate('reporterId', 'name').lean(),
    Analysis.find({ caseId }).sort({ createdAt: -1 }).lean(),
    Decision.find({ caseId }).sort({ createdAt: 1 }).populate('reviewerId', 'name role').lean(),
    Appeal.find({ caseId }).lean(),
  ]);
  const current = analyses.find((a) => String(a._id) === String(kase.currentAnalysisId)) ?? null;
  const [aiRun, policy] = await Promise.all([
    current?.aiRunId ? AiRun.findById(current.aiRunId).lean() : null,
    current ? policyService.getVersion(current.policyVersion) : null,
  ]);
  return {
    case: kase,
    content,
    parent,
    reports,
    analysis: current,
    aiRun,
    aiUnavailable: Boolean(aiRun && aiRun.status !== 'ok'),
    pastAnalyses: analyses.filter((a) => a !== current),
    decisions,
    appeals,
    policy: policy && { version: policy.version, clauses: policy.clauses },
  };
}

export async function reanalyze(caseId, { requestId }) {
  const analysis = await analyzeCase(caseId, { requestId });
  return analysis.toObject();
}

/** auto_cleared → awaiting_review, by a moderator. */
export async function reopen(caseId, { actor, requestId }) {
  return withTransaction(async (session) => {
    const kase = await Case.findOneAndUpdate(
      { _id: caseId, status: CASE.AUTO_CLEARED },
      { $set: { status: CASE.AWAITING_REVIEW } },
      { new: true, session },
    );
    if (!kase) {
      const exists = await Case.findById(caseId).session(session).lean();
      if (!exists) throw appError(ERROR.NOT_FOUND, 'Case not found.');
      throw appError(
        ERROR.INVALID_TRANSITION,
        `Only auto-cleared cases can be reopened; this one is ${exists.status}.`,
      );
    }
    await auditService.record(
      {
        actor,
        action: AUDIT.CASE_REOPENED,
        entity: { type: 'case', id: kase._id },
        before: { status: CASE.AUTO_CLEARED },
        after: { status: CASE.AWAITING_REVIEW },
        requestId,
      },
      session,
    );
    return kase.toObject();
  });
}
