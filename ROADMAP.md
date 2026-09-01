# Roadmap

The build is a spiral. Each turn has a branch, one live run where the turn calls a model, a
record under `docs/04-turns/`, and a merge pack under `docs/06-merge-packs/`. A turn is bounded
by what it may not do, not by what it should. This file says where the spiral stands and what
remains; the turn records say what each turn taught.

Last revised 2 September 2026.

## Where it stands

| | |
|---|---|
| Merged to `main` | Turns 0, 1, 2, 3, 4 — the planned spiral; turn 5, maintenance; the documentation pass |
| Open | none |
| Remaining | none |
| Deployed | Netlify, live convening, no access code |

## Turns

### 0 — Scaffold and gates · merged

Bound: no code that calls a model. Four pre-commit gates each watched refusing something; the
offline suite runs the fixture and assembly checks on the pinned Node; the byte-identical first
block asserted.

### 1 — The spine · merged

Bound: all seven roles on one model, no page beyond what proves the run. One live deliberation of
T-001, seven outputs, committed with its full log. Client module, protocol, validation, retry and
failure paths drilled offline against fixtures recorded from that run.

### 2 — Storage and the function · merged

Bound: no new model behaviour, no page. The protocol runs unchanged against Supabase through the
storage interface. The Netlify background function runs a deliberation end to end with the job row
claimed, budget accumulated across invocations, and re-entry resuming from stored outputs.

### 3 — The case page, and everything it absorbed · merged

Its recorded bound was *no new model behaviour; no storage change*. **The bound was broken.** The
branch also carries the v2 advocate prompt rewrite, per-seat model fallback and the intake clerk,
all three of which are new model behaviour. The branch is not being split — the merge packs cite
its SHAs — so the turn record is amended to describe what turn three actually became, and the
overrun is named there and in `docs/lessons-learned.md`.

What the turn contains: the case page and JSON endpoint; three opinions of equal prominence with
citations resolving to claims; failures rendered as failures; a fresh clone rendering T-001 from
the committed run with no key; the live polling path watched end to end; the courtroom design
handoff implemented; the access code removed and replaced by caps; the fenced-JSON fix; the v2
advocate prompts that first divided the floor along its tables; per-seat model fallback; and the
intake clerk that drafted T-006 from a neutral account and passed every rule first try.

Closed 1 September 2026: turn table amended, lessons-learned entry 6 added, *what is now locked*
written, merge pack rewritten against the branch as merged, root README written, merged `--no-ff`.

### 4 — Several models · merged

Bound: same prompts, same temperature, different models.

Done when: a second live deliberation across more than one model, **complete**, committed with its
log; both logs in the repository; the per-run spend cap replaced by a measured figure as a recorded
revision of `spec.md`.

Closed 1 September 2026: fourteen live probes seated seven models from seven companies, the seat
that never answered was replaced by one that always did, and the first convening of the probed
panel ran to complete — seven first-call answers, $0.0444, three verdicts. Both logs sit in the
repository; the $0.25 backstop stands re-affirmed as a dated line.

### 5 — Maintenance · closed

First declared cut — the intake clerk, the advocate prompt rewrite and model fallback were built
inside turn three, and no fifth turn of building was owed. Then the live site reopened it: after
the merge-ready close, running the courtroom kept teaching. Bound: no new capability; every change
repairs what a live run exposed or makes visible a cost already spent. The paid-only roster, the
background-tab wake, per-seat cost and tokens, and the gavel saga all live here. Record:
`docs/04-turns/turn-05.md`, which also names a branch drift caught and closed mid-turn.

Closed 2 September 2026 with one condition of its own left unmet, named here rather than dropped:
the retuned gavel strike has not been watched on a convened run by the eye that measured it. Every
other change in the turn is merged, drilled, and deployed. The turn closes because the project
closes, not because that last watch happened.

### The documentation pass · merged

Not a spiral turn. Four documents the course asks for by name — `intent.txt`, `spec.md`,
`CLAUDE.md`, `ARCHITECTURE.md` — written or brought true against merged `main`, with `spec.md`
gaining an unnumbered section on the mechanics of a deliberation stage by stage, and no part or
criterion renumbered so that every citation elsewhere still resolves.

Two blind verification runs, each given only the documents and the repository, found ten
discrepancies between what the documents claimed and what the code did. Four were real defects the
275-test suite did not catch, repaired on `maintenance-5`, `-6` and `-7`: a refusal reassigning to
a fallback, a text regex classifying HTTP 403, two log fields the spec claimed and nothing wrote,
and a paid-run cap with a hole in it. The second run also found that per-role fallback had never
been wired into the deliberation's client at all — the drills passed against clients they built
themselves, so no live run could ever have reassigned a failed seat. That correction is dated
beside all six places the earlier record claimed otherwise. Record:
`docs/06-merge-packs/docs-pass-pack.md` and the three maintenance packs; the method is
`docs/lessons-learned.md` entry 7.

## Closing items

- **Root `README.md`** — written at the turn-three close.
- **Merge-ready state** — reached 1 September 2026 and held: every turn record closed, every merge
  pack true to its branch, nothing left unmerged.
- **The four named documents** — `intent.txt`, `spec.md`, `CLAUDE.md`, `ARCHITECTURE.md`, all at
  the repository root beside `problem.md` and this file.
- **Known and accepted** — the free Supabase project pauses when idle, so the deployed site can be
  asleep when a reader opens it. The committed runs under `runs/` render from the repository alone
  with no key and no network, and are the durable evidence. Not fixed by decision, 2 September 2026.

## Where this stands

The Tribunal is finished for now. Nothing is in flight, nothing is unmerged, and no further turn is
planned. Work resumes only if a live run teaches something, which is the bound turn five was
written under.
