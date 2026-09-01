# Merge pack: maintenance six, the fallback that was never wired

Branch `maintenance-6` (1 commit) into `main`.

The second blind verification run found that `role_fallbacks` reached only the intake clerk's
client (`src/protocol/intake.ts`); the deliberation's own client was constructed without it in
both `netlify/functions/tribunal-run-background.mts` and `scripts/run-live.ts`, so
`reassignToFallback` always returned null and no live deliberation could ever reassign a failed
seat. The drills passed because they build their own clients; the multi deliberation ran with
zero retries, so no live run ever needed the path and nothing showed. The fix wires the config
through in both places, and `tests/wiring.test.ts` (2 drills) asserts the construction sites
name `roleFallbacks`, so the wiring cannot silently vanish again. 275 tests pass offline.
