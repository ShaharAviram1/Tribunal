# Merge pack: turn three, the case page

Branch `turn-3` into `main`. Evidence under each heading, not assertion.

## 1. Functional completeness

| Requirement | Evidence |
|---|---|
| problem.md 4: opinions side by side, equal prominence, identical structure; no combined verdict anywhere | `src/page/render-case.ts`: one `opinionColumn` renders all three; render tests assert 3 identical-structure columns and that page chrome names no combined result; measured at 375 px: identical x, identical width, stacked |
| problem.md 9: fresh clone renders T-001 with no key | `scripts/render-static.ts` + `runs/run-02/case.html` committed; render tests run offline against the committed run |
| Citations resolve, never a raw id | render test: no `role.pN` visible in rendered text; citation shows advocate name + claim, support one click deeper |
| Failures render as failures, one door | `failureCard` is the only path for a failure record; test asserts a failure record cannot enter the opinion path and its raw attempts sit behind per-attempt disclosures with the not-a-position caveat; `runs/run-01/case.html` shows it on the real incomplete run |
| Live page and progress | `tribunal-case-page.mts` server-renders with the same renderer (one renderer, no client bundle); poll script present only while pending/running; watched live through T-002: states 0→7 outputs across advocates then judges, complete at 206 s, transcripts committed |
| Dossier guard and as-filed scoping on the page | render test asserts both strings; visible on the deployed page |
| spec part three: page reads through the storage interface server-side; no service key in the browser | `tribunal-case.mts` / `tribunal-case-page.mts`; the page itself carries no fetch to Supabase |

Deliberately not in this turn: any model behaviour change, any storage change, the multi-model run (turn four).

## 2. Sound verification

194 offline tests. New: render tests against the committed real run, including escape of hostile model text, the failure-record door, absent-output rendering, and the chrome-only vocabulary check (the page test learned G3's lesson: the rule binds our words, not a judge writing "counter-consideration"). Live: the deployed case page and JSON endpoint answered 200 on the real deliberation; a second filing exercised the whole path and surfaced two genuine retries, both recovered and both in the committed log. Phone layout measured from inside a 375-px frame, not eyeballed.

## 3. Engineering hygiene

One renderer for static and live pages; no client bundle, so the no-key-in-bundle criterion is checkable by reading the only inline script, a 20-line poller. No new dependencies. `/case/<id>` via a redirect. All commits gated; the word-bound decision closed with its reason rather than left open.

## 4. Rationale

**Decided.** Server-side rendering by the same function the static render uses, because the browser runs no TypeScript and a second renderer in JS would drift. Guard and as-filed scoping placed with the opinions, in the dossier's terms. Failure attempts behind per-attempt disclosures with an explicit caveat, because a truncated fragment opening with a position field reads as a position. No opinion word bound, from rendered evidence (295/381/214 words): nothing failed, the backstop exists and is logged, and inventing a cap for an unobserved failure is the lessons-learned pattern.

**Removed by decision before the turn's work.** The cold-reader criterion, from all live documents: it depended on recruiting a person, and an unmet item in a definition of done is worse than one never written. Target-reader decisions stand; merge packs and turn records keep their history.

**Recorded.** T-002 as specified behaviour; canonical evidence is T-001 / `d-T-001-1788124601994`.

## 5. Audit trail

Commits from the turn-open plan through the phone measurement, each gated, on `turn-3`. Turn record `docs/04-turns/turn-03.md`: plan as it stood, first-render approval and fixes, word bound closed, polling transcript with the two live retries, the T-002 note, the phone measurement, the fresh-clone note. Live evidence: `docs/04-turns/e2e/t002-*.txt`, deployed pages at `/case/d-T-001-1788124601994` and `/case/d-T-002-1788200414013` on the branch deploy. Renders: `runs/run-01/case.html`, `runs/run-02/case.html`.
