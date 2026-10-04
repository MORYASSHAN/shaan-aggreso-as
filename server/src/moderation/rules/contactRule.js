import { allMatches, findClause, ruleFinding } from './finding.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// At least 9 digits with common separators, e.g. 555-123-4567 or +44 20 7946 0958.
const PHONE_RE = /(?<![\w])\+?\d(?:[\s().-]?\d){8,14}(?![\w])/;

// Contact details map to PII-1. The quote is masked wherever it is logged.
export function contactRule(text, policy) {
  const clause = findClause(policy, 'PII-1');
  if (!clause) return [];
  const matches = [...allMatches(text, EMAIL_RE), ...allMatches(text, PHONE_RE)].sort(
    (a, b) => a.start - b.start,
  );
  if (matches.length === 0) return [];
  return [ruleFinding({ ruleId: 'contact_details', clause, policy, matches })];
}
