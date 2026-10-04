import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUDIT, CASE } from '../src/constants.js';
import { AuditEvent, Case } from '../src/models/index.js';
import { app, connect, disconnect, loginAs, request, resetDb, settle } from './helpers.js';

describe('API basics', () => {
  let users;
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    users = await resetDb();
  });

  it('health reports the database, active policy and AI provider', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ ok: true, db: 'connected', activePolicyVersion: 1, aiProvider: 'mock' });
  });

  it('unknown API routes return the error shape with a requestId', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('no cookie gets 401; an author calling a moderator route gets 403', async () => {
    expect((await request(app).get('/api/cases')).status).toBe(401);
    const author = await loginAs(users.author);
    const res = await author.get('/api/cases');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await AuditEvent.countDocuments({ action: AUDIT.AUTH_DENIED })).toBe(1);
  });

  it('wrong password gets 401 without saying which part was wrong', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: users.author.email, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Email or password is incorrect.');
  });

  it('login sets an httpOnly session cookie and /me returns the user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: users.author.email, password: 'test-password-123' });
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    const author = await loginAs(users.author);
    expect((await author.get('/api/auth/me')).body.user.role).toBe('author');
  });

  it('an empty or 5,001-character post gets 400 with field errors', async () => {
    const author = await loginAs(users.author);
    const empty = await author.post('/api/posts').send({ body: '   ' });
    expect(empty.status).toBe(400);
    expect(empty.body.error.details.fields.body[0]).toMatch(/empty/);
    const long = await author.post('/api/posts').send({ body: 'a'.repeat(5001) });
    expect(long.status).toBe(400);
    expect(long.body.error.details.fields.body[0]).toMatch(/5,000/);
  });

  it('creating a post opens an auto_scan case that is analysed in the background', async () => {
    const author = await loginAs(users.author);
    const res = await author.post('/api/posts').send({ body: '@sam you are a worthless idiot' });
    expect(res.status).toBe(201);
    const pending = await Case.findById(res.body.caseId).lean();
    expect(pending.trigger).toBe('auto_scan');
    await settle();
    expect((await Case.findById(res.body.caseId)).status).toBe(CASE.AWAITING_REVIEW);
    const feed = await author.get('/api/posts');
    expect(feed.body.items[0].body).toBe('@sam you are a worthless idiot');
  });

  it('a second report raises priority and one user cannot report twice', async () => {
    const author = await loginAs(users.author);
    const created = await author.post('/api/posts').send({ body: '@sam you are a worthless idiot' });
    await settle();
    const before = await Case.findById(created.body.caseId).lean();
    const reporter = await loginAs(users.author2);
    const report = await reporter
      .post(`/api/content/${created.body._id}/reports`)
      .send({ reasonCode: 'harassment' });
    expect(report.status).toBe(201);
    expect(report.body.joinedExistingCase).toBe(true);
    const after = await Case.findById(created.body.caseId).lean();
    expect(after.reportCount).toBe(1);
    expect(after.priority).toBeGreaterThan(before.priority);
    const again = await reporter
      .post(`/api/content/${created.body._id}/reports`)
      .send({ reasonCode: 'harassment' });
    expect(again.status).toBe(400);
  });

  it('moderators can reopen an auto-cleared case', async () => {
    const author = await loginAs(users.author);
    const created = await author.post('/api/posts').send({ body: 'Lovely weather for a run today.' });
    await settle();
    expect((await Case.findById(created.body.caseId)).status).toBe(CASE.AUTO_CLEARED);
    const mod = await loginAs(users.moderator);
    const res = await mod.post(`/api/cases/${created.body.caseId}/reopen`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(CASE.AWAITING_REVIEW);
    const queue = await mod.get('/api/cases');
    expect(queue.body.items.map((c) => c._id)).toContain(created.body.caseId);
  });
});
