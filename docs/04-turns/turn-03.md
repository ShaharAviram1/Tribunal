# Turn three: the case page

Branch `turn-3`. Bound: no new model behaviour; no storage change.

## Plan as it stood before the work

As proposed and approved on 2026-08-31, with the cold-reader test removed by decision before work began:

1. A read-only JSON endpoint, `tribunal-case`, through the storage interface server-side: charge sheet, stances, opinions, failure records, job state. No access code; the service-role key never reaches the browser.
2. The case page, plain TypeScript, no framework. Case block with base premises on the page; four stances with position and seat per advocate, never counted; three judge columns of equal prominence and identical structure: verdict, reasons whose citations render as advocate name plus claim text, expandable to support, never a raw id; strongest point against. Failures render as failures from the failure record, and the renderer cannot take a failure record down the output path.
3. Live progress: the same page polling the job row; pending and running render stage and per-role status.
4. Fresh clone: the page renders `runs/run-02/` through the file store with no key and no network, tested offline.
5. The opinion word bound is decided during this turn from the rendered page, with the evidence, before any prompt or schema change.

Order of work: endpoint and renderer first, and the first render of run-02 shown before the live polling path is built.

## First render approved; word bound closed

The run-02 render was approved 2026-08-31 with one fix, now in: the opinions section carries the dossier's guard in its own terms, a fictional proceeding, each judge adapting a published judicial method, not representing the jurist and not predicting how they would decide, plus the scoping line that the panel judges the record as filed. Failure attempts each sit behind their own disclosure with an explicit caveat, since a raw attempt opening with `"position":"justified"` could read as the advocate's position to a skimming eye.

**Opinion word bound: closed, no bound.** From the rendered evidence (totals 295, 381, 214 words): nothing failed at these lengths, the longest column reads as long rather than broken, `max_output_tokens` is already the logged backstop, and a cap invented for a failure that has not happened is the pattern lessons-learned entry 2 warns about. Revisit only if turn four produces a column that does not fit.

## The polling path, watched live

Filed a second charge sheet on the branch deploy (`docs/04-turns/e2e/t002-filing-transcript.txt`): the system assigned `T-002` and `d-T-002-1788200414013`. The states actually seen, 5-second polls (`t002-polling-transcript.txt`): running/advocates with outputs 0, 1, 2, 3; then judges with outputs 4, 5, 6; complete at 206 s with 7 outputs and 9 calls. The two extra calls were live corrective retries, both recovered: Grey Worm's first response failed validation and his second passed; judge-1's first answer was HTTP 200 with no finish reason and no tokens, an empty provider response, and the retry produced a valid opinion. The page rendered each state as it happened.

**T-002 is specified behaviour, not an accident.** The interview settled that re-asking means filing a new charge sheet and that each filing creates its own case, so a second copy of the same content correctly became a new case. The canonical evidence for the project is `T-001` and deliberation `d-T-001-1788124601994`; `T-002` exists to exercise filing and the polling path.

## Phone layout, measured rather than eyeballed

The window could not be resized below the desktop minimum, so a screenshot would have proven nothing. Instead a 390-px iframe of the live case page was injected same-origin and the geometry read from inside it: viewport 375 px, no horizontal overflow, all four stance cards and all three opinion columns at identical x and identical 327-px width, stacked in document order. Equal prominence and identical structure hold where "three columns" is false; the columns become a sequence and nothing about their internal structure changes.

## Fresh clone

`node scripts/render-static.ts run-02` renders the committed single-model deliberation to `runs/run-02/case.html` through the file store with no key and no network; the offline render tests read the same run. A fresh clone therefore renders a complete T-001 case page from the repository alone (problem.md item 9), and the committed `case.html` for both runs is checked in beside its run.

## The convening view, watched live

Direction change mid-turn, on record: the live run is the product; the finished-case renderer stays for committed evidence. Convened `d-T-001-1788202422638` on the existing case T-001 (the convene mode deliberates a stored charge sheet without creating a new case) and watched in the browser: Jon alone on screen first, Tyrion, Daenerys, Grey Worm each taking the floor in seat order with the hold capped; then three per-judge chips, "Deliberating…", one flipping to "Opinion returned, under seal until the bench rules" while the others worked, never a count; then the gavel, and all three columns in the same frame. Verdicts: Barak model justified, Elon model not_justified, Shamgar model not_justified, the second split, and Tyrion argued justified from the defense seat for the second consecutive run. Every card on screen was adopted from the server render of stored output; the client builds no content. The gavel is conditional on at least one opinion existing; a stalled run shows its job state and stops polling.

