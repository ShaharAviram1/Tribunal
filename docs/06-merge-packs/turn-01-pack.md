# Merge pack: turn one, the spine

Branches `turn-0` (2 commits) and `turn-1` (8 commits) into `main`. Evidence under each heading, not assertion.

## 1. Functional completeness

Criteria from problem.md section 3 and spec.md part two that this turn satisfies, each with the output that shows it.

| Criterion | Evidence |
|---|---|
| problem.md 1: seven outputs, seven calls, four stances and three opinions | `runs/run-02/log.jsonl` has exactly 7 rows; `runs/run-02/outputs/` has 7 files |
| problem.md 2: 3–5 points, claim plus support, system-assigned ids | `runs/run-02/outputs/jon.json` … `greyworm.json`: 5 points each, ids `<role>.p1..p5` |
| problem.md 3: verdict is one of two strings; every `relies_on` resolves | three opinion files, `verdict: "not_justified"`; validator asserts resolution (`tests/protocol/opinion.test.ts`) |
| problem.md 5: charge sheet rejected before any model call, failing rule named | `src/protocol/validate-charge-sheet.ts`; `tests/protocol/charge-sheet.test.ts` (7 invalid fixtures, multi-failure case) |
| problem.md 6: log with role, model, temperature, tokens in/out, cost, latency, outcome | any row of `runs/run-02/log.jsonl` |
| problem.md 7: failed call shown as failure, never as a verdict | `runs/run-01/outputs/tyrion.json` is a failure record with both raw texts; `tests/protocol/run.test.ts` "failure record carries no output key" |
| problem.md 8 (half): committed single-model deliberation with the log showing which | `runs/run-02/job.json` `models` map, all `minimax/minimax-m2.7:free`; multi-model run is turn four |
| problem.md 11: prompts as versioned files loaded at runtime | `prompts/*.md`; `tests/assembly.test.ts` "prompts are read from disk" |
| problem.md 12: charge sheet spec as a document separate from code | `docs/charge-sheet.spec.md` |
| spec 1, 2, 10, 11: caps from config, frozen, refusal path tested | `tests/client.test.ts` call cap, spend cap, per-role ceiling, frozen caps, budget-from-job |
| spec 4: no key in any response, bundle, or committed file | `git log -p \| grep -c 'sk-or-v1-[0-9a-f]\{20\}'` → 0; G1 refused a fabricated key on 2026-08-30 |
| spec 5: offline suite passes with zero live calls | `npm test` → 173 pass; `tests/_guard.ts` blocks `fetch` and refuses a key in the environment |
| spec 6: retry rules | `tests/protocol/run.test.ts` malformed/unresolvable/refusal/transport; `tests/protocol/truncation.test.ts` |
| spec 7: row per attempt, hash of assembled prompt | `runs/run-01/log.jsonl` has 7 rows for 5 logical calls (one 502, two corrective retries); `prompt_hash` on every row |
| spec 8: temperature 0 on every row | `temperature: 0` on all 14 committed rows |
| spec 13: advocate stage wall clock < sum of latencies | run-02: stage ≈ 60 s, sum 164 s |
| spec 14: stop before judges on fewer than four stances | `runs/run-01/job.json`: `status: incomplete`, `stage: advocates`, `terminal_reason` names 3 of 4; zero judge rows in its log |
| spec 15, 16, 17, 18 | `tests/protocol/run.test.ts` re-entry and claim tests; `Job` shape in `src/protocol/run.ts`; failure record tests; `runDeliberation` resolves (run-01 exited 0) |

Not satisfied this turn, by design: problem.md 4, 9, 10 (the page: turn three), 8's second half (turn four), spec 3 (the provider-side credit limit is set outside the repository and cannot be shown here), spec 9 (turn four).

## 2. Sound verification

**Gates that ran.** G1–G4 on every one of the 10 commits (hook wired via `core.hooksPath`). Refusals during the turn: G3 refused `70fca90`'s first attempt on `tests/protocol/no-aggregation.test.ts`, which names the forbidden words to forbid them; resolved by a shared definition in `config/forbidden-vocabulary.json` (commit `3081e13`), not a path hole.

