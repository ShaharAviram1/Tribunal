// One live deliberation of T-001 into runs/<id>/. Run with:
//   node --env-file=.env scripts/run-live.ts <deliberation_id> <model-or-models.json>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModelClient, type Caps } from '../src/client/model-client.ts';
import { openRouterTransport } from '../src/client/openrouter-transport.ts';
import { FileStore } from '../src/store/file-store.ts';
import { runDeliberation } from '../src/protocol/run.ts';
import { ADVOCATES, JUDGES } from '../src/prompt/assemble.ts';

const [id, modelArg] = process.argv.slice(2);
if (!id || !modelArg) throw new Error('usage: run-live.ts <deliberation_id> <model | path/to/models.json>');
const key = process.env.OPENROUTER_API_KEY; if (!key) throw new Error('OPENROUTER_API_KEY not set');
const caps: Caps = JSON.parse(readFileSync(join(process.cwd(), 'config/caps.json'), 'utf8'));
const models: Record<string, string> = modelArg.endsWith('.json')
  ? JSON.parse(readFileSync(modelArg, 'utf8'))
  : Object.fromEntries([...ADVOCATES, ...JUDGES].map((r) => [r, modelArg]));
const chargeSheet = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/charge-sheets/T-001.stored.json'), 'utf8'));
const store = new FileStore(join(process.cwd(), 'runs'), id);
const client = new ModelClient({ caps, models, deliberation_id: id, budget: store, transport: openRouterTransport(key) });
// The client's own rows are the log of record; the protocol reads client.log for budget sync.
const priorRows = store.readLog(); (client.log as unknown[]).push(...priorRows);
const t0 = Date.now();
const job = await runDeliberation({ client, store, chargeSheet, deliberation_id: id, models });
console.log(JSON.stringify({ status: job.status, stage: job.stage, terminal_reason: job.terminal_reason, calls: job.calls, spend_usd: job.spend_usd, wall_ms: Date.now() - t0, completed: job.completed_roles, failed: job.failed_roles }, null, 2));
