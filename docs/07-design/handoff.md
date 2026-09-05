# Handoff: The Tribunal — case page, antechamber, live states, gavel

## Overview

The Tribunal stages one legal-style case against seven separate model calls: four advocates argue it, then three judges rule on those arguments. The three verdicts are presented side by side and are **never combined**. This handoff covers five screens (antechamber, case page mid-run, case page concluded, the gavel transition, failure states) plus the token sheet, in the accepted visual direction: **A · Walnut and brass**.

The existing implementation is plain HTML/CSS/TS with a server-side renderer (`src/page/render-case.ts`) and a polling client (`public/case-live.js`). This design is a redesign of that output, not a new architecture. Every constraint below is a hard requirement from the brief, not a preference.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour. They are not production code to copy. The prototype is a single interactive file with a screen switcher, a direction switcher, and simulated run timing; the real product has none of that.

The task is to **recreate these designs in the existing codebase's environment**: plain HTML/CSS/TypeScript, no framework, no build step, no dependencies, rendered server-side and updated by polling. The prototype's inline styles and its React-ish template are artefacts of the design tool — translate them into the `CSS` string constant in `render-case.ts` and the markup that renderer emits.

## Fidelity

**High-fidelity.** Colours, type sizes, spacing, borders, shadows and materials are final and exact. Recreate pixel-for-pixel. Copy is final where it is chrome (labels, guard lines, section headings); all argument text comes from model output at runtime.

## Hard constraints — verify each before shipping

1. **Never combine the verdicts.** No summary line, no majority, no count, no "2 to 1", no tally of advocate positions, no page title implying a decision. The word "verdict" appears only inside a judge column, three times.
2. **The three judge columns are identical in every visual respect** — width, border, top rule, header height, nameplate, verdict block, stepper, footer position, and total height. Any asymmetry reads as ranking. The two grids use `align-items: stretch`; verified equal heights in every state, including when one column has failed.
3. **The verdict is the most prominent element in its card** and renders identically whatever it says. Colour may mark the seat. **Colour may never mark the outcome.**
4. **Judges carry a real jurist's name.** Directly under the name, not in a footer: "Method adapted from published opinions. Not the jurist, and not a prediction of how he would decide." A separate line states the panel judges the record as filed.
5. **No placeholder text stands in for a model that has not answered.** Waiting states are geometry only.
6. **A failure is shown as a failure, by name, with the other columns intact.** Never hidden, never substituted, and no position is inferred for a failed seat.

## Design tokens

Declared once on the page root. Direction A is the accepted one; direction B (oxblood/verdigris) is included in the prototype for reference only and need not ship.

### Colour — direction A

| Token | Value | Use |
|---|---|---|
| `--ground` | `#181008` | page ground, top-lit |
| `--ground2` | `#0d0906` | ground at the edges |
| `--card` | `#1c1510` | raised panel |
| `--card2` | `#261d14` | lit header / inset |
| `--edge` | `#3b2e20` | hairline |
| `--edge2` | `#54412b` | structural rule |
| `--rule` | `#35291c` | rules inside cards |
| `--card-ink` | `#f2ead9` | argument text |
| `--card-ink2` | `#a3937a` | support / secondary |
| `--card-ink3` | `#776650` | labels |
| `--page-ink` | `#f2ead9` | text on ground |
| `--page-ink2` | `#a3937a` | secondary on ground |
| `--page-ink3` | `#776650` | labels on ground |
| `--accent` | `#c9a227` | brass; structure only, never outcome |
| `--accent-soft` | `rgba(201,162,39,.35)` | brass at rule strength |
| `--defense` | `#8ba0b5` | defense seat |
| `--prosecution` | `#b5806a` | prosecution seat |
| `--sheen` | `255,240,205` | lit-edge highlight (used as `rgba(var(--sheen),a)`) |
| `--r` | `3px` | radius |

### Materials

