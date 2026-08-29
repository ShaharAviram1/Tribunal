<!-- contract; version: 1 -->
# Prompt contract

What the seven prompt files share. This file is a document about assembly and output; it is not itself sent to a model.

## Authority

`docs/advocate-stance.schema.md` and `docs/judicial-opinion.schema.md` are authoritative for what a model must return. The output contract below is the rendering of those schemas that models receive. If the two ever disagree, the schema wins and this file is corrected.

## Headers

Every prompt file begins with an HTML comment carrying its role id, version, and either its seat or its profile. The comment is stripped at assembly. The model never sees a role id, a version, or a seat label.

## Assembly order

Each call's prompt is assembled from blocks in this fixed order. The order does not vary by role and is not reordered for any reason: the first block is what caches.

1. **Charge sheet block.** Rendered once per deliberation from the stored charge sheet, in the layout below, and placed first in all seven prompts byte for byte. It contains the case id, accused, deceased, act alleged, the background for readers new to the story, the agreed record as a numbered list, the question for judgment, the two verdict values, and the scope note.
2. **Judge preamble, judges only.** The contents of `_judge-preamble.md` after its header: the isolation rule, the non-impersonation guard, and the ban on citing or naming any source. Advocates receive no preamble.
3. **Role body.** The contents of the role's prompt file after the header. For a judge this is method, manner, and risk only.
4. **Stances block, judges only.** The four validated advocate stances, each rendered as its stored object including the assigned point ids, in seat order: defense, defense, prosecution, prosecution. Advocates receive no stances block.
5. **Output contract.** The section below matching the role type.
6. **Corrective block, retries only.** On a corrective retry, a final block naming what failed on the previous attempt, and for an unresolvable id the full list of valid ids. Blocks 1 to 5 are unchanged on retry.

## Identifying an assembled prompt

A prompt is assembled from parts, so no single file's version identifies what a model received. Each call's log row carries a hash of the full assembled text as sent, including the corrective block on a retry. Two rows with the same hash received the same prompt; a change to any part, including the charge sheet block, changes the hash.

## Charge sheet block layout

```
CASE <case_id>
Accused: <accused>
Deceased: <deceased>
Act alleged: <act_alleged>

Background for readers new to the story
<base_premises>

Agreed factual record
1. <agreed_record[0]>
2. <agreed_record[1]>
...

Question for judgment
<question>

Verdict values: justified, not_justified
<scope_note>
```

## Output contract, advocates

Return one JSON object and nothing else: no preamble, no closing remark, no code fence.

```
{
  "position": "justified" | "not_justified",
  "points": [
    { "claim": "<one sentence, at most 40 words>", "support": "<at most 200 words>" },
    ...  three to five points
  ]
}
```

`position` is the answer you reached on the question for judgment. Points are in the order you would present them. Do not number them and do not add fields.

## Output contract, judges

Return one JSON object and nothing else: no preamble, no closing remark, no code fence.

```
{
  "verdict": "justified" | "not_justified",
  "reasons": [
    { "text": "<the reason>", "relies_on": ["<point id>", ...] },
    ...  at least two reasons, each citing at least one point id
  ],
  "against": { "text": "<the strongest consideration against your verdict>", "relies_on": ["<point id>", ...] }
}
```

Point ids are the `id` values in the stances block, exactly as written. Every reason cites at least one. `against.relies_on` may be empty if the strongest consideration against your verdict was not raised by any advocate; any id you do give must be one from the stances block. Do not add fields.

## What no prompt contains

No prompt file mentions this contract, the assembly, the other role files, the retry mechanism, or that the writer is a model. Advocates are not told that judges exist or that other advocates exist. Judges are told only that they rule alone, in the preamble.
