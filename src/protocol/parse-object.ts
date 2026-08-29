// Shared by both validators: raw model text -> object or a malformed detail. Never classifies prose.
export function parseObject(raw: string): { ok: true; obj: Record<string, unknown> } | { ok: false; detail: string } {
  const t = raw.trim();
  if (t.startsWith('```')) return { ok: false, detail: 'response is wrapped in a code fence; return one JSON object and nothing else' };
  let parsed: unknown;
  try { parsed = JSON.parse(t); } catch { return { ok: false, detail: 'response is not a parseable JSON object; return one JSON object and nothing else' }; }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, detail: 'response is not a JSON object' };
  return { ok: true, obj: parsed as Record<string, unknown> };
}
export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
