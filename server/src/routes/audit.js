import { Router } from 'express';
import { MODERATOR_ROLES } from '../constants.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import * as auditService from '../services/auditService.js';
import { AuditQuery } from './schemas.js';

export const auditRouter = Router();

auditRouter.get(
  '/',
  requireAuth,
  requireRole(...MODERATOR_ROLES),
  validateQuery(AuditQuery),
  async (req, res) => {
    res.json(await auditService.list(req.validQuery));
  },
);
