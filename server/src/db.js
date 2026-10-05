import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from './config.js';
import { logger } from './logger.js';
import * as models from './models/index.js';

// On some Windows machines (VPNs, virtual adapters) Node's resolver falls back to 127.0.0.1 and every
// mongodb+srv:// lookup fails with ECONNREFUSED, while the OS resolver works. Retry once via DNS_FALLBACK.
function isSrvLookupFailure(err) {
  return err?.syscall === 'querySrv' && ['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(err.code);
}

export async function openConnection(uri) {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri);
  } catch (err) {
    const servers = config.DNS_FALLBACK;
    if (!isSrvLookupFailure(err) || !servers.length) throw err;
    logger.warn({ servers, code: err.code }, 'SRV lookup failed; retrying with fallback DNS servers');
    dns.setServers(servers);
    await mongoose.connect(uri);
  }
}

export async function connectDb(uri) {
  await openConnection(uri);
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
