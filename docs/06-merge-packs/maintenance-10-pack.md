# Merge pack: maintenance ten, the gavel waits for a focused window

Branch `maintenance-10` into `main`. Evidence under each heading, not assertion.

## 1. What the branch carries

| Change | Why | Evidence |
|---|---|---|
| The terminal reveal waits until the page is visible **and** its window focused, and shows "The bench is ready. Return to this page to hear it." while it waits | Maintenance nine held only on the Page Visibility API. On the deployed host it held correctly in a hidden automation tab (run `d-T-001-1788579712299`, terminal at 03:42:09, still held forty-six seconds on) while the author, who had left the tab in view and gone to the terminal, came back to verdicts and no gavel: visible to the browser, unattended in fact. Decision, 2026-09-05: hold on lost focus too, and say so | `public/case-live.js`, `attended()` and `untilAttended()`; `docs/07-design/handoff.md` gavel row; `docs/04-turns/turn-05.md` |

## 2. The offline suite

284 tests pass, no key in the environment, no network reached. `case-live.js` has no offline test; browser choreography is verified by watching.

## 3. Watched

The author convened T-001 on the deployed host, left the page for another tab, and returned: the
waiting line, then the gavel, then the three verdicts. Reported working, 2026-09-05, after the merge
at d2b6130.
