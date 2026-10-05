import { FunctionCallingConfigMode, GoogleGenAI } from '@google/genai';
import { config } from '../../config.js';
import { AiTimeoutError } from './errors.js';

let client;

function getClient() {
  // Per-attempt timeout from config, and 1 retry (2 attempts total).
  client ??= new GoogleGenAI({
    apiKey: config.GEMINI_API_KEY,
    httpOptions: {
      timeout: config.AI_TIMEOUT_MS,
      retryOptions: { attempts: 2 },
    },
  });
  return client;
}

// Our messages use { role: 'user' | 'assistant', content: string }; Gemini wants role 'model' and parts.
function toContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

/**
 * Calls Gemini with function calling forced to one function, so the reply is structured JSON instead of free text.
 * Returns the raw function args; the caller validates them with Zod before trusting any of it.
 */
async function callTool({ system, messages, tool }) {
  let response;
  try {
    response = await getClient().models.generateContent({
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
