import { Router } from 'express';
import { ROLES } from '../constants.js';
import { requireAuth, requireRole, toActor } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as appealService from '../services/appealService.js';
import { AppealBody } from './schemas.js';

export const decisionsRouter = Router();

// The service checks that the caller is the author of the decided content.
decisionsRouter.post(
  '/:id/appeals',
  requireAuth,
  requireRole(ROLES.AUTHOR),
  validate(AppealBody),
  async (req, res) => {
    const appeal = await appealService.submit({
      decisionId: req.params.id,
      ...req.body,
      actor: toActor(req.user),
      requestId: req.id,
    });
    res.status(201).json(appeal);
  },
);
