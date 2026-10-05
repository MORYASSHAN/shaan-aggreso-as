import { Router } from 'express';
import { MODERATOR_ROLES, OVERSIGHT_ROLES } from '../constants.js';
import { requireAuth, requireRole, toActor } from '../middleware/auth.js';
import { aiWriteLimiter } from '../middleware/rateLimits.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as caseService from '../services/caseService.js';
import * as decisionService from '../services/decisionService.js';
import { DecisionBody, QueueQuery } from './schemas.js';

export const casesRouter = Router();

// Admins may read the queue and cases; every write stays with moderators.
const canRead = requireRole(...OVERSIGHT_ROLES);
const canModerate = requireRole(...MODERATOR_ROLES);

casesRouter.use(requireAuth);

casesRouter.get('/', canRead, validateQuery(QueueQuery), async (req, res) => {
  res.json(await caseService.listQueue(req.validQuery));
});

casesRouter.get('/:id', canRead, async (req, res) => {
  res.json(await caseService.getCase(req.params.id));
});

casesRouter.post('/:id/reanalyze', canModerate, aiWriteLimiter, async (req, res) => {
  res.status(201).json(await caseService.reanalyze(req.params.id, { requestId: req.id }));
});

casesRouter.post('/:id/decisions', canModerate, validate(DecisionBody), async (req, res) => {
  const decision = await decisionService.applyDecision({
    caseId: req.params.id,
    input: req.body,
    actor: toActor(req.user),
    requestId: req.id,
  });
  res.status(201).json(decision);
});

casesRouter.post('/:id/reopen', canModerate, async (req, res) => {
  res.json(await caseService.reopen(req.params.id, { actor: toActor(req.user), requestId: req.id }));
});
