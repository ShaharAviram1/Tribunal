# Turn one: the spine

Branch `turn-1`. Bound: all seven roles on one model; no page beyond what proves the run.

## Model for run one, chosen by probe

The probe (`scripts/probe-candidates.ts`) sent the real assembled `daenerys` and `judge-1` prompts once each, temperature 0, `max_tokens` 4,096, fallbacks off, no JSON mode. Raw records: `docs/04-turns/probe/`.

| Candidate | Result |
|---|---|
| openai/gpt-4.1-mini, google/gemini-2.5-flash, anthropic/claude-sonnet-4.5 (first pass, no `max_tokens`) | all 402: the provider reserved each model's maximum output against the key's balance. Finding: every call must set an output ceiling. |
| moonshotai/kimi-k2:free, z-ai/glm-4.5-air:free | 404: "This model is unavailable for free. The paid version is available now." Both slugs went paid-only between my choosing them and the call. |
| z-ai/glm-5.2:free, google/gemma-4-31b-it:free | 429: rate-limited upstream. Not a JSON failure, not a refusal. |
| **minimax/minimax-m2.7:free** | two clean objects, 2.5 s and 5.7 s, $0. **Chosen** by the pre-stated rule: first free candidate returning a clean object. |
| openai/gpt-4.1-mini (with `max_tokens`) | two clean objects, 0.5 s each, $0.0012 and $0.0016. Paid comparison. |

**Free listings change.** Two slugs became paid-only during the probe. The committed run is explained by the `model_served` column of its log, not by the catalogue at the time of reading.

**Corrected.** The probe's 2,303 output tokens on `judge-1` from minimax were not a verbose opinion; the model reasons before answering and the reasoning is billed as output. Run one made this plain: 393 characters of text against 4,096 billed tokens. When opinion length is bounded in the page turn, the bound is on words in the JSON and has no fixed relationship to the token ceiling.

**Rate limit as a cap artefact.** The free tier allows 20 requests a minute and the deliberation cap is 20 calls, so a rate-limited run can end on `cap_exceeded` for a reason that is not a runaway. Transport backoff base is 15 s so that two retries span a per-minute window. If a run ends that way it is recorded as a rate-limit artefact, not a protocol fault.

## Run one (`runs/run-01/`): incomplete, kept as evidence

Seven calls, $0, 102 s. Jon, Daenerys, and Grey Worm produced stances; Tyrion truncated twice at the 4,096-token ceiling; judges correctly not called; job `incomplete` with the reason written. Four failure paths ran for real at zero cost: a 502 recovered by the transport retry with the 15 s backoff, a malformed response detected, a failure record stored with both raw texts and attempt hashes, and a stop before the judge stage with `terminal_reason` set.

What it changed: `max_output_tokens` 4,096 → 16,384 (reasoning counts toward the ceiling); truncation became its own condition with its own remedy, a retry at a raised ceiling rather than a corrective block, since the corrective block restates a format the model had right; call timeout 60 → 90 s with the derivation redone (2 × 90 × 4 = 720 s inside 15 min; 120 s does not fit); the ceiling sent and the finish reason now sit on every log row.

The one-dollar backstop is not replaced from this run: it cost zero because the model is free, so it measures nothing about cost. It waits for a paid run, or for an estimate from these token counts against run two's models, labelled as an estimate.

**Observation to watch, not to fix.** All three successful advocates concluded `not_justified`, and Tyrion's truncated second attempt was also `not_justified`; Jon, defending himself, did the same. The simulation rule allows it. If the defense seats never make a defense case, the judges read a one-sided record. Run two decides whether this is the model or the prompts; the prompts are not touched before then.

## Run two of this turn (`runs/run-02/`): complete

Seven calls, seven outputs, zero retries, $0, 127 s wall clock. Advocate stage 60 s (longest call, Tyrion, 59.6 s; sum of the four latencies 164 s, so criterion 13's concurrency evidence holds), judge stage 68 s. Output tokens 1,717 to 6,287 per call under the 16,384 ceiling; every finish reason `stop`. `model_served` equals `model_requested` on all seven rows. This is the committed single-model deliberation that problem.md item 8 requires, and the seed for the fresh-clone criterion.

**What it taught.**
- Reasoning output is large and variable: judge-2 spent 6,287 tokens, judge-3 1,717, on the same stances. The 4,096 ceiling would have cut four of these seven.
- Latency tracks reasoning: 23 to 68 s. The 90 s timeout held with 22 s to spare on the slowest call. Timeout is the binding constraint on a free reasoning model, not cost.
- All four advocates, both defense seats included, concluded `not_justified`, for the second run in a row. All three judges then found `not_justified` on near-identical grounds (imminence, alternatives, authority, method), each citing the same four points. This is the pitfall spec.md part five names: three judges on one model agreeing because they share it. Run one demonstrates the pipeline and licenses no conclusion about the judges; this run shows exactly why that sentence is in the spec.
- The three opinions differ in manner more than in matter: judge-1 builds four sequential tests, judge-2 cites eight ids in one reason and reaches for precedent language, judge-3 stays with chronology and offices and leaves `against.relies_on` empty, saying the counter-consideration is one no advocate raised. The prompts are distinguishing manner; whether they can distinguish matter on one model is the question turn four exists to answer.

**Observation carried forward, unchanged.** The defense seats made no defense case in either run. Not touched before the multi-model run.

## Locked
- Model for the single-model run: `minimax/minimax-m2.7:free`, chosen by probe; served model recorded on every row.
- `max_output_tokens` 16,384; timeout 90 s; truncation as its own condition.
- Refusal is the provider's signal only; failure records store raw text; the run resolves, never throws.
- The twenty gaps from the blind test-writer and how each closed: see the section below.

## The blind test-writer's twenty gaps and how each closed
1. Job row fields and statuses: decided, criterion 16. 2. Prose refusal heuristic: rejected, refusal is provider signal only, criterion 6. 3. Corrective block wording: literal reading, restates format and names field. 4. `unresolved` contents: every id once, encounter order. 5. Throw or resolve: resolves, criterion 18. 6. Transport failure terminal for the role: yes. 7. Cap mid-stage: await in-flight, store, terminate, criterion 1. 8. Failed role storage: failure record, criterion 17. 9. Judge labels: `config/roles.json`, not `models.json`. 10. Absent output: `undefined`. 11. Log rows: client writes them; protocol syncs totals to the job. 12. Concurrency evidence: log timestamps now exist; the fake measures in-flight count. 13. Block layout blank lines: fixed by the renderer, asserted by test. 14. Stances order: jon, tyrion, daenerys, greyworm. 15. Failures unordered. 16. Type errors: CS-06 added. 17. Missing field is CS-01 only. 18. Judge failure: job `incomplete`. 19. Staleness: ceiling plus margin. 20. Re-entry trusts stored objects.
