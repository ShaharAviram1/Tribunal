# Turn four: several models

Branch `turn-4` from `main` at the turn-three merge. Bound: same prompts, same temperature,
different models. No prompt edits, no schema change, no renderer change beyond what a genuine
defect requires.

Done when: one live multi-model deliberation runs to complete, not incomplete, committed with its
full log; both logs in the repository; the spend-cap revision recorded in spec.md.

## Plan as it stands before any convening

### Seats, and why each was chosen

Every candidate was probed live through the real client, one call each, the real assembled
judge-1 prompt carrying run-02's four stances, checked for a valid opinion. Raw results:
`docs/04-turns/probe/turn-04-seat-probes-*.json`. No seat is proposed unprobed.

| Seat | Model | Probe | Why |
|---|---|---|---|
| jon | openai/gpt-4.1-mini | valid, unfenced, $0.0020, 5.3s | proven across three production runs; cleanest probe of the nine |
| tyrion | anthropic/claude-sonnet-4.5 | valid (fenced, stripped), $0.0213, 10.8s | proven in production; the panel's strongest arguer; fencing now an envelope, not a failure |
| daenerys | google/gemini-2.5-flash | valid (fenced, stripped), $0.0024, 3.2s | the seat that fenced two runs to death now validates, which is the fence revision working |
| greyworm | minimax/minimax-m2.7:free | probe FAILED: empty response after 90s | retained on production evidence, not the probe: ten-plus valid outputs across every single-panel run; the empty flake is known, recurs rarely, and the free chain and three advocate attempts stand behind it. The one seat where the probe and the record disagree, and the record is larger. |
| judge-1 | deepseek/deepseek-chat-v3.1 | valid, unfenced, $0.0013, 28.5s | proven in the last multi run |
| judge-2 | mistralai/mistral-small-3.2-24b-instruct | valid (fenced, stripped), $0.0004, 6.7s | proven in the last multi run; cheapest seat on the bench |
| judge-3 | cohere/command-r-08-2024 | valid, unfenced, $0.0008, 46.3s | replaces qwen3.8-flash, which errored at the provider on every attempt ever made to it; slow but well inside the 90s timeout |

Seven distinct models; no two roles share. Probed but not seated: qwen/qwen3.8-27b (valid,
unfenced, $0.0078, 2,583 output tokens — reasoning-heavy; kept as judge-3's fallback);
meta-llama/llama-4-maverick (502 provider error — struck entirely, including from jon's fallback
slot, which it currently holds; a fallback pointing at a dead provider is worse than none).

Config change on approval, before convening: in `config/models.json`, multi.judge-3 →
cohere/command-r-08-2024; role_fallbacks.judge-3 → [qwen/qwen3.8-27b]; role_fallbacks.jon →
[qwen/qwen3.8-27b] replacing the dead llama. Nothing else moves.

### What the fallback does at a paid seat — the bound question, raised now

Turn three locked per-role fallback for every seat, paid ones included: a seat that fails all its
retries reassigns visibly, on the log, the job map, and the card. That is the standing behaviour
this turn inherits, and it differs from the older no-fallback-at-paid-seats design this plan was
asked about. The question for approval: does it stand for this turn? Position taken by the plan:
it stands, armed but unlikely — the probes exist precisely so no seat should need its net. If a
reassignment fires mid-run, the run still counts as complete, and the merge pack must state that
the no-two-roles-share property broke, visibly, in that run. If instead the approval says paid
seats must fail honestly without reassignment this turn, that is one config edit (empty fallback
lists for the six paid seats) and no code.

### Spend estimate against the $0.25 backstop

Sum of the seven probe costs is $0.028; a clean run with judge-prompt-sized inputs lands near
$0.03–0.05. Worst plausible case — sonnet retrying twice and every seat using its corrective —
stays under $0.12. The backstop is $0.25 and the client refuses the call that would cross it: if
the run trips the cap it terminates failed with the refusal on the log, the evidence is committed
as it stands, and the cap is not raised without a recorded decision.

### Evidence committed, and where

The full export of the complete run — job, all outputs, log — under
`docs/04-turns/e2e/<deliberation_id>/`, alongside the polling transcript; the probe JSON above;
run-02's single-panel log already in the repository, so both logs required by the done-condition
sit side by side; and the spend-cap line in spec.md re-affirmed or revised from the completed
run's measured figure, as a dated revision either way.

## Amended on approval: greyworm earned nothing, and lost the seat

The approval ordered the disputed seat to earn its place on a probe, not on history: three
re-probes, seat kept at 2 of 3. minimax passed 1 of 3 — one valid opinion at 44 seconds between
two empty responses that ran the full 90-second timeout — so by the amendment's own branch, and
by the simultaneous ruling that slow seats go even if the replacement is paid, the seat passes to
qwen/qwen3.8-27b, already probed valid. The first probe's failure, the three re-probes, and the
pass rate are all in `docs/04-turns/probe/`; the record does not read as though the failure never
happened. The multi panel now carries no free seat.

Every fallback slot was then re-pointed at a probed model, because a fallback aimed at an
unprobed or dead model is worse than none: llama-4-maverick (502 on probe) and glm-5.3-flash
(empty at 90s on probe) are struck; deepseek-chat-v3-0324, gemini-2.5-flash-lite and
mistral-small-2603 all probed valid (the flash-lite probe validating through the fence strip is
the revision closing its own loop) and now hold every fallback slot on the panel.

## The ruling, recorded

Per-seat fallback stands, armed, at every seat including paid. The done-when never promised seven
distinct models; no-two-share is a property this seating happens to have, not a demonstration this
turn owes. Disarming locked behaviour so a run reads cleanly would make the record flatter than the
system. If a reassignment fires, the run counts as complete and the merge pack states in one line
which seat reassigned, to what, after how many retries, and that two roles shared a model in that
run as a result.


## The run

`d-T-001-1788273758751-f66e1e36`, convened on the branch deploy the moment the probed panel was
sealed. Complete in 125 seconds: seven calls, seven outputs, zero retries, no corrective, no
truncation, no fallback fired — every seat answered its first call, which is what the probes were
for. Measured spend $0.0444, inside the estimate and re-affirming the $0.25 backstop as a dated
line in spec.md. Full export at `docs/04-turns/e2e/d-T-001-1788273758751-f66e1e36/`; the polling
transcript beside it; run-02's single-panel log already in the repository, so both logs the
done-condition requires sit side by side. The done-condition of the turn is met.
