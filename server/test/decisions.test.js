import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUDIT, CASE, VISIBILITY } from '../src/constants.js';
import { AuditEvent, Content, Decision } from '../src/models/index.js';
import { analyzeCase } from '../src/services/analysisService.js';
import { caseFor, connect, disconnect, loginAs, post, resetDb } from './helpers.js';

describe('decisions', () => {
  let users;
  let mod;
  let kase;
  let content;

  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    users = await resetDb();
    mod = await loginAs(users.moderator);
    content = await post(users.author, '@sam you are a worthless idiot');
    kase = await caseFor(content._id);
  });

  const decide = (body) =>
    mod
      .post(`/api/cases/${kase._id}/decisions`)
      .send({ analysisId: String(kase.currentAnalysisId), ...body });

  it('approve takes the AI action and clauses and stores the policy version', async () => {
    const res = await decide({ outcome: 'approved' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      outcome: 'approved',
      finalAction: 'remove',
      clauseCodes: ['HAR-1'],
      policyVersion: 1,
    });
    expect((await Content.findById(content._id)).visibility).toBe(VISIBILITY.REMOVED);
    expect((await caseFor(content._id)).status).toBe(CASE.RESOLVED);
  });

  it('reject forces the action to none and keeps the content visible', async () => {
    const res = await decide({ outcome: 'rejected', finalAction: 'remove' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      outcome: 'rejected',
      finalAction: 'none',
      clauseCodes: [],
      policyVersion: 1,
    });
    expect((await Content.findById(content._id)).visibility).toBe(VISIBILITY.VISIBLE);
  });

  it('modify applies a different action with a rationale', async () => {
    const res = await decide({
      outcome: 'modified',
      finalAction: 'label',
      clauseCodes: ['HAR-1'],
      rationale: 'Insult is real but mild; label instead of remove.',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ finalAction: 'label', clauseCodes: ['HAR-1'], policyVersion: 1 });
    expect((await Content.findById(content._id)).visibility).toBe(VISIBILITY.LABELED);
  });

  it('modified without a rationale gets 400 with a field error', async () => {
    const res = await decide({ outcome: 'modified', finalAction: 'label', clauseCodes: ['HAR-1'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.fields.rationale[0]).toMatch(/required when you modify/);
  });

  it('deciding twice gets 409', async () => {
    expect((await decide({ outcome: 'approved' })).status).toBe(201);
    const second = await decide({ outcome: 'rejected' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_TRANSITION');
    expect(await Decision.countDocuments({ caseId: kase._id })).toBe(1);
  });

  it('deciding on an old analysis gets STALE_ANALYSIS', async () => {
    await analyzeCase(kase._id);
    const res = await decide({ outcome: 'approved' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_ANALYSIS');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('every decision has a matching decision.made audit event', async () => {
    const res = await decide({ outcome: 'approved' });
    const events = await AuditEvent.find({ action: AUDIT.DECISION_MADE, 'entity.id': kase._id }).lean();
    expect(events).toHaveLength(1);
    expect(String(events[0].after._id)).toBe(res.body._id);
    expect(events[0].policyVersion).toBe(1);
  });
});