```css
--wood:
  repeating-linear-gradient(93deg,
    rgba(255,236,196,.075) 0 1px, rgba(0,0,0,0) 1px 4px,
    rgba(0,0,0,.11) 4px 5px, rgba(0,0,0,0) 5px 11px,
    rgba(255,236,196,.05) 11px 13px, rgba(0,0,0,0) 13px 19px,
    rgba(0,0,0,.07) 19px 21px, rgba(0,0,0,0) 21px 29px),
  repeating-linear-gradient(88deg, rgba(0,0,0,.05) 0 2px, rgba(0,0,0,0) 2px 47px);

--stone:
  linear-gradient(112deg,
    rgba(226,232,240,.055) 0%, rgba(226,232,240,0) 9%,
    rgba(226,232,240,.03) 13%, rgba(226,232,240,0) 21%,
    rgba(0,0,0,.22) 44%, rgba(226,232,240,.045) 49%,
    rgba(226,232,240,0) 58%, rgba(0,0,0,.16) 71%,
    rgba(226,232,240,.028) 78%, rgba(226,232,240,0) 88%,
    rgba(226,232,240,.038) 93%, rgba(226,232,240,0) 100%),
  linear-gradient(28deg, rgba(255,255,255,.02) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,.14) 100%);
```

Rule: **walnut is furniture** (bench plinth, card headers, floor cards, charge-sheet panel). **Stone is the room** (page ground). **Brass is hardware** (plinth inlay, rail strip, section rules). No texture ever sits under argument text.

### Shadow

```css
--lift: inset 0 1px 0 rgba(240,222,180,.075),
        0 2px 3px rgba(0,0,0,.5),
        0 30px 60px -34px rgba(0,0,0,1);
```

### Typography

Google Fonts: `Bodoni Moda` (opsz 6..96, wght 400/600/700), `Spectral` (400/600/700 + italic 400), `JetBrains Mono` (400/500).

- `--display: "Bodoni Moda", Didot, Georgia, serif`
- `--text: Spectral, Georgia, serif`
- `--mono: "JetBrains Mono", ui-monospace, monospace`

| Role | Spec |
|---|---|
| Wordmark | display 600, `clamp(58px,7.4vw,116px)`, lh .9, tracking −.015em, light gradient across the type |
| Case title | display 700, `clamp(40px,4.8vw,70px)`, lh .96, tracking −.02em, `text-shadow: 0 2px 0 rgba(0,0,0,.5)` |
| Verdict | display 700, `clamp(44px,4.8vw,72px)`, lh .9, tracking −.03em, `text-shadow: 0 2px 0 rgba(0,0,0,.65)` |
| Advocate position | display 700, 30px, lh 1 |
| Judge name (nameplate) | display 600, 27px, lh 1.05 |
| Advocate name | display 600, 23px, lh 1.08 |
| Section heading | display 600, 26px, tracking .22em, uppercase |
| Argument body | Spectral 400, 16.5px / 1.58, `text-wrap: pretty` |
| Cited claim | Spectral 400, 13.5px / 1.45 |
| Advocate claim | Spectral 400, 14.5px / 1.45 |
| Support prose | Spectral 400, 13.5px / 1.55, `--card-ink2` |
| Micro label | mono 400, 10px, tracking .2–.3em, uppercase, `--card-ink3` |
| Model attribution | mono 400, 11px / 1.4, `--card-ink`, `overflow-wrap: anywhere` |

Model attribution is **not** the dimmest text on the card. It sits in `--card-ink` under a hairline in the judge header, and in `--card-ink2` in advocate headers.

### Spacing scale

6, 10, 18, 20, 22, 26, 34, 46, 58 px. Page padding: case screen `196px 34px 60px`, max-width 1560px. Antechamber `132px 40px 34px`, content max-width 1180px.

## Screens

### A. Antechamber (index)

Full-viewport, two columns at `1.15fr 1fr`, 64px gap, vertically centred, with a footer row on a 1px `--edge` rule.

Left column: mono 11px kicker (tracking .34em, uppercase) "Sitting in one session · seven separate model calls"; the wordmark "The / Tribunal" with a light gradient (`linear-gradient(176deg,#fff6e2,var(--page-ink) 42%,#8d7c62)` clipped to text); a 5px brass rule (1px `--accent` top, 1px `--accent-soft` bottom, brass wash between, max-width 420px); a 19px `--page-ink2` line; a 15px `--page-ink3` line stating the opinions are never combined; and the guard paragraph in mono 12px behind a 1px `--edge2` left border.

