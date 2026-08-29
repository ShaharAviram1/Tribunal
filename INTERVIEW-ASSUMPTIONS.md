# Tribunal — assumptions and open gaps (2026-08-29, revised)

Decisions still owed. Items that existed only to serve struck decisions (Q1–Q3, Q7, Q8 evaluation and case-engine machinery) were removed.

## Constraints you left open
1. **Budget ceiling per month** — "[X]". Not stated. Caps cannot be sized without it.
2. **Credit available today** — you said you would check.
3. **Access code** — who holds it, how it rotates, whether the seeded case is readable without it.

## Three real gaps
4. **Verdict values.** Binary, *justified* / *not justified*, per the dossier's scope note. Assumed silently throughout the interview; now stated. No third value.
5. **Temperature.** Never mentioned. Needs setting as a plain config choice.
6. **Execution time against the deployment target.** Seven calls, judges blocked on the advocates, plus validation retries, against a Netlify serverless function's execution ceiling. A synchronous request will not survive that; this decides the backend shape now.

## Process decisions never reached
7. **What advocates see.** Turn one is one round of four independent point-sets. Not stated: whether advocates see the charge sheet only or also the other seat assignments, and in what order (if any) they are called.
8. **Retry policy.** How many validation retries, and what the case page shows if a judge never produces a valid opinion.
9. **Refused call rendering.** Empty column, or case marked incomplete.
10. **Repeat runs.** Whether a case can be run more than once and, if so, whether both runs are shown and how the reader tells them apart (run one vs. run two at minimum).

## Schema gaps
11. **Judge output shape** beyond the four fields: length limits, reasons as list or prose, minimum number of `relies_on` ids (zero allowed?).
12. **Point count enforcement.** "Three to five" — validation failure or accepted with a warning if a model emits two or six.
13. **Dossier source links.** Whether any of the nine Section 6 opinions enters a judge's prompt, or the ~300-word profile is all a judge sees.

## Interface gaps
14. **Screen.** "Three columns" is the only description. Web app vs. static site, case list, what a live run shows as progress, mobile or not.
15. **The cold-reader test person.** Who, and whether a course grader counts.

## Assumptions I made silently
16. That each opinion is produced in one call (no multi-step reasoning, no tool use).
17. That the case id `T-001` is human-assigned.
18. That T-001 seeds into the database from a repo file; repo is the source, database is the store, one read path.
19. That the seeded deliberation is the run-one (single-model) output.
20. That the file names of these two documents were mine to choose.
