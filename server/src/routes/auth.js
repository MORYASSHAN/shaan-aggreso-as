import { Router } from 'express';
import { cookieOptions, requireAuth, SESSION_COOKIE, signSession } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimits.js';
import { validate } from '../middleware/validate.js';
import * as authService from '../services/authService.js';
import { LoginBody } from './schemas.js';

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.post('/login', validate(LoginBody), async (req, res) => {
  const user = await authService.login({ ...req.body, requestId: req.id });
  res.cookie(SESSION_COOKIE, signSession(user), cookieOptions());
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, options);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