**Tests written blind.** 144 of the 173 tests were written by an agent shown only the documents (`tests/protocol/`). The implementation was written to pass them. The agent's twenty gaps are listed in `docs/04-turns/turn-01.md` with how each closed; six were decisions and became criteria 16–18, a rewritten criterion 6, and CS-06.

**Failure modes exercised for real, at zero cost**, in `runs/run-01/`: HTTP 502 recovered by transport retry with backoff; malformed (truncated) response detected; failure record stored with attempt hashes and raw text; judges not called; job incomplete with a reason.

**Failure modes the gates would have caught** had they occurred: a key in a commit (G1), a staged `.env` (G2), a `majority` helper (G3, and it did), a broken assembly or a drifting charge sheet block (G4/G5), a prompt turned into a string (G6).

**What is not verified.** Character fidelity (out of scope by problem.md). That the three opinions differ in matter on one model: they do not, and the turn note says so.

## 3. Engineering hygiene

- **Boundaries** (spec part three): key read only in `scripts/*` and passed to `openRouterTransport`; the browser does not exist yet; all model access through `src/client/model-client.ts`; protocol has no model call (`grep -r fetch src/protocol` → none); prompts loaded from disk at call time.
- **No inline prompts**: `grep -rn "You are\|You sit as" src/` → none.
- **No hard-coded model**: models come from the CLI argument or a JSON map; `grep -rn "minimax\|gpt-4" src/` → none.
- **No secrets**: `.env` ignored and refused by G2; `.env.example` has names only; history grep for the key prefix returns nothing.
- **Pinned runtime**: `.nvmrc` 24.11.1, `netlify.toml`, `engines`, `.npmrc engine-strict`, guard on major.minor.
- **No dependencies**: `package.json` has none.
- One logical change per commit; every message says why.

## 4. Rationale

**Decided.** Refusal is the provider's signal only (a text heuristic would have thrown away an advocate opening in character). Failed roles are stored as failure records that share no key with an output. A cap refuses new dispatch, awaits in-flight calls, stores what returns. The run resolves rather than throws, because the platform re-invokes on a throw. Truncation is its own condition with its own remedy. Output ceiling 16,384; timeout 90 s by derivation (2 × 90 × 4 = 720 s fits, 120 s does not). Model for run one chosen by probe, not reputation.

**Rejected.** A prose-refusal pattern list. A reasoning-exclusion request parameter (run two must vary only the model). Replacing the one-dollar backstop from a free run (it measured nothing about cost). Adjusting prompts after two unanimous runs (wait for the multi-model run). A path exemption for the vocabulary test. Exact-patch Node pinning.

**Carried as a note, not an action.** The panel was unanimous because the record it read was one-sided. If several models reproduce it, examine the advocate stage. Judge prompts are not adjusted to produce disagreement.

## 5. Audit trail

**Commits, in order.** `turn-0`: `ddca011` gates before code; `8fa99bb` guard narrowed, model-call constraints. `turn-1`: `7ed5c73` client module; `70fca90` protocol passing blind tests; `2030f15` file store; `3081e13` shared vocabulary; `478a9f7` output ceiling and probe records; `4a650df` run-01 kept as evidence; `ce2719c` truncation condition; `bfbac76` run-02.

**Spec revisions this turn**, all in `spec.md` history: part three gained the runtime, the language, `max_output_tokens`, the two model-call constraints, the execution shape made unconditional with platform retry rules; part two gained criteria 12 (redone), 15–18, and a rewritten 1 and 6; part five gained four pitfalls. `docs/charge-sheet.spec.md` gained CS-06. Both schemas gained the truncation and provider-signal rows and lost the prose-refusal claim.

**Runs.** `runs/run-01/` incomplete, 7 rows, $0. `runs/run-02/` complete, 7 rows, $0, the committed single-model deliberation.

**Probe records.** `docs/04-turns/probe/`, three passes, explained in its README.

**Lessons.** `docs/lessons-learned.md` entries 1 and 2.