Right column: mono 10px label "The matter before the bench"; the docket card (`--card`, 1px `--edge`, 2px `--accent` top, `--lift`, 26px padding) with docket number in mono 10px, "The Realm v. Jon Snow" in display 600 32px, a 15px `--card-ink2` line, then a `--rule` divider and past hearings in mono 11px. Below: the panel choice as two buttons in a `1fr 1fr` grid (18px padding, display 600 19px title, 13px `--card-ink2` body; selected gets `1px solid var(--accent)` plus `box-shadow: 0 0 0 1px var(--accent)`). Then the convene button: full width, `--accent` fill, `--ground` text, display 600 22px, tracking .14em, uppercase, 20px 24px padding, `--lift`. Under it a mono 11px line: "Seven calls, about two minutes. The four advocates speak, then the bench rules."

### B. Case page, concluded

**Header.** Grid `1fr auto`, aligned to baseline, on a `3px double var(--accent-soft)` bottom rule with 20px padding. Left: mono 11px "The Tribunal · Docket T-001" (tracking .3em), the case title, then a 15px `--page-ink2` line naming accused and deceased and stating the panel judges the record as filed and does not combine its opinions. Right: mono 11px/1.7 `--page-ink3`, right-aligned, three lines — stage, panel composition, `Elapsed m:ss · Calls n of 20`. Behind it all, absolutely positioned at `right:-6px; top:-58px`: the docket "T-001" in display 700 210px, `color: rgba(255,255,255,.028)`, `pointer-events:none; user-select:none`.

**The Bench.** Section head row: `h2` "The Bench" left, a 14px `--page-ink3` right-aligned note ("Three judicial methods, each ruling alone on the same record. Presented side by side; not combined."), on a `3px double var(--accent-soft)` rule.

The three columns sit inside a **plinth**: `padding: 26px 26px 30px`, 1px `--edge` border with `--edge2` on top, radius `--r`, background `var(--wood), linear-gradient(180deg, rgba(240,222,180,.05), rgba(0,0,0,.28))`, and
```css
box-shadow: inset 0 1px 0 rgba(240,222,180,.075),
            inset 0 0 0 1px rgba(0,0,0,.35),
            inset 0 -30px 50px -30px rgba(0,0,0,.72),
            inset 0 0 0 8px rgba(201,162,39,.28),
            inset 0 0 0 9px rgba(0,0,0,.45);
```
(the last two are the brass inlay). Inside: `display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:22px; align-items:stretch`.

**Judge column** — `--card` background, 1px `--edge`, `2px solid var(--accent)` top, radius `--r`, `--lift`, `display:flex; flex-direction:column; min-height:420px`.

1. *Header*: 22px 24px 18px padding, bottom border 1px `--accent-soft`, background `var(--wood), linear-gradient(180deg,var(--card2),var(--card))`, plus `inset 0 1px 0 rgba(240,222,180,.09)`. Inside: the **nameplate** — the judge name with `padding:11px 14px`, `background: linear-gradient(178deg, rgba(var(--sheen),.10), rgba(0,0,0,.22))`, `border-top:1px solid var(--accent-soft)`, `border-bottom:1px solid rgba(0,0,0,.55)`, `box-shadow: inset 0 1px 0 rgba(var(--sheen),.10), inset 0 -1px 0 rgba(0,0,0,.4)`, `text-shadow: 0 1px 0 rgba(0,0,0,.7), 0 -1px 0 rgba(var(--sheen),.10)`. Then the method disclaimer at 12.5px/1.5 `--card-ink2`, then the model in mono 11px above a 1px `--rule` top border with 10px padding.
2. *Verdict block*: `flex:1` wrapper, 0 24px padding. Label "Verdict" in mono 10px tracking .3em; the verdict in display 700 up to 72px. Bottom border 1px `--rule`, padding `24px 0 22px`.
3. *Stepper row*: `display:flex; justify-content:space-between`, 16px 0 10px. Left: mono 10px "Reasons" (`white-space:nowrap`). Right: `‹` and `›` buttons (mono 11px, 1px `--rule`, transparent, 5px 9px) and a "Read all" / "Step" toggle (mono 10px, uppercase).
4. *Reason block*: mono 10px "Reason n of m", then the reason at 16.5px/1.58. If the reason cites points: mono 10px "Relies on", then one `<details>` per citation, each with a 1px `--rule` top border; summary is a flex row of the advocate's name in display 600 `--card-ink` (`white-space:nowrap`) plus the claim at 13.5px `--card-ink2`; open state reveals the support prose in a blockquote with a 1px `--edge2` left border. **Citations render as "Grey Worm: <claim>", never as a raw id.**
5. *Footer* (`margin-top:auto`, 18px 24px 22px, 1px `--rule` top): mono 10px "Strongest consideration against this verdict", the text at 14.5px/1.55 `--card-ink2`, then mono 10.5px `n reasons · n citations`.

