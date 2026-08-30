# Turn two: storage and the function

Branch `turn-2`. Bound: no new model behaviour; no page.

## Intent

Move the deliberation behind an HTTP trigger and a database without the protocol noticing, so that turn three can build a page against a JSON endpoint and turn four can swap models without touching storage.

## Plan as it stood before the work

As proposed and amended on 2026-08-30, before any code in this turn:

1. The storage interface (`Store` + `Budget`) is the only storage contract. `SupabaseStore` joins `FileStore` behind `TRIBUNAL_STORE=file|supabase`; everything reads through the interface. `FileStore` is a permanent configured implementation, what a fresh clone runs with, not scaffolding.
2. The claim uses two mechanisms, and the spec says which problem each solves. An atomic conditional write prevents two claimers at once. A heartbeat the function updates as it works, with a stale threshold, frees a job whose function died mid-run. Claimable when `pending`, or when `running` with a heartbeat older than the threshold. Terminal statuses are never claimable, or the platform's re-invocation could claim a complete job and run it again.
3. The Supabase schema is a SQL migration committed in the repository. A table created in the dashboard is invisible to a reader; only what can be opened counts.
4. The trigger is HTTP, proven by curl: a filing function (access code, rule validation, stamp, job row, invoke background) and a background function behind a shared secret header, since the access code protects filing and the background path is otherwise reachable by anyone who guesses it. The done condition includes committed transcripts of the filing curl and the polling curl.
5. Secrets: OpenRouter key, Supabase service-role key, access code, and function secret in Netlify's environment and local `.env` only; `.env.example` names them with no values. G1's JWT pattern was written for the Supabase key shape deliberately.
6. The page, when it comes in turn three, reads a JSON endpoint that goes through the storage interface server-side. The service-role key cannot reach the browser, and turn three does not begin by discovering that.
7. Offline drills run against both store implementations behind a fake HTTP boundary; the idempotency drills (re-entry, claim lost, budget across invocations) test the interface, not an implementation.
8. One live end-to-end on the deployed function against the real project, its job row, outputs, and log exported and committed.

Steps 1 to 7 are unblocked; step 8 waits for the Supabase project and the linked Netlify site.

## Amended during setup, before any deployment

`claim_job` originally left the status transition to the protocol: the claim wrote timestamps, the protocol later wrote `running`. In that gap `heartbeat_job`, which touches only running rows, was a no-op, so the heartbeat went stale on schedule and a second invocation could claim a job still being worked. Claiming and becoming `running` are now one atomic update, and the function returns `coalesce(..., false)` so the no-row case is an explicit false rather than a null that happens to be falsy. Drilled: a heartbeating job stays unclaimable past the stale threshold; a dead one is freed; a missing row claims false.

**Grading note.** Free Supabase projects pause after inactivity, so the deployed site should be expected to be asleep when this repository is graded. The durable evidence is the committed file-store run and the exported transcripts, not the deployment.

**Deployment corrections.** `public/index.html` is a one-line placeholder so the publish directory exists; it is not the page, and the turn-two bound holds. Two environment problems were found in the Netlify config during setup: `TRIBUNAKL_FUNCTION_SECRET` (typo) and `TRIBUNAL_STORE` absent from the resolved config. The correction is hardened rather than just applied: both functions validate their required environment first and fail loudly with the missing names, making no model call, because a missing `TRIBUNAL_STORE` silently falling back to the file store would have produced a deliberation that appeared to work and wrote into a filesystem that disappears with the invocation. Drilled offline for both functions.

**Why the two non-production contexts differ.** Branch deploys can file (`TRIBUNAL_FILING_ENABLED = "true"`): the end-to-end curl test runs against the turn branch's deploy before any merge, and a filing switched off there would refuse the very test the turn exists to pass. Deploy previews cannot file: a pull request from anywhere gets a preview, and a preview that can file can spend.

**Deployment, first night's record.** The push of `turn-2` at first produced no build: branch deploys were disabled on the Netlify side, so the branch never built at all. Once enabled and built, every path on the branch deploy, placeholder and functions alike, answered Netlify's edge-access 401, because the project was private by default; our own access-code check never ran, since the request died at the platform's door. Both settings are now changed: branch deploys enabled for all branches, project visibility public. Verified with cookie-free curls, not a logged-in browser, which proves nothing.

**The env drill caught a platform fact.** With the project public and the branch rebuilt, `GET /` answered 200 and the filing POST answered our own JSON: `missing: ["TRIBUNAL_STORE"]`. The toml context environment reaches the build, not the function runtime. Without the fail-loudly rule this would have been a silent file-store deliberation into a vanishing filesystem reported as success. The two config variables move to the dashboard per context, exempted from the scanner by name.

**One source of truth per value.** The toml context blocks are removed: the dashboard is the runtime source, the toml is the build source, and keeping the same value in both is two sources of truth that drift without warning. `SECRETS_SCAN_OMIT_KEYS` stays in `[build.environment]`, which really is build-time.

**The mismatch was the diagnostic.** The local smoke test passed while the deployed function failed with the same code and the same credential names; only the values could differ, which pointed straight at the environment rather than the code. `SUPABASE_URL` in the dashboard was the project's dashboard URL, not its API host, and was masked as a secret so nobody could see it was wrong. Corrected in every context, and unmasked, since it is a public endpoint (lessons-learned entry 5).

## End-to-end on the deployed function: complete

Branch deploy `https://turn-2--incomparable-hotteok-4da2cf.netlify.app`. Filed `fixtures/charge-sheets/T-001.filed.json` by curl with the access code; the system assigned `T-001` and `d-T-001-1788124601994`, answered 202, and the background function ran the deliberation to `complete` in about 122 seconds: advocates stage, then judges, 7 calls, 7 outputs, zero retries, zero failures, $0 on the free model. Transcripts: `docs/04-turns/e2e/filing-transcript.txt` and `polling-transcript.txt`. Database evidence exported to `docs/04-turns/e2e/d-T-001-1788124601994/` (job, outputs, log). The claim, heartbeat, budget-on-the-job, and stage machinery all ran on the real platform: Netlify function to Supabase to OpenRouter and back.

## Production confirmed after merge

`main` merged (`--no-ff`) and pushed; first production deploy live at `https://incomparable-hotteok-4da2cf.netlify.app`. Cookie-free checks: `GET /` answers 200 with the placeholder; an uncoded filing POST answers our own JSON 401, `access code missing or wrong`, not the platform's edge-access page. Turn two closes here.
