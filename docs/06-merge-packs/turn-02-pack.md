# Merge pack: turn two, storage and the function

Branch `turn-2` (14 commits) into `main`. Evidence under each heading, not assertion.

## 1. Functional completeness

The turn's done condition: the protocol runs unchanged against Supabase through the storage interface; the background function runs a deliberation end to end with the job claimed, budget accumulated across invocations, and re-entry resuming from stored outputs; idempotency drills pass offline; the trigger is HTTP proven by curl.

| Requirement | Evidence |
|---|---|
| Protocol unchanged over Supabase | `src/protocol/run.ts` untouched this turn except the `caps` dep; the same `runDeliberation` ran runs 01–02 (file) and `d-T-001-1788124601994` (Supabase) |
| HTTP trigger, curl-proven | `docs/04-turns/e2e/filing-transcript.txt`: 202 with system-assigned `T-001`; `polling-transcript.txt`: pending → advocates → judges → complete in ~122 s |
| Deployed deliberation complete | `docs/04-turns/e2e/d-T-001-1788124601994/`: job (`status: complete`, `calls: 7`), 7 outputs, 7-row log, $0, all rows `minimax/minimax-m2.7:free` served |
| Atomic claim (criterion 15, rewritten) | `supabase/migrations/0001_tribunal.sql` `claim_job`: claim and become-running in one conditional update, `coalesce(..., false)`; smoke-tested live: pending→true, fresh-running→false, stale→true, terminal→false, missing row→false |
| Heartbeat frees a dead run, not a live one | drill in `tests/store-drills.test.ts`: heartbeating job unclaimable past threshold, dead job freed |
| Terminal never claimable | migration condition; drilled in both store tests; smoke-tested live |
| Budget across invocations | `SupabaseStore.read()` sums `call_log`; `FileStore` sums `log.jsonl`; drill: second client instance sees prior spend |
| Env validated, no silent default | `src/functions-env.ts`; three drills; proven in production: deployed function answered `missing: ["TRIBUNAL_STORE"]` before any call |
| Secrets placement | four secrets + access code in dashboard; config pair per-context in dashboard (runtime) with `SECRETS_SCAN_OMIT_KEYS` by name; `.env.example` names only |
| Migration committed | `supabase/migrations/0001_tribunal.sql`; only what can be opened counts |

Deliberately not in this turn: the page (turn three; `public/index.html` is a one-line placeholder and the record says so), new model behaviour (none: same model, same prompts, same temperature), the multi-model run (turn four).

## 2. Sound verification

186 offline tests, zero network, pinned Node. New this turn: Supabase store semantics against a fake PostgREST boundary; the same idempotency drills against both store implementations, so the contract is what is tested; the heartbeat-holds drill; three env-validation drills that run with the network guard armed. Live verification: the `claim_job` smoke test against the real database (six semantic assertions, scratch rows deleted), and the deployed end-to-end. Platform gate recorded: Netlify secret scanning, its false positive, and the second finding (toml env reaches build, not runtime) are in `gates.md`.

## 3. Engineering hygiene

No new dependencies. The functions import the same client, protocol, and store code the tests exercise. `grep -rn fetch src/protocol` → none; models come from the job row; prompts still load from disk (function bundles include `prompts/` via the repo). One source of truth per environment value: dashboard for runtime, toml for build only. Every commit passed G1–G4; message says why.

## 4. Rationale

**Decided.** Claiming and becoming running are one atomic act (a heartbeat that touches only running rows was a no-op in the gap). Explicit false over falsy null. Terminal never claimable. Fail loudly on missing environment, because the silent fallback would have written a "successful" deliberation into a vanishing filesystem. Branch deploys file, previews don't: the test runs on the branch; a preview that can file can spend. Config out of the scanner by name, never scanning off.

**Rejected.** Porting the timestamp heuristic as the claim (kept only as the file store's documented approximation). A path exemption where a shared definition works. Marking a public URL secret (lessons-learned 5).

**Found the hard way, recorded.** Platform access control binds at deploy creation (lesson 3). Repo-file platform config may reach only the build (lesson 4). A local pass against a deployed failure with identical names is itself the diagnostic: the difference must be a value.

## 5. Audit trail

Commits `9113409` (plan on record) through `db31aa8` (deployed spine proven), 14 in order, each gated. Spec revisions: criterion 15 rewritten with two mechanisms and the problem each solves; part three gained the migration-in-repo rule and the page-reads-JSON-endpoint boundary. Turn record `docs/04-turns/turn-02.md` carries the plan as it stood, every deployment correction with its cause, and the grading note that free Supabase pauses and the committed evidence is the durable record. Lessons-learned gained entries 3, 4, 5. Live evidence: `docs/04-turns/e2e/` (transcripts + exported deliberation), smoke test output quoted in the turn record's history.
