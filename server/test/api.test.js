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

  it('admins can read the queue, cases and audit log, but cannot decide, reopen or re-analyse', async () => {
    const author = await loginAs(users.author);
    await author.post('/api/posts').send({ body: 'You are a worthless idiot.' });
    await settle();
    const kase = await Case.findOne().lean();

    const admin = await loginAs(users.admin);
    expect((await admin.get('/api/cases')).status).toBe(200);
    expect((await admin.get(`/api/cases/${kase._id}`)).status).toBe(200);
    expect((await admin.get('/api/audit')).status).toBe(200);

    const decide = await admin.post(`/api/cases/${kase._id}/decisions`).send({
      outcome: 'approved',
      analysisId: String(kase.currentAnalysisId),
    });
    expect(decide.status).toBe(403);
    expect(decide.body.error.code).toBe('FORBIDDEN');
    expect((await admin.post(`/api/cases/${kase._id}/reanalyze`)).status).toBe(403);
    expect((await admin.post(`/api/cases/${kase._id}/reopen`)).status).toBe(403);
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

  it('history shows staff the full AI review and failure reason, and shows authors no AI findings', async () => {
    const author = await loginAs(users.author);
    const created = await author
      .post('/api/posts')
      .send({ body: '[mock:error] Lately I just want to disappear.' });
    await settle();

    const admin = await loginAs(users.admin);
    const staff = await admin.get(`/api/content/${created.body._id}/history`);
    expect(staff.status).toBe(200);
    const [analysis] = staff.body.analyses;
    expect(analysis.ruleFindings.map((f) => f.clauseCode)).toContain('SH-1');
    expect(analysis.recommendation.needsHumanReasons.length).toBeGreaterThan(0);
    expect(analysis.ai).toMatchObject({ status: 'error', failure: expect.any(String) });

    const own = await author.get(`/api/content/${created.body._id}/history`);
    expect(own.status).toBe(200);
    expect(own.body.analyses[0]).not.toHaveProperty('ruleFindings');
    expect(own.body.analyses[0]).not.toHaveProperty('ai');
    const aiEvents = own.body.audit.filter((e) => e.action.startsWith('analysis.'));
    expect(aiEvents.length).toBeGreaterThan(0);
    expect(aiEvents.every((e) => e.after === null)).toBe(true);
    const stranger = await (await loginAs(users.author2)).get(`/api/content/${created.body._id}/history`);
    expect(stranger.status).toBe(403);
  });
});
