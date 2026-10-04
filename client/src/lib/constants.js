// Mirrored from server/src/constants.js so the UI never types a status as a raw string.

export const ROLES = {
  AUTHOR: 'author',
  MEMBER: 'member',
  MODERATOR: 'moderator',
  SENIOR: 'senior_moderator',
  ADMIN: 'admin',
};
export const MODERATOR_ROLES = [ROLES.MODERATOR, ROLES.SENIOR];

export const ROLE_LABEL = {
  [ROLES.AUTHOR]: 'Author',
  [ROLES.MEMBER]: 'Member',
  [ROLES.MODERATOR]: 'Moderator',
  [ROLES.SENIOR]: 'Senior moderator',
  [ROLES.ADMIN]: 'Admin',
};

export const ACTIONS = ['none', 'label', 'limit', 'remove'];

export const CASE_STATUS = {
  PENDING_ANALYSIS: 'pending_analysis',
  AWAITING_REVIEW: 'awaiting_review',
  AUTO_CLEARED: 'auto_cleared',
  RESOLVED: 'resolved',
  APPEAL_PENDING: 'appeal_pending',
  APPEAL_RESOLVED: 'appeal_resolved',
};

export const TRIGGERS = ['auto_scan', 'user_report', 'policy_reevaluation'];

export const REPORT_REASONS = [
  ['harassment', 'Harassment'],
  ['hate', 'Hate speech'],
  ['violence', 'Violence or threats'],
  ['self_harm', 'Self-harm'],
  ['private_info', 'Private information'],
  ['spam', 'Spam'],
  ['impersonation', 'Impersonation'],
  ['other', 'Something else'],
];

export const AUDIT_ACTIONS = [
  'content.created',
  'report.created',
  'case.opened',
  'analysis.completed',
  'analysis.failed',
  'case.auto_cleared',
  'case.reopened',
  'decision.made',
  'content.visibility_changed',
  'appeal.submitted',
  'appeal.assigned',
  'appeal.resolved',
  'policy.published',
  'reevaluation.started',
  'case.reevaluated',
  'reevaluation.completed',
  'auth.login',
  'auth.denied',
];

export const LIMITS = { BODY_MAX: 5000, RATIONALE_MIN: 10, APPEAL_MIN: 20, APPEAL_MAX: 2000 };