**The rail** between bench and floor: `margin:58px 0 0; height:8px; border-top:1px solid var(--accent-soft); border-bottom:1px solid var(--edge); background: linear-gradient(180deg, rgba(201,162,39,.22), rgba(201,162,39,.06) 40%, rgba(0,0,0,.45)); box-shadow: 0 1px 0 rgba(240,222,180,.05);` — a brass strip laid into stone.

**The Floor.** Section head as above ("The seat fixes a procedural role, not a conclusion. Each advocate states the position it actually reached."). Grid `repeat(4,minmax(0,1fr))`, gap 18px, `align-items:stretch`.

**Advocate card** — `background: var(--wood), linear-gradient(180deg, var(--card) 0%, rgba(0,0,0,.22) 100%)` over `--card`, 1px `--edge`, `2px solid` seat colour on top, radius `--r`, `box-shadow: inset 0 1px 0 rgba(255,236,190,.05), 0 24px 44px -30px rgba(0,0,0,1)`, `display:flex; flex-direction:column`.

- Header (20px 20px 14px, 1px `--rule` bottom): name in display 600 23px; seat label in mono 10px tracking .2em uppercase, coloured by seat; model in mono 10.5px `--card-ink2`.
- Position (18px 20px 8px): mono 10px "Position", then the position in display 700 30px.
- **Against-seat state** (see below).
- Points block (`flex:1`, 14px 20px 20px): mono 10px "n points as argued", then one `<details>` per point — 1px `--rule` top border, claim at 14.5px/1.45 in the summary, support prose in a blockquote with a 1px `--edge2` left border.

**Charge sheet panel.** Not collapsed behind a summary any more — a two-column panel (`1fr 1fr`, 40px gap) with `background: var(--wood), linear-gradient(180deg, var(--card2), var(--card) 34%, rgba(0,0,0,.2))`, 1px `--edge` with `--accent-soft` on top, `--lift`, 32px 34px padding. Left: act alleged (display 21px/1.45), question for judgment (15.5px `--card-ink2`), scope note (14px `--card-ink2`). Right: the agreed record as a five-item list, each row a `34px 1fr` grid with a mono zero-padded number and the item at 14.5px/1.55 on a 1px `--rule` top border; then a `<details>` holding the 258-word background.

**Footer.** 1px `--edge2` top rule, mono 11px, two ends: "A fictional proceeding; the panel judges the record as filed." and "No opinion is combined with another."

**Atmosphere.** One inert overlay above everything: `position:fixed; inset:0; z-index:30; pointer-events:none;` with `background: radial-gradient(58% 42% at 50% -4%, rgba(var(--sheen),.10) 0%, rgba(var(--sheen),.03) 34%, rgba(var(--sheen),0) 62%)` and `box-shadow: inset 0 0 200px 10px rgba(0,0,0,.5), inset 0 -160px 150px -130px rgba(0,0,0,.85)`. Spotlight above the bench, vignette at the edges. It must never intercept pointer events or be replaced by polling.

