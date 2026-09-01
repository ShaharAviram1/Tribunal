# The Tribunal

**The three opinions are never combined.** Not under any name, in any layer: no count, no majority marker, no page title, no summary line, no "the panel found". Advocate positions are never summed either. If a change would make it easier to answer "so what did they decide", it is the wrong change.

## What this is

Four advocates and three judges deliberate a charge sheet in seven separate model calls: T-001 from the dossier, or a case the intake clerk drafts from a submitted scenario, as T-006 proved. The judges' opinions are shown side by side, unreconciled. One committed deliberation ran all seven roles on one model; another ran them across seven; both logs are in the repository. That is the whole project.

## The documents, and what each is for

- `intent.txt`: the idea as it was first put, before any of it was built. The seed, not a summary.
- `problem.md`: the situation that needs to change, who it is for, what done looks like, what is excluded and why. Read first.
- `spec.md`: the contract the build is held to. Goal and reason, numbered criteria, boundaries, how correctness is checked, known pitfalls. Where it is silent, its part one says how to resolve the silence.
- `docs/charge-sheet.spec.md`: what a filer may submit, what the system stamps, and the six rules with the failure each prevents.
- `README.md`: the front door: what this is, how to run it, where everything lives.
- `ROADMAP.md`: where the spiral stands, turn by turn, and what remains.
- `ARCHITECTURE.md`: how the infrastructure is built, every claim naming the file that proves it.
- `docs/advocate-stance.schema.md`: what an advocate call returns, what the system adds at ingest, and which retry each rejection triggers.
- `docs/judicial-opinion.schema.md`: the same for a judge, plus what an opinion must never contain.
- `docs/04-turns/`: one record per spiral turn: the plan, what it taught, what is locked.
- `docs/06-merge-packs/`: what each branch carried when it was proposed for merge.
- `docs/07-design/handoff.md`: the courtroom design the case page implements.
- `INTERVIEW-QUESTIONS.md`, `INTERVIEW-ASSUMPTIONS.md`: how the decisions were reached, and which are still owed.
- `docs/lessons-learned.md`: every correction the user gives is written there as a rule, not a complaint. If the rule is permanent, it is carried into this file. It is graded evidence and only counts if it fills up during the build.

Do not copy from these into code comments, prompts, or this file. Copies drift and a wrong context file gives no error. Point at them.

## Standards

**The specification is the product.** A wrong behaviour is fixed in `spec.md` first and the code rebuilt to match. Never patch code past its own specification; if the spec and the code disagree, the code is wrong until the spec is changed on purpose.

**A failure is shown as a failure.** A refused call, an absent opinion, a stance that never validated: each is rendered as exactly that. A defaulted or silently substituted result that reads as an output is the worst defect this project can ship, worse than a crash.

**Prompts are code.** The seven prompts are versioned files loaded at runtime, reviewed in commits, never strings in code. The shared charge sheet block goes first in every one of them, byte-identical, so it caches.

**Plain code carries, stores, and orders.** A model call appears only where reasoning is required: the four stances, the three opinions, and the intake clerk's draft of a submitted scenario. The protocol, id assignment, validation, retry, and rendering are deterministic code with no model call of their own.

**Objects pass between stages, never flattened prose.** A judge receives four stance objects, not a paragraph about them.

**No real jurist's name in an id, a key, or a point id.** The dossier adapts methods and does not impersonate; ids are where that distinction is quietly lost. Judges are `judge-1` to `judge-3`, with the profile in a `label` field.

**Nothing is normalised.** A verdict with a space, a capital, or trailing whitespace is malformed, not fixed.

## What good work looks like here

- A second reader can check every claim against a committed log, fixture, or page, without asking.
- The offline suite runs with no key in the environment and reaches no network.
- Every model attempt has its own log row; the cost of a deliberation equals the sum of its rows.
- The commit history reads as a sequence of reasons, not a changelog.

## How to work here

1. Commit before starting any non-trivial task, so a clean restore point exists.
2. One logical change per commit. The message says why, not what.
3. One branch per spiral turn.
4. Before writing code, state a plan of three to six lines and wait. Do not start on a nod you have not received.
5. The offline suite passes before any merge is proposed.
6. Ask when a decision is missing. Do not fill the gap with the common answer; the gap is information.
7. Subagents read files from disk and return structured results, never prose summaries of a file. No subagent is given a step that requires asking the user a question.
8. Do not run `/init`.

## Stop and ask before

- Any change that summarises, ranks, or reconciles outputs, or that adds a field only a reader comparing the three would use.
- Any change to the charge sheet rules or to either output schema.
- Any new dependency or external service.
- Any database schema change.
- Any point where the specification is silent and the choice is not obviously reversible.
- A second consecutive failed attempt at the same fix. The answer is to return to the last good commit and report, not to try a third time.

## Known traps

The full list is `spec.md` part five. The ones that bite on arrival:

- The platform re-invokes a failed background function on its own, so a deliberation must be idempotent. The mechanism is in `spec.md` part three.
- An identical resend at temperature 0 returns the identical failure. A corrective retry must differ.
- Three judges on one model will tend to agree because they share it. Run one proves the pipeline and nothing else.

---

**The three opinions are never combined.** No count, no majority, no title, no summary line, in any layer. Advocate positions are never summed. If a change would make it easier to answer "so what did they decide", it is the wrong change.
