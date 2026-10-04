// Every enum in the app lives here. Never type a status or role as a raw string elsewhere.

export const ROLES = Object.freeze({
  AUTHOR: 'author',
  MEMBER: 'member',
  MODERATOR: 'moderator',
  SENIOR: 'senior_moderator',
  ADMIN: 'admin',
});
export const MODERATOR_ROLES = Object.freeze([ROLES.MODERATOR, ROLES.SENIOR]);

export const CONTENT_TYPE = Object.freeze({ POST: 'post', COMMENT: 'comment' });

export const VISIBILITY = Object.freeze({
  VISIBLE: 'visible',
  LABELED: 'labeled',
  LIMITED: 'limited',
  REMOVED: 'removed',
});

export const ACTION = Object.freeze({ NONE: 'none', LABEL: 'label', LIMIT: 'limit', REMOVE: 'remove' });
// Ordered weakest to strongest; used when an action must be lowered.
export const ACTION_ORDER = Object.freeze([ACTION.NONE, ACTION.LABEL, ACTION.LIMIT, ACTION.REMOVE]);
export const ACTION_TO_VISIBILITY = Object.freeze({
  [ACTION.NONE]: VISIBILITY.VISIBLE,
  [ACTION.LABEL]: VISIBILITY.LABELED,
  [ACTION.LIMIT]: VISIBILITY.LIMITED,
  [ACTION.REMOVE]: VISIBILITY.REMOVED,
});

export const SEVERITY = Object.freeze({ NONE: 'none', LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });
export const FINDING_SEVERITIES = Object.freeze([SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH]);

export const TRIGGER = Object.freeze({
  AUTO_SCAN: 'auto_scan',
  USER_REPORT: 'user_report',
  POLICY_REEVALUATION: 'policy_reevaluation',
});

export const CASE = Object.freeze({
  PENDING_ANALYSIS: 'pending_analysis',
  AWAITING_REVIEW: 'awaiting_review',
  AUTO_CLEARED: 'auto_cleared',
  RESOLVED: 'resolved',
  APPEAL_PENDING: 'appeal_pending',
  APPEAL_RESOLVED: 'appeal_resolved',
});
// "Unresolved" is what gets re-checked when the policy changes.
export const UNRESOLVED_STATUSES = Object.freeze([
  CASE.PENDING_ANALYSIS,
  CASE.AWAITING_REVIEW,
  CASE.APPEAL_PENDING,
]);

export const DECISION_STAGE = Object.freeze({ INITIAL: 'initial', APPEAL: 'appeal' });
export const DECISION_OUTCOME = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MODIFIED: 'modified',
});
export const APPEAL_OUTCOME = Object.freeze({
  UPHELD: 'upheld',
  OVERTURNED: 'overturned',
  MODIFIED: 'modified',
});

export const APPEAL_STATUS = Object.freeze({ PENDING: 'pending', RESOLVED: 'resolved' });

export const POLICY_STATUS = Object.freeze({ DRAFT: 'draft', ACTIVE: 'active', RETIRED: 'retired' });

export const FINDING_SOURCE = Object.freeze({ RULE: 'rule', AI: 'ai' });

export const AI_PURPOSE = Object.freeze({ CLASSIFY: 'classify', APPEAL_SUMMARY: 'appeal_summary' });
export const AI_RUN_STATUS = Object.freeze({
  OK: 'ok',
  INVALID_OUTPUT: 'invalid_output',
  ERROR: 'error',
  TIMEOUT: 'timeout',
});

export const REEVALUATION_STATUS = Object.freeze({ RUNNING: 'running', COMPLETED: 'completed' });

export const ACTOR_TYPE = Object.freeze({ USER: 'user', SYSTEM: 'system', AI: 'ai' });

export const REPORT_REASONS = Object.freeze([
  'harassment',
  'hate',
  'violence',
  'self_harm',
  'private_info',
  'spam',
  'impersonation',
  'other',
]);

export const AUDIT = Object.freeze({
  CONTENT_CREATED: 'content.created',
  REPORT_CREATED: 'report.created',
  CASE_OPENED: 'case.opened',
  ANALYSIS_COMPLETED: 'analysis.completed',
  ANALYSIS_FAILED: 'analysis.failed',
  CASE_AUTO_CLEARED: 'case.auto_cleared',
  CASE_REOPENED: 'case.reopened',
  DECISION_MADE: 'decision.made',
  VISIBILITY_CHANGED: 'content.visibility_changed',
  APPEAL_SUBMITTED: 'appeal.submitted',
  APPEAL_ASSIGNED: 'appeal.assigned',
  APPEAL_RESOLVED: 'appeal.resolved',
  POLICY_PUBLISHED: 'policy.published',
  REEVALUATION_STARTED: 'reevaluation.started',
  CASE_REEVALUATED: 'case.reevaluated',
  REEVALUATION_COMPLETED: 'reevaluation.completed',
  AUTH_LOGIN: 'auth.login',
  AUTH_DENIED: 'auth.denied',
});

export const ERROR = Object.freeze({
  VALIDATION_FAILED: { code: 'VALIDATION_FAILED', status: 400 },
  UNAUTHENTICATED: { code: 'UNAUTHENTICATED', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
  HUMAN_REQUIRED: { code: 'HUMAN_REQUIRED', status: 403 },
  SAME_REVIEWER: { code: 'SAME_REVIEWER', status: 403 },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
  INVALID_TRANSITION: { code: 'INVALID_TRANSITION', status: 409 },
  STALE_ANALYSIS: { code: 'STALE_ANALYSIS', status: 409 },
  ALREADY_APPEALED: { code: 'ALREADY_APPEALED', status: 409 },
  RATE_LIMITED: { code: 'RATE_LIMITED', status: 429 },
  INTERNAL: { code: 'INTERNAL', status: 500 },
});

export const LIMITS = Object.freeze({
  BODY_MAX: 5000,
  APPEAL_STATEMENT_MIN: 20,
  APPEAL_STATEMENT_MAX: 2000,
  RATIONALE_MIN: 10,
  REPEAT_WINDOW_MS: 10 * 60 * 1000,
  AUTO_CLEAR_MIN_CONFIDENCE: 0.85,
  NEEDS_HUMAN_CONFIDENCE: 0.7,
  UNVERIFIED_CONFIDENCE_CAP: 0.5,
  REEVALUATION_CONCURRENCY: 3,
});

export const PROMPT_VERSION = Object.freeze({ CLASSIFY: 'classify-v1', APPEAL_SUMMARY: 'appeal-summary-v1' });
