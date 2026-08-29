// Renders the stored charge sheet into the block that opens every prompt.
// Layout is fixed by prompts/_contract.md. Deterministic; no model call.

export type StoredChargeSheet = {
  case_id: string;
  accused: string;
  deceased: string;
  act_alleged: string;
  base_premises: string;
  agreed_record: string[];
  question: string;
  verdict_values: string[];
  scope_note: string;
};

export function renderChargeSheetBlock(cs: StoredChargeSheet): string {
  const record = cs.agreed_record.map((item, i) => `${i + 1}. ${item}`).join('\n');
  return [
    `CASE ${cs.case_id}`,
    `Accused: ${cs.accused}`,
    `Deceased: ${cs.deceased}`,
    `Act alleged: ${cs.act_alleged}`,
    '',
    'Background for readers new to the story',
    cs.base_premises,
    '',
    'Agreed factual record',
    record,
    '',
    'Question for judgment',
    cs.question,
    '',
    `Verdict values: ${cs.verdict_values.join(', ')}`,
    cs.scope_note,
    '',
  ].join('\n');
}
