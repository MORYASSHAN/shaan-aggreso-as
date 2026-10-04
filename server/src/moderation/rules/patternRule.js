import { allMatches, ruleFinding } from './finding.js';

// Clause regex patterns from the active policy, matched case-insensitively.
export function patternRule(text, policy) {
  const findings = [];
  for (const clause of policy.clauses) {
    for (const source of clause.deterministic?.patterns ?? []) {
      const matches = allMatches(text, new RegExp(source, 'i'));
      if (matches.length === 0) continue;
      findings.push(ruleFinding({ ruleId: 'pattern', clause, policy, matches }));
    }
  }
  return findings;
}
