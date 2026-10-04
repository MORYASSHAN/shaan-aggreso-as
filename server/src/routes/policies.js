import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../constants.js';
import { requireAuth, requireRole, toActor } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import * as policyService from '../services/policyService.js';
import { DiffQuery } from './schemas.js';

export const policiesRouter = Router();

policiesRouter.use(requireAuth);

policiesRouter.get('/', async (_req, res) => {
  res.json({ items: await policyService.list() });
});

policiesRouter.get('/diff', validateQuery(DiffQuery), async (req, res) => {
  res.json(await policyService.diff(req.validQuery.from, req.validQuery.to));
});

policiesRouter.get('/:version', async (req, res) => {
  const version = z.coerce.number().int().positive().catch(0).parse(req.params.version);
  res.json(await policyService.getVersion(version));
});

// Body is the policy file as JSON (the UI reads an uploaded .json file and sends its contents).
policiesRouter.post('/', requireRole(ROLES.ADMIN), async (req, res) => {
  res.status(201).json(await policyService.publish(req.body, toActor(req.user), req.id));
});
