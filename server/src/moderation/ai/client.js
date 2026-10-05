import { config } from '../../config.js';
import { geminiClient } from './geminiClient.js';
import { mockClient } from './mockClient.js';

// Tests and local development use the mock.
export function getAiClient() {
  return config.AI_PROVIDER === 'gemini' ? geminiClient : mockClient;
}
