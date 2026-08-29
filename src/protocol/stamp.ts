import type { FiledChargeSheet, StoredChargeSheet } from './types.ts';
import { SCOPE_NOTE, VERDICTS } from './types.ts';

export function stampChargeSheet(sheet: FiledChargeSheet, caseId: string): StoredChargeSheet {
  if (!/^T-[0-9]{3}$/.test(caseId)) throw new Error(`case id must match ^T-[0-9]{3}$: ${caseId}`);
  return { case_id: caseId, verdict_values: [...VERDICTS], scope_note: SCOPE_NOTE, ...sheet };
}
