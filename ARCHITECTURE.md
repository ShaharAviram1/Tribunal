# The Tribunal, architecture

How the infrastructure is built, for a reader with the code in front of them who has never seen
it. Every claim here names the file that proves it. The rules the system obeys, and the stage-by-
stage mechanics of a deliberation, are spec.md's subject; this document says only where each part
runs and how the parts reach each other.

## The pieces

- **The browser pages.** The home page is a static file, `public/index.html`, its behaviour an
  inline script in that same file: choose a case or submit a scenario, choose a panel, convene. A
  case page is not static: it is server-rendered, and the browser receives finished HTML. While a
  deliberation is in flight, `public/case-live.js`, injected by the page function, polls and
  reveals the server-rendered cards; `public/case-ui.js` adds the reason stepper on every case
  page. Neither renders content of its own.
- **Five Netlify functions**, in `netlify/functions/`:
  - `tribunal-file.mts` — filing and convening. Validates a charge sheet against the rules
    (`src/protocol/validate-charge-sheet.ts`), naming the failed rule; stamps what only the system
    may write (`src/protocol/stamp.ts`); writes the job row; invokes the background function. No
    model call happens here.
  - `tribunal-intake.mts` — scenario submission, retired 2026-09-05 (`spec.md` part two, step 0).
    Answers 503 naming the retirement. The clerk it once fed (`src/protocol/intake.ts`) and the
    background function's intake branch remain, reachable by nothing on the live site.
  - `tribunal-run-background.mts` — the background function, where every model call in the system
    happens: the intake clerk's draft (`src/protocol/intake.ts`) and the seven-role protocol
    (`src/protocol/run.ts`).
  - `tribunal-case.mts` — the read-only JSON endpoint the page polls, and the docket listing
    (`?list=1`). The one door to the data from outside.
  - `tribunal-case-page.mts` — serves the case page, rendered by the same renderer the static
    render uses (`src/page/render-case.ts`), with per-seat usage computed from the log rows
    (`src/page/usage.ts`).
- **Supabase** holds the four tables; the schema is the committed migration
  `supabase/migrations/0001_tribunal.sql`.
- **OpenRouter** is the single model gateway; one key, every call.
- **One client module**, `src/client/model-client.ts` with its HTTP layer
  `src/client/openrouter-transport.ts`: the only code that holds the key, the caps, the
  temperature, the transport retry policy, and the log-row format. Everything else asks it.

```mermaid
flowchart LR
  B[browser<br/>index.html · case-ui.js · case-live.js]
  F[tribunal-file]
  I[tribunal-intake]
  C[tribunal-case]
  P[tribunal-case-page]
  R[tribunal-run-background]
  M[model-client]
  S[(Supabase)]
  O[(OpenRouter)]
  B -->|file / convene| F
  B -->|scenario| I
  B -->|poll JSON| C
  B -->|open case| P
  F -->|invoke| R
  I -->|invoke| R
  R --> M
  M -->|one key, every call| O
  F --> S
  I --> S
  R --> S
  C --> S
  P --> S
```

Arrows point the way requests move; the browser never touches Supabase or OpenRouter, and no
function calls a model except through the client module.

## The request paths

- **Filing a charge sheet.** POST to `tribunal-file.mts`. Rules checked, failures named, sheet
  stamped and stored, job row written `pending`, background function invoked, docket URL returned.
- **Submitting a scenario.** POST to `tribunal-intake.mts` answers 503: retired 2026-09-05. Until
  then it checked the word bounds, reserved the docket row and job, and handed the scenario to the
  background function, where the clerk drafted.
- **Convening.** POST to `tribunal-file.mts` with a case id: a fresh job row for an existing
  stamped sheet, then the same background invocation. The paid-panel daily cap is enforced here.
- **Polling a run in progress.** `public/case-live.js`, injected by `tribunal-case-page.mts`,
  polls the job and re-fetches the server-rendered HTML when it advances, revealing the cards
  that now exist. The browser holds no protocol state the server does not.
- **Opening a past case.** GET `/case/<deliberation_id>`, redirected by `netlify.toml` to
  `tribunal-case-page.mts`, which renders stored objects. The committed runs under `runs/` are the
  same renderer run offline by `scripts/render-static.ts`, with no key in the environment.

## The database

Four tables, all in `supabase/migrations/0001_tribunal.sql`:

- `charge_sheets` — sheets as stored after stamping, one row per case id.
- `jobs` — one row per deliberation: status, stage, terminal reason, accumulated calls and spend,
  attempts per role, claim and heartbeat timestamps, completed and failed roles, and the resolved
  role-to-model map as used.
- `outputs` — one row per role per deliberation, stance, opinion, or failure record, written as
  each lands.
- `call_log` — one row per model attempt; the cost of a deliberation equals the sum of its rows.

Row-level security is enabled on all four tables with no policies written (the `alter table ...
enable row level security` lines at the end of the migration), so PostgREST serves nothing to the
anonymous role and only the service-role key, held server-side, reads or writes. The claim and
heartbeat are SQL functions in the same migration, `claim_job` and `heartbeat_job`, so their
atomicity is the database's, not the caller's.

## The background function, and why it exists

A deliberation is minutes of model calls; a synchronous Netlify function answers in seconds. The
background function (`tribunal-run-background.mts`) has a 15-minute ceiling, and the platform
automatically re-invokes an invocation it believes failed, after one minute and again after two.
That platform behaviour shapes the function:

