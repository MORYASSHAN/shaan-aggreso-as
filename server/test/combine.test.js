import { describe, expect, it } from 'vitest';
import policyV1 from '../../policies/policy.v1.json' with { type: 'json' };
import { combine } from '../src/moderation/combine.js';

function ai(overrides = {}) {
  return {
    findings: [],
    proposedAction: 'none',
    overallSeverity: 'none',
    overallConfidence: 0.95,
    aiNeedsHuman: false,
    aiNeedsHumanReasons: [],
    summary: 'ok',
    verification: { invalidCitations: [], unverifiedQuotes: 0, droppedEmpty: 0, actionLowered: null },
    ...overrides,
  };
}

const ruleHit = { source: 'rule', clauseCode: 'HAR-1', severity: 'medium', confidence: 1, evidence: [] };
const base = { policy: policyV1, trigger: 'auto_scan', reportCount: 0 };

describe('combine', () => {
  it('sets needsHuman with a reason when a rule hit is not confirmed by the AI', () => {
    const { recommendation, autoClear } = combine({ ...base, ruleFindings: [ruleHit], ai: ai() });
    expect(recommendation.needsHuman).toBe(true);
    expect(recommendation.needsHumanReasons.join(' ')).toMatch(/rule matched HAR-1; the AI did not confirm/);
    expect(autoClear).toBe(false);
  });

  it('auto-clears only with no findings, no reports and confidence of at least 0.85', () => {
    expect(combine({ ...base, ruleFindings: [], ai: ai() }).autoClear).toBe(true);
    expect(combine({ ...base, ruleFindings: [], ai: ai({ overallConfidence: 0.84 }) }).autoClear).toBe(false);
    expect(combine({ ...base, reportCount: 1, ruleFindings: [], ai: ai() }).autoClear).toBe(false);
    expect(combine({ ...base, trigger: 'user_report', ruleFindings: [], ai: ai() }).autoClear).toBe(false);
    expect(combine({ ...base, ruleFindings: [ruleHit], ai: ai() }).autoClear).toBe(false);
    expect(combine({ ...base, ruleFindings: [], ai: null }).autoClear).toBe(false);
  });

  it('forces needsHuman and top priority for an always-escalate clause', () => {
    const sh = { source: 'rule', clauseCode: 'SH-1', severity: 'high', confidence: 1, evidence: [] };
    const { recommendation, priority } = combine({ ...base, ruleFindings: [sh], ai: ai() });
    expect(recommendation.needsHuman).toBe(true);
    expect(priority).toBe(100);
  });

  it('any proposed action other than none goes to a human', () => {
    const finding = { source: 'ai', clauseCode: 'HAR-1', severity: 'low', confidence: 0.95, evidence: [] };
    const { recommendation } = combine({
      ...base,
      ruleFindings: [],
      ai: ai({ findings: [finding], proposedAction: 'label' }),
    });
    expect(recommendation.needsHuman).toBe(true);
  });
});
