// Read-only case endpoint: the page's one door to the data, through the storage interface
// server-side. Public read, like the page; the service-role key stays here.
import { SupabaseStore } from '../../src/store/supabase-store.ts';
import { checkEnv } from '../../src/functions-env.ts';

const ROLES = ['jon', 'tyrion', 'daenerys', 'greyworm', 'judge-1', 'judge-2', 'judge-3'];

export default async (req: Request): Promise<Response> => {
  const env = checkEnv(['TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (!env.ok) return env.response;
  const u = new URL(req.url);
  if (u.searchParams.has('list')) {
    const url0 = process.env.SUPABASE_URL!.replace(/\/$/, ''); const key0 = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const h = { apikey: key0, Authorization: `Bearer ${key0}` };
    const sheets = (await (await fetch(`${url0}/rest/v1/charge_sheets?select=case_id,body&order=case_id`, { headers: h })).json()) as { case_id: string; body: { accused: string; deceased: string } }[];
    const jobs = (await (await fetch(`${url0}/rest/v1/jobs?select=deliberation_id,case_id,status,created_at,models&order=created_at`, { headers: h })).json()) as { deliberation_id: string; case_id: string; status: string; created_at: string; models: Record<string, string> }[];
    return json({ cases: sheets.map((s0) => ({ case_id: s0.case_id, accused: s0.body.accused, deceased: s0.body.deceased, deliberations: jobs.filter((j) => j.case_id === s0.case_id).map((j) => ({ deliberation_id: j.deliberation_id, status: j.status, convened_at: j.created_at, panel: new Set(Object.values(j.models ?? {})).size <= 1 ? 'one model' : `${new Set(Object.values(j.models ?? {})).size} distinct models` })) })) }, 200);
  }
  const deliberation_id = u.searchParams.get('deliberation_id');
  if (!deliberation_id) return json({ error: 'deliberation_id is required' }, 400);
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const store = new SupabaseStore({ url, serviceKey: key, deliberation_id });
  const job = (await store.getJob()) as { case_id?: string } | undefined;
  if (!job) return json({ error: 'unknown deliberation' }, 404);
  const sheetRes = await fetch(`${url.replace(/\/$/, '')}/rest/v1/charge_sheets?case_id=eq.${job.case_id}&select=body`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const chargeSheet = ((await sheetRes.json()) as { body: unknown }[])[0]?.body ?? null;
  const outputs: Record<string, unknown> = {};
  for (const r of ROLES) { const o = await store.getOutput(r); if (o !== undefined) outputs[r] = o; }
  return json({ chargeSheet, job, outputs }, 200);
};
const json = (b: unknown, status: number) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
