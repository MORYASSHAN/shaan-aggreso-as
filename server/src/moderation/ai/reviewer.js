import { AI_PURPOSE, AI_RUN_STATUS } from '../../constants.js';
import { logger } from '../../logger.js';
import { AiRun } from '../../models/index.js';
import { getAiClient } from './client.js';
import { AiTimeoutError } from './errors.js';
import {
  CLASSIFY_PROMPT_VERSION,
  classifySystemPrompt,
  classifyUserMessage,
  repairMessage,
} from './prompts.js';
import { ReviewOutput, SUBMIT_REVIEW_TOOL } from './schema.js';
import { verifyReview } from './verify.js';

// The AI code may only write analyses (through its caller) and aiRuns. It has no path to content or appeals.

function describeIssues(zodError) {
  return zodError.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
    .join('; ');
}

function statusFor(err) {
  return err instanceof AiTimeoutError ? AI_RUN_STATUS.TIMEOUT : AI_RUN_STATUS.ERROR;
}

/** Calls the model, validates with Zod, and allows exactly one repair retry. */
async function callAndValidate(client, { system, user, meta }, usage) {
  let issues = null;
  for (const isRepair of [false, true]) {
    const content = isRepair ? `${user}\n\n${repairMessage(issues)}` : user;
    const result = await client.callTool({
      system,
      messages: [{ role: 'user', content }],
      tool: SUBMIT_REVIEW_TOOL,
      meta: { ...meta, isRepair },
    });
    usage.model = result.model;
    usage.inputTokens += result.inputTokens;
    usage.outputTokens += result.outputTokens;
    const parsed = ReviewOutput.safeParse(result.input);
    if (parsed.success) return { output: parsed.data };
    issues = describeIssues(parsed.error);
  }
  return { invalid: issues };
}

/**
 * One AI review: build input, call, validate (+1 repair), verify, and log an aiRuns record either way.
 * Returns { ok: true, review, aiRunId } or { ok: false, status, aiRunId }. It never throws for AI failures.
 */
export async function reviewContent({ policy, content, parent, reports, ruleFindings, history, requestId }) {
  const client = getAiClient();
  const usage = { model: client.model, inputTokens: 0, outputTokens: 0 };
  const started = Date.now();
  let status = AI_RUN_STATUS.OK;
  let errorMessage = null;
  let review = null;
  try {
    const result = await callAndValidate(
      client,
      {
        system: classifySystemPrompt(policy.version),
        user: classifyUserMessage({ policy, content, parent, reports, ruleFindings, history }),
        meta: { text: content.body, policy },
      },
      usage,
    );
    if (result.invalid) {
      status = AI_RUN_STATUS.INVALID_OUTPUT;
      errorMessage = `Invalid output after repair retry: ${result.invalid}`;
    } else {
      review = verifyReview(result.output, { text: content.body, policy });
      if (review.verification.droppedEmpty) {
        logger.warn({ requestId, dropped: review.verification.droppedEmpty }, 'dropped empty AI findings');
      }
    }
  } catch (err) {
    status = statusFor(err);
    errorMessage = err.message;
  }
  const run = await AiRun.create({
    purpose: AI_PURPOSE.CLASSIFY,
    model: usage.model || 'unknown',
    promptVersion: CLASSIFY_PROMPT_VERSION,
    policyVersion: policy.version,
    latencyMs: Date.now() - started,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    status,
    errorMessage,
    verification: review?.verification ?? null,
  });
  if (status !== AI_RUN_STATUS.OK) {
    logger.warn({ requestId, aiRunId: run._id, status, errorMessage }, 'AI review unavailable');
    return { ok: false, status, aiRunId: run._id };
  }
  return { ok: true, review, aiRunId: run._id };
}
