import { Router } from 'express';
import { requireAuth, toActor } from '../middleware/auth.js';
import { aiWriteLimiter } from '../middleware/rateLimits.js';
import { validate } from '../middleware/validate.js';
import * as contentService from '../services/contentService.js';
import { ReportBody } from './schemas.js';

export const contentRouter = Router();

contentRouter.use(requireAuth);

contentRouter.post('/:id/reports', aiWriteLimiter, validate(ReportBody), async (req, res) => {
  const result = await contentService.reportContent({
    contentId: req.params.id,
    ...req.body,
    actor: toActor(req.user),
    requestId: req.id,
  });
  res.status(201).json(result);
});

// The service checks that the viewer is the author or a moderator.
contentRouter.get('/:id/history', async (req, res) => {
  res.json(await contentService.getHistory(req.params.id, req.user));
});
