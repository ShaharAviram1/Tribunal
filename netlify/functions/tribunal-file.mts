// Filing: access code, rule validation (all failures named), stamp, job row, invoke background.
// No model call happens here or anywhere outside the background function.
import { validateChargeSheet } from '../../src/protocol/validate-charge-sheet.ts';
import { stampChargeSheet } from '../../src/protocol/stamp.ts';
import { SupabaseStore } from '../../src/store/supabase-store.ts';
import { checkEnv, FILE_ENV } from '../../src/functions-env.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const env = checkEnv(FILE_ENV);
  if (!env.ok) return env.response;
  if (process.env.TRIBUNAL_FILING_ENABLED === 'false') return json({ error: 'filing is disabled; reading still works' }, 503);
  if (req.headers.get('x-tribunal-access-code') !== requireEnv('TRIBUNAL_ACCESS_CODE')) return json({ error: 'access code missing or wrong' }, 401);
  const panelRaw = new URL(req.url).searchParams.get('panel') ?? 'single';
  if (panelRaw !== 'single' && panelRaw !== 'multi') return json({ error: `unknown panel "${panelRaw}"; use single or multi` }, 400);
  const panel = panelRaw as 'single' | 'multi';
  let input: unknown;
  try { input = await req.json(); } catch { return json({ error: 'body is not JSON' }, 400); }
  const url = requireEnv('SUPABASE_URL'); const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  // Convene mode: { case_id } deliberates an existing charge sheet afresh.
  const asConvene = input as { case_id?: string };
  if (asConvene && typeof asConvene === 'object' && 'case_id' in asConvene) {
    if (Object.keys(asConvene).length !== 1 || !/^T-[0-9]{3}$/.test(asConvene.case_id ?? '')) return json({ error: 'convene body is exactly { case_id: "T-nnn" }' }, 400);
    const res0 = await fetch(`${url.replace(/\/$/, '')}/rest/v1/charge_sheets?case_id=eq.${asConvene.case_id}&select=case_id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (((await res0.json()) as unknown[]).length === 0) return json({ error: `unknown case ${asConvene.case_id}` }, 404);
    return start(url, key, asConvene.case_id!, panel, req);
  }

  const v = validateChargeSheet(input);
  if (!v.ok) return json({ rejected: true, failures: v.failures }, 422);
  // Next unused case id, assigned by the system (charge sheet spec 1b).
  const res = await fetch(`${url}/rest/v1/charge_sheets?select=case_id&order=case_id.desc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const last = ((await res.json()) as { case_id: string }[])[0]?.case_id ?? 'T-000';
  const caseId = `T-${String(Number(last.slice(2)) + 1).padStart(3, '0')}`;
  const sheet = stampChargeSheet(v.sheet, caseId);
  await fetch(`${url}/rest/v1/charge_sheets`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseId, body: sheet }) });

  return start(url, key, caseId, panel, req);
};

async function start(url: string, key: string, caseId: string, panel: 'single' | 'multi', req: Request): Promise<Response> {
  const deliberation_id = `d-${caseId}-${Date.now()}`;
  const store = new SupabaseStore({ url, serviceKey: key, deliberation_id });
  await store.putJob({ case_id: caseId, status: 'pending', stage: 'advocates', models: modelMap(panel) });
  // Invoke the background function; it authenticates the shared secret, not the access code.
  const base = new URL(req.url).origin;
  await fetch(`${base}/.netlify/functions/tribunal-run-background`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tribunal-function-secret': process.env.TRIBUNAL_FUNCTION_SECRET! },
    body: JSON.stringify({ deliberation_id, case_id: caseId }),
  });
  return json({ case_id: caseId, deliberation_id, status: 'pending' }, 202);
}

function modelMap(panel: 'single' | 'multi'): Record<string, string> {
  const panels = JSON.parse(readFileSync(join(process.cwd(), 'config/models.json'), 'utf8'));
  return { ...panels[panel] };
}
const json = (b: unknown, status: number) => new Response(JSON.stringify(b, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
const requireEnv = (k: string): string => { const v = process.env[k]; if (!v) throw new Error(`${k} not set`); return v; };
