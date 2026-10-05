import { ruleFinding } from './finding.js';

// Findings carry the exact match and its character positions.
export function keywordRule(text, policy) {
  const findings = [];
  const lower = text.toLowerCase();
  for (const clause of policy.clauses) {
    for (const word of clause.deterministic?.keywords ?? []) {
      const start = lower.indexOf(word.toLowerCase());
      if (start === -1) continue;
      const quote = text.slice(start, start + word.length);
      findings.push(ruleFinding({ ruleId: 'keyword', clause, policy, matches: [{ quote, start }] }));
    }
  }
  return findings;
}
