import { ACTION, LIMITS, SEVERITY, TRIGGER } from '../constants.js';
import { escalatingClauses } from './rules/index.js';

const SEVERITY_RANK = { [SEVERITY.NONE]: 0, [SEVERITY.LOW]: 1, [SEVERITY.MEDIUM]: 2, [SEVERITY.HIGH]: 3 };
const PRIORITY_BASE = { [SEVERITY.NONE]: 10, [SEVERITY.LOW]: 25, [SEVERITY.MEDIUM]: 50, [SEVERITY.HIGH]: 75 };
export const AI_UNAVAILABLE = 'AI review unavailable';

function maxSeverity(values) {
  return values.reduce((best, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[best] ? s : best), SEVERITY.NONE);
}

function codes(findings) {
  return new Set(findings.filter((f) => !f.invalidCitation).map((f) => f.clauseCode));
}

function disagreementReasons(ruleFindings, aiFindings) {
  const ruleCodes = codes(ruleFindings);
  const aiCodes = codes(aiFindings);
  const reasons = [];
  for (const code of ruleCodes) {
    if (!aiCodes.has(code))
      reasons.push(`Rules and AI disagree: a rule matched ${code}; the AI did not confirm it.`);
  }
  for (const code of aiCodes) {
    if (!ruleCodes.has(code))
      reasons.push(`Rules and AI disagree: the AI cited ${code}; no rule matched it.`);
  }
  return reasons;
}

/** The server decides when a human is required; the AI's own flag is only one of the inputs. */
function needsHumanReasons({ ai, ruleFindings, allFindings, escalating, isReported }) {
  const reasons = [];
  if (!ai) return [`${AI_UNAVAILABLE}.`, ...(isReported ? ['The case came from a user report.'] : [])];
  if (ai.proposedAction !== ACTION.NONE) reasons.push(`Proposed action is "${ai.proposedAction}".`);
  if (ai.aiNeedsHuman) {
    const own = ai.aiNeedsHumanReasons.map((r) => `AI: ${r}`);
    reasons.push(...(own.length ? own : ['The AI asked for human review.']));
  }
  if (ai.overallConfidence < LIMITS.NEEDS_HUMAN_CONFIDENCE) {
    reasons.push(`Confidence ${Math.round(ai.overallConfidence * 100)}% is below 70%.`);
  }
  if (allFindings.some((f) => f.severity === SEVERITY.HIGH)) reasons.push('A finding has high severity.');
  const escalated = [...new Set(allFindings.map((f) => f.clauseCode).filter((c) => escalating.has(c)))];
  if (escalated.length) reasons.push(`Always-escalate clause: ${escalated.join(', ')}.`);
  reasons.push(...disagreementReasons(ruleFindings, ai.findings));
  if (ai.findings.some((f) => f.invalidCitation))
    reasons.push('The AI cited a clause that is not in the policy.');
  if (ai.verification.unverifiedQuotes > 0) reasons.push('The AI quoted text that is not in the content.');
  if (isReported) reasons.push('The case came from a user report.');
  return reasons;
}

function priorityFor({ severity, reportCount, needsHuman, escalated }) {
  if (escalated) return 100;
  return Math.min(99, PRIORITY_BASE[severity] + Math.min(reportCount * 10, 20) + (needsHuman ? 5 : 0));
}

/** Pure. `ai` is the verified review, or null when the AI call failed. Nothing reads the result to change content. */
export function combine({ ruleFindings, ai, policy, trigger, reportCount }) {
  const aiFindings = ai?.findings ?? [];
  const allFindings = [...ruleFindings, ...aiFindings];
  const escalating = escalatingClauses(policy);
  const isReported = trigger === TRIGGER.USER_REPORT || reportCount > 0;
  const reasons = needsHumanReasons({ ai, ruleFindings, allFindings, escalating, isReported });
  const severity = maxSeverity([ai?.overallSeverity ?? SEVERITY.NONE, ...allFindings.map((f) => f.severity)]);
  const confidence = ai ? ai.overallConfidence : 0;
  const needsHuman = reasons.length > 0;
  const escalated = allFindings.some((f) => escalating.has(f.clauseCode));
  const autoClear =
    Boolean(ai) &&
    !needsHuman &&
    allFindings.length === 0 &&
    !isReported &&
    confidence >= LIMITS.AUTO_CLEAR_MIN_CONFIDENCE;
  return {
    aiFindings,
    recommendation: {
      proposedAction: ai?.proposedAction ?? ACTION.NONE,
      severity,
      confidence,
      needsHuman,
      needsHumanReasons: reasons,
      summary: ai?.summary ?? `${AI_UNAVAILABLE}. Showing rule findings only.`,
    },
    autoClear,
    priority: priorityFor({ severity, reportCount, needsHuman, escalated }),
  };
}

/** Clause codes the recommendation cites: the AI's valid citations, else the rule matches. */
export function recommendedClauses(analysis) {
  const fromAi = [...codes(analysis.aiFindings)];
  return fromAi.length ? fromAi : [...codes(analysis.ruleFindings)];
}
