// docs/judicial-opinion.schema.md sections 1 and 4. Exact-match id resolution; malformed wins over unresolvable.
import type { EmittedOpinion, Reason } from './types.ts';
import { VERDICTS } from './types.ts';
import { parseObject, isNonEmptyString } from './parse-object.ts';

export type OpinionResult =
  | { ok: true; opinion: EmittedOpinion }
  | { ok: false; kind: 'malformed' | 'unresolvable_id'; detail: string; unresolved?: string[] };

export function validateOpinion(raw: string, validIds: string[]): OpinionResult {
  const p = parseObject(raw);
  if (!p.ok) return { ok: false, kind: 'malformed', detail: p.detail };
  const o = p.obj; const problems: string[] = []; const unresolved: string[] = [];
  const valid = new Set(validIds);
  const checkIds = (ids: unknown, where: string, min: number) => {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) { problems.push(`${where}.relies_on must be an array of strings`); return; }
    if (ids.length < min) problems.push(`${where}.relies_on must cite at least ${min} point id`);
    for (const id of ids as string[]) if (!valid.has(id) && !unresolved.includes(id)) unresolved.push(id);
  };
  for (const k of Object.keys(o)) if (!['verdict', 'reasons', 'against'].includes(k)) problems.push(`unexpected field "${k}"`);
  if (!('verdict' in o)) problems.push('missing field "verdict"');
  else if (!(VERDICTS as readonly unknown[]).includes(o.verdict)) problems.push('"verdict" must be exactly "justified" or "not_justified"');
  if (!('reasons' in o)) problems.push('missing field "reasons"');
  else if (!Array.isArray(o.reasons)) problems.push('"reasons" must be an array');
  else {
    if (o.reasons.length < 2) problems.push(`"reasons" must have at least 2 items, has ${o.reasons.length}`);
    o.reasons.forEach((r, i) => {
      if (typeof r !== 'object' || r === null || Array.isArray(r)) { problems.push(`reasons[${i}] is not an object`); return; }
      const q = r as Record<string, unknown>;
      for (const k of Object.keys(q)) if (k !== 'text' && k !== 'relies_on') problems.push(`reasons[${i}] has unexpected field "${k}"`);
      if (!isNonEmptyString(q.text)) problems.push(`reasons[${i}].text must be a non-empty string`);
      checkIds(q.relies_on, `reasons[${i}]`, 1);
    });
  }
  if (!('against' in o)) problems.push('missing field "against"');
  else if (typeof o.against !== 'object' || o.against === null || Array.isArray(o.against)) problems.push('"against" must be an object');
  else {
    const q = o.against as Record<string, unknown>;
    for (const k of Object.keys(q)) if (k !== 'text' && k !== 'relies_on') problems.push(`against has unexpected field "${k}"`);
    if (!isNonEmptyString(q.text)) problems.push('against.text must be a non-empty string');
    checkIds(q.relies_on, 'against', 0);
  }
  if (problems.length) {
    const detail = unresolved.length ? `${problems.join('; ')}; unresolvable point ids: ${unresolved.join(', ')}` : problems.join('; ');
    return { ok: false, kind: 'malformed', detail, ...(unresolved.length ? { unresolved } : {}) };
  }
  if (unresolved.length) return { ok: false, kind: 'unresolvable_id', detail: `unresolvable point ids: ${unresolved.join(', ')}`, unresolved };
  const reasons = (o.reasons as Reason[]).map((r) => ({ text: r.text, relies_on: [...r.relies_on] }));
  const ag = o.against as Reason;
  return { ok: true, opinion: { verdict: o.verdict as EmittedOpinion['verdict'], reasons, against: { text: ag.text, relies_on: [...ag.relies_on] } } };
}
