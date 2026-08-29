# Turn zero: scaffold and gates

Branch `turn-0`. Bound: no code that calls a model.

## Intent

Put the gates in place before there is code for them to guard, and watch each one refuse, so that the first application commit is already held to the standards in CLAUDE.md rather than retrofitted to them.

## Plan as it stood before the work

1. Skeleton, `.env.example` with every key named and no values, `.gitignore`.
2. Lift the valid and invalid instances from the two schemas and the charge sheet specification into fixture files; invent nothing.
3. Charge sheet renderer and prompt assembler, deterministic, reading prompt files from disk; the only code.
4. Offline suite: fixtures parse and have the documented shape; first block byte-identical across seven prompts; prompts are files; hash is of the assembled text; no key, no network.
5. Pre-commit hook with four gates, wired through `core.hooksPath`; then a commit with a fabricated key, refused, output shown.
6. `docs/05-verification/gates.md`.

Decisions taken during the plan: TypeScript on Node, pinned; no dev dependency, since the pinned Node runs TypeScript under `node:test` natively; no frontend framework. All three recorded in spec.md part three.

## What the work taught

- The pin did not bind. `engines` in package.json is advisory and the hook's `npm test` resolves whatever `node` is on PATH; a bare PATH on this machine finds 20.14.0 at `/usr/local/bin`. Fixed two ways: `.npmrc` with `engine-strict=true` for installs, and the test guard refuses to run on any version other than `.nvmrc`. A pin that local tooling ignores is worse than none because it reads as settled.
- A test that edits a tracked prompt file and restores it leaves an edited prompt in the working tree if it crashes in between. The assembler takes a prompts-directory argument and the test edits a temp copy.
- `_contract.md` made a claim about prompt content that was false the moment a judge had to cite a point id. See `docs/lessons-learned.md` entry 1.
- The G3 vocabulary gate has to be scoped to source directories. The specification, CLAUDE.md and this record all name the forbidden words, because they state the rule.
- The assembled-text hash works before anything depends on it: it changes on a corrective retry while the prefix stays identical, which is what the log row will record in turn one.

## Locked

- Runtime: Node 24.11.1, TypeScript stripped natively, no build step, no dependencies, no framework.
- Prompt assembly order and the charge sheet block layout, as `prompts/_contract.md` states them, now asserted by the suite.
- The fixture set is the documents' own instances; new fixtures in later turns come from recorded live responses.
- Four pre-commit gates, each watched refusing on 2026-08-30 (`docs/05-verification/gates.md`).

## Open into turn one

- Whether Netlify's function runtime accepts the pinned Node 24; the first deploy answers it.
- Per-call cost at the chosen single model, which sets whether the 1.00 USD backstop is far or near.

Amended after review: the version guard matches major.minor and lets the patch float; exact-patch matching was a rule wider than the failure it prevents. Netlify's default runtime is Node 24, so the pin needs no deploy check.
