import { normalize } from '../../utils/text.js';
import { findClause, ruleFinding } from './finding.js';

const SIMILARITY = 0.9;

function wordSet(text) {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

function similarity(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / new Set([...left, ...right]).size;
}

// The caller passes the author's recent texts so this rule stays pure.
export function repeatRule(text, policy, { recentTexts = [] } = {}) {
  const clause = findClause(policy, 'SPAM-1');
  if (!clause || !text.trim()) return [];
  const repeats = recentTexts.filter((other) => similarity(text, other) >= SIMILARITY);
  if (repeats.length === 0) return [];
  return [
    ruleFinding({
      ruleId: 'repeat_posting',
      clause,
      policy,
      matches: [{ quote: text, start: 0 }],
      severityReason: `Near-identical text posted ${repeats.length + 1} times in 10 minutes.`,
    }),
  ];
}
