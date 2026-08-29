# The Tribunal, problem definition

## 1. Problem statement

A contested act admits several defensible readings, but someone trying to understand it is given a single answer: the competing readings are either never produced, or are collapsed into one conclusion before the reader sees them. What the reader loses is the disagreement itself, which readings exist, on what grounds, and where they part, and with it any basis for judging the answer they were handed.

## 2. Stakeholders

- **The cold reader.** Someone who opens a past case with no knowledge of the story, the dossier, or the design. The primary stakeholder; the design target on record.
- **The builder.** Runs deliberations, reads results live, and is the only person on record who files charge sheets.
- **The course.** Supplies the dossier, the "verdicts are never combined" rule, and grades the history. A stakeholder in the record, not in the product.
- **The people whose methods are adapted.** The three judge profiles derive from real jurists' published opinions. The dossier's own qualification (fictional proceeding; adapts methods, does not impersonate) is a constraint the product inherits.

Unsure, flagged rather than added:
- *Whoever holds the access code besides the builder.* Nothing on record says anyone does.
- *A course grader as cold reader.* Whether a grader counts as the test person is an open item in the assumptions file.
- *OpenRouter and the model providers.* Their terms constrain the build, but nothing on record makes them a stakeholder in the outcome.

## 3. Definition of done

Each item is a fact a second reader can check by looking at the repository, a log, or a rendered case page.

1. A completed deliberation of T-001 contains exactly seven agent outputs, produced by seven separate model calls: four advocate stances and three judicial opinions.
2. Each advocate stance is a structured set of three to five points, each point a one-sentence claim with supporting prose, and each point carries an id assigned by the system.
3. Each judicial opinion contains a verdict whose value is one of exactly two strings, `justified` or `not_justified`, and every point id the opinion relies on resolves to a point that exists in the same deliberation.
4. The case page shows the three judicial opinions side by side with equal prominence and identical structure, and nowhere on the page, in the stored deliberation, or in the code is there a combined, majority, aggregate, or counted verdict.
5. A charge sheet that fails any validation rule is rejected before any model call is made, and the rejection names the rule that failed.
6. Every model call made during a deliberation appears in a log with, at minimum, the role, the model identifier, the temperature, tokens in, tokens out, cost, latency, and the outcome.
7. A model call that fails, including a refusal, appears in the log as a failure and appears on the case page as a failure; no failed call is rendered as a verdict or a stance.
8. The repository contains one committed deliberation in which all seven roles ran on a single model, and one in which the seven roles ran across more than one model, and the log of each shows which.
9. A fresh clone of the repository renders a complete T-001 case page from the committed deliberation with no API key present.
10. A person who has not read the dossier, given only the case page, states each judge's verdict and one reason it gave. Recorded as a dated note in the repository naming the date and whether the person succeeded.
11. The seven agent prompts exist as versioned files in the repository and are loaded at runtime; no prompt text is inlined in code.
12. The charge sheet specification exists as a written specification document in the repository, separate from the validation code that enforces it.

Item not written because it cannot be made argument-free: whether an advocate or judge is "in character". Character fidelity is not measured by this project (interview Q7, struck), so it is not a done criterion.

## 4. Out of scope

Each entry is something a reasonable person could expect, with the reason it is excluded.

- **A combined, majority, or aggregate verdict.** The course rule and the problem statement: collapsing the readings into one conclusion is the situation the project exists to change. A tally is a single answer in a different form.
- **An agreement metric between judges.** Deciding whether two sets of grounds are "the same" is a judgment the system does not have; shipping a number for it would be a claim that cannot be defended.
- **A meta-judge that reads the three opinions and reports where they agree.** Sounds like rigour, is synthesis with extra steps.
- **A follow-up chat on a case.** A follow-up turn carries the prior output in its context, so the second answer continues the first: the single conversation the project replaces, reintroduced through a text box. It also lets a reader keep asking until they get the answer they wanted. Asking again means filing a new charge sheet.
- **A reader-as-judge verdict box.** A tally in human form; it gives the reader somewhere to resolve the disagreement the design refuses to resolve.
- **A second case.** One case, T-001. The project is a demonstration on one charge sheet, not a case engine.
- **A case-authoring interface, persona editor, or ingestion pipeline.** Follows from one case. Personas are the dossier's four; the charge sheet is a validated form, not an authoring tool.
- **Measuring character fidelity.** Fidelity to the real jurists is not checkable and is not claimed. No baseline judge, no blind attribution, no rubric rater.
- **A framing-flag agent that reviews the charge sheet for slant before the panel runs.** A model in the middle making an unaccountable call about the record. Validation is by rule code only.
- **Onboarding, tooltips, guided tours, help text.** The page must carry its own context; an explainer bolted on is a failure of the page, not a fix for it.

## 5. Deferred

Postponed, not excluded. Distinct from the list above: nothing here is ruled out on principle.

- **A rebuttal round between advocates.** Turn one is one round of four independent stances.
