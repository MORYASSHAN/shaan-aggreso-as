import { z } from 'zod';
import { ACTIONS, LIMITS } from '../../lib/constants.js';

// Mirrors the server's DecisionBody schema.
export const DecisionFormSchema = z
  .object({
    outcome: z.enum(['approved', 'rejected', 'modified']),
    finalAction: z.enum(ACTIONS).optional(),
    clauseCodes: z.array(z.string()),
    rationale: z.string().trim().max(2000),
  })
  .superRefine((form, ctx) => {
    if (form.outcome !== 'modified') return;
    if (!form.finalAction)
      ctx.addIssue({ code: 'custom', path: ['finalAction'], message: 'Choose the action to take' });
    if (form.finalAction && form.finalAction !== 'none' && form.clauseCodes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['clauseCodes'],
        message: 'Choose at least one clause for this action',
      });
    }
    if (form.rationale.length < LIMITS.RATIONALE_MIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['rationale'],
        message: 'Rationale is required when you modify the action',
      });
    }
  });

export function validateDecision(form) {
  const parsed = DecisionFormSchema.safeParse(form);
  if (parsed.success) return {};
  return Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message]));
}
