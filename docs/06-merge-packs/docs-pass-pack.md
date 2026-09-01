# Merge pack: the documentation pass

Branch `docs-pass` (7 commits) into `main`. Evidence under each heading, not assertion.
Not yet proposed for merge: `intent.txt` awaits the author's voice check and is intentionally
uncommitted; nothing merges until it lands or is rewritten.

## 1. What the branch carries

| Change | Commit | Evidence |
|---|---|---|
| spec.md gains the stage-by-stage mechanics | `97f25b0` | the section sits after part one, unnumbered; no part or criterion number moved, so every citation in the packs, turn records and code comments still lands |
| spec.md paid-only currency, two dated revisions | `97f25b0` | criterion 2 and part three, each dated 2026-09-02, the superseded sentences kept in place above their revisions |
| CLAUDE.md currency, three items only | `e16d48b` | what-this-is says what the project is now in the same lines; the two runs are past tense; seven document lines added, one pointer each; the rule is still the first and last line |
| ARCHITECTURE.md, new | `81016d1`, corrected `a408d14` | every claim names the file that proves it; two Mermaid diagrams; rejected shapes pointed at spec.md part three, not restated |
| README points at the seed and the architecture | `ffb0c11` | two lines in "Where things live" |
| Home page dead space removed | `f08ecb0` | `public/index.html` body padding 132px → 36px |
| The way back to the Tribunal made visible | `d542a4a` | the case-header home link, an 11px crumb since the courtroom redesign, is now a bordered button; `src/page/render-case.ts` |

## 2. Verification, run before this pack was written

A subagent was given only the four documents and the repository — not the author's notes and
not the task prompt — and asked for every factual claim it could not verify against a committed
file and every cross-document contradiction. It returned eleven claims and four contradictions.

- **Three were errors in ARCHITECTURE.md, fixed on this branch** (`a408d14`): the home page's
  behaviour is an inline script, not `case-ui.js`; polling belongs to `case-live.js`, injected
  by the page function; caps are read by the background function and `run.ts`, and the output
  ceiling is raised once on a truncation retry.
- **One stands by design**: `intent.txt` describes the seed, before the clerk or the docket
  existed, and is the one document licensed to disagree with the present. Its "seven calls,
  one case" is the idea as first put, which is the file's whole purpose.
- **The remainder are pre-existing staleness in spec.md, one sentence of CLAUDE.md, and two
  code-side items**, reported to the author for decision rather than fixed, under the standing
  rules that a spec fix beyond the two named requires telling first and that nothing else moves
  in CLAUDE.md. The list travels with the session report, not this pack.

## 3. The offline suite

268 tests pass on the branch, no key in the environment, no network reached.

## 4. No duplication

The mechanics section cites criteria by number rather than restating them; ARCHITECTURE.md
points at spec.md part three for the rejected shapes; every new CLAUDE.md and README line
points at a document instead of copying from it.
