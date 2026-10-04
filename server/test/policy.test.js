import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CASE, POLICY_STATUS } from '../src/constants.js';
import { Analysis, Case, Policy, ReevaluationRun } from '../src/models/index.js';
import * as decisionService from '../src/services/decisionService.js';
import * as policyService from '../src/services/policyService.js';
import { processRun } from '../src/services/reevaluationService.js';
import {
  actorFor,
  caseFor,
  comment,
  connect,
  disconnect,
  loginAs,
  post,
  resetDb,
  settle,
} from './helpers.js';
import * as contentService from '../src/services/contentService.js';

describe('policy publishing and re-evaluation', () => {
  let users;
  let twoLinks;
  let decidedCase;

  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    users = await resetDb();
    const soup = await post(users.author2, 'Does anyone have a good lentil soup recipe?');
    twoLinks = await comment(
      users.author2,
      soup._id,
      'Check https://deals.example/spices and https://deals.example/pots',
    );
    await contentService.reportContent({
      contentId: twoLinks._id,
      reasonCode: 'spam',
      note: '',
      actor: actorFor(users.author),
    });
    await settle();
    const insult = await post(users.author, '@sam you are a worthless idiot');
    decidedCase = await caseFor(insult._id);
    await decisionService.applyDecision({
      caseId: decidedCase._id,
      input: { outcome: 'approved', analysisId: String(decidedCase.currentAnalysisId) },
      actor: actorFor(users.moderator),
    });
  });

  async function publishV2() {
    const admin = await loginAs(users.admin);
    const res = await admin.post('/api/policies').send(await policyService.readPolicyFile(2));
    await settle();
    return res;
  }

  it('publishing v2 leaves exactly one active version', async () => {
    const res = await publishV2();
    expect(res.status).toBe(201);
    expect(res.body.policy.version).toBe(2);
    const active = await Policy.find({ status: POLICY_STATUS.ACTIVE }).lean();
    expect(active.map((p) => p.version)).toEqual([2]);
    expect((await Policy.findOne({ version: 1 })).status).toBe(POLICY_STATUS.RETIRED);
  });

  it('only admins can publish, and an invalid file is rejected', async () => {
    const mod = await loginAs(users.moderator);
    expect((await mod.post('/api/policies').send(await policyService.readPolicyFile(2))).status).toBe(403);
    const admin = await loginAs(users.admin);
    const bad = await admin.post('/api/policies').send({ changelog: 'x', clauses: [{ code: 'bad' }] });
    expect(bad.status).toBe(400);
    expect(await Policy.countDocuments()).toBe(1);
  });

  it('turns the 2-link comment into a SPAM-1 finding under v2', async () => {
    const before = await caseFor(twoLinks._id);
    expect(before.status).toBe(CASE.AWAITING_REVIEW);
    const v1 = await Analysis.findById(before.currentAnalysisId).lean();
    expect(v1.ruleFindings).toHaveLength(0);

    await publishV2();
    const after = await caseFor(twoLinks._id);
    const v2 = await Analysis.findById(after.currentAnalysisId).lean();
    expect(v2.policyVersion).toBe(2);
    expect(v2.ruleFindings.map((f) => f.clauseCode)).toContain('SPAM-1');
    expect(after.policyChangedFrom).toBe(1);
    expect(after.status).toBe(CASE.AWAITING_REVIEW);
  });

  it('re-analyses only unresolved cases; resolved ones keep v1', async () => {
    const res = await publishV2();
    const decided = await Case.findById(decidedCase._id).lean();
    expect(decided.status).toBe(CASE.RESOLVED);
    expect((await Analysis.findById(decided.currentAnalysisId)).policyVersion).toBe(1);
    expect(await Analysis.countDocuments({ caseId: decidedCase._id })).toBe(1);
    const run = await ReevaluationRun.findById(res.body.reevaluationRunId).lean();
    expect(run.status).toBe('completed');
    expect(run.total).toBe(await Case.countDocuments({ policyChangedFrom: 1 }));
  });

  it('running the job twice does not create duplicate analyses', async () => {
    const res = await publishV2();
    const count = await Analysis.countDocuments();
    const run = await ReevaluationRun.findById(res.body.reevaluationRunId).lean();
    const caseIds = await Case.find({}).distinct('_id');
    await processRun(run._id, caseIds, { toVersion: 2 });
    expect(await Analysis.countDocuments()).toBe(count);
  });

  it('shows a clause-by-clause diff', async () => {
    await publishV2();
    const mod = await loginAs(users.moderator);
    const res = await mod.get('/api/policies/diff?from=1&to=2');
    const byCode = Object.fromEntries(res.body.clauses.map((c) => [c.code, c]));
    expect(byCode['IMP-1'].change).toBe('added');
    expect(byCode['SPAM-1'].change).toBe('changed');
    expect(byCode['HAR-1'].fields).toContain('text');
    expect(byCode['VIO-1'].change).toBe('unchanged');
  });
});
