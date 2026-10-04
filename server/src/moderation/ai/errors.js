// Thrown by an AI client when the call took longer than AI_TIMEOUT_MS (after its retry).
export class AiTimeoutError extends Error {
  constructor(message = 'AI call timed out') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}
