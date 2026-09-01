// Case intake: reserve the docket, hand the scenario to the background function, answer at
// once. The drafting model call happens in the background alongside the deliberation it feeds,
// because a synchronous function's ceiling cannot hold a model call — the same arithmetic that
// put the deliberation there (spec.md part three; learned again on 2026-09-01 as a live 504).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { checkEnv } from '../../src/functions-env.ts';
import { SupabaseStore } from '../../src/store/supabase-store.ts';
import { words } from '../../src/protocol/types.ts';

const INTAKE_ENV = ['TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY', 'TRIBUNAL_FUNCTION_SECRET'];

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const env = checkEnv(INTAKE_ENV);
  if (!env.ok) return env.response;
  if (process.env.TRIBUNAL_FILING_ENABLED === 'false') return json({ error: 'filing is disabled; reading still works' }, 503);
  const panelRaw = new URL(req.url).searchParams.get('panel') ?? 'single';
  if (panelRaw !== 'single' && panelRaw !== 'multi') return json({ error: `unknown panel "${panelRaw}"; use single or multi` }, 400);
  const panel = panelRaw as 'single' | 'multi';
  let input: unknown;
  try { input = await req.json(); } catch { return json({ error: 'body is not JSON' }, 400); }
  const scenario = (input as { scenario?: unknown })?.scenario;
  if (typeof scenario !== 'string' || scenario.trim() === '') return json({ error: 'scenario must be a non-empty string' }, 400);
  const w = words(scenario);
  if (w > 800) return json({ error: `the scenario is ${w} words; the bound is 800 words so the seven prompts that carry the drafted case stay inside their budget` }, 422);

  const url = requireEnv('SUPABASE_URL'); const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const base = url.replace(/\/$/, '');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  // Same protections as filing: paid-panel daily cap, per-IP cooldown.
  if (panel === 'multi') {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const day = (await (await fetch(`${base}/rest/v1/jobs?select=models&created_at=gt.${dayAgo}`, { headers })).json()) as { models: Record<string, string> }[];
    const paid = day.filter((j) => new Set(Object.values(j.models ?? {})).size > 1).length;
    if (paid >= 10) return json({ error: 'the paid panel is limited to 10 deliberations per 24 hours; try again later, or convene the free panel' }, 429);
  }
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const iphash = createHash('sha256').update(ip).digest('hex').slice(0, 8);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const recent = (await (await fetch(`${base}/rest/v1/jobs?select=deliberation_id&deliberation_id=like.*-${iphash}&created_at=gt.${fiveMinAgo}`, { headers })).json()) as unknown[];
  if (recent.length > 0) return json({ error: 'per-IP limit: 5 minutes between convenings from one IP; try again shortly' }, 429);

  // Reserve the docket row first: jobs.case_id references charge_sheets, and the intake call is
  // logged as the job's first row, so the row order is forced and honest.
  const res = await fetch(`${base}/rest/v1/charge_sheets?select=case_id&order=case_id.desc&limit=1`, { headers });
  const last = ((await res.json()) as { case_id: string }[])[0]?.case_id ?? 'T-000';
  const caseId = `T-${String(Number(last.slice(2)) + 1).padStart(3, '0')}`;
  const modelsConfig = JSON.parse(readFileSync(join(process.cwd(), 'config/models.json'), 'utf8'));
  if (!modelsConfig.intake) return json({ error: 'config/models.json has no "intake" model; refusing to substitute one silently' }, 500);
  const provenance = { kind: 'intake', scenario_words: w, intake_model: modelsConfig.intake as string, drafted_at: new Date().toISOString() };
  await fetch(`${base}/rest/v1/charge_sheets`, { method: 'POST', headers, body: JSON.stringify({ case_id: caseId, body: { drafting: true, accused: '(drafting)', deceased: '(drafting)', provenance } }) });

  const deliberation_id = `d-${caseId}-${Date.now()}-${iphash}`;
  const store = new SupabaseStore({ url, serviceKey: key, deliberation_id });
  await store.putJob({ case_id: caseId, status: 'pending', stage: 'advocates', models: { ...modelsConfig[panel] } });
  const origin = new URL(req.url).origin;
  await fetch(`${origin}/.netlify/functions/tribunal-run-background`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tribunal-function-secret': requireEnv('TRIBUNAL_FUNCTION_SECRET') },
    body: JSON.stringify({ deliberation_id, case_id: caseId, intake: { scenario } }),
  });
  return json({ case_id: caseId, deliberation_id, status: 'pending' }, 202);
};

const json = (b: unknown, status: number) => new Response(JSON.stringify(b, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
const requireEnv = (k: string): string => { const v = process.env[k]; if (!v) throw new Error(`${k} not set`); return v; };
