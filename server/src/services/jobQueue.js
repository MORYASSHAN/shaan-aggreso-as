import { config } from '../config.js';
import { logger } from '../logger.js';

// A small in-process queue: an array plus a worker loop, at most AI_CONCURRENCY jobs at a time,
// so requests return fast while analysis runs in the background.
// A production system would use a durable job queue instead (see README).
const queue = [];
let active = 0;
let idleWaiters = [];

function settleIdle() {
  if (active > 0 || queue.length > 0) return;
  const waiters = idleWaiters;
  idleWaiters = [];
  waiters.forEach((resolve) => resolve());
}

function pump() {
  while (active < config.AI_CONCURRENCY && queue.length > 0) {
    const job = queue.shift();
    active += 1;
    Promise.resolve()
      .then(job.run)
      .catch((err) => logger.error({ err, job: job.name, requestId: job.requestId }, 'background job failed'))
      .finally(() => {
        active -= 1;
        pump();
        settleIdle();
      });
  }
}

export function enqueue(name, run, { requestId } = {}) {
  queue.push({ name, run, requestId });
  pump();
}

/** Resolves when no job is queued or running. Used by tests and the seed script. */
export function onIdle() {
  if (active === 0 && queue.length === 0) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.push(resolve));
}
