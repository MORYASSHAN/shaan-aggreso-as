import { ACTOR_TYPE, AUDIT, ERROR, LIMITS, REEVALUATION_STATUS, UNRESOLVED_STATUSES } from '../constants.js';
import { logger } from '../logger.js';
import { Analysis, Case, ReevaluationRun } from '../models/index.js';
import { appError } from '../utils/AppError.js';
import { analyzeCase } from './analysisService.js';
import * as auditService from './auditService.js';

const SYSTEM = { type: ACTOR_TYPE.SYSTEM };
const running = new Map();

// Resolved, auto-cleared and appeal-resolved cases are never touched: they keep their original version.
async function reevaluateCase(caseId, { runId, toVersion, requestId }) {
  const kase = await Case.findById(caseId).lean();
  const current = kase?.currentAnalysisId ? await Analysis.findById(kase.currentAnalysisId).lean() : null;
  // Skipping cases already on the new version makes a restart (or a second run) safe.
  if (!kase || !UNRESOLVED_STATUSES.includes(kase.status) || current?.policyVersion === toVersion) {
    await ReevaluationRun.updateOne({ _id: runId }, { $inc: { processed: 1, skipped: 1 } });
    return;
  }
  try {
    await analyzeCase(caseId, { fromVersion: current?.policyVersion ?? null, requestId });
    await ReevaluationRun.updateOne({ _id: runId }, { $inc: { processed: 1 } });
  } catch (err) {
    logger.error({ err, caseId, runId }, 're-evaluation failed for case');
    await ReevaluationRun.updateOne(
      { _id: runId },
      { $inc: { processed: 1, failed: 1 }, $push: { failures: { caseId, error: err.message } } },
    );
  }
}

/** Processes cases 3 at a time and records progress on the run document. */
export async function processRun(runId, caseIds, { toVersion, requestId }) {
  const queue = [...caseIds];
  const worker = async () => {
    while (queue.length) await reevaluateCase(queue.shift(), { runId, toVersion, requestId });
  };
  await Promise.all(Array.from({ length: LIMITS.REEVALUATION_CONCURRENCY }, worker));
  const run = await ReevaluationRun.findByIdAndUpdate(
    runId,
    { $set: { status: REEVALUATION_STATUS.COMPLETED, completedAt: new Date() } },
    { new: true },
  );
  await auditService.record({
    actor: SYSTEM,
    action: AUDIT.REEVALUATION_COMPLETED,
    entity: { type: 'reevaluationRun', id: runId },
    after: { processed: run.processed, skipped: run.skipped, failed: run.failed },
    policyVersion: toVersion,
    requestId,
  });
  return run;
}

/** Creates a run for every unresolved case and starts it in the background. */
export async function start({ fromVersion, toVersion, actor, requestId }) {
  const caseIds = await Case.find({ status: { $in: UNRESOLVED_STATUSES } }).distinct('_id');
  const run = await ReevaluationRun.create({
    fromVersion,
    toVersion,
    status: REEVALUATION_STATUS.RUNNING,
    total: caseIds.length,
    startedBy: actor.id,
  });
  await auditService.record({
    actor,
    action: AUDIT.REEVALUATION_STARTED,
    entity: { type: 'reevaluationRun', id: run._id },
    after: { fromVersion, toVersion, total: caseIds.length },
    policyVersion: toVersion,
    requestId,
  });
  const promise = processRun(run._id, caseIds, { toVersion, requestId })
    .catch((err) => logger.error({ err, runId: run._id }, 're-evaluation run failed'))
    .finally(() => running.delete(String(run._id)));
  running.set(String(run._id), promise);
  return run;
}

export async function getRun(runId) {
  const run = await ReevaluationRun.findById(runId).lean();
  if (!run) throw appError(ERROR.NOT_FOUND, 'Re-evaluation run not found.');
  return run;
}

/** Resolves when every run started in this process has finished. Used by tests and the seed script. */
export async function whenIdle() {
  await Promise.all([...running.values()]);
}
