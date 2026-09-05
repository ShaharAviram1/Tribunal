# Merge pack: maintenance nine, the gavel waits for an eye

Branch `maintenance-9` into `main`. Evidence under each heading, not assertion.

## 1. What the branch carries

| Change | Why | Evidence |
|---|---|---|
| The terminal reveal and the gavel wait for a visible tab | Chrome keeps a hidden tab's timers running, slower, and defers its media loading. On 2026-09-05 an instrumented hidden tab recorded: veil mounted on the terminal poll, the clip's `play()` "interrupted because the media was removed from the document", veil removed at the eight-second floor. A viewer returning from another window found a concluded page with no gavel | `public/case-live.js`, `visible()` awaited at the top of the terminal branch; `docs/07-design/handoff.md` gavel row amended; `docs/04-turns/turn-05.md` hidden-tab bullet amended |
| One fresh markup fetch after the job is known terminal | A poll fetches markup, then job state, two to three seconds apart on Render. A run that turned terminal in that gap read as terminal with sealed judges in the stale markup: no gavel, sealed columns adopted, polling stopped. Found by reading the loop; a twenty-second run on a five-second poll makes it likely | `public/case-live.js`, `fin` replaces `doc` throughout the terminal branch |
| The clip buffers from the first moment of a live page | A twenty-second run may never show the bench stage to a poll, so the old trigger could never fire and the clip loaded from zero at the strike | `public/case-live.js`, `bufferGavel()` before the loop |

## 2. The offline suite

284 tests pass, no key in the environment, no network reached. `case-live.js` has no offline test; it is browser choreography, verified by watching, as the turn-five record says.

## 3. Watched

Recorded below after one convening on the new host in a visible tab.
