// Vercel entry: vercel.json rewrites /api/* here; the client is served as static files.
import { waitUntil } from '@vercel/functions';
import { createApp } from '../server/src/app.js';
import { config } from '../server/src/config.js';
import { connectDb } from '../server/src/db.js';
import { logger } from '../server/src/logger.js';
import { onIdle } from '../server/src/services/jobQueue.js';

const app = createApp();
let connecting;

// Reused by warm instances; a failed attempt is dropped so the next request retries.
function ready() {
  connecting ??= connectDb(config.MONGODB_URI).catch((err) => {
    connecting = undefined;
    throw err;
  });
  return connecting;
}

export default async function handler(req, res) {
  try {
    await ready();
  } catch (err) {
    logger.error({ err }, 'database connection failed');
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Database unavailable.' } }));
    return;
  }
  // Analysis runs after the response is sent; keep the instance alive until the queue drains.
  waitUntil(new Promise((resolve) => res.on('close', resolve)).then(onIdle));
  app(req, res);
}
