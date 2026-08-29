// docs/charge-sheet.spec.md section 3. All failing rules reported; nothing repaired.
import type { FiledChargeSheet } from './types.ts';
import { words } from './types.ts';

export type Failure = { code: string; field: string };
export type ChargeSheetResult = { ok: true; sheet: FiledChargeSheet } | { ok: false; failures: Failure[] };

const FILER_FIELDS = ['accused', 'deceased', 'act_alleged', 'base_premises', 'agreed_record', 'question'] as const;
const STRING_FIELDS = ['accused', 'deceased', 'act_alleged', 'base_premises', 'question'] as const;

export function validateChargeSheet(input: unknown): ChargeSheetResult {
  const failures: Failure[] = [];
  const fail = (code: string, field: string) => { if (!failures.some((f) => f.code === code && f.field === field)) failures.push({ code, field }); };

  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, failures: [{ code: 'CS-06', field: '$' }] };
  const o = input as Record<string, unknown>;

  // CS-05: no field outside 1a.
  for (const k of Object.keys(o)) if (!(FILER_FIELDS as readonly string[]).includes(k)) fail('CS-05', k);

  // CS-01 presence and CS-06 type, per field.
  for (const k of FILER_FIELDS) {
    if (!(k in o)) { fail('CS-01', k); continue; }
    const v = o[k];
    if (k === 'agreed_record') {
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) { fail('CS-06', k); continue; }
      if (v.length === 0) fail('CS-01', k);
    } else {
      if (typeof v !== 'string') { fail('CS-06', k); continue; }
      if (v.trim() === '') fail('CS-01', k);
    }
  }
  const str = (k: (typeof STRING_FIELDS)[number]): string | null => typeof o[k] === 'string' ? (o[k] as string) : null;

  // CS-02 header bounds.
  for (const k of ['accused', 'deceased'] as const) { const v = str(k); if (v !== null && (v.length < 1 || v.length > 80)) fail('CS-02', k); }
  { const v = str('act_alleged'); if (v !== null && words(v) > 100) fail('CS-02', 'act_alleged'); }
  { const v = str('base_premises'); if (v !== null) { const n = words(v); if (n < 200 || n > 300) fail('CS-02', 'base_premises'); } }

  // CS-03 record shape.
  if (Array.isArray(o.agreed_record) && (o.agreed_record as unknown[]).every((x) => typeof x === 'string')) {
    const rec = o.agreed_record as string[];
    if (rec.length < 2 || rec.length > 8 || rec.some((x) => words(x) < 1 || words(x) > 120)) fail('CS-03', 'agreed_record');
  }

  // CS-04 one question.
  { const v = str('question'); if (v !== null && (words(v) < 1 || words(v) > 120 || (v.match(/\?/g) ?? []).length !== 1)) fail('CS-04', 'question'); }

  if (failures.length) return { ok: false, failures };
  return { ok: true, sheet: { accused: o.accused as string, deceased: o.deceased as string, act_alleged: o.act_alleged as string, base_premises: o.base_premises as string, agreed_record: o.agreed_record as string[], question: o.question as string } };
}
