// The background function: claims the job, refreshes its heartbeat while working, runs the
// protocol, writes through the store. Guarded by a shared secret header: the access code
// protects filing; this path is otherwise reachable by anyone who guesses it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModelClient, type Caps } from '../../src/client/model-client.ts';
import { openRouterTransport } from '../../src/client/openrouter-transport.ts';
import { makeStore } from '../../src/store/index.ts';
import { makeCatalogue } from '../../src/store/catalogue.ts';
import { runDeliberation } from '../../src/protocol/run.ts';
import { draftCase } from '../../src/protocol/intake.ts';
import { checkEnv, RUN_ENV } from '../../src/functions-env.ts';

export default async (req: Request): Promise<Response> => {
  const env = checkEnv(RUN_ENV);
  if (!env.ok) return env.response;
  if (req.headers.get('x-tribunal-function-secret') !== requireEnv('TRIBUNAL_FUNCTION_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const { deliberation_id, intake } = (await req.json()) as { deliberation_id: string; intake?: { scenario: string } };
  const store = makeStore(deliberation_id);
  const job = (await store.getJob()) as { case_id: string; models: Record<string, string> } | undefined;
  if (!job) return new Response('unknown deliberation', { status: 404 });
  let sheet = await makeCatalogue().getSheet(job.case_id);
  if (!sheet) return new Response('unknown case', { status: 404 });

  const caps: Caps = JSON.parse(readFileSync(join(process.cwd(), 'config/caps.json'), 'utf8'));
  if (intake) {
    // The clerk drafts inside the ceiling that can hold a model call. On failure the docket and
    // the job both say so; on success the stamped sheet replaces the reservation and the
    // deliberation proceeds on it. Scenario submission was retired on 2026-09-05 and nothing
    // reaches this branch; it writes its draft through Supabase directly (src/protocol/intake.ts)
    // and was not carried to the file store with the rest of the move on 2026-09-18.
    if (process.env.TRIBUNAL_STORE !== 'supabase') return new Response(JSON.stringify({ status: 'failed', failures: ['the intake clerk was retired on 2026-09-05 and runs only against the Supabase store'] }), { status: 200 });
    const drafted = await draftCase({ scenario: intake.scenario, caseId: job.case_id, deliberation_id, store, caps, url: requireEnv('SUPABASE_URL'), serviceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'), apiKey: requireEnv('OPENROUTER_API_KEY') });
    if (!drafted.ok) return new Response(JSON.stringify({ status: 'failed', failures: drafted.failures }), { status: 200 });
    sheet = drafted.sheet; // the stamped sheet, not the stale reservation
  }
  const modelsCfg = JSON.parse(readFileSync(join(process.cwd(), 'config/models.json'), 'utf8')) as { free_fallbacks?: string[]; role_fallbacks?: Record<string, string[]> };
  const client = new ModelClient({ caps, models: job.models, deliberation_id, budget: store, transport: openRouterTransport(requireEnv('OPENROUTER_API_KEY')), freeFallbacks: modelsCfg.free_fallbacks ?? [], roleFallbacks: modelsCfg.role_fallbacks ?? {} });
  (client.log as unknown[]).push(...(await store.readLog()));
  // The file store's heartbeat is synchronous and the Supabase store's is a request; Promise.resolve
  // takes either, so a heartbeat that throws cannot take the deliberation down with it.
  const beat = setInterval(() => { void Promise.resolve(store.heartbeat()).catch(() => {}); }, 30_000);
  try {
    const result = await runDeliberation({ client, store, chargeSheet: sheet as never, deliberation_id, models: job.models });
    return new Response(JSON.stringify({ status: result.status }), { status: 200 });
  } finally {
    clearInterval(beat);
  }
};

const requireEnv = (k: string): string => { const v = process.env[k]; if (!v) throw new Error(`${k} not set`); return v; };