## UI pass and the 390-px check

Reordered per review: guard at the top of both pages, verdicts before the background, background and record behind disclosures, position and verdict the loudest text in their cards, "concluded against this seat" as a badge, model attribution legible under each name, shared-height card headers, distinct markers for expandable points versus citations, a way back to the index. The index shows the one case, folds the three debug filings behind a disclosure that says what they are, names each run by convened time, panel, and status, and states the two-minute duration by the Convene button.

Measured at a 375-px viewport (390-px frame) on the deployed branch, both pages: **nothing breaks.** No horizontal overflow and no overflowing element on either page; all seven cards at identical x and identical 327-px width, stacked; all seven card headers exactly 90 px; verdicts render above the background; the index guard sits above the fold, the debug disclosure is closed by default, and a run line reads "Convened Aug 31, 2026, 12:16 AM — one model — complete".

## The access code is gone from filing; the courtroom design lands

Convening no longer asks for a code: the professor must be able to convene a tribunal without a password, and a shared secret that has to be whispered to every legitimate reader protects nothing worth the friction. What replaces it costs money-shaped abuse its payoff without gatekeeping people: the per-run caps stay; a global cap of 10 deliberations per rolling 24 hours is counted from the jobs table; and a per-IP cooldown of 5 minutes rides on an 8-hex IP-hash suffix in the deliberation id, so neither protection needed a schema change. Both refuse with a plain 429 naming the limit. The background function keeps its shared secret: that path is machine-to-machine and was never for people.

The presentation moved to the courtroom direction as specified: walnut and brass, Bodoni Moda for chrome and verdicts, Spectral for argument; the bench above, the floor below; verdict bands at the largest size in the card and typographically identical whatever they say; seat colours for defense and prosecution, never outcome colours; numbered reasons with citations as quieter indented lines; the charge sheet, background and record in one collapsed row; a live rail with elapsed time, calls against the cap, spend, panel, and a two-stage Floor/Bench bar; live placeholder bars that are geometry, never words; and a gavel that strikes a podium, with the three verdicts revealed together at the strike.

## The live view diagnosed and fixed; the fence question lands on the record

The broken live updates were the first hypothesis: the poller was never attached. The injected script died at parse time with a SyntaxError, one invalid token produced by assembling client code inside nested server template literals; the gavel had the same root cause, since a script that never parses never strikes. The fix removed the failure class rather than the token: the live script and its styles are static files served as themselves. Verified on a live convene: staged reveals, per-judge chips, rail, and console clean.

The multi panel then failed a second time in the same seat with a new model: `google/gemini-2.5-flash`, clean in the probe, fenced its JSON on both deployed attempts, a well-formed object inside a well-formed ```json fence, after a corrective retry naming the fence. Two Gemini models, four attempts, one failure shape. The panel spent $0.0430 and stopped at 3 of 4 stances, judges withheld, exported as evidence. The pending decision: strip a well-formed outer fence as transport wrapping (a revision to the no-normalisation rule), swap the seat a second time, or keep the incomplete run as the multi record.

## The design handoff, implemented

`Current build recreation.zip` arrived as a full high-fidelity handoff (filed at `docs/07-design/handoff.md` with its gavel clip at `public/gavel.mp4`): token sheet, materials, five screens, six hard constraints, all matching the standing rules. Implemented across the renderer, a new always-loaded `case-ui.js` (reason stepper, global Read all so the three columns never differ in disclosure state), the rebuilt `case-live.js` (state labels, shimmer geometry, progress rail as roles-returned over roles-expected, the filmed gavel mounted once on the terminal transition), and the antechamber index recreated by a subagent with the script byte-identical. Verified deployed: antechamber, concluded courtroom with the against-seat state live on real data, and the gavel video playing via the terminal-arrival path.

**The global cap fired its first real refusal.** The design-verification convene was refused: `global limit reached: at most 10 deliberations per 24 hours`. A day of building spent the budget, which is the protection doing its job; the full live-choreography watch on a fresh convene waits for the window to roll.
