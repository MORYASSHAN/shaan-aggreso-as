import { config } from '../../config.js';
import { geminiClient } from './geminiClient.js';
import { mockClient } from './mockClient.js';

/** AI_PROVIDER picks the client. Tests and local development use the mock. */
export function getAiClient() {
  return config.AI_PROVIDER === 'gemini' ? geminiClient : mockClient;
}