- **The atomic claim.** The function claims the job through `claim_job` before any work; one row
  updated or zero. A concurrent re-invocation loses the claim and exits without a single call.
- **The heartbeat.** The function refreshes `heartbeat_at` as it works. A job left `running` by a
  function that died becomes claimable again once the heartbeat passes the stale threshold; a
  terminal job is never claimable at all.
- **Budget on the job row.** Calls and spend accumulate on the job row, never in process memory,
  so a re-invocation inherits the money already spent; a fresh invocation never gets a fresh
  budget (`src/client/model-client.ts` reads and writes them through the store).
- **Resume from stored outputs.** On re-entry, a role with a stored output is not called again and
  a stage whose outputs all exist is not re-run (`src/protocol/run.ts`).

```mermaid
sequenceDiagram
  actor U as visitor
  participant B as browser
  participant F as tribunal-file
  participant R as run-background
  participant S as Supabase
  participant O as OpenRouter
  U->>B: convene
  B->>F: POST case id
  F->>S: job row (pending)
  F->>R: invoke
  F-->>B: docket URL
  B->>S: — never —
  R->>S: claim_job (atomic)
  par four advocates, concurrent
    R->>O: advocate call
    O-->>R: stance
    R->>S: log row, then output row
  end
  Note over R: gate: four stances or stop
  par three judges, concurrent
    R->>O: judge call
    O-->>R: opinion
    R->>S: log row, then output row
  end
  R->>S: terminal status on job row
  loop while job not terminal
    B->>F: — no more writes —
    B->>+S: (via tribunal-case) poll job
    S-->>-B: status, stage, outputs
  end
  B->>B: reveal the three columns, side by side
```

## The key

`OPENROUTER_API_KEY` lives in the Netlify server environment and nowhere else. It is read inside
the functions (`src/functions-env.ts` checks its presence and fails loudly) and handed to the
transport. It never reaches: the browser (there is no client bundle to hold it), an HTTP response,
a log row (`src/client/model-client.ts` defines the row and no field carries it), or a committed
file (`.githooks/pre-commit` refuses key patterns before any commit). The hard credit limit on the
key itself, set at the provider, is the one control that survives all of this being wrong.

## Deploy

Two hosts run the same handlers; neither changes them.

**Render, since 2026-09-05.** `server/serve.ts` is a plain Node server that hosts the five handlers
on the paths Netlify gave them, and `render.yaml` describes the free web service that runs it with
`npm start`. The server mirrors `netlify.toml` claim by claim: `public/` as static files with byte
ranges for the gavel clip, `/.netlify/functions/<name>` for the five names and no other, `/case/<id>`
onto the page handler with the id as the redirect passed it, and the background function answered
202 before it runs. `tests/server.test.ts` holds each of those claims on loopback with no store
environment, so every handler answers before it could reach Supabase. One difference stands: on
Netlify the platform re-invokes a background function that dies, and the claim-and-heartbeat
mechanism of spec.md part three resumes the job; on Render nothing re-invokes, so a deliberation
killed mid-run stays `running` until its heartbeat goes stale, and the case page reports the stall
after four minutes of no advance. That is a failure shown as a failure, not a substitution. The free
instance sleeps after fifteen idle minutes and wakes in under a minute; a live page polls every five
seconds, so a run in progress keeps it awake.

**Netlify, until 2026-09-05.** `netlify.toml` publishes `public/` and serves `netlify/functions/`;
the `/case/*` redirect maps case URLs onto the page function. Deploys stopped when the account's
credit ran out; the CLI's refusal is recorded in the maintenance-8 pack. The configuration stays
so the site deploys there again the day credit returns, unchanged.

The Node version is pinned three times, in `.nvmrc`, `netlify.toml`, and `render.yaml`, so local
and either deploy cannot disagree; the pinned version strips TypeScript natively, so there is no
build step and no dependency — `package.json` declares none.

`SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` omits `TRIBUNAL_STORE` and `TRIBUNAL_FILING_ENABLED`
from Netlify's secret scanning. Both are non-secret flags whose values are ordinary words that
legitimately appear in deployed output, which the scanner cannot know; the omission is named in
the committed file so a reader can check exactly what is exempt, and the API key is not exempt.

## Configuration

- `config/caps.json` — every numeric cap: calls, spend, attempts, timeout, temperature, output
  ceiling, backoff. Read by `netlify/functions/tribunal-run-background.mts` and
  `src/protocol/run.ts`, and handed to the client module at construction
  (`src/client/model-client.ts`). No code path raises the call or spend caps mid-run; the output
  ceiling alone is raised mid-run, doubling on each truncation retry, the truncation remedy of
  spec.md criterion 6.
- `config/models.json` — the named panels, the intake model, and the per-role fallback lists, with
  the decisions that shaped them recorded in its comment. Read by the background function and the
  scripts.
- `config/roles.json` — the seat of each advocate and the label of each judge. Read by
  `src/protocol/run.ts`; no real jurist's name appears in any id.
- `config/forbidden-vocabulary.json` — the aggregation vocabulary the project must never use.
  Read by `.githooks/pre-commit`, which refuses a commit containing it, and by the tests that
  assert the rule.

## What was rejected

Three execution shapes were considered and rejected — the protocol in the browser, a single
streaming function, and a stage-advancing worker. spec.md part three states each and the reason;
this document does not restate them.
