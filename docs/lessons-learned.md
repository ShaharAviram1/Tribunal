# Lessons learned

Every correction from the user, written as a rule to follow rather than a record of what went wrong. Permanent rules are carried into CLAUDE.md.

## 1. A claim about what a model receives is a test, not a sentence

`prompts/_contract.md` said "the model never sees a role id." The first assembly test showed judges must see advocate role ids to cite point ids. Any statement in a document about what text reaches a model is a testable claim: assert it in the suite and let the document point at the test. Prose that describes prompt content will be wrong the first time the assembly changes and nothing will say so. (2026-08-30, turn zero)

## 2. When the code cannot do what a document claims, narrow the document

Fourth instance of the same shape: a document claimed a distinction (a refusal in prose versus prose that is merely not JSON) that no rule in the code could draw. The fix is never a heuristic that makes the claim true at the cost of a new false positive. Narrow the document to what the code can check, and say plainly what is not checked. (2026-08-30, turn one)

## 3. A platform access-control change does not reach deploys that already exist

Access control is applied when a deploy is created. A deploy built while the project was private keeps answering the platform's 401 after the project is made public, so a cookie-free probe against the old deploy disproves nothing. Rebuild first, then probe, then conclude. (2026-08-30, turn two)

## 4. Check where the runtime actually reads from before treating a config file as the boundary

Platform configuration declared in a repository file may reach only the build. Netlify's toml context environment fed the build and not the function runtime, so a value that looked committed and versioned was absent where it mattered. Find out where each consumer reads from; keep one source of truth per value, and let the repo carry only what the repo's consumer reads. (2026-08-31, turn two)

## 5. Do not mark a non-secret value secret

A value marked secret cannot be read back, so masking a public value costs verification and buys nothing. SUPABASE_URL is a public API endpoint; masked, it hid for an hour that it was the dashboard URL rather than the API host, and no one could notice by looking. Mark secret what is secret; leave readable what is public, so a wrong value is visible. (2026-08-31, turn two)

## 6. Re-cut the bound at the moment work crosses it, not at merge time

A turn's bound is a recorded promise, and work that crosses it must force the record open before the crossing commit lands: amend the bound in the turns table, in the same commit or the one before, with the reason the line moved. Turn three's bound said no new model behaviour, and three model-behaviour changes were committed against it over two days; each was individually recorded and reasoned, but the bound sat unamended until merge, so the record briefly promised one thing while the branch did another. The check that would have caught it costs one question at commit time: does this change do something the current turn row says this turn does not do? (2026-09-01, turn three)
