# Merge pack: turn three, the case page and everything it absorbed

Branch `turn-3` (27 commits, `42722df`…`be901dc`) into `main`. Evidence under each heading, not assertion.

Turn three began as the case page and did not stay there. Its recorded bound was *no new model behaviour;
no storage change*; the storage half held, the model-behaviour half did not. What the branch actually
contains is below, and the overrun is stated under Rationale rather than buried.

## 1. Functional completeness

| Delivered | Evidence |
|---|---|
| problem.md 4: three opinions side by side, three columns of equal prominence and identical structure, and no combined result on the page, in the stored deliberation, or in the code | one `opinionColumn` in `src/page/render-case.ts` renders all three; `tests/render.test.ts` "three opinion columns, identical structure, and no combined result anywhere" checks page chrome against `config/forbidden-vocabulary.json` and also refuses chrome that states agreement for the reader; measured at a 375-px viewport: all seven cards at identical x and identical 327-px width, all seven headers exactly 90 px (`docs/04-turns/turn-03.md`, "UI pass and the 390-px check") |
| problem.md 9: a fresh clone renders T-001 with no key and no network | `scripts/render-static.ts` plus the committed `runs/run-02/case.html` (complete) and `runs/run-01/case.html` (incomplete); `tests/render.test.ts` reads the same committed run offline under `tests/_guard.ts`, which throws if a key is present and replaces `fetch` |
| problem.md 7, the page half: a failed call renders as a failure, never as a position | `failureCard` is the only path a failure record can take; `tests/render.test.ts` "a failure record renders as a failure and cannot go down the output path" and "an absent output renders the job state, not an empty column"; live on real data in `docs/04-turns/e2e/d-T-001-1788255489724-b4847b2d/` (`judge-3` failed, `terminal_reason` "judge column(s) judge-3 produced no opinion; the others stand", the other two opinions standing) |
| Citations resolve to an advocate's name and claim, never a raw id | `tests/render.test.ts` "citations render as advocate name plus claim text; no raw point id is visible" asserts no `role.pN` reaches the rendered text |
| Read-only JSON endpoint and case page, both through the storage interface server-side; the service key never reaches the browser | `netlify/functions/tribunal-case.mts` (JSON), `netlify/functions/tribunal-case-page.mts` (server-renders through `renderCasePage`); the browser loads only `public/case-live.js` and `public/case-ui.js`, both static files, so spec criterion 4 stays checkable by reading them |
| Live view: staged reveals in seat order, the bench sealed until it rules, the filmed gavel on the terminal transition | `public/case-live.js`, 126 lines, served as itself; `tests/render.test.ts` "no judge content reaches the document before the bench rules: running seals returned opinions" asserts no verdict element exists in the running state; watched end to end in `docs/04-turns/e2e/convene-single-transcript.txt`, `multi-convene-transcript.txt`, `multi-polling-transcript.txt`, `multi-2-polling-transcript.txt` |
| The courtroom design implemented from the handoff | `docs/07-design/handoff.md` with the clip at `public/gavel.mp4` (commit `ae0a3df`); its six hard constraints land as the renderer's rules — columns identical in every visual respect, the verdict the most prominent element in its card and typographically identical whatever it says, seat colour never outcome colour, waiting states geometry only, a failure named with the other columns intact, the jurist qualification directly under each name (`tests/render.test.ts` "the page names the panel and the model behind each card" and "the dossier guard and the as-filed scoping line sit with the opinions") |
| The antechamber | `public/index.html` implements handoff screen A: docket card, panel choice as a named two-button grid, convene button, guard paragraph above the fold, the debug filings folded behind a disclosure that says what they are (`5104118`, `ae0a3df`); the index was recreated by a subagent with the script byte-identical, recorded in `docs/04-turns/turn-03.md` |
| The access code is gone from filing and intake | `cc8654b` removes `TRIBUNAL_ACCESS_CODE` from `.env.example`, from `FILE_ENV` in `src/functions-env.ts`, from `tests/functions-env.test.ts`, and from the stakeholder list in `problem.md`; the background function keeps `TRIBUNAL_FUNCTION_SECRET`, which is machine-to-machine |
| What replaces it: caps, not a gate | `netlify/functions/tribunal-file.mts` and `tribunal-intake.mts` count paid deliberations from the jobs table over a rolling 24 hours and refuse the eleventh with a plain 429 naming the limit, before any write or model call; the per-run call and spend caps stand in `config/caps.json`; the daily cap's first real refusal is recorded in `73b83e7` and in the turn record. The per-IP cooldown was removed by decision (`be901dc`), the reason on record in `tribunal-file.mts` and the turn record |
| v2 advocate prompts | `prompts/jon.md`, `tyrion.md`, `daenerys.md`, `greyworm.md` carry `version: 2` after `c3f03f0`: the seat owes the strongest honest case the record allows, and concluding against the seat is the last resort an honest advocate earns rather than the assignment. Result on record: the floor divided along its tables in both runs that night, defense arguing justified and prosecution not_justified (`docs/04-turns/turn-03.md`, "The night the floor learned to argue"); the free-panel run is exported at `docs/04-turns/e2e/d-T-001-1788255049324-b4847b2d/`, complete, 9 calls, $0 |
| Fence stripping, as a narrowing of the no-normalising rule | `spec.md` criterion 6, revision 2026-09-01, fences; `src/protocol/parse-object.ts`; `tests/protocol/fence.test.ts`, 5 drills including "a fence around garbage is still malformed; only the envelope was stripped". Named cause, both exported: `d-T-004-1788201481917` and `d-T-001-1788247753913-b4847b2d`, each incomplete at 3 of 4 stances with `daenerys` on a Gemini model fencing valid JSON on both attempts. Production test: the same seat validated first try after the fix |
| Advocates get a third validation attempt; judges keep two | `spec.md` criterion 6, revision 2026-09-01, attempts, with the worst case recomputed as 18 validation calls inside the 20-call cap; `config/caps.json` `max_attempts_per_role`; drilled in `tests/protocol/run.test.ts` |
| Judge reasons and the counter-consideration bounded at 90 words | `spec.md` criterion 8 revision 2026-09-01 with the measured basis; enforced in `src/protocol/validate-opinion.ts` as malformed with the corrective retry naming it; `tests/protocol/opinion-bound.test.ts`, 3 drills |
| Per-role model fallback, and every reassignment visible | `config/models.json` `role_fallbacks`, used only after a seat exhausts its retries and never because of what a stance said; `src/protocol/run.ts`; `tests/protocol/reassignment.test.ts`, 4 drills, first of them "a judge whose model never answers is reassigned to its fallback, visibly"; the card says so, asserted by `tests/render.test.ts` "a reassigned seat says so on its card". (Correction, 2026-09-02: as merged, role_fallbacks reached only the intake clerk's client; the deliberation's client in tribunal-run-background.mts was constructed without it, so no live run could reach this path — the drills passed against clients they built themselves. The wiring landed in maintenance-6, merged to main 2026-09-02.) The separate ordered free chain (`free_fallbacks`) advances a free seat on a rate or quota status, each attempt logged under the model actually requested and the job's role map recording who finally served — `spec.md` part three revision 2026-09-01, drilled in `tests/client.test.ts` |
| The intake clerk, drafting a case from a submitted scenario | `prompts/_intake.md` (hand-written, versioned, never assembled into any of the seven panel prompts — asserted in `prompts/_contract.md`), `prompts/_advocate-frame.md`, `docs/representative-sketch.schema.md`, `src/protocol/validate-sketches.ts`, `src/protocol/intake.ts`, `netlify/functions/tribunal-intake.mts`. The endpoint reserves the docket row and job and answers at once; the drafting call runs inside the background function where the ceiling can hold it (`spec.md` criterion 7 revision 2026-09-01) |
| T-006 is the clerk's proof | `docs/04-turns/e2e/d-T-006-1788268372241-744dfe6b/`: `charge-sheet.json` drafted from a neutral two-hundred-word account and passing every rule first try, with Servilia, Calpurnia, Marcus Antonius and Cicero seated from the scenario and none invented; `job.json` `status: complete`, `calls: 11`, `spend_usd: 0.026145`, seven outputs, no failed roles; `log.jsonl` carries the intake call as the job's first row, so the deliberation's cost is still the sum of its rows. Transcripts: `intake-submission-transcript.txt` (202 with the assigned `T-006` in 1.88 s) and `intake-polling-transcript.txt` (2 s drafting → 23 s sheet stamped → complete at 343 s) |
| An intake that failed is on the record as failed | `T-005`, the reservation whose synchronous drafting call died at the gateway as a 504, is marked failed with zero calls and zero spend; the 504 itself is preserved in git at `1b32578`'s `intake-submission-transcript.txt`, and `failIntake` in `src/protocol/intake.ts` is the path that writes it |
| Panel choice as a named configuration, not a hard-coded model | `config/models.json` `single` and `multi`; `tests/panels.test.ts`, 4 drills, including "multi is seven distinct models, no two roles sharing one" and the free chain's ordering |