The page root carries: `background: radial-gradient(110% 62% at 50% -6%, var(--accent-soft) 0%, rgba(0,0,0,0) 52%), var(--stone), radial-gradient(150% 128% at 50% -8%, var(--ground) 0%, var(--ground) 34%, var(--ground2) 100%); background-color: var(--ground2); background-attachment: fixed;`

### C. Case page, mid-run

Same page. Additions and differences:

- **Progress rail** under the header, shown only while `stage` is `floor` or `judges`: a two-column grid inside a 12px 18px `--card` box with 1px `--edge`. Each half is a mono 10px label ("The Floor", "The Bench", 82px wide) plus a 3px `--rule` track holding a `--accent` fill with `transition: width .7s ease`. The fill is *roles returned or failed over roles expected* — it is a progress bar, **not** a count of positions or verdicts.
- **Waiting state** (advocates and judges): mono 10px label — "Yet to take the floor", "Taking the floor", "Awaiting argument", "Deliberating", "Never convened" — then three shimmer bars (11px tall, radius 2px, `linear-gradient(90deg,var(--rule) 25%,var(--edge2) 50%,var(--rule) 75%)` at `background-size:200% 100%`, `animation: shimmer 1.6s linear infinite`) at widths 100%, 88%/84%, 64%/58%, then a dashed `--rule` reserve block (`margin-top:auto`). No model-attributed words anywhere.
- **Reveal**: a returned card animates `fade-up .7s ease both` (`from{opacity:0;transform:translateY(10px)}`). Advocates reveal one at a time in seat order (jon, tyrion, daenerys, greyworm) with a minimum 9s gap — that logic already exists in `case-live.js`.
- Judges show status only while the bench works. No verdict, no reasons, no partial content.

### D. The gavel

Full-screen blackout. `position:fixed; inset:0; z-index:60; display:grid; place-items:center; background:#000; animation: gv-veil 4.4s ease forwards`.

Inside: `<video src="Wooden_gavel_striking_block_1080p.mp4#t=1,5" autoplay muted playsinline>` at `width:100%; height:100%; object-fit:cover; opacity:.92`; over it a vignette (`radial-gradient(58% 52% at 50% 48%, transparent 0%, rgba(5,4,3,.55) 72%, #000 100%)`); and at `bottom:56px`, centred, "The bench has ruled" in display 600 19px, tracking .28em, uppercase, `#e8e2d2`, `animation: gv-word 4.4s ease forwards`.

```css
@keyframes gv-veil { 0%{opacity:0} 8%{opacity:1} 82%{opacity:1} 100%{opacity:0;visibility:hidden} }
@keyframes gv-word { 0%,30%{opacity:0;letter-spacing:.5em} 46%{opacity:1;letter-spacing:.28em} 92%{opacity:1} 100%{opacity:0} }
```

The media fragment `#t=1,5` trims the clip to 1s–5s; no JS timeline. The overlay element exists only in the gavel state, so mounting it *is* the trigger — a polled markup swap re-fires it. The verdicts are revealed behind it while it plays, so all three appear together in the same moment. If no judge returned, reveal without the gavel.

### E. Failure states

Three cases, each shown with the other columns intact and at equal height.

- **One advocate failed**: the card keeps its header (name, seat, model). Body: mono 10px "No output from this seat" above a `1px dashed var(--edge2)` rule; display 600 21px "This seat produced no output."; 13.5px `--card-ink2` "Nothing returned validated as a stance. The seat has no position, and no position is inferred for it."; then a `<details>` "Attempts" holding a mono 11px `<pre>` of the real attempt outcomes on `--card2`.
- **A judge produced no opinion**: same pattern in the column — "No opinion from this seat", display 600 24px "This seat produced no opinion.", a 14.5px explanation that the attempts failed validation and nothing counts as a verdict, and a `<details>` with the attempts. `flex:1` so the column matches its neighbours exactly.
- **Deliberation stopped before the bench**: the floor renders as filed, all three judge columns show the waiting geometry with the label "Never convened", and a notice sits under the header: 14px 18px padding, 1px `--edge2` with `3px solid var(--accent)` on the left, `--card` background — "This deliberation is incomplete: it stopped before the bench was convened. The floor is shown as filed. No judge was called, and no verdict exists for this run."

