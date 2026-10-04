import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import { AiTimeoutError } from './errors.js';

let client;

function getClient() {
  // 30-second timeout and 1 retry, from config.
  client ??= new Anthropic({
    apiKey: config.ANTHROPIC_API_KEY,
    timeout: config.AI_TIMEOUT_MS,
    maxRetries: 1,
  });
  return client;
}

/**
 * Calls Claude with tool_choice forced to one tool, so the reply is structured JSON instead of free text.
 * Returns the raw tool input; the caller validates it with Zod before trusting any of it.
 */
async function callTool({ system, messages, tool }) {
  let response;
  try {
    response = await getClient().messages.create({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 4000,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AiTimeoutError(err.message);
    throw err;
  }
  const block = response.content.find((part) => part.type === 'tool_use' && part.name === tool.name);
  return {
    // A missing tool call is treated like invalid output, which triggers the repair retry.
    input: block ? block.input : { error: `no ${tool.name} call; stop_reason=${response.stop_reason}` },
    model: response.model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

export const claudeClient = {
  get model() {
    return config.ANTHROPIC_MODEL;
  },
  callTool,
};