**What this closes.** problem.md items 4 and 9 close here; item 7's page half closes here (its log half closed in turn one); items 10 and 11 stand from turn one. Spec criteria 4, 5, 6 (as revised), 7 (as revised), 14, 16, and 17 are exercised on this branch, and the part-three rule that the page reads a JSON endpoint through the storage interface server-side is satisfied by `tribunal-case.mts` and `tribunal-case-page.mts`.

**What remains, by design.** problem.md item 8's second half — one committed deliberation across more than one model, **complete** — is turn four's done condition. Every multi-panel run on this branch ended incomplete, honestly, and each is exported with its log.

## 2. Sound verification

**265 offline tests, zero network, pinned Node** (`npm test`, 265 pass / 0 fail). The suite runs under `tests/_guard.ts`, which refuses to start with a key in the environment and replaces `fetch` with a thrower.

**52 blind intake drills**, `tests/intake/sketches.test.ts`. Its header names exactly which documents it was written from — `docs/representative-sketch.schema.md`, `docs/charge-sheet.spec.md`, `prompts/_intake.md`, `prompts/_contract.md` — and states that `src/protocol/validate-sketches.ts`, `netlify/functions/tribunal-intake.mts` and every other file under `src/` were never opened, with the one exception (`types.ts`, for the word-counting convention) declared. It covers SK-01 to SK-05 with both boundaries on every numeric rule (39/40 and 300/301 words, 60/61 characters), case-insensitive whole-word jurist-name rejection with the substring near-misses that must pass (`Belongs`, `Meirong`), and multi-rule failures reported together. Its two findings tightened `docs/representative-sketch.schema.md` rather than the tests (`6e6503b`). This is the same discipline as turn one's blind protocol suite, which still runs here: `tests/protocol/` was written by an agent shown only the documents and never the implementation, and the implementation was made to pass it.

