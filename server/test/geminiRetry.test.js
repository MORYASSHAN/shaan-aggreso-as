import { describe, expect, it } from 'vitest';
import { retryDelayMs } from '../src/moderation/ai/geminiClient.js';

// The shape @google/genai puts in ApiError.message for a free-tier 429.
const quotaError = (delay) => ({
  status: 429,
  message: JSON.stringify({ error: { code: 429, details: [{ retryDelay: delay }] } }),
});

describe('Gemini retry delay', () => {
  it('waits for the delay Gemini asks for on a 429, plus a small margin', () => {
    expect(retryDelayMs(quotaError('18s'), 1)).toBe(18_500);
    expect(retryDelayMs(quotaError('2.25s'), 1)).toBe(2_750);
  });

  it('backs off exponentially when there is no hint, e.g. a 503', () => {
    const overloaded = { status: 503, message: 'This model is currently experiencing high demand.' };
    expect(retryDelayMs(overloaded, 1)).toBe(2_000);
    expect(retryDelayMs(overloaded, 2)).toBe(4_000);
  });

  it('never waits longer than a minute', () => {
    expect(retryDelayMs(quotaError('300s'), 1)).toBe(60_000);
  });
});
