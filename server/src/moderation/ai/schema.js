import { z } from 'zod';

// Zod mirror of the submit_review tool's input schema. The AI's output is never trusted until it passes this.
const Finding = z.object({
  clause_code: z.string(),
  evidence: z.array(z.object({ quote: z.string().min(1) })),
  interpretation: z.string().nullable(),
  severity: z.enum(['low', 'medium', 'high']),
  severity_reason: z.string(),
  confidence: z.number().min(0).max(1),
  confidence_reason: z.string(),
});

export const ReviewOutput = z.object({
  findings: z.array(Finding),
  proposed_action: z.enum(['none', 'label', 'limit', 'remove']),
  overall_severity: z.enum(['none', 'low', 'medium', 'high']),
  overall_confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
  needs_human_reasons: z.array(z.string()),
  summary: z.string().max(600),
});

export const AppealSummaryOutput = z.object({
  summary: z.string().max(800),
  new_points: z.array(z.string()),
  policy_changed: z.boolean(),
});

// JSON Schema sent to Claude as the tool's input_schema. Keep in sync with ReviewOutput above.
export const SUBMIT_REVIEW_TOOL = {
  name: 'submit_review',
  description: 'Submit your assessment of the content against the policy. Call this exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            clause_code: {
              type: 'string',
              description: 'Exactly one clause code from the policy, e.g. HAR-1.',
            },
            evidence: {
              type: 'array',
              description: 'Exact quotes copied character-for-character from the content.',
              items: {
                type: 'object',
                properties: { quote: { type: 'string', minLength: 1 } },
                required: ['quote'],
              },
            },
            interpretation: {
              type: ['string', 'null'],
              description:
                'Your reading of intent, context, tone or sarcasm, clearly marked as interpretation.',
            },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            severity_reason: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            confidence_reason: { type: 'string' },
          },
          required: [
            'clause_code',
            'evidence',
            'interpretation',
            'severity',
            'severity_reason',
            'confidence',
            'confidence_reason',
          ],
        },
      },
      proposed_action: { type: 'string', enum: ['none', 'label', 'limit', 'remove'] },
      overall_severity: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
      overall_confidence: { type: 'number', minimum: 0, maximum: 1 },
      needs_human_review: { type: 'boolean' },
      needs_human_reasons: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string', maxLength: 600 },
    },
    required: [
      'findings',
      'proposed_action',
      'overall_severity',
      'overall_confidence',
      'needs_human_review',
      'needs_human_reasons',
      'summary',
    ],
  },
};

export const SUBMIT_APPEAL_SUMMARY_TOOL = {
  name: 'submit_appeal_summary',
  description: 'Submit a neutral summary of the appeal. Do not recommend an outcome.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', maxLength: 800, description: 'Neutral summary of the appeal.' },
      new_points: {
        type: 'array',
        items: { type: 'string' },
        description: 'Points the author raises that the original decision did not address.',
      },
      policy_changed: {
        type: 'boolean',
        description: 'Whether the policy version changed since the decision.',
      },
    },
    required: ['summary', 'new_points', 'policy_changed'],
  },
};
