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

**Open item, with evidence.** minimax spent 2,303 output tokens on `judge-1` where gpt-4.1-mini spent 411 on the same prompt. The opinion has no word bound; this is what that looks like. The bound is decided in the page turn, from the page, not here.

**Rate limit as a cap artefact.** The free tier allows 20 requests a minute and the deliberation cap is 20 calls, so a rate-limited run can end on `cap_exceeded` for a reason that is not a runaway. Transport backoff base is 15 s so that two retries span a per-minute window. If a run ends that way it is recorded as a rate-limit artefact, not a protocol fault.
