import { ROLES } from './constants.js';

// The nav changes with the user's role. Every role can read the feed and the policy.
const LINKS = {
  feed: { to: '/', label: 'Feed' },
  mine: { to: '/me', label: 'My content' },
  queue: { to: '/queue', label: 'Queue' },
  appeals: { to: '/appeals', label: 'Appeals' },
  policy: { to: '/policy', label: 'Policy' },
  audit: { to: '/audit', label: 'Audit' },
};

const BY_ROLE = {
  [ROLES.AUTHOR]: ['feed', 'mine', 'policy'],
  [ROLES.MEMBER]: ['feed', 'policy'],
  [ROLES.MODERATOR]: ['queue', 'feed', 'policy', 'audit'],
  [ROLES.SENIOR]: ['queue', 'appeals', 'feed', 'policy', 'audit'],
  [ROLES.ADMIN]: ['policy', 'appeals', 'feed'],
};

export function linksFor(role) {
  return (BY_ROLE[role] ?? ['feed']).map((key) => LINKS[key]);
}

export function homeFor(role) {
  return linksFor(role)[0].to;
}
