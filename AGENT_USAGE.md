# Agent usage

How AI coding tools were used to build this project, what they got wrong, and how the output was checked.

## Tools

| Tool                                    | Used for                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Claude Code (desktop app), Claude Opus  | Writing and editing code, running commands, tests and the app, reading docs       |
| Claude Code subagents                   | Two delegated tasks in the final session (below)                                  |
| Claude Code browser pane                | Clicking through the running app: login, queue, case detail, decision form, audit |
| Google Gemini (`gemini-3.5-flash-lite`) | Runtime only: the AI reviewer inside the product, not a coding tool               |

Three working sessions, each started from a written brief:

1. **Oct 4:** backend first, then the frontend, built from a written build blueprint (architecture, data
   model, rules, API and test list) and a UI style reference (memorable.sh: minimal, thin borders, smooth).
2. **Oct 5 (morning):** switch the AI provider from Anthropic to Gemini's free tier, verify the database and
   write the full README.
3. **Oct 5 (afternoon):** final hardening: demo accounts and data, admin access, Vercel deployment, cleanup
   and documentation.

## Representative prompts

Lightly edited for spelling.

| Prompt                                                                                                                                     | What came back                                                                                        | What I kept                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| "Develop it as given in the blueprint. Don't do anything outside the instructions."                                                        | Started on the UI reference first                                                                     | Stopped it and redirected: "first make the backend and make sure it works, then the frontend" |
| "Scan this and do everything it says; nothing outside it."                                                                                 | Express + Mongoose services, rules, AI layer, seed, 53 server tests, CI                               | All of it, after the test suite and a live run against Atlas passed                           |
| "Keep the UI minimalistic like memorable.sh, very smooth, thin highlighted borders."                                                       | React 19 SPA, 9 screens, dark theme, Geist / Instrument Serif                                         | Kept; spot-checked in the browser pane                                                        |
| "I've decided to use the free Gemini API instead of Anthropic; change the code."                                                           | New `geminiClient.js` with forced function calling; same schema, validation, repair retry and logging | Kept. The provider is swappable through `AI_PROVIDER`                                         |
| "Write a full README: every endpoint, input and response, feature by feature."                                                             | A 1,500-line README                                                                                   | Kept, then restructured in the final session (architecture, scope, limitations, Vercel)       |
| "Create admin@example.com with password 1234, add example data, make it fully usable, finish the docs, make it ready to deploy on Vercel." | Seed changes, admin read-only oversight, Gemini back-off, Vercel Services config, docs                | Kept, after an end-to-end run through the Vercel entry point                                  |

## Delegated work

**What the agent wrote:** nearly all of the code, tests and documentation, working from my brief.

**What I did:**

- Wrote the brief: requirements, architecture and the "AI recommends, humans decide" rule.
- Chose the UI reference and the AI provider.
- Set up MongoDB Atlas and the Gemini key.
- Reviewed the results and redirected the agent when it went off course.
- Handle all git commits and pushes myself. The agent was told not to commit.

**Subagents (final session):**

1. Reading the earlier session transcripts and summarising prompts, mistakes and verification steps for this
   file (secrets redacted).
2. A comment-only cleanup across 63 source files: removed comments that restated the code, made the rest
   host-neutral. It was told not to touch executable lines. Afterwards I checked the diff: no code line changed,
   and lint and all tests still passed.

## Agent mistakes and rejected suggestions

- **Wrong starting point.** It began with the UI before the backend existed. I interrupted and changed the
  order.
- **Dependency drift.**
  - npm installed Mongoose 9 although the brief said 8. Pinned back to 8.
  - An ESLint React plugin failed to install against ESLint 10. The config was changed instead.
- **Claude API with forced tool calls.** The newest Claude models rejected the forced-tool-call pattern, and the
  API needs paid credit. I chose Gemini's free tier instead, and the Anthropic client and SDK were removed.
- **Retired model.** `gemini-2.5-flash` returned 404 for new keys. Switched to `gemini-3.8-flash`.
- **Daily quota.** `gemini-3.8-flash` turned out to allow only 20 free requests per day, so new posts started
  failing with 429. Four candidate models were tested with the app's real request, and `gemini-3.5-flash-lite`
  (valid output, about 6 s, separate quota) became the default. The History and case pages now say exactly why
  an AI review failed (overloaded, quota, timeout, invalid output) instead of a bare "AI error".
