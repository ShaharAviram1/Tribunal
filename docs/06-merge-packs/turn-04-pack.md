# Merge pack: turn four, several models

Branch `turn-4` (3 commits) into `main`. Evidence under each heading, not assertion.

## 1. Functional completeness

The turn's done-condition: one live multi-model deliberation running to complete, committed with
its full log; both logs in the repository; the spend-cap revision recorded in spec.md.

| Requirement | Evidence |
|---|---|
| Complete multi-model deliberation | `docs/04-turns/e2e/d-T-001-1788273758751-f66e1e36/`: job `status: complete`, 7 calls, 7 outputs, zero retries; polling transcript beside it |
| Seven distinct models, every seat probed before seating | `docs/04-turns/probe/turn-04-seat-probes-*.json`: fourteen live probes through the real client; the seat table in `docs/04-turns/turn-04.md` cites each |
| Both logs in the repository | `runs/run-02/log.jsonl` (single panel) and the export's `log.jsonl` (multi panel) |
| Spend line as a dated entry | spec.md criterion 2: $0.25 re-affirmed 2026-09-01 against the measured $0.0444 |
| Bound held | Same prompts (no file under `prompts/` changed this turn: `git diff main..turn-4 --stat -- prompts/` is empty), same temperature 0, models changed in `config/models.json` only |

problem.md item 8 is now satisfied in full: one committed deliberation on one model, one across
more than one, each log saying which.

## 2. Sound verification

265 offline tests green at every commit. Fourteen live probes: nine first-round candidates, three
re-probes of the disputed seat, two fallback candidates — each a single call through the real
`ModelClient` and `openRouterTransport`, validated with the real `validateOpinion`. The
fence-strip revision validated five fencing models across the probes, closing its own loop. The
run itself: seven first-attempt answers, no corrective, no truncation, no reassignment — the log
is the verification.

## 3. Engineering hygiene

Three commits, each gated. The only code added is `scripts/probe-turn4.ts`, a throwaway harness
using the real client; no dependency, no schema change, no renderer change, no prompt edit. The
seating and fallback changes live entirely in `config/models.json`.

## 4. Rationale

**Decided.** The probe is the door: no model is seated unprobed, and a model that was probed and
failed sits worse than one never probed. minimax lost the greyworm seat on a 1-of-3 re-probe by
the amendment's own branch, concurrent with the ruling that slow seats go even if the replacement
is paid; the panel now carries no free seat. Every fallback slot points at a model probed the same
day; llama-4-maverick (502) and glm-5.3-flash (empty at the timeout) were struck. The per-seat
fallback stands armed at every seat including paid, by ruling: no-two-share is a property this
seating happens to have, not a promise the turn made, and disarming locked behaviour to make a
run read cleanly would make the record flatter than the system. No reassignment fired, so no
property broke.

**Rejected.** Seating on production history against a failed probe; emptying paid fallback lists
for cosmetic cleanliness; raising the spend cap ahead of any measurement that needs it.

## 5. Audit trail

Commits: `e093ac2` plan with probed seats; `30ffda3` seat trial, ruling, config; `a97848e` the
complete run. Probe records under `docs/04-turns/probe/`, the run export and transcript under
`docs/04-turns/e2e/`, the turn record `docs/04-turns/turn-04.md` carrying the amendment, the
ruling verbatim in substance, and the run section. Spec revision: the dated re-affirmation on
criterion 2. The three verdicts of the run — justified, justified, justified, from three
different companies' models ruling alone — are in the export, not in this pack's arithmetic.
