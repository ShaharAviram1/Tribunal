// docs/advocate-stance.schema.md sections 1 and 3.
import type { EmittedStance, EmittedPoint } from './types.ts';
import { VERDICTS, words } from './types.ts';
import { parseObject, isNonEmptyString } from './parse-object.ts';

export type StanceResult = { ok: true; stance: EmittedStance } | { ok: false; kind: 'malformed'; detail: string };

export function validateStance(raw: string): StanceResult {
  const p = parseObject(raw);
  if (!p.ok) return { ok: false, kind: 'malformed', detail: p.detail };
  const o = p.obj; const problems: string[] = [];
  for (const k of Object.keys(o)) if (k !== 'position' && k !== 'points') problems.push(`unexpected field "${k}"`);
  if (!('position' in o)) problems.push('missing field "position"');
  else if (!(VERDICTS as readonly unknown[]).includes(o.position)) problems.push(`"position" must be exactly "justified" or "not_justified"`);
  if (!('points' in o)) problems.push('missing field "points"');
  else if (!Array.isArray(o.points)) problems.push('"points" must be an array');
  else {
    if (o.points.length < 3 || o.points.length > 5) problems.push(`"points" must have 3 to 5 items, has ${o.points.length}`);
    o.points.forEach((pt, i) => {
      if (typeof pt !== 'object' || pt === null || Array.isArray(pt)) { problems.push(`points[${i}] is not an object`); return; }
      const q = pt as Record<string, unknown>;
      for (const k of Object.keys(q)) if (k !== 'claim' && k !== 'support') problems.push(`points[${i}] has unexpected field "${k}"`);
      if (!isNonEmptyString(q.claim)) problems.push(`points[${i}].claim must be a non-empty string`);
      else if (words(q.claim) > 40) problems.push(`points[${i}].claim is ${words(q.claim)} words, at most 40`);
      if (!isNonEmptyString(q.support)) problems.push(`points[${i}].support must be a non-empty string`);
      else if (words(q.support) > 200) problems.push(`points[${i}].support is ${words(q.support)} words, at most 200`);
    });
  }
  if (problems.length) return { ok: false, kind: 'malformed', detail: problems.join('; ') };
  return { ok: true, stance: { position: o.position as EmittedStance['position'], points: (o.points as EmittedPoint[]).map((x) => ({ claim: x.claim, support: x.support })) } };
}
