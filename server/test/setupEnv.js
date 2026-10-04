import { inject } from 'vitest';

// Runs before each test file imports anything, so config.js sees a valid test environment.
const uri = new URL(inject('mongoUri'));
uri.pathname = `/test_${Math.random().toString(36).slice(2, 10)}`;

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = uri.toString();
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.AI_PROVIDER = 'mock';
process.env.APPEAL_WINDOW_DAYS = '14';
process.env.AI_CONCURRENCY = '2';
