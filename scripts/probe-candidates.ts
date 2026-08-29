// Turn one probe. Sends the real assembled judge-1 prompt and the real assembled daenerys prompt
// once each, at temperature 0, to three candidate models. Records raw text, served model, tokens,
// cost, latency. Throwaway: not the client module, not the protocol. Run with:
//   node --env-file=.env scripts/probe-candidates.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { assemblePrompt } from '../src/prompt/assemble.ts';

const CANDIDATES = (process.env.PROBE_MODELS ?? 'moonshotai/kimi-k2:free,z-ai/glm-4.5-air:free,openai/gpt-4.1-mini').split(',');
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error('OPENROUTER_API_KEY not set');

const root = process.cwd();
const chargeSheet = JSON.parse(readFileSync(join(root, 'fixtures/charge-sheets/T-001.stored.json'), 'utf8'));
const stance = JSON.parse(readFileSync(join(root, 'fixtures/stances/greyworm.stored.json'), 'utf8'));
const stances = ['jon', 'tyrion', 'daenerys', 'greyworm'].map((r) => ({
  ...stance, role_id: r, seat: r === 'jon' || r === 'tyrion' ? 'defense' : 'prosecution',
  points: stance.points.map((p: { id: string }, i: number) => ({ ...p, id: `${r}.p${i + 1}` })),
}));
const prompts = [
  assemblePrompt({ role_id: 'daenerys', chargeSheet }),
  assemblePrompt({ role_id: 'judge-1', chargeSheet, stances }),
];

type Result = { model_requested: string; role_id: string; served?: string; status?: number; ms: number;
  tokens_in?: number; tokens_out?: number; cost_usd?: number; finish?: string; text?: string; error?: string;
  clean_object: boolean; notes: string[] };

async function one(model: string, p: (typeof prompts)[number]): Promise<Result> {
  const t0 = Date.now();
  const r: Result = { model_requested: model, role_id: p.role_id, ms: 0, clean_object: false, notes: [] };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: 4096, messages: [{ role: 'user', content: p.text }],
        provider: { allow_fallbacks: false }, usage: { include: true },
      }),
    });
    r.ms = Date.now() - t0; r.status = res.status;
    const body: any = await res.json();
    if (!res.ok) { r.error = JSON.stringify(body).slice(0, 500); return r; }
    r.served = body.model; r.finish = body.choices?.[0]?.finish_reason;
    r.tokens_in = body.usage?.prompt_tokens; r.tokens_out = body.usage?.completion_tokens; r.cost_usd = body.usage?.cost;
    r.text = body.choices?.[0]?.message?.content ?? '';
    const t = r.text!.trim();
    if (t.startsWith('```')) r.notes.push('code fence');
    if (!t.startsWith('{')) r.notes.push('preamble or non-object');
    if (!t.endsWith('}')) r.notes.push('trailing text or truncated');
    try { const o = JSON.parse(t); r.clean_object = typeof o === 'object' && o !== null && r.notes.length === 0; }
    catch { r.notes.push('not parseable JSON'); }
    if (/I can.t|I cannot|I'm not able|unable to/i.test(t.slice(0, 200)) && !r.clean_object) r.notes.push('looks like a refusal');
  } catch (e) { r.ms = Date.now() - t0; r.error = String(e); }
  return r;
}

const out: Result[] = [];
for (const m of CANDIDATES) for (const p of prompts) { const r = await one(m, p); out.push(r);
  console.log(`${m} ${p.role_id}: status=${r.status} served=${r.served} ms=${r.ms} in=${r.tokens_in} out=${r.tokens_out} cost=${r.cost_usd} clean=${r.clean_object} notes=[${r.notes.join('; ')}] ${r.error ?? ''}`); }
mkdirSync(join(root, 'docs/04-turns/probe'), { recursive: true });
const outPath = join(root, 'docs/04-turns/probe', `turn-01-candidates-${Date.now()}.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('written', outPath);
