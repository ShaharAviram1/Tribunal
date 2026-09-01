# Representative sketch schema

The intake model's output carries two halves: a `charge_sheet` governed entirely by `docs/charge-sheet.spec.md` and validated by the existing `validateChargeSheet`, and a `sketches` array governed by this document. This document covers the sketches only.

A sketch is a character paragraph in the dossier's manner: how the person speaks, what they value, what distorts them under pressure, what changes their mind. Four sketches fill the four fixed seats; the two defense sketches take the jon and tyrion slots in order, the two prosecution sketches the daenerys and greyworm slots. The seat fixes the procedural role, never the conclusion.

Word counts are whitespace-separated tokens.

## Shape

```json
[
  { "name": "<1-60 chars>", "seat": "defense", "sketch": "<40-300 words>" },
  { "name": "...", "seat": "defense", "sketch": "..." },
  { "name": "...", "seat": "prosecution", "sketch": "..." },
  { "name": "...", "seat": "prosecution", "sketch": "..." }
]
```

## Validation rules

Each rule names the concrete failure it prevents. All failing rules are reported together; nothing is repaired.

| Code | Rule | Failure prevented |
|---|---|---|
| SK-01 | `sketches` is an array of exactly 4 objects, each with exactly `name`, `seat`, `sketch`, each of the right type. | Three sketches leave a seat arguing as nobody; five leave one unassigned; an extra field is either rendered to all seven agents as record or silently dropped while its author believes it was read. |
| SK-02 | Exactly two sketches per seat; `seat` is exactly `defense` or `prosecution`. | A 3–1 split gives one table a chorus and the other a lone voice; a misspelled seat assigns a character to no table at all. |
| SK-03 | Each `name` is 1–60 characters, non-empty after trimming, and the four names are distinct, compared case-insensitively (clarified 2026-09-01 after the blind drills flagged the ambiguity: a case-only difference leaves a citation exactly as ambiguous). | A duplicate name makes two stances read as one person disagreeing with themselves, and a citation of either becomes ambiguous on the page. |
| SK-04 | Each `sketch` is 40–300 words. | Under 40 words no character is established and the frame prompt argues as a generic voice; over 300 the sketch starts carrying argument, which belongs to the advocates, and the dossier's own sections stay under 300. |
| SK-05 | No field contains a real jurist's name, matched case-insensitively as a whole word against: Barak, Elon, Shamgar, Aharon, Menachem, Meir. | The dossier adapts methods and does not impersonate; a submitted scenario must not smuggle a jurist onto the floor as a character, where the page would print the name over model-written words. |

## Rejection behaviour

As with the charge sheet: validation runs to completion, every failing rule is listed with its code and a detail sentence that names the offending item and, where one exists, the offending field, nothing is trimmed or filled, and the object is accepted as returned or rejected as returned. A rejection follows the intake retry rule in spec.md criterion 6: one corrective retry naming every failure, then the submission fails honestly.