**New drills for what this turn added.** Fence stripping, 5 (`tests/protocol/fence.test.ts`). Visible reassignment, 4 (`tests/protocol/reassignment.test.ts`). (Correction, 2026-09-02: those four drills build their own clients; the production wiring for role_fallbacks did not exist until maintenance-6, so they were evidence for the protocol, not for the deployed path.) The 90-word bound, 3 (`tests/protocol/opinion-bound.test.ts`). Panels, 4 (`tests/panels.test.ts`). Rendering, 11 (`tests/render.test.ts`), including the sealed bench, the reassigned card, escape of hostile model text, and the chrome-only vocabulary check — the page test learned G3's lesson, that the rule binds our words and not a judge writing "counter-consideration".

**Live watches, each with its transcript committed** under `docs/04-turns/e2e/`: the filing and polling path (`t002-filing-transcript.txt`, `t002-polling-transcript.txt`, states 0→7 outputs, complete at 206 s with two live corrective retries both recovered); the convening view on a single panel (`convene-single-transcript.txt`); the paid panel twice (`panel-single-filing.txt`, `panel-multi-filing.txt`, `panel-polling-transcript.txt`); the two multi runs (`multi-convene-transcript.txt`, `multi-polling-transcript.txt`, `multi-2-polling-transcript.txt`); intake (`intake-submission-transcript.txt`, `intake-polling-transcript.txt`).

