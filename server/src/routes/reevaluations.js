import { Router } from 'express';
import { MODERATOR_ROLES, ROLES } from '../constants.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as reevaluationService from '../services/reevaluationService.js';

export const reevaluationsRouter = Router();

reevaluationsRouter.get(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ...MODERATOR_ROLES),
  async (req, res) => {
    res.json(await reevaluationService.getRun(req.params.id));
  },
);
