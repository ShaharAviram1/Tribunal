# Judicial opinion schema

The object a judge call returns, and the object the system stores. Written so that tests can be derived from this document, spec.md, problem.md, and the charge sheet specification alone.

Word counts are whitespace-separated tokens.

## 1. What the model emits

The model returns one JSON object with exactly these fields.

| Field | Type | Invalid when |
|---|---|---|
| `verdict` | string | not exactly `justified` or `not_justified` |
| `reasons` | array of objects | fewer than 2 items |
| `reasons[].text` | string | empty after trimming, or more than 90 words |
| `reasons[].relies_on` | array of strings | empty, or any id does not resolve to a point in the same deliberation |
| `against` | object | missing |
| `against.text` | string | empty after trimming, or more than 90 words |
| `against.relies_on` | array of strings | any id present does not resolve; an empty array is valid |

No other fields. An object with any other field is invalid.

`reasons` is the course's requirement of a verdict plus at least two reasons, each citing at least one point. A reason must rest on what was argued, so `relies_on` requires at least one resolving id.

`against` is the strongest consideration against the conclusion, one of the four fields of the opinion column decided in the interview record (INTERVIEW-QUESTIONS.md, Q6). Its `relies_on` may be empty: the strongest consideration against a conclusion may be something no advocate raised, and requiring an id there would make the model cite the nearest point rather than the real one. Any id that is present must still resolve.

An id resolves when it is exactly `<role_id>.p<n>` for one of the four advocate stances stored in the same deliberation and `n` is within that stance's point count. Matching is exact; no case folding, no whitespace trimming.

## 2. What the system assigns

| Field | Type | Value |
|---|---|---|
| `role_id` | string | one of `judge-1`, `judge-2`, `judge-3` |
| `label` | string | the judge's display name from configuration (revised 2026-09-01: the full jurist name, shown with a standing method line, 'method adapted from published opinions; not the jurist, and not a prediction of how he would decide') |
| `deliberation_id` | string | the deliberation this opinion belongs to |

The profile is carried in `label` and never in an id. The dossier adapts judicial methods and does not impersonate; an id is where that distinction is quietly lost, so no real jurist's name appears in `role_id`, in any point id, or in any key.

## 3. What the object must not contain

Nothing that summarises, ranks, or reconciles the three opinions, and nothing that refers to another judge. Any field that would only make sense to a reader comparing the three opinions does not belong in a single opinion. This is enforced as a schema constraint by the "no other fields" rule; it is not enforced on the prose inside `text`, and this document does not claim otherwise.

## 4. Rejection conditions and the retry each triggers

Retry rules are those of spec.md, part two, criterion 6.

| Condition | Retry rule |
|---|---|
| Provider signals a refusal (finish or stop reason) | refusal: zero retries, recorded as failed |
| Provider reports the response cut off at the output ceiling (`finish_reason: length`) | truncated: one retry of the same prompt at a raised ceiling, no corrective text; a second truncation fails the role |
| Response is not a parseable JSON object after unwrapping at most one outer code fence (revision 2026-09-01: a fence is an envelope, not a value, and is stripped with a log note) | malformed: corrective retry restating the format and naming what failed |
| A required field is missing, or an extra field is present | malformed |
| `verdict` outside the two values | malformed |
| `reasons` has fewer than 2 items | malformed |
| A `reasons[].relies_on` is empty | malformed |
| A `text` over 90 words | malformed |
| Any `text` empty | malformed |
| Any id in `relies_on` does not resolve | unresolvable id: one corrective retry including the list of valid ids |

Every condition maps to a rule. Where an object fails on both a malformed condition and an unresolvable id, the malformed rule applies and the corrective prompt names both. The validator never classifies prose; see the advocate schema, section 3, which applies here unchanged.

A judge is only called when all four advocate stances succeeded (spec.md, part two, criterion 14). A judge that fails after its retries, or on refusal, leaves its column rendered as a failure from the failure record stored under its role id (criterion 17); the other two opinions stand, since each is independent, and the job ends `incomplete` (criterion 16).

## 5. Valid instance

As emitted:

```json
{
  "verdict": "not_justified",
  "reasons": [
    { "text": "The record establishes that no lesser means was attempted. Detention, council, and public demand were each available and each untried; a defence of others that skips every alternative fails at the necessity step.", "relies_on": ["greyworm.p2", "daenerys.p1"] },
    { "text": "The threatened harm, however grave, lay in announced intention rather than imminent act. Necessity requires that the danger be present, and the record places it in the future.", "relies_on": ["greyworm.p3"] }
  ],
  "against": {
    "text": "The scale of what had already been done at King's Landing, and the announced continuation, gives the strongest ground for treating the danger as present rather than prospective.",
    "relies_on": ["jon.p1"]
  }
}
```

As stored:

```json
{
  "role_id": "judge-3",
  "label": "Meir Shamgar",
  "deliberation_id": "d-0001",
  "verdict": "not_justified",
  "reasons": [ "..." ],
  "against": { "..." : "..." }
}
```

## 6. Invalid instances

One per rejection condition. Only the failing part is shown.

**Not a JSON object**
```
Having reconstructed the chronology, the court finds as follows...
```
Malformed retry.

**Extra field**
```json
{ "verdict": "not_justified", "concurs_with": "judge-1", "reasons": [ ... ], "against": { ... } }
```
Malformed retry: `concurs_with` is not a field. It is also the kind of field section 3 forbids.

**Verdict outside the set**
```json
{ "verdict": "not justified", "reasons": [ ... ], "against": { ... } }
```
Malformed retry: space instead of underscore. Nothing is normalised.

**Too few reasons**
```json
{ "verdict": "justified", "reasons": [ { "text": "...", "relies_on": ["jon.p1"] } ], "against": { ... } }
```
Malformed retry: 1 reason, minimum 2.

**Reason with empty relies_on**
```json
{ "text": "The court's own view of necessity is decisive.", "relies_on": [] }
```
Malformed retry.

**Empty text**
```json
{ "text": "   ", "relies_on": ["tyrion.p2"] }
```
Malformed retry.

**Unresolvable id**
```json
{ "text": "...", "relies_on": ["tyrion.p6"] }
```
Unresolvable-id retry, if Tyrion's stance has five points or fewer. `Tyrion.p2` and `tyrion.P2` are likewise unresolvable.

**Refusal in prose, no provider signal**
```
I'm not able to write an opinion in the voice of a real judge.
```
Malformed retry: not a JSON object. A second non-object response fails the role with both texts stored.