**The failure distribution, measured before it was acted on.** Four failure records existed across the turn, from two recurring causes: a well-formed outer fence twice, and an empty HTTP-200 response twice in a row once. Both fixes were derived from that count and are named in `c3f03f0`'s message. The exported records: `d-T-004-1788201481917` and `d-T-001-1788247753913-b4847b2d`, both `incomplete`, both stopped at 3 of 4 stances with judges never called (spec criterion 14 doing its job, twice, on real money — $0.0456 and $0.0430); `d-T-001-1788255489724-b4847b2d`, `incomplete` at the bench, `judge-3` on `qwen/qwen3.8-flash` erroring at the provider on every transport attempt and never answering, the other two opinions standing. Complete runs exported for contrast: `d-T-001-1788124601994`, `d-T-001-1788202422638`, `d-T-003-1788201480873`, `d-T-001-1788255049324-b4847b2d`, `d-T-006-1788268372241-744dfe6b`.

**Measured rather than eyeballed.** The narrow-screen check was made from inside a 390-px frame injected same-origin, geometry read from the live page, because the window could not be resized below the desktop minimum and a screenshot would have proven nothing (`28f1f91`, and again after the UI pass).

**What is not verified.** Character fidelity, out of scope by problem.md. That a multi-model panel can run to completion: it has not yet, and turn four opens with the seat that has never answered still to be replaced.

## 3. Engineering hygiene

- **One renderer for static and live.** `renderCasePage` in `src/page/render-case.ts` has exactly two importers, `scripts/render-static.ts` and `netlify/functions/tribunal-case-page.mts`. There is no second renderer in JavaScript to drift from it.
- **The client builds no content.** `public/case-live.js` polls, then reveals server-rendered cards by `document.importNode` / `replaceWith`; the only strings it writes are chrome labels and geometry. Its own header says so, and the sealed-bench drill enforces the consequence: nothing a model produced reaches the document before the server has rendered it.
- **No new dependencies.** `package.json` still declares none; the test script is `node --test` on the pinned `24.11.1`. The gavel is an `mp4` asset, not a library.
- **Prompts are files.** `prompts/` now holds eleven, including `_intake.md` and `_advocate-frame.md`; `grep -rn "You are " src/` returns nothing. G5 still asserts the shared charge-sheet block is byte-identical and first across all seven panel prompts, and the intake prompt is outside that set by contract.
- **One narrowing, stated rather than glossed.** Turn two's pack could claim `grep -rn fetch src/protocol` returns nothing. It no longer does: `src/protocol/intake.ts` PATCHes the docket row twice through the same service credentials the store uses. The rule that matters is intact — the deliberation protocol in `src/protocol/run.ts` still makes no model call and no HTTP call of its own, and all model access still goes through `src/client/model-client.ts`.
- **The storage half of the bound held.** `supabase/migrations/` still contains only `0001_tribunal.sql`; no commit on this branch touches it. The daily cap counts existing rows, the IP-hash suffix rides on the deliberation id, and intake reserves rows in the tables that already existed.
- **Gates.** G1–G4 ran on every one of the 27 commits via `core.hooksPath`, with G5 and G6 inside G4; `--no-verify` is not used in this repository. The platform gate, Netlify's secret scanning, ran on every deploy of the branch. One logical change per commit; every message says why.

## 4. Rationale

**The bound was broken, and the record says so.** Turn three's recorded bound was *no new model behaviour;
no storage change*. Three things on this branch are new model behaviour: the **v2 advocate prompt rewrite**
(`c3f03f0`), made when the defense seats kept arguing the prosecution's case; **per-seat model fallback**
(`26dc58d`, with the free chain in `c3f03f0`), made when a judge seat errored at the provider on every
attempt and never answered; and the **intake clerk** (`448a1ed` through `be901dc`), ordered as new scope
mid-turn. Each crossing was visible when it happened — each is a dated commit with its reasons, and each
carries a `spec.md` revision — but the bound itself was only re-read at merge time. **The branch is not
being split**: the merge packs cite its SHAs and this repository does not rewrite history to make the past
tidier than it was. Instead the overrun is named in three places a reader will reach — `ROADMAP.md`, which
records what turn three actually became; the turns table and its note in `docs/04-turns/README.md`, where
the bound row now reads "Recorded as: no new model behaviour; no storage change. The bound was broken";
and `docs/lessons-learned.md` entry 6, which turns it into a rule: re-cut the bound at the moment work
crosses it, not at merge time. The storage half of the bound held.

