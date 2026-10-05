import { FunctionCallingConfigMode, GoogleGenAI } from '@google/genai';
import { config } from '../../config.js';
import { AiTimeoutError } from './errors.js';

let client;

// Retries are ours, not the SDK's, so a 429 can wait for the delay Gemini asks for.
const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 60_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function getClient() {
  client ??= new GoogleGenAI({
    apiKey: config.GEMINI_API_KEY,
    httpOptions: { timeout: config.AI_TIMEOUT_MS, retryOptions: { attempts: 1 } },
  });
  return client;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini's RetryInfo hint on a 429, otherwise exponential backoff (2 s, 4 s, ...).
export function retryDelayMs(err, attempt) {
  const hint = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(String(err?.message))?.[1];
  const ms = hint ? Number(hint) * 1000 + 500 : 2000 * 2 ** (attempt - 1);
  return Math.min(ms, MAX_WAIT_MS);
}

function isRetryable(err) {
  return RETRYABLE.has(err?.status) || err?.name === 'AbortError' || err?.name === 'TimeoutError';
}

// Re-analyse waits for this call, so all attempts together get a budget of 2 × AI_TIMEOUT_MS.
async function generateWithRetry(request) {
  const deadline = Date.now() + 2 * config.AI_TIMEOUT_MS;
  for (let attempt = 1; ; attempt++) {
    try {
      return await getClient().models.generateContent(request);
    } catch (err) {
      const wait = retryDelayMs(err, attempt);
      if (attempt >= MAX_ATTEMPTS || !isRetryable(err) || Date.now() + wait >= deadline) throw err;
      await sleep(wait);
    }
  }
}

// Our messages use { role: 'user' | 'assistant', content: string }; Gemini wants role 'model' and parts.
function toContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

// Forces a single function call so the reply is structured; the caller validates the raw args with Zod.
async function callTool({ system, messages, tool }) {
  let response;
  try {
    response = await generateWithRetry({
      model: config.GEMINI_MODEL,
      contents: toContents(messages),
      config: {
        systemInstruction: system,
        maxOutputTokens: 8192,
        tools: [
          {
            functionDeclarations: [
              {
                name: tool.name,
                description: tool.description,
                parametersJsonSchema: tool.input_schema,
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [tool.name],
          },
        },
      },
    });
  } catch (err) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') throw new AiTimeoutError(err.message);
    throw err;
  }
  const call = response.functionCalls?.find((fc) => fc.name === tool.name);
  const finishReason = response.candidates?.[0]?.finishReason;
  return {
    // A missing function call is treated like invalid output, which triggers the repair retry.
    input: call ? call.args : { error: `no ${tool.name} call; finish_reason=${finishReason}` },
    model: response.modelVersion ?? config.GEMINI_MODEL,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export const geminiClient = {
  get model() {
    return config.GEMINI_MODEL;
  },
  callTool,
};
