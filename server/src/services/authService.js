import bcrypt from 'bcryptjs';
import { ACTOR_TYPE, AUDIT, ERROR } from '../constants.js';
import { User } from '../models/index.js';
import { appError } from '../utils/AppError.js';
import * as auditService from './auditService.js';

export async function login({ email, password, requestId }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // Same message for unknown email and wrong password, so accounts can't be discovered.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw appError(ERROR.UNAUTHENTICATED, 'Email or password is incorrect.');
  const actor = { type: ACTOR_TYPE.USER, id: String(user._id), role: user.role };
  await auditService.record({
    actor,
    action: AUDIT.AUTH_LOGIN,
    entity: { type: 'user', id: user._id },
    requestId,
  });
  return { _id: user._id, id: String(user._id), name: user.name, email: user.email, role: user.role };
}
