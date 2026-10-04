import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ACTOR_TYPE, CASE, VISIBILITY } from '../src/constants.js';
import { Content } from '../src/models/index.js';
import * as appealService from '../src/services/appealService.js';
import * as decisionService from '../src/services/decisionService.js';
import { caseFor, connect, disconnect, post, resetDb } from './helpers.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('hard rule: the AI recommends, humans decide', () => {
  let users;
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    users = await resetDb();
  });

  it('refuses an AI or system actor calling applyDecision with HUMAN_REQUIRED', async () => {
    const content = await post(users.author, '@sam you are a worthless idiot');
    const kase = await caseFor(content._id);
    for (const type of [ACTOR_TYPE.AI, ACTOR_TYPE.SYSTEM]) {
      await expect(
        decisionService.applyDecision({
          caseId: kase._id,
          input: { outcome: 'approved', analysisId: String(kase.currentAnalysisId) },
          actor: { type },
        }),
      ).rejects.toMatchObject({ code: 'HUMAN_REQUIRED', status: 403 });
    }
    expect((await caseFor(content._id)).status).toBe(CASE.AWAITING_REVIEW);
  });

  it('never changes content visibility through analysis, even for a clear violation', async () => {
    const content = await post(users.author, '@sam you are a worthless idiot. I will hurt you.');
    const kase = await caseFor(content._id);
    expect(kase.status).toBe(CASE.AWAITING_REVIEW);
    const stored = await Content.findById(content._id).lean();
    expect(stored.visibility).toBe(VISIBILITY.VISIBLE);
  });

  it('refuses a system actor resolving an appeal', async () => {
    await expect(
      appealService.resolve({
        appealId: '000000000000000000000000',
        input: { outcome: 'overturned', rationale: 'System tries to overturn.' },
        actor: { type: ACTOR_TYPE.SYSTEM },
      }),
    ).rejects.toMatchObject({ code: 'HUMAN_REQUIRED' });
  });

  it('fails lint if moderation/ai imports decisionService', async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const [result] = await eslint.lintText(
      "import { applyDecision } from '../../services/decisionService.js';\n",
      {
        filePath: `${REPO_ROOT}server/src/moderation/ai/sneaky.js`,
      },
    );
    expect(result.messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
  });
});
