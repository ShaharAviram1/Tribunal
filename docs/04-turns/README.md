# Turns

The build is a spiral of five turns. Each turn has a branch, one live run where the turn calls a model, and a record here written in three parts: the plan as it stood before the work, what the work taught, and what is now locked. A turn is bounded by what it may not do, not by what it should.

| Turn | Name | Bound | Done when |
|---|---|---|---|
| 0 | Scaffold and gates | No code that calls a model. | The four pre-commit gates have each been watched refusing; the offline suite runs the fixture and assembly checks on the pinned Node; the byte-identical first block is asserted. |
| 1 | The spine | All seven roles on one model. No page beyond what proves the run. | One live deliberation of T-001, seven outputs, committed with its full log; the client module, protocol, validation, retry and failure paths pass their drills offline on fixtures recorded from that run. |
| 2 | Storage and the function | No new model behaviour; no page. | The protocol runs unchanged against Supabase through the storage interface; the Netlify background function runs a deliberation end to end with the job row claimed, budget accumulated across invocations, and re-entry resuming from stored outputs; the idempotency drills pass offline. |
| 3 | The case page | No new model behaviour; no storage change. | The case page renders a deliberation whole: case block, four stances per advocate, three opinions of equal prominence with citations resolving to claims, failures as failures. A fresh clone renders T-001 from the committed run with no key. |
| 4 | Several models | Same prompts, same temperature, different models. | A second live deliberation across more than one model, committed with its log; both logs in the repository; the per-run spend cap replaced by a measured figure as a recorded revision of spec.md. |

The bound for turn zero was first written as "no application code" and corrected to "no code that calls a model": the renderer and assembler are application code, deterministic, and needed so that two gates prove something from the first commit.
