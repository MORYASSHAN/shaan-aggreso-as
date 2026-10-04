import { FINDING_SOURCE } from '../../constants.js';

/** Every rule returns findings of this shape. A rule hit is confirmed evidence: the text is really there. */
export function ruleFinding({ ruleId, clause, policy, matches, severityReason }) {
  return {
    source: FINDING_SOURCE.RULE,
    ruleId,
    clauseCode: clause.code,
    policyVersion: policy.version,
    evidence: matches.map(({ quote, start }) => ({
      quote,
      start,
      end: start + quote.length,
      verified: true,
    })),
    interpretation: null,
    severity: clause.defaultSeverity,
    severityReason: severityReason ?? `Default severity for ${clause.code}.`,
    confidence: 1,
    confidenceReason: 'Deterministic rule match.',
  };
}

export function findClause(policy, code) {
  return policy.clauses.find((clause) => clause.code === code) ?? null;
}

export function allMatches(text, regex) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const global = new RegExp(regex.source, flags);
  return [...text.matchAll(global)].map((m) => ({ quote: m[0], start: m.index }));
}
