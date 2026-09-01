// Shared by both validators: raw model text -> object or a malformed detail. Never classifies prose.
// A single well-formed outer code fence is stripped before parsing: the no-normalising rule
// protects values, and a fence is an envelope, not a value (spec revision, 2026-09-01, after two
// deliberations aborted on models that fence their JSON and fence the corrective retry too).
// The one definition of what counts as an outer fence, shared by the parser and the client's
// log-row note so the two can never disagree.
export function stripOuterFence(raw: string): { text: string; fence_stripped: boolean } {
  const t = raw.trim();
  const m = t.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  return m ? { text: m[1]!.trim(), fence_stripped: true } : { text: t, fence_stripped: false };
}

export function parseObject(raw: string): { ok: true; obj: Record<string, unknown>; fence_stripped: boolean } | { ok: false; detail: string } {
  const stripped = stripOuterFence(raw);
  const t = stripped.text;
  const fence_stripped = stripped.fence_stripped;
  if (t === '') return { ok: false, detail: 'response was empty; return one JSON object and nothing else' };
  let parsed: unknown;
  try { parsed = JSON.parse(t); } catch { return { ok: false, detail: 'response is not a parseable JSON object; return one JSON object and nothing else' }; }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, detail: 'response is not a JSON object' };
  return { ok: true, obj: parsed as Record<string, unknown>, fence_stripped };
}
export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