**Decided.** Server-side rendering by the same function the static render uses, because the browser runs no TypeScript and a second renderer would drift. The guard and the as-filed scoping line placed with the opinions, in the dossier's terms. Failure attempts behind per-attempt disclosures with an explicit caveat, because a truncated fragment opening with a position field reads as a position. No opinion word bound, from rendered evidence (295/381/214 words) — and later a 90-word bound on judge reasons and the counter-consideration, from different rendered evidence (113 and 96 words against advocate texts that stayed inside their bounds): a bound is added when a measurement asks for one and not before. A single well-formed outer fence is an envelope, not a value, so stripping it narrows the no-normalising rule rather than abandoning it. Advocates get one more validation attempt than judges, because a failed advocate aborts the deliberation before the bench and a transient flake should not be the first thing a visitor sees. The per-run backstop set to $0.25, five times the worst of three measured paid runs, replacing a figure that predated any measurement. Caps rather than a code on the door, because a tribunal a professor cannot convene without a password fails its purpose, while a spend cap costs money-shaped abuse its payoff. The clerk drafts inside the background function, because a synchronous ceiling cannot hold a model call — the deliberation's own lesson, learned a second time from a live 504. A seat reassigns only after exhausting its retries, never for what a stance said, and the reassignment is written to the log, the job map, and the card, because it can break the multi panel's no-two-roles-share-a-model property and that must be visible. (Correction, 2026-09-02: as merged this held in the protocol and its drills but not in the production wiring — role_fallbacks was not passed to the deliberation's client until maintenance-6.)

**Rejected.** Keeping the incomplete Gemini run as the multi record, and swapping the seat a third time: the fence was the fix, and the swap that had already happened (`24aab5b`) was not repeated. A fallback chain on the paid seats, which by design carry none, so a failed paid column shows the failure and the seat decision goes to the record's owner. Deleting the timed-out `T-005` reservation instead of marking it failed. A per-IP cooldown, removed after it throttled its own author twice in one afternoon — a protection whose only measured effect was on legitimate use. Inventing a word bound for a failure that had not happened, twice over: once for opinions, and not again until a measurement asked.

**Removed by decision before the turn's work.** The cold-reader criterion, from all live documents: it depended on recruiting a person, and an unmet item in a definition of done is worse than one never written. Target-reader decisions stand; merge packs and turn records keep their history.

**Recorded.** `T-002` is specified behaviour, not an accident: re-asking means filing a new charge sheet, so a second copy of the same content correctly became a new case; canonical evidence is `T-001` and `d-T-001-1788124601994`. The design handoff arrived mid-turn as a full high-fidelity specification and was implemented rather than interpreted. The daily cap's first refusal came from a day of building, which is the protection working. The bench that ruled after the v2 prompts ruled differently from every earlier bench on the same model and record structure, which is the note this turn hands to turn four: the record with a real defense reads differently, and nothing in the judge prompts was adjusted to produce it.

## 5. Audit trail

**Commits, in order** (`git log --oneline main..turn-3`, 27, each gated):

