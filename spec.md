# The Tribunal, specification

## Part one: goal and reason

The goal is the system described in problem.md: four advocates and three judges, each a separate model call, deliberating one charge sheet, with the three judicial opinions presented side by side and never combined.

The reason is that a contested act admits several defensible readings, and a reader is normally handed one. In a single conversation every answer sits in one context and later text continues earlier text, so asking one conversation to argue both sides and then judge, or to judge three times, yields one voice several times and a synthesis at the end. Producing each reading in its own call is what makes the readings independent, and presenting them unreconciled is what lets the reader see the disagreement instead of its resolution.

This reason settles questions this document does not anticipate. Where the specification is silent, preserve the separation: no output of one agent may shape another's except where the protocol says so, and nothing, human or model, may resolve the three opinions into fewer than three. Where something goes wrong, show the failure as a failure, never as a result: an absent opinion is shown as absent, a refused call is shown as refused, and no fallback text, default verdict, or quiet substitution ever stands in the place of an output that was not produced.

## Part two: success criteria

The definition of done in problem.md, section 3, is incorporated by reference; its twelve items are not restated. The criteria below cover what it does not.

1. A deliberation makes at most 20 model calls, counting every attempt, retry, and transport retry, across every invocation of the background function for that job. The count is read from and written to the job row. The 21st attempt is refused by the client module and the deliberation is marked failed at that point.
2. A deliberation spends at most 1.00 USD as summed from its own log rows, across every invocation of the background function for that job. The client module refuses the call that would exceed it. This figure is a backstop, set before any run has been measured; it is to be replaced by a measured figure after run one, and the replacement is recorded as a revision of this document, not a silent edit.
3. The monthly ceiling is 20 USD, and a hard credit limit equal to it is set on the OpenRouter key itself, in the provider's dashboard. This is the one control that survives the codebase being wrong.
4. The API key appears in no HTTP response body or header, in no client-side bundle, and in no committed file. A grep of the built client assets and of the full git history for the key's prefix returns nothing.
5. The offline test suite passes with zero live model calls. The suite runs with no API key in the environment, and a test that reaches the network fails.
6. Retry counts are as follows and are visible in the log. Malformed output, including a verdict outside the permitted set: one corrective retry whose prompt names what failed, then a visible failure. An unresolvable point id: one corrective retry whose prompt includes the list of valid ids, then a visible failure. A refusal: zero retries, recorded as failed immediately. Transport failures, meaning timeouts, rate limits, and 5xx responses: two backoff retries per call, exponential with jitter, made by the client module, not counted as validation retries, but counted toward the 20-call cap. Across all causes, a role makes at most four attempts. In the worst case the global 20-call cap binds before the per-role ceilings do, and a run that reaches it fails loudly as a whole rather than dropping roles.
7. Every attempt writes its own log row, so that the cost of a deliberation equals the sum of its rows. Each row carries a hash of the full assembled prompt text as sent, since a prompt assembled from parts is not identified by any one file's version.
8. Temperature is 0 for all seven roles, unchanged between run one and run two, and the value sent appears in every log row. When a model ignores or rejects the parameter, the row records that. This is not described anywhere as reproducibility; zero is as deterministic as the provider allows and no more.
9. Run one and run two, as required by problem.md item 8, are both made at temperature 0 with the same seven prompt files, so that run one varies only the prompt and run two varies only the model.
10. The caps in criteria 1 and 2 are read from configuration when the client module is constructed, and no code path can raise them during a deliberation. Tests construct the module with low caps to exercise the refusal.
11. The refusal path for each cap is covered by an offline test that constructs the client module with a low cap, drives it past the cap with fixtures, and asserts that the call is refused and the deliberation is marked failed.
12. Each call has a timeout of 60 seconds. Derivation: the protocol has two concurrent stages, advocates then judges; the worst case is 2 stages times 60 seconds times 4 attempts per role, which is 480 seconds, inside a 15-minute background function ceiling with margin. Run sequentially, the same worst case is 7 roles times 60 seconds times 4 attempts, 1680 seconds, which does not fit.
13. The advocate stage's wall clock, as recorded in the log, is less than the sum of the four advocates' latencies in the log. This is the observable evidence that the four calls ran concurrently.
14. If fewer than four advocate stances succeed, the deliberation stops before the judge stage. No judge call is made. A panel that heard three advocates is a different panel, and proceeding would produce something that looks complete and is not. The job row records how far the deliberation got, the case page renders it as incomplete with each failed stance shown as a failure, and no partial deliberation is presented as a result. Because a refusal gets zero retries, this is reached the first time a model declines the case.
15. A second invocation of the background function for a job that already has stored outputs makes no model call for any role whose output is stored, and an invocation that finds the job claimed and not stale makes no model call at all. Both are covered by offline tests.

## Part three: architectural guidance

Boundaries only. The interior is left to the builder.

The panel reasons and the interface renders in English. Prompts, outputs, the charge sheet, and the case page are English throughout.

The language is TypeScript on Node, one language across the function, the protocol, and the page. The Node version is pinned in `.nvmrc` and in `netlify.toml` so local and deploy cannot disagree; the pinned version runs TypeScript under `node:test` natively, so the test suite has no build step and no dependency. There is no frontend framework: the page polls a job row and renders stored objects in plain TypeScript, which keeps the client bundle small enough that the no-key-in-the-bundle criterion is checkable by reading the output.

