import { Router } from 'express';
import { appealsRouter } from './appeals.js';
import { auditRouter } from './audit.js';
import { authRouter } from './auth.js';
import { casesRouter } from './cases.js';
import { contentRouter } from './content.js';
import { decisionsRouter } from './decisions.js';
import { healthRouter } from './health.js';
import { meRouter } from './me.js';
import { policiesRouter } from './policies.js';
import { postsRouter } from './posts.js';
import { reevaluationsRouter } from './reevaluations.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/posts', postsRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/content', contentRouter);
apiRouter.use('/cases', casesRouter);
apiRouter.use('/decisions', decisionsRouter);
apiRouter.use('/appeals', appealsRouter);
apiRouter.use('/policies', policiesRouter);
apiRouter.use('/reevaluations', reevaluationsRouter);
apiRouter.use('/audit', auditRouter);
