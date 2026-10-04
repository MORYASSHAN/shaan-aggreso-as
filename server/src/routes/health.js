import { Router } from 'express';
import { config } from '../config.js';
import { isDbConnected } from '../db.js';
import { Policy } from '../models/index.js';
import { POLICY_STATUS } from '../constants.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const db = isDbConnected();
  const active = db ? await Policy.findOne({ status: POLICY_STATUS.ACTIVE }).select('version').lean() : null;
  res.status(db ? 200 : 503).json({
    ok: db,
    db: db ? 'connected' : 'disconnected',
    activePolicyVersion: active?.version ?? null,
    aiProvider: config.AI_PROVIDER,
  });
});