Failure cards use dashed rules; they never use colour to signal failure, and never a red.

### The against-seat state

An advocate may conclude against its own seat (in run-02, both defense advocates concluded *not justified*). When that happens:

- the seat label gets `text-decoration: line-through`;
- under the position, on a `1px solid var(--card-ink)` top border with 10px padding: **"This seat argued against itself."** at 14px/1.4, weight 600;
- under that, 13px `--card-ink2`: "Seated for the {defense|prosecution}, it reached the opposite conclusion."

It is loud because it breaks the card's rhythm and uses the brightest ink on the card — **not** because it is coloured. Computed as `seat === 'defense' ? position === 'not_justified' : position === 'justified'`.

## Interactions & behaviour

| Interaction | Behaviour |
|---|---|
| Panel choice | Two buttons, one selected; selection is `1px solid var(--accent)` + `0 0 0 1px var(--accent)` |
| Convene | Disables the button, POSTs the filing, redirects to the case page |
| Advocate reveal | One at a time in seat order, minimum 9s gap; `fade-up .7s` |
| Bench | Status only until all judges are terminal |
| Gavel | Fires once, on transition to a terminal job with at least one returned opinion. Amended 2026-09-05: the transition is acted on only while the tab is visible; seen while hidden, the reveal and the gavel wait for the viewer to return, because a hidden tab defers media loading and the veil would run its floors unseen |
| Verdict reveal | All three at once, behind the gavel |
| Reason stepper | Per column, `‹`/`›` wrap around; opens on reason 1 |
| Read all | **Global, not per column** — toggles every column at once, so the three never differ in disclosure state |
| Citation / point | Native `<details>`; summary markers removed (`list-style:none`, `::-webkit-details-marker{display:none}`) |
| Stall | After 240s without a state change, stop polling and post the existing notice |

Motion rule: every animation is a CSS keyframe on an element that exists in exactly one state, so a poll that replaces a card's HTML re-triggers it. Nothing depends on a JS clock. The one exception is the gavel `<video>`, which autoplays on mount — same principle, different medium.

## State

Per role: `waiting` | `speaking` | `returned` | `failed` (`data-state` on the role slot, as today). Per job: `stage` (`floor` | `judges` | `stopped` | `done`), `status`, `calls`, `spend`, `models`, `terminal_reason`. Client-side only: per-judge reason index, the global read-all flag, elapsed seconds.

`Read all` should default to off. The reason index resets to 0 when a column's markup is replaced.

## Assets

- `Wooden_gavel_striking_block_1080p_202609011127.mp4` — user-supplied gavel clip, used trimmed to 1s–5s via a media fragment. Ships with this bundle. If it is replaced, keep the strike inside the trimmed window and re-check the `gv-veil` duration.
- Fonts from Google Fonts only: Bodoni Moda, Spectral, JetBrains Mono.
- No icons, no images, no SVG illustration anywhere in the design.

## Files

- `The Tribunal.dc.html` — the accepted design. Interactive: screen switcher (Antechamber / Mid-run / Gavel / Concluded / Failures / Tokens), direction switcher (A · Walnut is the accepted one; B · Oxblood is reference only), a real-cadence run, a ~20s replay, a per-role state switcher, and the three failure presets. The **Tokens** screen carries the full token sheet plus a "Decisions" section explaining each design call.
- `Current — Case Page.dc.html`, `Current — Index.dc.html` — faithful recreations of the build as it exists today, for before/after comparison.
- `Wooden_gavel_striking_block_1080p_202609011127.mp4` — the gavel clip. The design file references it at `uploads/<name>.mp4`; in this bundle it sits at the root, so adjust the path or drop it in an `uploads/` folder to view the prototype's gavel locally.

The `.dc.html` files are design-tool documents and expect a `support.js` runtime alongside them; read them as references rather than running them. The token values, geometry and copy in this README are self-sufficient.

All argument text in these files is real output from `runs/run-02` (one model across all seven roles). Treat it as sample data, not copy.
