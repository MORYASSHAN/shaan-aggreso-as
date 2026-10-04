import { Router } from 'express';
import { CONTENT_TYPE, ROLES } from '../constants.js';
import { requireAuth, requireRole, toActor } from '../middleware/auth.js';
import { aiWriteLimiter } from '../middleware/rateLimits.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as contentService from '../services/contentService.js';
import { ContentBody, FeedQuery } from './schemas.js';

export const postsRouter = Router();

postsRouter.use(requireAuth);

postsRouter.get('/', validateQuery(FeedQuery), async (req, res) => {
  res.json(await contentService.listFeed({ viewer: req.user, ...req.validQuery }));
});

postsRouter.get('/:id', async (req, res) => {
  res.json(await contentService.getPost(req.params.id, req.user));
});

postsRouter.post('/', requireRole(ROLES.AUTHOR), aiWriteLimiter, validate(ContentBody), async (req, res) => {
  const content = await contentService.createContent({
    type: CONTENT_TYPE.POST,
    body: req.body.body,
    actor: toActor(req.user),
    requestId: req.id,
  });
  res.status(201).json(content);
});

postsRouter.post(
  '/:id/comments',
  requireRole(ROLES.AUTHOR),
  aiWriteLimiter,
  validate(ContentBody),
  async (req, res) => {
    const content = await contentService.createContent({
      type: CONTENT_TYPE.COMMENT,
      body: req.body.body,
      postId: req.params.id,
      actor: toActor(req.user),
      requestId: req.id,
    });
    res.status(201).json(content);
  },
);
