# Merge pack: maintenance eight, the site moves house

Branch `maintenance-8` (4 commits) into `main`. Evidence under each heading, not assertion.

## 1. What the branch carries

| Change | Why | Evidence |
|---|---|---|
| The return link on a case page sits above the title | Measured live on 2026-09-05: the h1 at line-height .96 in the display face overflows its box upward by 8–12px, so the lower half of "← The Tribunal" hit-tested as the heading, showed a text cursor, and swallowed the click; which half depended on viewport width | `src/page/render-case.ts`, one declaration on `.crumb a.crumb-home`; test "the return link sits above the title…" in `tests/render.test.ts` |
| Scenario submission retired | Decision, 2026-09-05: outside what the tribunal is described to do. Named cause on the record: T-007 (39 words) failed CS-02 on `base_premises` twice, T-006 (184 words) passed at 205 words, and a diagnostic call with 41 words drafted 145. The clerk's "shorter, not fuller" rule and the 200-word floor cannot both hold on a thin scenario | `spec.md` part two step 0, revision dated; `netlify/functions/tribunal-intake.mts` answers 503 naming the retirement; the form removed from `public/index.html`; README and ARCHITECTURE say so; `src/protocol/intake.ts`, `prompts/_intake.md`, `tests/intake/` and the T-006 record untouched |
| A plain Node host, `server/serve.ts`, and `render.yaml` | Netlify refused every deploy: `netlify deploy --prod --no-build` answered 403, `Account credit usage exceeded - new deploys are blocked until credits are added`, on 2026-09-05 after login. The handlers are not changed; the server routes to them as `netlify.toml` does | `tests/server.test.ts`, eight loopback drills: front door, byte range, nothing outside `public/`, the five names and no other, env failure through the adapter, `/case/<id>`, background 202 at once, the retired intake. Served locally against the live store, `/case/d-T-001-1788363924097-b4847b2d` differed from Netlify's page only by Netlify's injected meta tags and the crumb declaration above |

## 2. The offline suite

284 tests pass, no key in the environment, no network reached. The server test uses loopback `node:http`; the guard's `fetch` block stands throughout.

## 3. What is not in this branch

- No change to the charge sheet rules, either output schema, the prompts, the protocol, or the store.
- No re-invocation on Render: a background run killed mid-flight stays `running` until its heartbeat goes stale and the page reports the stall. Recorded in ARCHITECTURE.md, Deploy, as the one difference between the hosts.
- The README's live-site address is trued in a following commit once the Render service has one.
