export type FiledChargeSheet = {
  accused: string; deceased: string; act_alleged: string; base_premises: string; agreed_record: string[]; question: string;
};
export type StoredChargeSheet = FiledChargeSheet & { case_id: string; verdict_values: string[]; scope_note: string };

export type Verdict = 'justified' | 'not_justified';
export type EmittedPoint = { claim: string; support: string };
export type EmittedStance = { position: Verdict; points: EmittedPoint[] };
export type StoredStance = { role_id: string; seat: 'defense' | 'prosecution'; deliberation_id: string; position: Verdict; points: (EmittedPoint & { id: string })[] };

export type Reason = { text: string; relies_on: string[] };
export type EmittedOpinion = { verdict: Verdict; reasons: Reason[]; against: Reason };
export type StoredOpinion = EmittedOpinion & { role_id: string; label: string; deliberation_id: string };

export type FailureRecord = {
  failed: true; role_id: string; deliberation_id: string; reason: string;
  attempts: { hash: string; text: string | null; outcome: string; detail: string | null }[];
};

export const VERDICTS: readonly Verdict[] = ['justified', 'not_justified'];
export const SCOPE_NOTE = 'The Tribunal decides justified or not justified and gives reasons. It does not impose a sentence and does not combine the three opinions into one verdict.';
export const words = (s: string): number => s.trim() === '' ? 0 : s.trim().split(/\s+/).length;
