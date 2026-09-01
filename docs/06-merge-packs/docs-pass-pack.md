# Merge pack: the documentation pass

Branch `docs-pass` (12 commits) into `main`. Evidence under each heading, not assertion.
`intent.txt` lands separately by ruling: paragraphs two to four stand as drafted, paragraph one
is being rewritten by the author, and the file stays uncommitted until handed back.

## 1. What the branch carries

| Change | Commit | Evidence |
|---|---|---|
| spec.md gains the stage-by-stage mechanics | `8c99679` | the section sits after part one, unnumbered; no part or criterion number moved, so every citation in the packs, turn records and code comments still lands |
| spec.md paid-only currency, two dated revisions | `8c99679` | criterion 2 and part three, the superseded sentences kept above their revisions |
| CLAUDE.md currency | `08863a6`, `53fc6df`, `2c41074` | what-this-is says what the project is now; the two committed deliberations named by what they are; the clerk counted among the model calls; seven document lines added; the rule still first and last |
| ARCHITECTURE.md, new | `a926409`, corrected `a4433b1` and `2c41074` | every claim names the file that proves it; two Mermaid diagrams; rejected shapes pointed at spec.md part three |
| README points at the seed and the architecture | `3284184` | two lines in "Where things live" |
| spec.md stale facts trued, fallback specified | `9c4e28f` | eleven items; four tables with the job row named non-derivable; 1.00 USD marked historical; per-role fallback written into part three with when it fires, when it must not, what it logs |
| Lessons-learned entry 7 | `5e1f9a2` | the blind-reader rule, written as method, not apology |
| Home page dead space removed | `f328ccb` | `public/index.html` body padding 132px → 36px |
| The way back to the Tribunal made visible | `38bccb4` | the case-header home link is a bordered button; `src/page/render-case.ts` |

## 2. First verification run

A subagent given only the four documents and the repository — no notes, no task prompt — was
asked for every unverifiable factual claim and every cross-document contradiction. It returned
eleven claims and four contradictions. Three were errors in ARCHITECTURE.md, fixed at `a4433b1`.
One stood by design: intent.txt is the seed and is licensed to disagree with the present. Four
were code defects, fixed as behaviour changes on `maintenance-5` before this branch was rebased
onto them (its pack has the evidence). The rest were stale spec sentences, fixed here at
`9c4e28f` and `8c99679` under the rulings of 2026-09-02.

## 3. Second verification run, against the corrected state

The same blind protocol, re-run after the fixes. Six claims, two contradictions:

- **Fixed as a behaviour change**: `role_fallbacks` was never handed to the deliberation's
  client, so no live run could ever reassign a failed seat — `maintenance-6`, merged to `main`
  before this branch was rebased onto it, with a wiring drill.
- **Fixed on this branch** (`2c41074`): ARCHITECTURE.md said the output ceiling rises "once"
  where the code doubles it per truncation retry; CLAUDE.md called the multi-model deliberation
  "run two" when the committed `runs/run-02` is a single-model run.
- **Standing, by the revision convention**: criterion 6's original four-attempt sentence remains
  above the dated revision that supersedes it, exactly as criterion 2's free-panel sentence
  remains above its own; this file corrects by dated revision and does not delete history.
- **Standing, reported for decision**: criterion 6 says a second truncation fails the role,
  while an advocate's three rounds allow a second raise; and criterion 8 claims a model
  *ignoring* temperature is recorded, which no code can detect (a rejecting provider fails the
  call onto its own row; silent ignoring is invisible). Both need a ruling — narrow the spec or
  change the code — and are listed in the session report.
- **Both contradictions were phantoms**: the verifier quoted CLAUDE.md sentences already
  corrected on this branch; the committed file was checked directly and carries the fixes.

## 4. The offline suite

275 tests pass on the branch, no key in the environment, no network reached.

## 5. No duplication

The mechanics section cites criteria by number; ARCHITECTURE.md points at spec.md part three
for the rejected shapes; every new CLAUDE.md and README line points at a document instead of
copying from it.
