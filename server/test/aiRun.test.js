import { describe, expect, it } from 'vitest';
import { aiFailureReason } from '../src/utils/aiRun.js';

describe('aiFailureReason', () => {
  it('is null when the AI succeeded', () => {
    expect(aiFailureReason({ status: 'ok' })).toBeNull();
    expect(aiFailureReason(null)).toBeNull();
  });

  it('names the common provider failures', () => {
    const error = (errorMessage) => aiFailureReason({ status: 'error', errorMessage });
    expect(error('{"error":{"code":503,"status":"UNAVAILABLE"}}')).toMatch(/overloaded/);
    expect(error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')).toMatch(/rate limit/);
    expect(error('API key not valid')).toMatch(/API key/);
    expect(error('socket hang up')).toBe('The AI request failed.');
  });

  it('covers timeouts and invalid output', () => {
    expect(aiFailureReason({ status: 'timeout' })).toMatch(/in time/);
    expect(aiFailureReason({ status: 'invalid_output' })).toMatch(/validation/);
  });
});
