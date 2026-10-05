import mongoose from 'mongoose';
import { z } from 'zod';
import {
  ACTION,
  APPEAL_OUTCOME,
  APPEAL_STATUS,
  AUDIT,
  CASE,
  DECISION_OUTCOME,
  LIMITS,
  REPORT_REASONS,
  TRIGGER,
} from '../constants.js';

export const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: 'is not a valid id' });

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);

export const LoginBody = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const ContentBody = z.object({
  body: z
    .string({ required_error: 'Text is required' })
    .trim()
    .min(1, 'Text cannot be empty')
    .max(LIMITS.BODY_MAX, `Text must be ${LIMITS.BODY_MAX.toLocaleString('en-US')} characters or fewer`),
});

export const ReportBody = z.object({
  reasonCode: z.enum(REPORT_REASONS, { errorMap: () => ({ message: 'Choose a reason' }) }),
  note: z.string().trim().max(500, 'Note must be 500 characters or fewer').default(''),
});

const rationaleRule = `Rationale must be at least ${LIMITS.RATIONALE_MIN} characters`;

export const DecisionBody = z
  .object({
    outcome: z.enum(Object.values(DECISION_OUTCOME)),
    analysisId: objectId,
    finalAction: z.enum(Object.values(ACTION)).optional(),
    clauseCodes: z.array(z.string().trim().min(1)).default([]),
    rationale: z.string().trim().max(2000).default(''),
  })
  .superRefine((body, ctx) => {
    if (body.outcome !== DECISION_OUTCOME.MODIFIED) return;
    if (!body.finalAction) {
      ctx.addIssue({ code: 'custom', path: ['finalAction'], message: 'Choose the action to take' });
    }
    if (body.rationale.length < LIMITS.RATIONALE_MIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['rationale'],
        message: 'Rationale is required when you modify the action',
      });
    }
  });

export const AppealBody = z.object({
  statement: z
    .string({ required_error: 'Statement is required' })
    .trim()
    .min(LIMITS.APPEAL_STATEMENT_MIN, `Statement must be at least ${LIMITS.APPEAL_STATEMENT_MIN} characters`)
    .max(
      LIMITS.APPEAL_STATEMENT_MAX,
      `Statement must be ${LIMITS.APPEAL_STATEMENT_MAX.toLocaleString('en-US')} characters or fewer`,
    ),
  evidence: z.string().trim().max(LIMITS.APPEAL_STATEMENT_MAX).default(''),
});

export const ResolveAppealBody = z
  .object({
    outcome: z.enum(Object.values(APPEAL_OUTCOME)),
    finalAction: z.enum(Object.values(ACTION)).optional(),
    clauseCodes: z.array(z.string().trim().min(1)).default([]),
    rationale: z.string().trim().min(LIMITS.RATIONALE_MIN, rationaleRule).max(2000),
  })
  .superRefine((body, ctx) => {
    if (body.outcome === APPEAL_OUTCOME.MODIFIED && !body.finalAction) {
      ctx.addIssue({ code: 'custom', path: ['finalAction'], message: 'Choose the action to take' });
    }
  });

export const QueueQuery = z.object({
  status: z.enum(Object.values(CASE)).default(CASE.AWAITING_REVIEW),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  trigger: z.enum(Object.values(TRIGGER)).optional(),
  policyVersion: z.coerce.number().int().positive().optional(),
  page,
  limit,
});

export const FeedQuery = z.object({ page, limit });

export const AppealsQuery = z.object({
  status: z.enum(Object.values(APPEAL_STATUS)).default(APPEAL_STATUS.PENDING),
});

export const DiffQuery = z.object({
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
});

export const AuditQuery = z.object({
  entityType: z.string().trim().min(1).optional(),
  entityId: objectId.optional(),
  actorId: objectId.optional(),
  action: z.enum(Object.values(AUDIT)).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page,
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
