# Lessons learned

Every correction from the user, written as a rule to follow rather than a record of what went wrong. Permanent rules are carried into CLAUDE.md.

## 1. A claim about what a model receives is a test, not a sentence

`prompts/_contract.md` said "the model never sees a role id." The first assembly test showed judges must see advocate role ids to cite point ids. Any statement in a document about what text reaches a model is a testable claim: assert it in the suite and let the document point at the test. Prose that describes prompt content will be wrong the first time the assembly changes and nothing will say so. (2026-08-30, turn zero)
