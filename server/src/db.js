import mongoose from 'mongoose';
import { logger } from './logger.js';
import * as models from './models/index.js';

export async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  await ensureCollections();
  logger.info({ db: mongoose.connection.name }, 'database connected');
}

// Collections and indexes must exist before the first transaction writes to them.
export async function ensureCollections() {
  for (const model of Object.values(models)) {
    await model.createCollection();
    await model.syncIndexes();
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/** Runs fn inside one Mongo transaction: all writes succeed or none do. */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
