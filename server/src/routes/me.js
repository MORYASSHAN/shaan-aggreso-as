import { Router } from 'express';
import { ROLES } from '../constants.js';
import { requireAuth, requireRole, toActor } from '../middleware/auth.js';
import * as contentService from '../services/contentService.js';

export const meRouter = Router();

meRouter.get('/content', requireAuth, requireRole(ROLES.AUTHOR), async (req, res) => {
  res.json({ items: await contentService.listMyContent(toActor(req.user)) });
});
