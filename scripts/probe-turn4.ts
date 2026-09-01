// Turn-four seat probes: one live call per candidate THROUGH THE REAL CLIENT (ModelClient +
// openRouterTransport), the real assembled judge-1 prompt with four real stances from run-02,
// checking the response parses as valid JSON, unfenced, and validates as an opinion.
// Results are the plan's evidence. Run: node --env-file=.env scripts/probe-turn4.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ModelClient, hashPrompt, type Caps, type LogRow } from '../src/client/model-client.ts';
import { openRouterTransport } from '../src/client/openrouter-transport.ts';
import { assemblePrompt } from '../src/prompt/assemble.ts';
import { validateOpinion } from '../src/protocol/validate-opinion.ts';

const key = process.env.OPENROUTER_API_KEY; if (!key) throw new Error('OPENROUTER_API_KEY not set');
const caps: Caps = JSON.parse(readFileSync('config/caps.json', 'utf8'));
const chargeSheet = JSON.parse(readFileSync('fixtures/charge-sheets/T-001.stored.json', 'utf8'));
const stances = ['jon', 'tyrion', 'daenerys', 'greyworm'].map((r) => JSON.parse(readFileSync(join('runs/run-02/outputs', `${r}.json`), 'utf8')));
const validIds = stances.flatMap((s: { points: { id: string }[] }) => s.points.map((p) => p.id));
const p = assemblePrompt({ role_id: 'judge-1', chargeSheet, stances });

const CANDIDATES = (process.env.PROBE_MODELS ?? '').split(',').filter(Boolean);
const results: Record<string, unknown>[] = [];
for (const model of CANDIDATES) {
  const rows: LogRow[] = [];
  const budget = { read: async () => ({ calls: rows.length, spend_usd: rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0) }), add: async (r: LogRow) => { rows.push(r); } };
  const client = new ModelClient({ caps, models: { 'judge-1': model }, deliberation_id: 'probe-t4', budget, transport: openRouterTransport(key) });
  const t0 = Date.now();
  const res = await client.call({ role_id: 'judge-1', prompt: p.text, hash: hashPrompt(p.text), attempt: 1 });
  const row = rows[rows.length - 1]!;
  const out: Record<string, unknown> = { model, outcome: res.outcome, served: row.model_served, ms: Date.now() - t0, tokens_in: row.tokens_in, tokens_out: row.tokens_out, cost_usd: row.cost_usd, finish: row.finish_reason, http: row.http_status };
  if (res.outcome === 'ok') {
    const t = res.text.trim();
    out.fenced = t.startsWith('```');
    const v = validateOpinion(res.text, validIds);
    out.valid_opinion = v.ok;
    if (!v.ok) out.failure = `${v.kind}: ${String(v.detail).slice(0, 140)}`;
    if (v.ok) out.verdict = v.opinion.verdict;
  } else {
    out.detail = row.detail;
  }
  results.push(out);
  console.log(JSON.stringify(out));
}
mkdirSync('docs/04-turns/probe', { recursive: true });
writeFileSync(join('docs/04-turns/probe', `turn-04-seat-probes-${Date.now()}.json`), JSON.stringify(results, null, 2) + '\n');
