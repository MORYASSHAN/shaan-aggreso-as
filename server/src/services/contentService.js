import { config } from '../config.js';
import {
  ACTION,
  AUDIT,
  CASE,
  CONTENT_TYPE,
  DECISION_STAGE,
  ERROR,
  MODERATOR_ROLES,
  TRIGGER,
  VISIBILITY,
} from '../constants.js';
import { withTransaction } from '../db.js';
import { Analysis, Appeal, Case, Content, Decision, Report } from '../models/index.js';
import { appError } from '../utils/AppError.js';
import { analyzeCase } from './analysisService.js';
import * as auditService from './auditService.js';
import { enqueue } from './jobQueue.js';

const REPORT_PRIORITY_BUMP = 10;
// A report joins a case that has not been decided yet; otherwise it opens a new one.
const JOINABLE_STATUSES = [CASE.PENDING_ANALYSIS, CASE.AWAITING_REVIEW];

export function isModerator(viewer) {
  return MODERATOR_ROLES.includes(viewer?.role);
}

function visibleFilter(viewer) {
  return isModerator(viewer) ? {} : { visibility: { $ne: VISIBILITY.REMOVED } };
}

function scheduleAnalysis(caseId, requestId) {
  enqueue('analyze', () => analyzeCase(caseId, { requestId }), { requestId });
}

async function openCase({ contentId, trigger, reportCount, actor, requestId }, session) {
  const [kase] = await Case.create(
    [{ contentId, trigger, status: CASE.PENDING_ANALYSIS, priority: 0, reportCount }],
    { session },
  );
  await auditService.record(
    { actor, action: AUDIT.CASE_OPENED, entity: { type: 'case', id: kase._id }, after: kase, requestId },
    session,
  );
  return kase;
}

/** Saves a post or comment, opens an auto_scan case and starts analysis in the background. */
export async function createContent({ type, body, postId = null, actor, requestId }) {
  if (type === CONTENT_TYPE.COMMENT) {
    const post = await Content.findOne({
      _id: postId,
      type: CONTENT_TYPE.POST,
      ...visibleFilter(actor),
    }).lean();
    if (!post) throw appError(ERROR.NOT_FOUND, 'Post not found.');
  }
  const { content, kase } = await withTransaction(async (session) => {
    const [created] = await Content.create([{ type, body, postId, authorId: actor.id }], { session });
    await auditService.record(
      {
        actor,
        action: AUDIT.CONTENT_CREATED,
        entity: { type: 'content', id: created._id },
        after: created,
        requestId,
      },
      session,
    );
    const opened = await openCase(
      { contentId: created._id, trigger: TRIGGER.AUTO_SCAN, reportCount: 0, actor, requestId },
      session,
    );
    return { content: created, kase: opened };
  });
  scheduleAnalysis(kase._id, requestId);
  return { ...content.toObject(), caseId: kase._id };
}

async function withAuthors(query) {
  return query.populate('authorId', 'name role').lean();
}

export async function listFeed({ viewer, page, limit }) {
  const filter = { type: CONTENT_TYPE.POST, ...visibleFilter(viewer) };
  const [posts, total] = await Promise.all([
    withAuthors(
      Content.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ),
    Content.countDocuments(filter),
  ]);
  const comments = await withAuthors(
    Content.find({ postId: { $in: posts.map((p) => p._id) }, ...visibleFilter(viewer) }).sort({
      createdAt: 1,
    }),
  );
  const items = posts.map((post) => ({
    ...post,
    comments: comments.filter((c) => String(c.postId) === String(post._id)),
  }));
  return { items, total, page, limit };
}

export async function getPost(postId, viewer) {
  const post = await withAuthors(
    Content.findOne({ _id: postId, type: CONTENT_TYPE.POST, ...visibleFilter(viewer) }),
  );
  if (!post) throw appError(ERROR.NOT_FOUND, 'Post not found.');
  const comments = await withAuthors(
    Content.find({ postId, ...visibleFilter(viewer) }).sort({ createdAt: 1 }),
  );
  return { ...post, comments };
}

function addReport({ contentId, actor, reasonCode, note, requestId }) {
  return withTransaction(async (session) => {
    // Join the open case for this content, raising its report count and priority.
    let kase = await Case.findOneAndUpdate(
      { contentId, status: { $in: JOINABLE_STATUSES } },
      [
        {
          $set: {
            reportCount: { $add: ['$reportCount', 1] },
            priority: { $min: [100, { $add: ['$priority', REPORT_PRIORITY_BUMP] }] },
          },
        },
      ],
      { new: true, session, sort: { createdAt: -1 } },
    );
    const joined = Boolean(kase);
    if (!kase) {
      kase = await openCase(
        { contentId, trigger: TRIGGER.USER_REPORT, reportCount: 1, actor, requestId },
        session,
      );
    }
    const [report] = await Report.create(
      [{ contentId, reporterId: actor.id, reasonCode, note, caseId: kase._id }],
      {
        session,
      },
    );
    await auditService.record(
      {
        actor,
        action: AUDIT.REPORT_CREATED,
        entity: { type: 'report', id: report._id },
        after: report,
        requestId,
      },
      session,
    );
    return { report, kase, joined };
  });
}

