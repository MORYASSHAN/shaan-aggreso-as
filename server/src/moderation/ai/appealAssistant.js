import { AI_PURPOSE, AI_RUN_STATUS } from '../../constants.js';
import { logger } from '../../logger.js';
import { AiRun } from '../../models/index.js';
import { getAiClient } from './client.js';
import { AiTimeoutError } from './errors.js';
import { APPEAL_PROMPT_VERSION, APPEAL_SYSTEM_PROMPT, appealUserMessage } from './prompts.js';
import { AppealSummaryOutput, SUBMIT_APPEAL_SUMMARY_TOOL } from './schema.js';

/**
 * Optional appeal assistant (appeal-summary-v1). It returns a neutral summary and new points only:
 * no uphold/overturn vote, so the appeal outcome stays fully human. Returns null if the AI fails.
 */
export async function summarizeAppeal({
  content,
  decision,
  clauses,
  statement,
  evidence,
  policyChanged,
  requestId,
}) {
  const client = getAiClient();
  const started = Date.now();
  let result = null;
  let status = AI_RUN_STATUS.OK;
  let errorMessage = null;
  try {
    result = await client.callTool({
      system: APPEAL_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: appealUserMessage({ content, decision, clauses, statement, evidence, policyChanged }),
        },
      ],
      tool: SUBMIT_APPEAL_SUMMARY_TOOL,
      meta: { statement, policyChanged },
    });
  } catch (err) {
    status = err instanceof AiTimeoutError ? AI_RUN_STATUS.TIMEOUT : AI_RUN_STATUS.ERROR;
    errorMessage = err.message;
  }
  const parsed = result ? AppealSummaryOutput.safeParse(result.input) : null;
  if (parsed && !parsed.success) {
    status = AI_RUN_STATUS.INVALID_OUTPUT;
    errorMessage = parsed.error.issues.map((i) => i.message).join('; ');
  }
  const run = await AiRun.create({
    purpose: AI_PURPOSE.APPEAL_SUMMARY,
    model: result?.model ?? client.model ?? 'unknown',
    promptVersion: APPEAL_PROMPT_VERSION,
    policyVersion: decision.policyVersion,
    latencyMs: Date.now() - started,
    inputTokens: result?.inputTokens ?? 0,
    outputTokens: result?.outputTokens ?? 0,
    status,
    errorMessage,
  });
  if (status !== AI_RUN_STATUS.OK) {
    logger.warn({ requestId, aiRunId: run._id, status }, 'appeal summary unavailable');
    return null;
  }
  return {
    summary: parsed.data.summary,
    newPoints: parsed.data.new_points,
    // The server knows whether the policy changed; it does not take the model's word for it.
    policyChanged,
    aiRunId: run._id,
  };
}
