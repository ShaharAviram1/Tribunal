# Merge pack: maintenance seven, the final rulings

Branch `maintenance-7` (6 commits) into `main`. Evidence under each heading, not assertion.

## 1. What the branch carries

| Ruling | Change | Evidence |
|---|---|---|
| D1 · truncation | one ceiling raise per role, budgeted apart from validation; a second truncation is terminal and never reaches a fallback | `src/protocol/run.ts`; spec.md criterion 6 revision and the part-three fallback paragraph corrected; drill "an advocate that truncates twice fails as truncated and never reaches a third attempt" in `tests/protocol/truncation.test.ts` |
| D2 · temperature | `temperature_honoured` removed — one reachable value, a name asserting the unknowable; every row logs `temperature_sent`; criterion 8 claims only what is knowable, and the wrong half of the earlier instruction is recorded as a correction in the spec and beside its citation in the maintenance-5 pack | `src/client/model-client.ts`, `src/client/openrouter-transport.ts`, drill in `tests/client.test.ts` asserting the field is gone. Committed historical logs keep the old field names; history is not rewritten |
| D3 · the record | the unwired-fallback correction dated beside every claim: the turns README row, the turn-03 bullet, and four places in the turn-03 pack; lessons entry 7 extended with the case | nothing softened, nothing deleted; each correction names what was claimed, what was wired, and when the wiring landed |
| D4 · the message | `6747fe8` blamed maintenance-6 for the intent.txt sweep that happened at `ae875ae`; corrected in the docs-pass pack, the commit standing as pushed | docs-pass pack, section 6 |
| D5 · the seed | intent.txt committed alone, in the author's own words, deliberately predating the clerk and the docket | one commit, one file |

## 2. The offline suite

275 tests pass, no key in the environment, no network reached.
