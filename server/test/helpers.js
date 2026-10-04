import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ACTOR_TYPE, CONTENT_TYPE, ROLES } from '../src/constants.js';
import { connectDb, ensureCollections } from '../src/db.js';
import { Case, User } from '../src/models/index.js';
import * as contentService from '../src/services/contentService.js';
import { onIdle } from '../src/services/jobQueue.js';
import * as policyService from '../src/services/policyService.js';
import * as reevaluationService from '../src/services/reevaluationService.js';

export const PASSWORD = 'test-password-123';
export const app = createApp();

const USERS = {
  author: { name: 'Alex Author', email: 'author@example.com', role: ROLES.AUTHOR },
  author2: { name: 'Blake Writer', email: 'author2@example.com', role: ROLES.AUTHOR },
  moderator: { name: 'Morgan Moderator', email: 'moderator@example.com', role: ROLES.MODERATOR },
  senior: { name: 'Sam Senior', email: 'senior@example.com', role: ROLES.SENIOR },
  admin: { name: 'Ari Admin', email: 'admin@example.com', role: ROLES.ADMIN },
};

export async function connect() {
  if (mongoose.connection.readyState !== 1) await connectDb(process.env.MONGODB_URI);
}

export async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

/** Fresh database with the 5 demo users and policy v1 active. */
export async function resetDb() {
  await settle();
  await mongoose.connection.dropDatabase();
  await ensureCollections();
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const users = {};
  for (const [key, user] of Object.entries(USERS)) users[key] = await User.create({ ...user, passwordHash });
  await policyService.install(await policyService.readPolicyFile(1), { publishedBy: users.admin._id });
  return users;
}

export const actorFor = (user) => ({ type: ACTOR_TYPE.USER, id: String(user._id), role: user.role });

/** Waits for background analysis and re-evaluation to finish. */
export async function settle() {
  await reevaluationService.whenIdle();
  await onIdle();
}

export async function post(user, body) {
  const content = await contentService.createContent({
    type: CONTENT_TYPE.POST,
    body,
    actor: actorFor(user),
  });
  await settle();
  return content;
}

export async function comment(user, postId, body) {
  const content = await contentService.createContent({
    type: CONTENT_TYPE.COMMENT,
    body,
    postId,
    actor: actorFor(user),
  });
  await settle();
  return content;
}

export async function caseFor(contentId) {
  return Case.findOne({ contentId }).sort({ createdAt: -1 }).lean();
}

/** A supertest agent that is logged in as the given demo user. */
export async function loginAs(user) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${user.email}: ${res.status}`);
  return agent;
}

export { request };
