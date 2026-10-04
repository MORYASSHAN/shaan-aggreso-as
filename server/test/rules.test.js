import { describe, expect, it } from 'vitest';
import policyV1 from '../../policies/policy.v1.json' with { type: 'json' };
import policyV2 from '../../policies/policy.v2.json' with { type: 'json' };
import { contactRule } from '../src/moderation/rules/contactRule.js';
import { keywordRule } from '../src/moderation/rules/keywordRule.js';
import { linkCountRule } from '../src/moderation/rules/linkCountRule.js';
import { patternRule } from '../src/moderation/rules/patternRule.js';
import { repeatRule } from '../src/moderation/rules/repeatRule.js';

function expectPositions(text, finding) {
  for (const e of finding.evidence) expect(text.slice(e.start, e.end)).toBe(e.quote);
}

describe('deterministic rules', () => {
  it('keyword rule finds the clause and exact character positions', () => {
    const text = '@sam you are a Worthless Idiot';
    const [finding] = keywordRule(text, policyV1);
    expect(finding).toMatchObject({ clauseCode: 'HAR-1', source: 'rule', confidence: 1 });
    expect(finding.evidence[0]).toMatchObject({
      quote: 'Worthless Idiot',
      start: 15,
      end: 30,
      verified: true,
    });
  });

  it('pattern rule matches regex patterns from the policy', () => {
    const text = 'Watch out. I will hurt you.';
    const [finding] = patternRule(text, policyV1);
    expect(finding.clauseCode).toBe('VIO-1');
    expectPositions(text, finding);
  });

  it('link count uses the SPAM-1 threshold of the policy version', () => {
    const text = 'See https://a.example and https://b.example';
    expect(linkCountRule(text, policyV1)).toHaveLength(0);
    const [finding] = linkCountRule(text, policyV2);
    expect(finding.clauseCode).toBe('SPAM-1');
    expect(finding.evidence).toHaveLength(2);
    expectPositions(text, finding);
  });

  it('contact rule finds emails and phone numbers as PII-1', () => {
    const text = 'Email jordan.lee@example.com or call 555-123-4567.';
    const [finding] = contactRule(text, policyV1);
    expect(finding.clauseCode).toBe('PII-1');
    expect(finding.evidence.map((e) => e.quote)).toEqual(['jordan.lee@example.com', '555-123-4567']);
    expectPositions(text, finding);
  });

  it('repeat rule flags near-identical text from the same author', () => {
    const text = 'Buy my course today, link in bio!';
    expect(
      repeatRule(text, policyV1, { recentTexts: ['buy my course today,  link in bio!'] })[0].clauseCode,
    ).toBe('SPAM-1');
    expect(repeatRule(text, policyV1, { recentTexts: ['Lovely weather today'] })).toHaveLength(0);
  });
});
