# The Tribunal

A contested act admits several defensible readings, and a reader is normally handed one: the
competing readings are either never produced, or are collapsed into a single conclusion before the
reader sees them. This system produces them separately and **never combines them**. Four advocates
argue one charge sheet in seven separate model calls, and three judges then rule alone, their
verdicts shown side by side.

One rule outranks everything else here: **the three opinions are never combined.** No count, no
tally, no summary line, no page title that answers "so what did they decide", in any layer.
Advocate positions are never summed either.

## The shape of a run

A charge sheet is filed and validated by rule code before any model is called; a sheet that fails a
rule is rejected and the rejection names the rule.

Four advocates then argue it, two at the defense table and two at the prosecution table, each in its
own call, each free to conclude against its own seat. The seat fixes the procedural role, not the
conclusion.

Three judges then read those four stances and each rules alone. Each judge applies a distinct
judicial method adapted from a real jurist's published opinions. The judge is not the jurist and the
opinion is not a prediction of how that jurist would decide.

The result is three verdicts, never combined: no count, no synthesis, nothing that reduces three
opinions to fewer than three.

Two panels can hear a case. One model takes all seven roles, or seven distinct models take one role
each. An intake clerk once drafted a charge sheet from a submitted scenario in one further model
call (T-006 is its record); scenario submission was retired from the live site on 2026-09-05, and
the endpoint says so rather than pretending to draft.

## Running the offline suite

The suite requires exactly the Node version pinned in `.nvmrc`, which is **24.11.1**. It needs no
API key and no network.

```
npm test
```

The suite refuses to run with `OPENROUTER_API_KEY` set, and `fetch` is replaced before any test
loads, so a test that reaches the network fails by design.

## Rendering a committed deliberation

A fresh clone renders a complete case page from the repository alone, with no key and no network:

```
node scripts/render-static.ts run-02
```

That writes `runs/run-02/case.html` from the committed charge sheet, job row, and seven stored
outputs. `runs/run-01` is the committed incomplete run: three advocates answered, one failed, the
deliberation stopped before the bench, and the page renders each failure as a failure.

## The live site

The site is https://tribunal-skg3.onrender.com, a free Render service running `server/serve.ts`
since 5 September 2026, when Netlify blocked deploys for exhausted credit; the earlier address,
https://incomparable-hotteok-4da2cf.netlify.app, still serves the last deploy made before that day.
A deliberation takes about two minutes from filing to the third opinion. Every panel runs on paid
models; convening needs no access code, only room under the daily cap.

Deployments sleep: the free Render instance stops after fifteen idle minutes and wakes in under a
minute, and the free Supabase project pauses when idle, so the site may be slow or unavailable when
you open it. The committed runs are the durable evidence.

To run it yourself, on the pinned Node with the variables of `.env.example` set:

```
npm start
```

## Where things live

- `problem.md` — the situation, the stakeholders, what done means, what is out of scope and why.
- `spec.md` — the contract the build is held to: goal and reason, criteria, boundaries, pitfalls.
- `CLAUDE.md` — how to work in this repository, and the rule that outranks everything.
- `intent.txt` — the idea as it was first put, before any of it was built.
- `ARCHITECTURE.md` — how the infrastructure is built: the pieces, the request paths, the
  database, the deploy, each claim naming the file that proves it.
- `docs/charge-sheet.spec.md` — what a filer may submit and the rules enforced against it.
- `docs/advocate-stance.schema.md` and `docs/judicial-opinion.schema.md` — the two output schemas.
- `prompts/` — the seven panel prompts and the intake prompt: hand-written, versioned, loaded at
  runtime, never inlined in code.
- `docs/04-turns/` — the turn records, one per spiral turn: the plan, what it taught, what is locked.
- `docs/06-merge-packs/` — what each branch carried when it was proposed for merge.
- `docs/lessons-learned.md` — every correction, written as a rule.
- `ROADMAP.md` — where the spiral stands and what remains.
- `docs/07-design/handoff.md` — the courtroom design the case page implements.
- `runs/` and `docs/04-turns/e2e/` — committed evidence: stored deliberations with their logs, and
  the end-to-end transcripts.

---

A fictional proceeding. Each judge applies a method adapted from published opinions; no judge
represents the jurist, and no opinion predicts how that jurist would decide.