| SHA | What it did |
|---|---|
| `42722df` | turn three's plan on record |
| `67f9cfc` | the renderer, the JSON endpoint, and both static renders |
| `f13c75f` | the dossier's guard onto the page; the word bound closed |
| `ff7c20d` | the live page served from the one renderer |
| `88c6b23` | the polling path watched live; the phone layout measured |
| `729e051` | the panel made a named choice |
| `6a6c8c1` | one deliberation per panel committed, one incomplete |
| `46f76d5` | the live run made the product |
| `e565ce7` | the tribunal watched convening, and what it decided kept |
| `c0a675c` | verdicts put first and made to look like verdicts |
| `28f1f91` | the narrow-screen measurement recorded |
| `cc8654b` | the access code removed; the court dressed |
| `eb83f25` | judges named, the bench bounded at 90 words, quoting ended |
| `5104118` | the antechamber dressed |
| `24aab5b` | the seat that could not stop fencing swapped |
| `dbff884` | the second fence recorded, from a model the probe called clean |
| `ae0a3df` | the courtroom recreated from the design handoff |
| `73b83e7` | the built room verified; the cap's first refusal recorded |
| `c3f03f0` | fence stripping, the third advocate attempt, v2 prompts, the free chain |
| `3e0d4d1` | the free door opened, the paid door counted |
| `5058fe8` | the backstop measured down to $0.25; the floor watched dividing |
| `26dc58d` | a failed seat reassigned visibly; the bench sealed until it rules (Correction, 2026-09-02: reassignment was drilled but not wired for production until maintenance-6) |
| `448a1ed` | the clerk drafted: intake prompt, sketch rules, advocate frame |
| `6e6503b` | the blind sketch drills gated in, and what they flagged tightened |
| `ff435fd` | the clerk's window opened |
| `1b32578` | the clerk moved behind the ceiling that can hold him |
| `be901dc` | the clerk let to work; the leash taken off the door |

**Spec revisions this turn**, all dated in `spec.md` itself:

- Criterion 2, 2026-09-01: the 1.00 USD backstop replaced by a measured 0.25 USD, with the three measurements named.
- Criterion 6, 2026-09-01, fences: a single well-formed outer code fence stripped before parsing, the strip noted in the log detail, with the named cause.
- Criterion 6, 2026-09-01, attempts: advocates get two corrective retries where judges keep one, worst case recomputed at 18 validation calls.
- Criterion 7, 2026-09-01, intake: the job created first so the intake call is its first log row; the intake prompt named as a versioned file never assembled into a panel prompt; and, later the same day after the live 504, the drafting call moved into the background function with the endpoint reserving the docket row.
- Criterion 8, 2026-09-01: judge reasons and the counter-consideration bounded at 90 words, with the measured basis.
- Part three, 2026-09-01: the system's own ordered free-model chain distinguished from the provider-side substitution the rule forbids.
- `problem.md` item 4 reworded to "three columns of equal prominence"; the access-code stakeholder line removed. `docs/advocate-stance.schema.md`, `docs/judicial-opinion.schema.md`, and `docs/representative-sketch.schema.md` carry the matching schema changes; `docs/representative-sketch.schema.md` is new this turn.

**Committed runs and exports.** Static renders: `runs/run-01/case.html` (incomplete) and `runs/run-02/case.html` (complete), regenerated as the design changed. Deliberation exports under `docs/04-turns/e2e/`: `d-T-001-1788202422638` (convene on the existing case, complete, 8 calls, $0), `d-T-003-1788201480873` (free panel, complete, 7 calls, $0), `d-T-004-1788201481917` (paid, incomplete at 3 of 4, $0.0456), `d-T-001-1788247753913-b4847b2d` (paid, incomplete at 3 of 4, $0.0430), `d-T-001-1788255049324-b4847b2d` (free, complete, 9 calls, $0), `d-T-001-1788255489724-b4847b2d` (paid, incomplete at the bench, $0.0275), `d-T-006-1788268372241-744dfe6b` (intake-drafted, complete, 11 calls, $0.026145). Eleven transcripts sit beside them. `d-T-001-1788124601994` remains the canonical T-001 record from turn two.

**Turn record.** `docs/04-turns/turn-03.md` carries the plan as it stood, the first-render approval and its fixes, the word bound closed with evidence, the polling watch with its two live retries, the T-002 note, both narrow-screen measurements, the fresh-clone note, the convening view, the access-code removal, the diagnosed live-script failure and its class-removing fix, the second fence, the design handoff, the night the floor learned to argue, the clerk and T-006, and a closing *what is now locked* list of seven items each pointing at a file, a spec revision, and a drill.

**Lessons.** `docs/lessons-learned.md` gained entry 6 this turn: re-cut the bound at the moment work crosses it, not at merge time. Entries 1–5 stand from turns zero through two.

**Roadmap.** `ROADMAP.md` records turn three as open and ready to merge, names the overrun, lists what the turn contains, and states what turn four opens with: multi-model runs exist, every one so far ended incomplete at a judge seat, and the missing thing is one clean complete run, which means replacing the seat that has never answered before running.
