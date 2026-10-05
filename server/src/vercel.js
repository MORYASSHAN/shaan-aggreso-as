// Vercel entrypoint for the server service. vercel.json routes /api/* here with the path unchanged.
import { waitUntil } from '@vercel/functions';
import express from 'express';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { logger } from './logger.js';
import { onIdle } from './services/jobQueue.js';

let connecting;

// Warm instances reuse the connection; a failed attempt is forgotten so the next request retries.
function ready() {
  connecting ??= connectDb(config.MONGODB_URI).catch((err) => {
    connecting = undefined;
    throw err;
  });
  return connecting;
}

const app = express();

app.use(async (req, res, next) => {
  try {
    await ready();
  } catch (err) {
    logger.error({ err }, 'database connection failed');
    res.status(503).json({ error: { code: 'INTERNAL', message: 'Database unavailable.' } });
    return;
  }
  // Analysis runs after the response is sent; keep the instance alive until the queue drains.
  waitUntil(new Promise((resolve) => res.on('close', resolve)).then(onIdle));
  next();
});

app.use(createApp());

export default app;
