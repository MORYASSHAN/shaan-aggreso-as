import { describe, expect, it } from 'vitest';
import policyV1 from '../../policies/policy.v1.json' with { type: 'json' };
import { combine } from '../src/moderation/combine.js';
import { verifyReview } from '../src/moderation/ai/verify.js';

const TEXT = '@sam   you are a Worthless idiot';

function output(findings, proposed_action = 'label') {
  return {
    findings,
    proposed_action,
    overall_severity: 'medium',
    overall_confidence: 0.9,
    needs_human_review: false,
    needs_human_reasons: [],
    summary: 'test',
  };
}

function aiFinding(overrides) {
  return {
    clause_code: 'HAR-1',
    evidence: [{ quote: 'you are a worthless idiot' }],
    interpretation: null,
    severity: 'medium',
    severity_reason: 'r',
    confidence: 0.9,
    confidence_reason: 'r',
    ...overrides,
  };
}

describe('AI verification', () => {
  it('verifies real quotes (normalising whitespace and case) and returns their positions', () => {
    const review = verifyReview(output([aiFinding()]), { text: TEXT, policy: policyV1 });
    const [evidence] = review.findings[0].evidence;
    expect(evidence.verified).toBe(true);
    expect(TEXT.slice(evidence.start, evidence.end)).toBe('you are a Worthless idiot');
  });

  it('flags an unknown clause code and forces human review', () => {
    const review = verifyReview(output([aiFinding({ clause_code: 'XYZ-9' })]), {
      text: TEXT,
      policy: policyV1,
    });
    expect(review.findings[0].invalidCitation).toBe(true);
    const { recommendation } = combine({
      ruleFindings: [],
      ai: review,
      policy: policyV1,
      trigger: 'auto_scan',
      reportCount: 0,
    });
    expect(recommendation.needsHuman).toBe(true);
    expect(recommendation.needsHumanReasons.join(' ')).toMatch(/not in the policy/);
  });

  it('marks a quote that is not in the text as unverified and caps confidence at 0.5', () => {
    const review = verifyReview(
      output([
        aiFinding({ evidence: [{ quote: 'this is not in the post' }], interpretation: 'Seems hostile.' }),
      ]),
      { text: TEXT, policy: policyV1 },
    );
    const [finding] = review.findings;
    expect(finding.evidence).toHaveLength(0);
    expect(finding.confidence).toBe(0.5);
    expect(finding.notes[0]).toMatch(/Unverified quote/);
    expect(review.verification.unverifiedQuotes).toBe(1);
  });

  it('drops a finding with no verified quote and no interpretation', () => {
    const review = verifyReview(output([aiFinding({ evidence: [{ quote: 'nope' }] })]), {
      text: TEXT,
      policy: policyV1,
    });
    expect(review.findings).toHaveLength(0);
    expect(review.verification.droppedEmpty).toBe(1);
  });

  it('lowers an action the clause does not allow to the strongest allowed one', () => {
    const spam = aiFinding({ clause_code: 'SPAM-1', evidence: [{ quote: '@sam' }] });
    const review = verifyReview(output([spam], 'remove'), { text: TEXT, policy: policyV1 });
    expect(review.proposedAction).toBe('limit');
    expect(review.verification.actionLowered.reason).toMatch(/not allowed by SPAM-1/);
  });
});
