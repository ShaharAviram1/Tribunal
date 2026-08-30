# Gates

A gate is a check that refuses work rather than reporting on it. Each entry says what it checks, which pitfall in spec.md part five it catches, when it runs, and what its failure looks like. A gate nobody has watched refuse anything is not a gate; the first refusal of each is recorded at the end.

Pre-commit gates live in `.githooks/pre-commit`, wired by `git config core.hooksPath .githooks` (run once per clone). All four run on every commit; any failure refuses it. `--no-verify` is not used in this repository.

## G1: no key in the staged diff

**Checks.** Every added line in the staged diff against the shapes of an OpenRouter key (`sk-or-…`), a generic `sk-` secret, and a JWT (the form a Supabase service key takes).

**Catches.** "A key committed once is compromised for the life of the repository."

**Runs.** Pre-commit, on the staged diff only, so a key in an ignored `.env` does not trip it and a key pasted into any tracked file does.

**On failure.**
```
GATE G1 REFUSED: staged diff contains something shaped like an API key or JWT.
3:+OPENROUTER_API_KEY=sk-or-v1-a...
Commit refused. Fix the gates above; do not bypass with --no-verify.
```
The offending value is shown truncated after eight characters so the refusal message itself does not leak it into a terminal log.

## G2: .env never staged

**Checks.** No staged path is `.env` or `.env.<anything>` except `.env.example`.

**Catches.** The same pitfall as G1 by a different route: `.gitignore` covers `.env`, but `git add -f` and a renamed copy do not respect it.

**Runs.** Pre-commit, on staged file names.

**On failure.**
```
GATE G2 REFUSED: a .env file is staged.
.env
```

## G3: no combined-verdict vocabulary in source

**Checks.** Added lines under `src/`, `tests/`, `netlify/`, `prompts/`, and `public/` for the patterns in `config/forbidden-vocabulary.json`, case-insensitively. The same file supplies the key fragments `tests/protocol/no-aggregation.test.ts` asserts against, so adding a word updates the gate and its test at once.

**Catches.** The rule at the top and bottom of CLAUDE.md, which is not a pitfall in part five because it is the project's premise. A field, label, or helper named for a combined result is how the tally arrives.

**Runs.** Pre-commit, on the staged diff of those directories only. The documents under `docs/` and the root are exempt: they discuss the rule and must be allowed to name it. The config file is the only place outside `docs/` that names the words, and it is not under a scanned directory. The test that asserts their absence reads them from the config and names none itself. An earlier path exemption for that test file, added when G3 first refused it on 2026-08-30, was replaced by this shared definition: a path exemption is a hole, a shared definition is not.

**On failure.**
```
GATE G3 REFUSED: staged source uses combined-verdict vocabulary.
12:+  const majority = opinions.filter(o => o.verdict === top).length;
```

## G4: offline suite passes with no key

**Checks.** `npm test` exits zero with `OPENROUTER_API_KEY` removed from the environment. The suite's own guard (`tests/_guard.ts`) throws if the key is present and replaces `fetch` with a function that throws, so a test that reaches the network fails inside G4.

**Catches.** Every pitfall the suite has a drill for, and spec.md criterion 5 directly. At turn zero the suite contains the fixture checks and the assembly gates below; each later turn adds its drills here.

**Runs.** Pre-commit, always, even for a documentation-only commit. It takes under a second at turn zero.

**On failure.**
```
GATE G4 REFUSED: offline test suite failed.
✖ first block is byte-identical across all seven prompts (1.2ms)
ℹ fail 1
```

## G5: charge sheet block byte-identical across all seven prompts

**Checks.** `tests/assembly.test.ts` assembles all seven prompts for the fixture charge sheet and asserts the first block of each is byte-for-byte the same buffer, and that every prompt's text begins with it.

**Catches.** "The shared charge sheet block must stay first and byte-identical across all seven prompts, or provider-side prompt caching is lost and every call pays for the full prefix." This failure is silent in every other place; it only shows up as a bill.

**Runs.** Inside G4, on every commit.

**On failure.** As G4, naming the test and the role whose first block differs:
```
✖ first block is byte-identical across all seven prompts
  AssertionError: judge-2 first block differs
```

## G6: prompts are files read from disk

**Checks.** `tests/assembly.test.ts` appends a line to `prompts/greyworm.md`, reassembles all seven, and asserts that exactly one hash changed and it was Grey Worm's; the file is restored afterwards. A second test asserts the hash is of the full assembled text and changes when a corrective block is appended while the earlier blocks stay identical.

**Catches.** The CLAUDE.md standard "prompts are code: versioned files loaded at runtime, never strings in code," and the spec.md criterion 7 requirement that the log row identify a prompt by the hash of what was sent. Exercised here before anything depends on it.

**Runs.** Inside G4, on every commit.

**On failure.**
```
✖ prompts are read from disk: editing a role file changes only that prompt
  AssertionError: jon hash changed=true
```

## Platform gate: Netlify secret scanning

**Checks.** Every deploy's build output for values of dashboard environment variables appearing in the published files or function bundles.

**Catches.** What G1 cannot: G1 scans the staged diff at commit time, so a secret that reaches the output through the build itself, an inlined environment variable, a bundler embedding `process.env` values, never passes G1's eyes. The scanner reads the artifact that actually ships.

**Runs.** On every Netlify deploy, before publish.

**False positive, 2026-08-30, and its resolution.** The scanner flagged `TRIBUNAL_STORE` because its dashboard value was the word `supabase`, which appears throughout the source. The fix was not to disable scanning: `TRIBUNAL_STORE` and `TRIBUNAL_FILING_ENABLED` are configuration, not secrets, and moved into `netlify.toml` as per-context environment blocks, with filing disabled on deploy previews and branch deploys. Only `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TRIBUNAL_FUNCTION_SECRET`, and `TRIBUNAL_ACCESS_CODE` remain in the dashboard. If a specific key still trips falsely, the remedy is `SECRETS_SCAN_OMIT_KEYS` naming that key, never `SECRETS_SCAN_ENABLED`.

## Record of first refusals

| Gate | Date | How it was made to refuse | Result |
|---|---|---|---|
| G1 | 2026-08-30 | staged `leaked.txt` containing a fabricated `sk-or-v1-…` value | refused, exit 1, HEAD unchanged; output matched the sample above with the value truncated |
| G2 | 2026-08-30 | `git add -f .env` with an empty key line | refused, exit 1 |
| G3 | 2026-08-30 | staged `src/bad.ts` exporting `majorityVerdict` | refused, exit 1, line quoted |
| G4–G6 | 2026-08-30 | during development, the leak test failed on `role_id` in judge prompts; the cause was a false sentence in `_contract.md`, corrected | refused, then passed 12/12 |
