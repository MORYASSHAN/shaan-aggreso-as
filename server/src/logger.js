import pino from 'pino';
import { config, isTest } from './config.js';

// Never log secrets, passwords, cookies or auth headers.
export const logger = pino({
  level: isTest ? 'silent' : config.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.apiKey',
    ],
    censor: '[redacted]',
  },
});
