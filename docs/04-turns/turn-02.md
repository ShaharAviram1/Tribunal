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