- **Atlas connection.**
  - "bad auth" was caused by the `<` `>` template brackets left in `MONGODB_URI`.
  - On this Windows machine, Node's resolver cannot do `mongodb+srv` SRV lookups. The first workaround was to
    hand-edit the URI. The final fix is in code: `DNS_FALLBACK` retries the lookup through public DNS only
    when it fails.
- **Corrupted README.** The original file was UTF-16 and the first rewrite kept that encoding. Prettier then
  mangled it, so it was rewritten as UTF-8.
- **Secrets in the wrong file.** `.env.example` (which is committed) briefly held a real database password
  and API key. The agent caught it, restored the placeholders and advised rotating both.
- **Its own UI bugs, caught in testing.**
  - The audit pager reset its own page.
  - The "To" date filter excluded that day.
  - In the final session, the login page's password field had lost its label association (an `id` override).
- **Seeding hit the Gemini free tier.** About 5 requests per minute, plus `503` overloads, so most seeded cases
  fell back to rule findings only. Two changes fixed it:
  - The seed now uses the deterministic mock by default (`SEED_AI_PROVIDER`).
  - The Gemini client waits for the server's `retryDelay` hint, within a fixed time budget.
- **A hung shell command.** A stray `cat >` waited on stdin. Long heredocs also failed in the Windows shell,
  so the agent switched to writing files directly.
- **Rejected suggestion: letting admins decide cases** so "admin can test everything". Admins got read-only
  access to the queue, cases and audit log instead. Decisions stay with moderators; both the route and the
  service enforce it, and a test covers it.

## How I verified output

- **Automated:**
  - `npm run lint` (ESLint + Prettier) runs clean.
  - `npm test` passes: 61 server tests on an in-memory MongoDB replica set, and 9 client tests.
  - CI runs both on every push.
- **Live database:** the seed ran against Atlas. Its output: 5 users, policy v1, 15 items, and cases split 10
  awaiting review, 6 auto-cleared, 1 resolved.
- **End-to-end:** a scripted run through the Vercel function entry point in production mode
  passed 25 of 25 checks:
  - all 5 logins
  - post → background analysis → moderator decision → visibility change
  - admin blocked from deciding
  - author appeal → original moderator refused (`SAME_REVIEWER`) → senior overturn
  - user report
  - publish v2 → re-evaluation 12/12 → v2 the only active policy
  - audit events for each step
- **Gemini:** live calls checked:
  - A verified quote with VIO-1 at 0.98 confidence; the content stayed visible until a human decided.
  - During an overload, the safe fallback to "AI review unavailable".
- **Browser walkthrough with live Gemini**, every role, through the single `npm run dev` command:
  - author posts → Gemini cites HAR-1 and VIO-1 with verified quotes, interpretation, severity and confidence
    reasons, and six "why a human must decide" reasons; the post stays visible
  - another user reports it → the moderator modifies the action to "limit" (saved with policy v1)
  - author appeals with evidence → the original moderator cannot resolve it → the senior overturns it and the
    post is visible again
  - admin publishes v2 from the in-browser editor → 10/10 cases re-analysed by Gemini (the new IMP-1 clause and
    the stricter SPAM-1 both took effect)
  - the History page shows the full AI review to staff and plain status, decision, appeal evidence and outcome
    to the author; a forced AI failure shows its reason instead of a bare "AI error"
  - admin sees the queue, cases and audit log read-only
- **Secrets:**
  - `.env` is git-ignored.
  - Every file a commit would include, and the git history, were scanned for the real `.env` values. No
    matches.
  - Logs were checked for leaked post text or keys. None found.

## Responsible use

- Every line of agent output was reviewed through tests, lint, live runs or reading before it was kept.
- The agent never had commit or push rights; I made all commits.
- Secrets stay in `.env` (ignored). `.env.example` holds names only. The demo password `1234` is a documented
  test credential for seeded accounts, not a production one.
- In the product itself, the AI can only recommend. A human makes every visibility change, and that is
  enforced in code and tests.
