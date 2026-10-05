import { rateLimit } from 'express-rate-limit';
import { isTest } from '../config.js';
import { ERROR } from '../constants.js';
import { appError } from '../utils/AppError.js';

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, _res, next) => next(appError(ERROR.RATE_LIMITED, message)),
  });
}

export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many login attempts. Try again in a few minutes.',
});

// Creating content, reporting and re-analysing all trigger AI calls.
export const aiWriteLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 30,
  message: 'Too many requests. Slow down and try again in a minute.',
});
