// The background function: claims the job, refreshes its heartbeat while working, runs the
// protocol, writes through the store. Guarded by a shared secret header: the access code
// protects filing; this path is otherwise reachable by anyone who guesses it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModelClient, type Caps } from '../../src/client/model-client.ts';
import { openRouterTransport } from '../../src/client/openrouter-transport.ts';
import { SupabaseStore } from '../../src/store/supabase-store.ts';
import { runDeliberation } from '../../src/protocol/run.ts';
import { checkEnv, RUN_ENV } from '../../src/functions-env.ts';

export default async (req: Request): Promise<Response> => {
  const env = checkEnv(RUN_ENV);
  if (!env.ok) return env.response;
  if (req.headers.get('x-tribunal-function-secret') !== requireEnv('TRIBUNAL_FUNCTION_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const { deliberation_id } = (await req.json()) as { deliberation_id: string };
  const store = new SupabaseStore({ url: requireEnv('SUPABASE_URL'), serviceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'), deliberation_id });
  const job = (await store.getJob()) as { case_id: string; models: Record<string, string> } | undefined;
  if (!job) return new Response('unknown deliberation', { status: 404 });
  const sheetRows = await fetch(`${requireEnv('SUPABASE_URL')}/rest/v1/charge_sheets?case_id=eq.${job.case_id}&select=body`, { headers: { apikey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${requireEnv('SUPABASE_SERVICE_ROLE_KEY')}` } });
  const sheet = ((await sheetRows.json()) as { body: unknown }[])[0]?.body;
  if (!sheet) return new Response('unknown case', { status: 404 });

  const caps: Caps = JSON.parse(readFileSync(join(process.cwd(), 'config/caps.json'), 'utf8'));
  const client = new ModelClient({ caps, models: job.models, deliberation_id, budget: store, transport: openRouterTransport(requireEnv('OPENROUTER_API_KEY')) });
  (client.log as unknown[]).push(...(await store.readLog()));
  const beat = setInterval(() => { void store.heartbeat().catch(() => {}); }, 30_000);
  try {
    const result = await runDeliberation({ client, store, chargeSheet: sheet as never, deliberation_id, models: job.models });
    return new Response(JSON.stringify({ status: result.status }), { status: 200 });
  } finally {
    clearInterval(beat);
  }
};

const requireEnv = (k: string): string => { const v = process.env[k]; if (!v) throw new Error(`${k} not set`); return v; };