/** One report per user per content. Joins the open case or opens a user_report case. */
export async function reportContent({ contentId, reasonCode, note, actor, requestId }) {
  const content = await Content.findOne({ _id: contentId, ...visibleFilter(actor) }).lean();
  if (!content) throw appError(ERROR.NOT_FOUND, 'Content not found.');
  if (await Report.exists({ contentId, reporterId: actor.id })) {
    throw appError(ERROR.VALIDATION_FAILED, 'You have already reported this content.');
  }
  let result;
  try {
    result = await addReport({ contentId, actor, reasonCode, note, requestId });
  } catch (err) {
    if (err?.code === 11000)
      throw appError(ERROR.VALIDATION_FAILED, 'You have already reported this content.');
    throw err;
  }
  if (!result.joined) scheduleAnalysis(result.kase._id, requestId);
  return { report: result.report.toObject(), caseId: result.kase._id, joinedExistingCase: result.joined };
}

function appealDeadline(decision) {
  return new Date(decision.createdAt.getTime() + config.APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function canAppeal(decision, kase, appeal) {
  return (
    decision.stage === DECISION_STAGE.INITIAL &&
    decision.finalAction !== ACTION.NONE &&
    kase.status === CASE.RESOLVED &&
    !appeal &&
    appealDeadline(decision) > new Date()
  );
}

/** The author's own content with case status, decisions and whether each decision can be appealed. */
export async function listMyContent(actor) {
  const contents = await Content.find({ authorId: actor.id }).sort({ createdAt: -1 }).lean();
  const cases = await Case.find({ contentId: { $in: contents.map((c) => c._id) } })
    .sort({ createdAt: 1 })
    .lean();
  const caseIds = cases.map((c) => c._id);
  const [decisions, appeals] = await Promise.all([
    Decision.find({ caseId: { $in: caseIds } })
      .sort({ createdAt: 1 })
      .lean(),
    Appeal.find({ caseId: { $in: caseIds } }).lean(),
  ]);
  return contents.map((content) => ({
    ...content,
    cases: cases
      .filter((k) => String(k.contentId) === String(content._id))
      .map((kase) => ({
        _id: kase._id,
        status: kase.status,
        trigger: kase.trigger,
        createdAt: kase.createdAt,
        decisions: decisions
          .filter((d) => String(d.caseId) === String(kase._id))
          .map((decision) => {
            const appeal = appeals.find((a) => String(a.decisionId) === String(decision._id)) ?? null;
            return {
              ...decision,
              appeal: appeal && { _id: appeal._id, status: appeal.status, createdAt: appeal.createdAt },
              canAppeal: canAppeal(decision, kase, appeal),
              appealDeadline: appealDeadline(decision),
            };
          }),
      })),
  }));
}

/** Moderation history of one item: cases, analyses, decisions, appeals and the audit timeline. */
export async function getHistory(contentId, viewer) {
  const content = await Content.findById(contentId).lean();
  if (!content) throw appError(ERROR.NOT_FOUND, 'Content not found.');
  const moderator = isModerator(viewer);
  if (!moderator && String(content.authorId) !== viewer.id) {
    throw appError(ERROR.FORBIDDEN, 'You can only see the history of your own content.');
  }
  const cases = await Case.find({ contentId }).sort({ createdAt: 1 }).lean();
  const caseIds = cases.map((c) => c._id);
  const [analyses, decisions, appeals, reports] = await Promise.all([
    Analysis.find({ caseId: { $in: caseIds } })
      .sort({ createdAt: 1 })
      .lean(),
    Decision.find({ caseId: { $in: caseIds } })
      .sort({ createdAt: 1 })
      .populate('reviewerId', 'name role')
      .lean(),
    Appeal.find({ caseId: { $in: caseIds } }).lean(),
    Report.find({ contentId }).lean(),
  ]);
  const entityIds = [contentId, ...caseIds, ...[...decisions, ...appeals, ...reports].map((x) => x._id)];
  let audit = await auditService.listForEntities(entityIds);
  // Authors see that their content was reported, never who reported it.
  if (!moderator) {
    audit = audit.map((e) =>
      e.action === AUDIT.REPORT_CREATED ? { ...e, actor: { type: e.actor.type }, after: null } : e,
    );
  }
  return {
    content,
    cases,
    analyses: moderator
      ? analyses
      : analyses.map(({ _id, caseId, policyVersion, createdAt }) => ({
          _id,
          caseId,
          policyVersion,
          createdAt,
        })),
    decisions,
    appeals,
    audit,
  };
}
