import { Router } from 'express';
import { MODERATOR_ROLES } from '../constants.js';
import { requireAuth, requireRole, toActor } from '../middleware/auth.js';
import { aiWriteLimiter } from '../middleware/rateLimits.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as caseService from '../services/caseService.js';
import * as decisionService from '../services/decisionService.js';
import { DecisionBody, QueueQuery } from './schemas.js';

export const casesRouter = Router();

casesRouter.use(requireAuth, requireRole(...MODERATOR_ROLES));

casesRouter.get('/', validateQuery(QueueQuery), async (req, res) => {
  res.json(await caseService.listQueue(req.validQuery));
});

casesRouter.get('/:id', async (req, res) => {
  res.json(await caseService.getCase(req.params.id));
});

casesRouter.post('/:id/reanalyze', aiWriteLimiter, async (req, res) => {
  res.status(201).json(await caseService.reanalyze(req.params.id, { requestId: req.id }));
});

casesRouter.post('/:id/decisions', validate(DecisionBody), async (req, res) => {
  const decision = await decisionService.applyDecision({
    caseId: req.params.id,
    input: req.body,
    actor: toActor(req.user),
    requestId: req.id,
  });
  res.status(201).json(decision);
});

casesRouter.post('/:id/reopen', async (req, res) => {
  res.json(await caseService.reopen(req.params.id, { actor: toActor(req.user), requestId: req.id }));
});
