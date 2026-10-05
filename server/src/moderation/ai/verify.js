import { ACTION, ACTION_ORDER, FINDING_SOURCE, LIMITS } from '../../constants.js';
import { locateQuote } from '../../utils/text.js';

function clauseByCode(policy) {
  return new Map(policy.clauses.map((clause) => [clause.code, clause]));
}

function verifyFinding(raw, { text, policy, clauses }) {
  const clause = clauses.get(raw.clause_code);
  const notes = [];
  const evidence = [];
  let unverified = 0;
  for (const { quote } of raw.evidence) {
    const at = locateQuote(text, quote);
    if (at)
      evidence.push({ quote: text.slice(at.start, at.end), start: at.start, end: at.end, verified: true });
    else {
      unverified += 1;
      notes.push(`Unverified quote (not found in the content): "${quote}"`);
    }
  }
  if (!clause) notes.push(`Invalid citation: ${raw.clause_code} is not in policy v${policy.version}.`);
  const confidence = unverified ? Math.min(raw.confidence, LIMITS.UNVERIFIED_CONFIDENCE_CAP) : raw.confidence;
  return {
    source: FINDING_SOURCE.AI,
    ruleId: null,
    clauseCode: raw.clause_code,
    policyVersion: policy.version,
    evidence,
    interpretation: raw.interpretation?.trim() || null,
    severity: raw.severity,
    severityReason: raw.severity_reason,
    confidence,
    confidenceReason: unverified
      ? `${raw.confidence_reason} (Capped at ${LIMITS.UNVERIFIED_CONFIDENCE_CAP}: quote not found in the content.)`
      : raw.confidence_reason,
    invalidCitation: !clause,
    notes,
    unverifiedCount: unverified,
  };
}

/** Lowers the action to the strongest one the cited clauses allow, never raising it. */
function allowedAction(proposed, findings, clauses) {
  if (proposed === ACTION.NONE) return { action: proposed, reason: null };
  const allowed = new Set(
    findings.flatMap((f) => (f.invalidCitation ? [] : (clauses.get(f.clauseCode)?.allowedActions ?? []))),
  );
  if (allowed.has(proposed)) return { action: proposed, reason: null };
  const ceiling = ACTION_ORDER.indexOf(proposed);
  const lowered =
    [...ACTION_ORDER]
      .slice(0, ceiling)
      .reverse()
      .find((a) => allowed.has(a)) ?? ACTION.NONE;
  const cited = [...new Set(findings.map((f) => f.clauseCode))].join(', ') || 'no clause';
  return {
    action: lowered,
    reason: `Proposed action "${proposed}" is not allowed by ${cited}; lowered to "${lowered}".`,
  };
}

/** Pure. Returns the verified findings, the possibly lowered action and what verification changed. */
export function verifyReview(output, { text, policy }) {
  const clauses = clauseByCode(policy);
  const checked = output.findings.map((raw) => verifyFinding(raw, { text, policy, clauses }));
  const kept = checked.filter((f) => f.evidence.length > 0 || f.interpretation);
  const findings = kept.map(({ unverifiedCount: _u, ...f }) => f);
  const { action, reason } = allowedAction(output.proposed_action, findings, clauses);
  return {
    findings,
    proposedAction: action,
    overallSeverity: output.overall_severity,
    overallConfidence: output.overall_confidence,
    aiNeedsHuman: output.needs_human_review,
    aiNeedsHumanReasons: output.needs_human_reasons,
    summary: output.summary,
    verification: {
      invalidCitations: findings.filter((f) => f.invalidCitation).map((f) => f.clauseCode),
      unverifiedQuotes: kept.reduce((sum, f) => sum + f.unverifiedCount, 0),
      droppedEmpty: checked.length - kept.length,
      actionLowered: reason ? { from: output.proposed_action, to: action, reason } : null,
    },
  };
}
