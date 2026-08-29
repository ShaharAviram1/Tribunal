# Probe records, turn one

Three passes of `scripts/probe-candidates.ts`, each the raw response of every call. All three are the record; none is scratch.

- `pass-1.no-max-tokens.json`: gpt-4.1-mini, gemini-2.5-flash, claude-sonnet-4.5, no `max_tokens` sent. All six calls 402: the provider reserved each model's maximum output against the key's balance. This pass is the evidence for the output-ceiling rule in spec.md part three.
- `pass-2.max-tokens-4096.json`: kimi-k2:free and glm-4.5-air:free (both 404, "unavailable for free": the slugs went paid-only between choosing and calling) and gpt-4.1-mini (two clean objects, $0.0012 and $0.0016). This pass is the evidence that free listings change and the log's served model is the record.
- `pass-3.live-free-list.json`: three free models taken from the live catalogue that minute. glm-5.2:free and gemma-4-31b-it:free 429 upstream; minimax-m2.7:free two clean objects. This pass chose run one's model.
