# Lessons learned

Every correction from the user, written as a rule to follow rather than a record of what went wrong. Permanent rules are carried into CLAUDE.md.

## 1. A claim about what a model receives is a test, not a sentence

`prompts/_contract.md` said "the model never sees a role id." The first assembly test showed judges must see advocate role ids to cite point ids. Any statement in a document about what text reaches a model is a testable claim: assert it in the suite and let the document point at the test. Prose that describes prompt content will be wrong the first time the assembly changes and nothing will say so. (2026-08-30, turn zero)

## 2. When the code cannot do what a document claims, narrow the document

Fourth instance of the same shape: a document claimed a distinction (a refusal in prose versus prose that is merely not JSON) that no rule in the code could draw. The fix is never a heuristic that makes the claim true at the cost of a new false positive. Narrow the document to what the code can check, and say plainly what is not checked. (2026-08-30, turn one)

## 3. A platform access-control change does not reach deploys that already exist

Access control is applied when a deploy is created. A deploy built while the project was private keeps answering the platform's 401 after the project is made public, so a cookie-free probe against the old deploy disproves nothing. Rebuild first, then probe, then conclude. (2026-08-30, turn two)