The API key lives in the server environment on Netlify and nowhere else. The browser holds no key, no orchestration, and no protocol state that the server does not also hold; it files a charge sheet, polls for progress, and renders what is stored. All model access goes through one client module, which is the only code that knows the key, the caps, the temperature, the transport retry policy, and the log format. The seven prompts are versioned files loaded at runtime, never strings in code, and the shared charge sheet block is rendered once and placed first in each of them. The protocol, meaning the order of calls, the assignment of point ids, the validation of outputs, and the decision to retry or fail, is deterministic code with no model call of its own. The protocol has two stages: the four advocates are called concurrently, and when all four have resolved, the three judges are called concurrently. Concurrency within a stage is required, not optional; the timeout derivation in criterion 12 depends on it, and sequential execution does not fit inside the function ceiling.

The database holds three things: charge sheets as stored after stamping, agent outputs as they land, and the call log with one row per attempt. Nothing else is stored server-side that is not derivable from those three.

The execution shape is a background function plus polling: filing writes a job row and enqueues; a Netlify background function runs the protocol and writes each output to Supabase as it lands; the page polls the job row. Background functions are available on Netlify's credit-based plans including Free, with a 15-minute ceiling, confirmed in the dashboard on 2026-08-30.

Netlify automatically retries a failed background invocation after one minute and again after two. This is platform behaviour, not something the code opts into, and it shapes three rules. Call count and spend accumulate on the job row, not in process memory, and the caps in criteria 1 and 2 are evaluated against the job's total across all invocations; a fresh invocation never gets a fresh budget. The function claims the job before doing any work, and an invocation that finds the job claimed and not stale exits without proceeding. On re-entry the protocol resumes from stored state: a role with a stored output is not called again, and a stage whose outputs are all stored is not re-run.

Three shapes were rejected. The client driving one model call per request puts the protocol in the browser, which this part forbids, and strands a run when the tab closes. A single streaming function has a shorter ceiling than a background function and loses the run on a dropped connection mid-retry. A stage-advancing worker, where the job row holds protocol state and each poll tick asks the server to advance one stage, would have been the fallback had background functions been unavailable; it works on any plan, but it makes progress depend on a client continuing to poll, and the background function makes it unnecessary.

## Part four: validation approach

Correctness is checked offline first. Real model responses from live runs are recorded and committed as fixtures, so that the protocol, the schema validation, the point-id resolution, the retry paths, and the failure paths all run in the test suite with no network. The fixtures include the good cases and, for each failure mode in part five that the code handles, at least one recorded or constructed instance of it.

There is one drill per failure mode: a test that injects the failure at the client module boundary and asserts that the protocol does what this document says, including that the case page renders the failure as a failure.

The output schemas, one for an advocate stance and one for a judicial opinion, live in the repository under docs/ alongside the charge sheet specification, as documents in the same form. They must exist and be committed before the test-writing agent runs; an agent shown a specification that refers to schemas that do not exist will invent them. The protocol tests are written by a separate agent that is shown this specification, problem.md, the charge sheet specification, and those two schemas, and is never shown the implementation. The implementation is then made to pass them. A protocol test that cannot be written from those documents alone is evidence that the documents are incomplete, and the fix is to the documents.

One live run is made per spiral turn and its full log is committed alongside the outputs, so that each turn's claim about the system rests on a record a second reader can open.

## Part five: known pitfalls

- A judge will sometimes return prose instead of the object; the corrective retry must quote the required form, and if the second attempt is also prose, the column shows a failure, not the prose.
- A call will time out; the transport retry handles it, but a timeout that persists through the transport budget is a failed role, and the deliberation must say so rather than wait.
- A model will refuse this case outright, since it concerns a killing and profiles adapted from real judges; record the refusal as the outcome and do not re-prompt, rephrase, or swap the model.
- A judge may invent an authority it was never given: a case, a ruling, a tractate, a statute. Schema validation cannot catch a fluent fabrication. The only controls are the preamble's ban on quoting or attributing to any named source, and a case page that carries no source list for a fabrication to hide in.
- A well-formed answer can be confidently wrong, citing a point that exists but says the opposite; schema validation cannot catch this and nothing in the code should claim to.
- Three judges on one model will tend to agree because they share the model, not because the case is clear; run one demonstrates the pipeline and licenses no conclusion about the judges.
- The shared charge sheet block must stay first and byte-identical across all seven prompts, or provider-side prompt caching is lost and every call pays for the full prefix.
- A key committed once is compromised for the life of the repository, since history is permanent; rotate it at the provider immediately, and treat the hard credit limit as the reason the damage is bounded.
- A verdict string with a space, a capital, or trailing whitespace will not match the enum; normalise nothing, reject it as malformed.
- A retry that resends the identical prompt at temperature 0 will most likely return the identical failure; the corrective retry must differ from the first prompt or it is wasted.
- The per-run spend cap of 1.00 USD was set before any measurement; a model whose pricing is far above the panel's average can hit it on a normal run, which will look like a loop and is not.
- The platform will re-invoke your function without asking, after one minute and again after two, whenever it thinks the invocation failed; a deliberation that is not idempotent will quietly run twice and bill twice.
- The background function has a ceiling too; a deliberation that crosses it must leave the job row in a state the page can render as incomplete, not as pending forever.
- If every judge returns an empty `against.relies_on` in run one, that is a prompt failure to fix in the prompt, not a reason to make the field mandatory.
- Supabase writes made per output are the progress signal; a write that fails leaves the page showing less than happened, so write the log row before the output row, never after.
