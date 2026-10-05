import { AI_RUN_STATUS } from '../constants.js';

/** Plain-language reason an AI review produced no result, or null when it succeeded. */
export function aiFailureReason(aiRun) {
  if (!aiRun || aiRun.status === AI_RUN_STATUS.OK) return null;
  if (aiRun.status === AI_RUN_STATUS.TIMEOUT) return 'The AI did not answer in time.';
  if (aiRun.status === AI_RUN_STATUS.INVALID_OUTPUT) {
    return 'The AI returned output that failed validation, even after one repair attempt.';
  }
  const message = aiRun.errorMessage ?? '';
  if (/\b503\b|UNAVAILABLE|overloaded|high demand/i.test(message)) {
    return 'The AI service was overloaded (503). Re-analyse later.';
  }
  if (/\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return 'The AI rate limit or quota was reached (429). Re-analyse in a minute.';
  }
  if (/\b40[13]\b|API key|PERMISSION_DENIED/i.test(message)) return 'The AI provider rejected the API key.';
  if (/\b404\b|no longer available|not found/i.test(message)) {
    return 'The configured AI model is not available.';
  }
  return 'The AI request failed.';
}
