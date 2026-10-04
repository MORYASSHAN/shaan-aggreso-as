import { Router } from 'express';
import { MODERATOR_ROLES, ROLES } from '../constants.js';
import { requireAuth, requireRole, toActor } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as appealService from '../services/appealService.js';
import { AppealsQuery, ResolveAppealBody } from './schemas.js';

export const appealsRouter = Router();

appealsRouter.use(requireAuth);

// Admins see unassigned appeals so "No eligible reviewer" is visible to them.
appealsRouter.get(
  '/',
  requireRole(ROLES.SENIOR, ROLES.ADMIN),
  validateQuery(AppealsQuery),
  async (req, res) => {
    res.json({ items: await appealService.list(toActor(req.user), req.validQuery) });
  },
);

appealsRouter.get('/:id', requireRole(...MODERATOR_ROLES, ROLES.ADMIN), async (req, res) => {
  res.json(await appealService.getDetail(req.params.id, toActor(req.user)));
});

// Any moderator may call this, so the original moderator gets a clear SAME_REVIEWER refusal;
// the service then requires an assigned (or eligible) senior moderator.
appealsRouter.post(
  '/:id/resolve',
  requireRole(...MODERATOR_ROLES),
  validate(ResolveAppealBody),
  async (req, res) => {
    const result = await appealService.resolve({
      appealId: req.params.id,
      input: req.body,
      actor: toActor(req.user),
      requestId: req.id,
    });
    res.status(201).json(result);
  },
);
