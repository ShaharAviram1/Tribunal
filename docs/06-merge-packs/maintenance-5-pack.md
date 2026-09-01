# Merge pack: maintenance five, the four code defects

Branch `maintenance-5` (6 commits) into `main`. Evidence under each heading, not assertion.
The defects were found by a blind verification subagent reading the documentation pass against
the repository; the ruling that ordered these fixes ordered them before the documents, so that
the documents describe a repository that is actually true.

## 1. What the branch carries

| Change | Commit | Evidence |
|---|---|---|
| A refusal is terminal: no retries, no fallback | `ae875ae` | `src/protocol/run.ts` fails the role on the spot; the correction recorded beside every citation of the fallback ruling (`config/models.json` comment, `src/client/model-client.ts`, `docs/04-turns/turn-03.md`); spec.md criterion 6, revision 2026-09-02, refusal and fallback; drill "a refused role is terminal" in `tests/protocol/reassignment.test.ts` asserts one model in the attempt history |
| The 403 text regex deleted; forbidden is its own condition | `76f8074` | `src/client/openrouter-transport.ts` classifies no prose: any 403 maps to `forbidden`, body verbatim, zero retries, no fallback; spec.md criterion 6, revision 2026-09-02, 403; two drills in `tests/client.test.ts`, one through the real transport with wording no heuristic has seen |
| `temperature_honoured` and `fence_stripped` written as claimed | `b5b22e0` | ok rows carry `temperature_honoured: true` (a provider that rejects the parameter fails the call onto its own row) (Correction, 2026-09-02: the true-or-false instruction assumed an ignoring model was detectable; it is not. The field was removed the same day in favour of `temperature_sent` — spec.md criterion 8, revision 2026-09-02); the log detail notes a stripped fence using `stripOuterFence`, the parser's own definition, exported from `src/protocol/parse-object.ts`; drills in `tests/client.test.ts` |
| Every deliberation counts against the daily cap | `ca95381` | `netlify/functions/tribunal-file.mts` counts all jobs in the window; the "paid = more than one model" filter and the offer to "convene the free panel" are gone |
| Six attempts recorded as deliberate; criterion 12 redone | `b51f68a` | see section 2 |

## 2. The six-attempts fact, established before either change

`git log -S max_attempts_per_role -- config/caps.json`: set to 4 in `7ed5c73`, raised to 6 in
`26dc58d` ("Reassign a failed seat visibly and seal the bench until it rules"), the commit that
added the fallback pass; the turn-three pack cites `max_attempts_per_role` in the same row as
the third-validation-attempt revision. The raise was deliberate — six is three validation
attempts on the primary plus a fresh pass on the fallback — so per the ruling six stays,
recorded in criterion 6 as a dated revision, and criterion 12's derivation is redone honestly:
the neat product never fit at six and never survived transport retries at four either; the
20-call cap evaluated before every dispatch and the re-invoke-reclaim-resume of criterion 15
are the real bounds, with the function ceiling a checkpoint boundary.

## 3. The offline suite

273 tests pass, up from 268: one refusal drill, two 403 drills, two field drills. No key in the
environment, no network reached.

## 4. What did not change

Reassignment after genuine failure — transport, malformed, truncation, a seat that never
answered — stands exactly as ruled on 2026-09-01, drills untouched. No schema, no charge-sheet
rule, no prompt moved.
