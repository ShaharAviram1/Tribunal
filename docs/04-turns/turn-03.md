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
