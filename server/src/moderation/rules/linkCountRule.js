import { allMatches, findClause, ruleFinding } from './finding.js';

const LINK_RE = /\bhttps?:\/\/[^\s<>"')]+|\bwww\.[^\s<>"')]+/i;

// The threshold comes from SPAM-1 in the policy version, so a new version can tighten it.
export function linkCountRule(text, policy) {
  const clause = findClause(policy, 'SPAM-1');
  const threshold = clause?.deterministic?.linkThreshold;
  if (!clause || !threshold) return [];
  const links = allMatches(text, LINK_RE);
  if (links.length < threshold) return [];
  return [
    ruleFinding({
      ruleId: 'link_count',
      clause,
      policy,
      matches: links,
      severityReason: `${links.length} links; policy v${policy.version} allows fewer than ${threshold}.`,
    }),
  ];
}
