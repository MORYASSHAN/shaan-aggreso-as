import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ACTION, AUDIT, ERROR, FINDING_SEVERITIES, POLICY_STATUS } from '../constants.js';
import { withTransaction } from '../db.js';
import { Policy } from '../models/index.js';
import { appError } from '../utils/AppError.js';
import * as auditService from './auditService.js';
import * as reevaluationService from './reevaluationService.js';

const ENFORCING_ACTIONS = [ACTION.LABEL, ACTION.LIMIT, ACTION.REMOVE];

const regexString = z.string().refine(
  (source) => {
    try {
      new RegExp(source, 'i');
      return true;
    } catch {
      return false;
    }
  },
  { message: 'is not a valid regular expression' },
);

const ClauseSchema = z
  .object({
    code: z.string().regex(/^[A-Z]+-\d+$/, 'must look like HAR-1'),
    title: z.string().min(1),
    text: z.string().min(1),
    defaultSeverity: z.enum(FINDING_SEVERITIES),
    allowedActions: z.array(z.enum(ENFORCING_ACTIONS)).min(1),
    deterministic: z
      .object({
        keywords: z.array(z.string().min(1)).default([]),
        patterns: z.array(regexString).default([]),
        alwaysEscalate: z.boolean().default(false),
        linkThreshold: z.number().int().min(1).optional(),
      })
      .default({}),
    examples: z
      .object({ violating: z.array(z.string()).default([]), allowed: z.array(z.string()).default([]) })
      .default({}),
  })
  .strict();

// The policy file format. "version" in an uploaded file is ignored: the server assigns latest + 1.
export const PolicyFileSchema = z
  .object({
    version: z.number().int().positive().optional(),
    effectiveFrom: z.string().optional(),
    changelog: z.string().min(1, 'describe what changed'),
    clauses: z.array(ClauseSchema).min(1),
  })
  .strict()
  .superRefine((policy, ctx) => {
    const seen = new Set();
    policy.clauses.forEach((clause, i) => {
      if (seen.has(clause.code)) {
        ctx.addIssue({
          code: 'custom',
          path: ['clauses', i, 'code'],
          message: `duplicate clause ${clause.code}`,
        });
      }
      seen.add(clause.code);
    });
  });

const POLICY_DIR = fileURLToPath(new URL('../../../policies/', import.meta.url));

export async function readPolicyFile(version) {
  const raw = await readFile(`${POLICY_DIR}policy.v${version}.json`, 'utf8');
  return JSON.parse(raw);
}

export async function getActive(session) {
  const policy = await Policy.findOne({ status: POLICY_STATUS.ACTIVE })
    .session(session ?? null)
    .lean();
  if (!policy) throw appError(ERROR.INTERNAL, 'No active policy. Run the seed script.');
  return policy;
}

export async function getVersion(version) {
  const policy = await Policy.findOne({ version }).populate('publishedBy', 'name role').lean();
  if (!policy) throw appError(ERROR.NOT_FOUND, `Policy v${version} does not exist.`);
  return policy;
}

export async function list() {
  return Policy.find({}).sort({ version: -1 }).populate('publishedBy', 'name role').lean();
}

export function findClause(policy, code) {
  return policy.clauses.find((clause) => clause.code === code) ?? null;
}

const COMPARED_FIELDS = ['title', 'text', 'defaultSeverity', 'allowedActions', 'deterministic', 'examples'];

function changedFields(before, after) {
  return COMPARED_FIELDS.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

/** Clause-by-clause diff: added, removed, changed (with the fields that changed) or unchanged. */
export async function diff(fromVersion, toVersion) {
  const [from, to] = await Promise.all([getVersion(fromVersion), getVersion(toVersion)]);
  const codes = [...new Set([...from.clauses, ...to.clauses].map((clause) => clause.code))];
  const clauses = codes.map((code) => {
    const before = findClause(from, code);
    const after = findClause(to, code);
    if (!before) return { code, change: 'added', before: null, after, fields: [] };
    if (!after) return { code, change: 'removed', before, after: null, fields: [] };
    const fields = changedFields(before, after);
    return { code, change: fields.length ? 'changed' : 'unchanged', before, after, fields };
  });
  return { from: fromVersion, to: toVersion, changelog: to.changelog, clauses };
}

/** Creates the first active policy. Used by the seed script only. */
export async function install(json, { publishedBy = null } = {}) {
  const { version: _ignored, ...file } = PolicyFileSchema.parse(json);
  return Policy.create({
    ...file,
    version: 1,
    status: POLICY_STATUS.ACTIVE,
    publishedBy,
    publishedAt: new Date(),
  });
}

/**
 * Publishes a new version. Switching the active version happens inside one transaction,
 * so there is never zero or two active policies. Then unresolved cases are re-evaluated.
 */
export async function publish(json, actor, requestId) {
  const parsed = PolicyFileSchema.safeParse(json);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw appError(ERROR.VALIDATION_FAILED, 'The policy file is invalid.', { fields: { policy: fields } });
  }
  const { version: _ignored, ...file } = parsed.data;
  const { policy, previous } = await withTransaction(async (session) => {
    const latest = await Policy.findOne({}).sort({ version: -1 }).session(session).lean();
    const active = await Policy.findOneAndUpdate(
      { status: POLICY_STATUS.ACTIVE },
      { $set: { status: POLICY_STATUS.RETIRED } },
      { new: true, session },
    );
    const [created] = await Policy.create(
      [
        {
          ...file,
          version: (latest?.version ?? 0) + 1,
          status: POLICY_STATUS.ACTIVE,
          publishedBy: actor.id,
          publishedAt: new Date(),
        },
      ],
      { session },
    );
    await auditService.record(
      {
        actor,
        action: AUDIT.POLICY_PUBLISHED,
        entity: { type: 'policy', id: created._id },
        before: active && { version: active.version, status: POLICY_STATUS.ACTIVE },
        after: { version: created.version, status: created.status, changelog: created.changelog },
        policyVersion: created.version,
        requestId,
      },
      session,
    );
    return { policy: created, previous: active };
  });
  const run = await reevaluationService.start({
    fromVersion: previous?.version ?? policy.version,
    toVersion: policy.version,
    actor,
    requestId,
  });
  return { policy: policy.toObject(), reevaluationRunId: run._id };
}
