import jwt from 'jsonwebtoken';
import { config, isProduction } from '../config.js';
import { ACTOR_TYPE, ERROR } from '../constants.js';
import { User } from '../models/index.js';
import { recordDenied } from '../services/auditService.js';
import { appError } from '../utils/AppError.js';

export const SESSION_COOKIE = 'modwb_session';
const SESSION_HOURS = 8;

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  };
}

export function signSession(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.JWT_SECRET, {
    expiresIn: `${SESSION_HOURS}h`,
  });
}

function readCookie(req, name) {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    if (part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return null;
}

export async function requireAuth(req, _res, next) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return next(appError(ERROR.UNAUTHENTICATED, 'Please log in.'));
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch {
    return next(appError(ERROR.UNAUTHENTICATED, 'Your session has expired. Please log in again.'));
  }
  // Load the user so a role change takes effect without waiting for the token to expire.
  const user = await User.findById(payload.sub).lean();
  if (!user) return next(appError(ERROR.UNAUTHENTICATED, 'Please log in.'));
  req.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
  next();
}

export function requireRole(...roles) {
  return async (req, _res, next) => {
    if (roles.includes(req.user?.role)) return next();
    await recordDenied({
      actor: toActor(req.user),
      reason: `${req.user?.role} cannot ${req.method} ${req.baseUrl}${req.path}`,
      entity: { type: 'user', id: req.user.id },
      requestId: req.id,
    });
    next(appError(ERROR.FORBIDDEN, 'You do not have permission to do that.'));
  };
}

export function toActor(user) {
  return { type: ACTOR_TYPE.USER, id: user.id, role: user.role };
}
