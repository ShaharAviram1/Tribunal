# Tribunal — interview questions (2026-08-29, revised)

## The project in one paragraph

Four advocates and three judges: seven prompts, seven calls. One charge sheet, T-001, from the dossier. Each agent receives its prompt and returns its stance, which is that character's opinion. Advocates return structured points; judges return verdicts. The three judges' verdicts are presented side by side and are never combined. First run: all seven on the same model, different calls. Second run: seven across multiple models. That is the whole project.

Several decisions in the original interview came from bad input and were struck on revision. Struck items are kept as one-line stubs.

---

## Q1 — What is the system for?
**Decision (revised):** Seven agents producing seven independent outputs, three verdicts shown side by side and not combined. Separate calls are what make the readings independent — in one conversation later text continues earlier text. *Struck:* "divergence marks the hard cases"; the system as a measuring instrument.

## Q2 — Independence of what?
**Decision (revised):** Judges read the shared record produced by the four advocates. *Struck:* attribution reasoning, blind-spot argument, on-screen scope statement.

## Q3 — Model plan
**Decision (revised):** Run one, all seven roles on a single model in separate calls. Run two, seven roles across multiple models. *Struck:* judge/advocate model disjointness, the `models.json` test, the citation-distribution check.

## Q4 — What is a "point" and who assigns ids?
**Decision:** Structured natively. A point = one-sentence claim + free-prose support; 3–5 per advocate. Ids assigned by code at ingest by index (`tyrion.p1`). Every `relies_on` id in an opinion must resolve or the opinion fails validation and retries. Position is an output field; an advocate may conclude against their seat and the UI shows it.

## Q5 — Who runs a case and who reads one later?
**Decision:** Target is the cold reader with no knowledge of story, dossier, or design; the live user is that plus progress. Ids never render raw — a citation shows the advocate's name and claim text, expandable to the support. Case block incl. base premises sits on the case page. No onboarding, tooltips, tours, or help text.
## Q6 — Are the verdicts combined?
**Decision:** Never. No tally, no majority marker, no "split" wording, no agreement metric — not combining is in the course spec and goes in CLAUDE.md explicitly. Three columns of identical shape: verdict, reasons, cited points, strongest point against the conclusion. *Struck:* the citation-overlap view; later, the cold-reader test criterion (removed 2026-08-31, see problem.md history).

## Q7 — Character fidelity evaluation
**Struck entirely.** No baseline opinion, no fourth judge, no blind attribution round, no rubric rater, no marker lists, no calibration, no thresholds. Character fidelity is not something this project measures.

## Q8 — Case engine?
**Struck entirely.** One case, T-001. No T-002, no control case, no case engine, no default personas.

## Q9 — Charge sheet validation
**Decision (revised):** The charge sheet is a specification, not free text. Required fields (agreed record, question for judgment) validated by rule code before any model call, failing rule named. *Struck:* provenance labelling (curated vs. filed).

## Q10 — What constrains the build?
**Decision:** OpenRouter, one key. A refusal is a failed call, recorded, never silently swapped. Caps enforced in the client module: calls per deliberation, spend per run, global deliberations per day, per-IP rate limit, env flag to disable filing while reading works. Offline: gate tests, reading any past case, and a seeded real deliberation so a fresh clone renders a case with no key. Deploy: Netlify + Supabase. Form behind a shared access code.

## Q11 — What is deliberately excluded?
**Settled no:** follow-up chat on a case; meta-judge reporting agreement; reader-as-judge verdict box; synthesis; tally; agreement metric; framing-flag agent; persona editor; case-authoring UI; ingestion pipeline; onboarding.
**Later:** rebuttal round, more models.
