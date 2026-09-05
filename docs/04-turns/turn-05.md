# Turn five: maintenance

Not planned. The roadmap declared turn five cut; the live site reopened it. Branches
`maintenance-1` through `maintenance-4` from `main` at the turn-four merge. Bound: no new
capability — every change either repairs what a live run exposed or makes visible a cost
already spent.

## The merges, in order

| SHA | Merge |
|---|---|
| `e120b6d` | the wake, the gavel, and the paid roster |
| `7902a1e` | per-seat cost and tokens on every card |
| `3501a34` | the strike keeps its own time |
| `4ba736a` | the gavel struck on camera |
| `f7df443` | the tuning bench comes aboard |

## What the turn taught

- **A hidden tab is not a crashed run.** The live page froze whenever it left the foreground;
  the database showed the deliberation complete in nineteen seconds. Browsers clamp timers in
  background tabs. The poll now sleeps abortably and wakes on `visibilitychange`, and the
  stalled notice only counts time the page was actually watching. Amended 2026-09-05
  (maintenance-9): the same hidden tab still ran the loop, only slower, and could see the job turn
  terminal with no one watching; a hidden tab also defers media loading, so the gavel's veil ran
  its floors over a clip that never played and was gone before the viewer returned. The reveal
  and the gavel now wait for a visible tab, and the markup is fetched once more after the job is
  known terminal, closing a second gap where the job turned terminal between the two requests of
  one poll and the page would have adopted sealed columns and stopped.
- **Free models cost the most.** The free tier's slowness and refusals bought nothing a paid
  cent didn't buy better; every chain, primary and fallback, now runs paid models only.
- **Cost belongs beside the name.** Each seat shows its model with the dollars and tokens it
  spent, computed from the log rows alone, with the sum in the header — the ledger the spec
  promised, made visible.
- **The choreography survives only where the tests can see it.** A script-surgery pass once
  shipped the gavel's JavaScript intact and deleted all of its CSS; the veil ran invisible. The
  gavel styles moved into the renderer's stylesheet, where the render test asserts them.
- **A frame-walk loses to an eye.** Sampling the clip at 0.6-second steps misread a double
  swing. The tuning bench at `/gavel-tune.html` let the eye mark start, impact and end to the
  hundredth; the strike runs on those numbers (`1e527f8`, `6d0ddf4`, `38954ef`).

## A drift, for the record

The strike retune (`1e527f8`) was committed on `main` directly while `maintenance-4` held only
the tuning page — the branches diverged and the "merge" at `1e527f8` merged an older branch. The
drift was noticed and closed at `6d0ddf4`, the branch realigned. Named here because the record
is the point.

## The closing commit

The seventh seat moves off `qwen/qwen3.8-27b`, which answered validly but spent 38–108 seconds
grinding reasoning tokens every call, onto `google/gemini-2.5-flash-lite` — the fastest valid
probe of the turn-four round (~2.5s), distinct from every other seat, with
`mistralai/mistral-small-2603` behind it so the seat cannot fall back onto itself. The gavel's
end moves to 4.00 by eye. The README stops calling the single panel free.

## Open until

The strike passes the eye that measured it, on a convened run.
