// Read-only case endpoint: the page's one door to the data, through the storage interface
// server-side. Public read, like the page; the service-role key stays here.
import { makeStore } from '../../src/store/index.ts';
import { makeCatalogue } from '../../src/store/catalogue.ts';
import { checkEnv } from '../../src/functions-env.ts';

const ROLES = ['jon', 'tyrion', 'daenerys', 'greyworm', 'judge-1', 'judge-2', 'judge-3'];

export default async (req: Request): Promise<Response> => {
  const env = checkEnv(['TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (!env.ok) return env.response;
  const u = new URL(req.url);
  const catalogue = makeCatalogue();
  if (u.searchParams.has('list')) {
    const sheets = await catalogue.listCases();
    const jobs = await catalogue.listJobs();
    return json({ cases: sheets.map((s0) => ({ case_id: s0.case_id, accused: s0.body.accused, deceased: s0.body.deceased, deliberations: jobs.filter((j) => j.case_id === s0.case_id).map((j) => ({ deliberation_id: j.deliberation_id, status: j.status, convened_at: j.created_at, panel: new Set(Object.values(j.models ?? {})).size <= 1 ? 'one model' : `${new Set(Object.values(j.models ?? {})).size} distinct models` })) })) }, 200);
  }
  const deliberation_id = u.searchParams.get('deliberation_id');
  if (!deliberation_id) return json({ error: 'deliberation_id is required' }, 400);
  const store = makeStore(deliberation_id);
  const job = (await store.getJob()) as { case_id?: string } | undefined;
  if (!job) return json({ error: 'unknown deliberation' }, 404);
  const chargeSheet = (await catalogue.getSheet(job.case_id ?? '')) ?? null;
  const outputs: Record<string, unknown> = {};
  for (const r of ROLES) { const o = await store.getOutput(r); if (o !== undefined) outputs[r] = o; }
  const { usageFromLog } = await import('../../src/page/usage.ts');
  const usage = usageFromLog(await store.readLog());
  return json({ chargeSheet, job, outputs, usage }, 200);
};
const json = (b: unknown, status: number) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
