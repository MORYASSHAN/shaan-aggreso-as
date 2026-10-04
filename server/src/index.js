import { loadEnvFile } from './loadEnv.js';

loadEnvFile();

// config.js validates the environment on import; refuse to start with a clear message if it is wrong.
let config;
try {
  ({ config } = await import('./config.js'));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const { logger } = await import('./logger.js');
const { connectDb } = await import('./db.js');
const { createApp } = await import('./app.js');

try {
  await connectDb(config.MONGODB_URI);
  createApp().listen(config.PORT, () => {
    logger.info({ port: config.PORT, aiProvider: config.AI_PROVIDER }, 'server listening');
  });
} catch (err) {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
}
