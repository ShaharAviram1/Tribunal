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
