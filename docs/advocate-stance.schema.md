# Advocate stance schema

The object an advocate call returns, and the object the system stores after ingest. Written so that tests can be derived from this document, spec.md, problem.md, and the charge sheet specification alone.

Word counts are whitespace-separated tokens.

## 1. What the model emits

The model returns one JSON object with exactly these fields.

| Field | Type | Invalid when |
|---|---|---|
| `position` | string | not exactly `justified` or `not_justified` |
| `points` | array of objects | fewer than 3 or more than 5 items |
| `points[].claim` | string | empty after trimming, or more than 40 words |
| `points[].support` | string | empty after trimming, or more than 200 words |

No other fields. An object with any other field is invalid.

`position` is the answer the advocate reached on the question for judgment. It is emitted by the model and not derived from the seat, because the dossier's simulation rule fixes the procedural role only. The field uses the verdict's two values so that position and seat are comparable as stored data.

"One sentence" for `claim` is an instruction in the prompt, not a rejection condition. The code enforces the 40-word bound; the failure that bound prevents is prompt size across the three judge calls that read every stance, not sentence structure. The 200-word bound on `support` exists for the same reason: all three judges read all four stances, so this field is where prompt size and cost concentrate.

The model emits no ids. Models are unreliable at maintaining unique identifiers; `points` is an ordered array and ids are assigned at ingest.

## 2. What the system assigns at ingest

| Field | Type | Value |
|---|---|---|
| `role_id` | string | one of `jon`, `tyrion`, `daenerys`, `greyworm` |
| `seat` | string | `defense` or `prosecution`, from configuration; `jon` and `tyrion` are defense, `daenerys` and `greyworm` are prosecution |
| `deliberation_id` | string | the deliberation this stance belongs to |
| `points[].id` | string | `<role_id>.p<index>`, index starting at 1 in array order, so `tyrion.p1` through `tyrion.p5` |

`seat` is stored alongside the emitted `position` so that "concluded against the seat" is a comparison of two stored values, not something the interface derives.

No real jurist's name or character-specific honorific appears in any id; role ids are the four fixed strings above.

## 3. Rejection conditions and the retry each triggers

Retry rules are those of spec.md, part two, criterion 6.

| Condition | Retry rule |
|---|---|
| Provider signals a refusal (finish or stop reason) | refusal: zero retries, recorded as failed |
| Response is not a parseable JSON object, whatever it says | malformed: one corrective retry restating the format and naming what failed |
| A required field is missing, or an extra field is present | malformed |
| `position` outside the two values | malformed |
| `points` count outside 3–5 | malformed |
| A `claim` or `support` empty or over its word bound | malformed |

Every condition maps to a rule. A stance has no ids to resolve, so the unresolvable-id rule does not apply to it.

The validator never classifies prose. A refusal written in words rather than signalled by the provider is, to the validator, a non-object response: it gets the corrective retry, and if the model refuses again the role fails with both raw texts stored on the failure record, where a reader sees the refusal for themselves. This is the detection the code actually has, and the document claims no more.

When a stance fails after its retries are exhausted, or immediately on refusal, the deliberation stops before the judge stage (spec.md, part two, criterion 14). No judge is called on fewer than four stances.

## 3a. Worst-case judge input

The bounds above fix the largest input a judge can receive: four stances at five points of 40 plus 200 words is 4,800 words of stances, plus the charge sheet block, which the charge sheet specification bounds at roughly 1,500 words (base premises 300, agreed record 8 × 120, act 100, question 120, names). Around 6,300 words per judge call, before the judge prompt itself. The per-run spend cap in spec.md criterion 2 is to be checked against this figure at the panel's most expensive model, not guessed.

## 4. Presentation constraint

Positions are shown per advocate and never summed or counted. Counting how many advocates reached each position is the forbidden aggregate arriving through a side door (problem.md, section 4).

## 5. Valid instance

As emitted:

```json
{
  "position": "not_justified",
  "points": [
    { "claim": "The queen was unarmed and embraced him when he struck.", "support": "I stood at the door. She had no blade, no guard, no dragon in the room. He came as a friend and killed her as a friend. That is the whole of it." },
    { "claim": "He tried nothing else first.", "support": "No council. No chains. No demand that she step down before the army. A soldier who thinks his commander wrong says so, or he leaves. He does not put a knife in her." },
    { "claim": "What she said she would do had not been done.", "support": "The city burned; that was done. The rest was words. He killed her for words about cities she had not yet reached." }
  ]
}
```

As stored, after ingest:

```json
{
  "role_id": "greyworm",
  "seat": "prosecution",
  "deliberation_id": "d-0001",
  "position": "not_justified",
  "points": [
    { "id": "greyworm.p1", "claim": "The queen was unarmed and embraced him when he struck.", "support": "..." },
    { "id": "greyworm.p2", "claim": "He tried nothing else first.", "support": "..." },
    { "id": "greyworm.p3", "claim": "What she said she would do had not been done.", "support": "..." }
  ]
}
```

## 6. Invalid instances

One per rejection condition. Only the failing part is shown.

**Not a JSON object**
```
Grey Worm does not speak in lists. The queen was unarmed...
```
Malformed retry.

**Extra field**
```json
{ "position": "not_justified", "confidence": 0.9, "points": [ ... ] }
```
Malformed retry: `confidence` is not a field.

**Position outside the set**
```json
{ "position": "guilty", "points": [ ... ] }
```
Malformed retry.

**Too few points**
```json
{ "position": "not_justified", "points": [ { "claim": "...", "support": "..." }, { "claim": "...", "support": "..." } ] }
```
Malformed retry: 2 points, minimum 3.

**Claim over bound**
```json
{ "claim": "The queen was unarmed and embraced him when he struck, and this alone settles the matter because no law of any kingdom that has ever existed has held that a man may take the life of an unarmed woman who has just opened her arms to him in trust and love, whatever he fears she might one day do." }
```
Malformed retry: 59 words, bound 40.

**Refusal in prose, no provider signal**
```
I can't role-play a character arguing for a killing.
```
Malformed retry: not a JSON object. If the second attempt is the same, the role fails and both texts are stored. Only a provider-signalled refusal is classified as a refusal.
