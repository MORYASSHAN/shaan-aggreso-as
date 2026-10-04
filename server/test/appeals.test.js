import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CASE, VISIBILITY } from '../src/constants.js';
import { Appeal, Content, Decision } from '../src/models/index.js';
import { chooseReviewer } from '../src/services/appealService.js';
import { actorFor, caseFor, connect, disconnect, loginAs, post, resetDb, settle } from './helpers.js';
import * as decisionService from '../src/services/decisionService.js';

const STATEMENT = 'I was quoting a song lyric, not insulting anyone. Please look again.';

describe('appeals', () => {
  let users;
  let content;
  let decision;

  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    users = await resetDb();
    content = await post(users.author, '@sam you are a worthless idiot');
    const kase = await caseFor(content._id);
    decision = await decisionService.applyDecision({
      caseId: kase._id,
      input: {
        outcome: 'modified',
        analysisId: String(kase.currentAnalysisId),
        finalAction: 'label',
        clauseCodes: ['HAR-1'],
        rationale: 'Mild insult; label it.',
      },
      actor: actorFor(users.moderator),
    });
  });

  const appeal = async (user = users.author) =>
    (await loginAs(user)).post(`/api/decisions/${decision._id}/appeals`).send({ statement: STATEMENT });

  it('routes to an eligible senior moderator and the original moderator gets 403 SAME_REVIEWER', async () => {
    const res = await appeal();
    expect(res.status).toBe(201);
    expect(String(res.body.assignedReviewerId)).toBe(String(users.senior._id));
    expect((await caseFor(content._id)).status).toBe(CASE.APPEAL_PENDING);

    const mod = await loginAs(users.moderator);
    const denied = await mod
      .post(`/api/appeals/${res.body._id}/resolve`)
      .send({ outcome: 'overturned', rationale: 'I changed my mind.' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('SAME_REVIEWER');
  });

  it('routing never assigns the original moderator; no eligible reviewer leaves it unassigned', () => {
    const a = { _id: 'a' };
    const b = { _id: 'b' };
    const c = { _id: 'c' };
    expect(
      chooseReviewer(
        [a, b, c],
        new Map([
          ['b', 3],
          ['c', 1],
        ]),
        'a',
      ),
    ).toBe(c);
    expect(chooseReviewer([a], new Map(), 'a')).toBeNull();
    expect(chooseReviewer([], new Map(), 'a')).toBeNull();
  });

  it('only the content author can appeal, only once, and only for an action other than none', async () => {
    const other = await appeal(users.author2);
    expect(other.status).toBe(403);

    expect((await appeal()).status).toBe(201);
    const again = await appeal();
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_APPEALED');

    const clean = await post(users.author, '@sam you are a worthless idiot, again');
    const kase = await caseFor(clean._id);
    const rejected = await decisionService.applyDecision({
      caseId: kase._id,
      input: { outcome: 'rejected', analysisId: String(kase.currentAnalysisId) },
      actor: actorFor(users.moderator),
    });
    const author = await loginAs(users.author);
    const none = await author.post(`/api/decisions/${rejected._id}/appeals`).send({ statement: STATEMENT });
    expect(none.status).toBe(409);
  });

  it('rejects a statement shorter than 20 characters', async () => {
    const author = await loginAs(users.author);
    const res = await author.post(`/api/decisions/${decision._id}/appeals`).send({ statement: 'too short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields.statement).toBeDefined();
  });

  it('overturn restores visibility and records a stage "appeal" decision', async () => {
    const submitted = await appeal();
    await settle();
    expect((await Content.findById(content._id)).visibility).toBe(VISIBILITY.LABELED);

    const senior = await loginAs(users.senior);
    const detail = await senior.get(`/api/appeals/${submitted.body._id}`);
    expect(detail.body.canResolve).toBe(true);
    expect(detail.body.appealEvidence.aiSummary.summary).toMatch(/Mock summary/);

    const res = await senior
      .post(`/api/appeals/${submitted.body._id}/resolve`)
      .send({ outcome: 'overturned', rationale: 'Context shows it was a lyric.' });
    expect(res.status).toBe(201);
    expect(res.body.decision).toMatchObject({
      stage: 'appeal',
      outcome: 'overturned',
      finalAction: 'none',
      policyVersion: 1,
    });
    expect((await Content.findById(content._id)).visibility).toBe(VISIBILITY.VISIBLE);
    expect((await caseFor(content._id)).status).toBe(CASE.APPEAL_RESOLVED);
    expect((await Appeal.findById(submitted.body._id)).status).toBe('resolved');
    expect(await Decision.countDocuments({ caseId: (await caseFor(content._id))._id })).toBe(2);
  });
});
