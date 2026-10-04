import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { isProduction } from './config.js';
import { logger } from './logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

const CLIENT_DIST = fileURLToPath(new URL('../../client/dist/', import.meta.url));

function requestLogger() {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    // Every line carries the requestId and, once logged in, the userId. Bodies are never logged.
    customProps: (req) => ({ requestId: req.id, userId: req.user?.id }),
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

// In production, Express also serves the built React app from the same URL (no CORS).
function serveClient(app) {
  if (!existsSync(CLIENT_DIST)) return;
  app.use(express.static(CLIENT_DIST, { index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(`${CLIENT_DIST}index.html`));
}

/** Builds the Express app without connecting to the database, so tests can import it. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Render sits behind one proxy; this lets rate limiting see the real client IP.
  app.set('trust proxy', 1);
  app.use(requestLogger());
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiRouter);
  app.use('/api', notFound);
  if (isProduction) serveClient(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
