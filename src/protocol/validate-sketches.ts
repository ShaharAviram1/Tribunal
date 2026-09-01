// docs/representative-sketch.schema.md. All failures reported; nothing repaired.
import { words } from './types.ts';

export type Sketch = { name: string; seat: 'defense' | 'prosecution'; sketch: string };
export type SketchResult = { ok: true; sketches: Sketch[] } | { ok: false; failures: { code: string; detail: string }[] };

const JURISTS = ['barak', 'elon', 'shamgar', 'aharon', 'menachem', 'meir'];

export function validateSketches(input: unknown): SketchResult {
  const failures: { code: string; detail: string }[] = [];
  const fail = (code: string, detail: string) => failures.push({ code, detail });

  if (!Array.isArray(input)) return { ok: false, failures: [{ code: 'SK-01', detail: 'sketches must be an array of exactly 4 objects' }] };
  if (input.length !== 4) fail('SK-01', `sketches has ${input.length} items, exactly 4 required`);
  input.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) { fail('SK-01', `sketches[${i}] is not an object`); return; }
    const o = raw as Record<string, unknown>;
    for (const k of Object.keys(o)) if (!['name', 'seat', 'sketch'].includes(k)) fail('SK-01', `sketches[${i}] has unexpected field "${k}"`);
    if (typeof o.name !== 'string') fail('SK-01', `sketches[${i}].name must be a string`);
    if (typeof o.sketch !== 'string') fail('SK-01', `sketches[${i}].sketch must be a string`);
    if (o.seat !== 'defense' && o.seat !== 'prosecution') fail('SK-02', `sketches[${i}].seat must be exactly "defense" or "prosecution"`);
    if (typeof o.name === 'string') {
      const n = o.name.trim();
      if (n.length < 1 || o.name.length > 60) fail('SK-03', `sketches[${i}].name must be 1-60 characters and non-empty`);
    }
    if (typeof o.sketch === 'string') {
      const w = words(o.sketch);
      if (w < 40 || w > 300) fail('SK-04', `sketches[${i}].sketch is ${w} words, must be 40-300`);
    }
    for (const field of ['name', 'sketch'] as const) {
      if (typeof o[field] === 'string') {
        for (const j of JURISTS) if (new RegExp(`\\b${j}\\b`, 'i').test(o[field] as string)) fail('SK-05', `sketches[${i}].${field} names a real jurist ("${j}")`);
      }
    }
  });
  if (input.length === 4 && input.every((x) => typeof x === 'object' && x !== null)) {
    const seats = (input as Record<string, unknown>[]).map((o) => o.seat);
    const d = seats.filter((s) => s === 'defense').length, p = seats.filter((s) => s === 'prosecution').length;
    if ((d !== 2 || p !== 2) && !failures.some((f) => f.code === 'SK-02')) fail('SK-02', `exactly two sketches per seat required, got ${d} defense and ${p} prosecution`);
    if (d === 2 && p === 2 && seats.every((s) => s === 'defense' || s === 'prosecution')) { /* balanced */ }
    const names = (input as Record<string, unknown>[]).map((o) => String(o.name ?? '').trim().toLowerCase());
    if (new Set(names).size !== names.length) fail('SK-03', 'the four names must be distinct');
  }
  if (failures.length) return { ok: false, failures };
  return { ok: true, sketches: (input as Sketch[]).map((s) => ({ name: s.name, seat: s.seat, sketch: s.sketch })) };
}
