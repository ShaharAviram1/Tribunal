// Intake: a visitor's scenario becomes a charge sheet and four advocate sketches, drafted by one
// model call. That call is logged like every other call in the system, so the job row and its
// deliberation id are created BEFORE it: the intake attempt is the first row of the deliberation
// it opens, written through the same ModelClient with the SupabaseStore as its budget. Nothing is
// judged here; on a valid draft the case is filed and the background function convenes.
//
// The schema forces one thing about that order (supabase/migrations/0001_tribunal.sql):
// jobs.case_id is NOT NULL and references charge_sheets(case_id), and call_log.deliberation_id
// references jobs(deliberation_id). A job cannot exist before its case row does. So the next
// unused case id is reserved with a placeholder charge sheet that names itself as undrafted, and
// the stamped sheet replaces that placeholder on success. A failed intake patches the reserved row
// to say so and leaves its failed job standing: the call log is the record of what was attempted,
// and deleting the case row would delete the job and the log with it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ModelClient, hashPrompt, type Caps } from '../../src/client/model-client.ts';
import { openRouterTransport } from '../../src/client/openrouter-transport.ts';
import { SupabaseStore } from '../../src/store/supabase-store.ts';
import { checkEnv, RUN_ENV } from '../../src/functions-env.ts';
import { parseObject } from '../../src/protocol/parse-object.ts';
import { validateChargeSheet } from '../../src/protocol/validate-charge-sheet.ts';
import { validateSketches, type Sketch } from '../../src/protocol/validate-sketches.ts';
import { stampChargeSheet } from '../../src/protocol/stamp.ts';
import { words, type FiledChargeSheet } from '../../src/protocol/types.ts';

const SCENARIO_WORDS_MAX = 800;
const HEADER = /^<!--[\s\S]*?-->\n?/;
const NO_CASE = 'intake produced no valid case';

type Provenance = { kind: 'intake'; scenario_words: number; intake_model: string; drafted_at: string };

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  // The intake makes a model call, so it needs the run environment, not the filing environment:
  // the same store and secret as filing, plus the key the drafting call spends.
  const env = checkEnv(RUN_ENV);
  if (!env.ok) return env.response;
  if (process.env.TRIBUNAL_FILING_ENABLED === 'false') return json({ error: 'filing is disabled; reading still works' }, 503);

  const panelRaw = new URL(req.url).searchParams.get('panel') ?? 'single';
  if (panelRaw !== 'single' && panelRaw !== 'multi') return json({ error: `unknown panel "${panelRaw}"; use single or multi` }, 400);
  const panel = panelRaw as 'single' | 'multi';

  let input: unknown;
  try { input = await req.json(); } catch { return json({ error: 'body is not JSON' }, 400); }
  const scenario = (input as { scenario?: unknown } | null)?.scenario;
  if (typeof scenario !== 'string' || scenario.trim() === '') return json({ error: 'scenario must be a non-empty string' }, 400);
  const scenario_words = words(scenario);
  if (scenario_words > SCENARIO_WORDS_MAX) {
    return json({ error: `the scenario is ${scenario_words} words; the bound is ${SCENARIO_WORDS_MAX} words. Shorten it and submit again` }, 422);
  }

  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  // Both rate limits run before any write and before the drafting call.
  const gate = await rateLimit(url, key, req, panel);
  if (!gate.ok) return gate.response;

  const base = url.replace(/\/$/, '');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  // The model assigned to intake, read once. No silent default if it is missing from config: a
  // function that made up a substitute model here would be exactly the failure mode
  // functions-env.ts exists to prevent for the store and secret, just moved one file over.
  const modelsConfig = JSON.parse(readFileSync(join(process.cwd(), 'config/models.json'), 'utf8')) as {
    intake?: string; free_fallbacks?: string[]; role_fallbacks?: Record<string, string[]>;
  };
  const intakeModel = modelsConfig.intake;
  if (!intakeModel) return json({ error: 'config/models.json has no "intake" model configured; no case was drafted' }, 500);

  // One provenance object, computed once and carried through every write this request makes: the
  // reservation, a possible failure, and the eventual stamped success all say the same thing about
  // when this attempt started and which model was assigned to it.
  const provenance: Provenance = { kind: 'intake', scenario_words, intake_model: intakeModel, drafted_at: new Date().toISOString() };

  // Next unused case id, assigned by the system (charge sheet spec 1b), then reserved. The
  // placeholder accused/deceased text keeps ?list=1 (tribunal-case.mts) readable while the case
  // has no filed content yet; it is replaced on success, or turned into a failure placeholder.
  const res = await fetch(`${base}/rest/v1/charge_sheets?select=case_id&order=case_id.desc&limit=1`, { headers });
  const last = ((await res.json()) as { case_id: string }[])[0]?.case_id ?? 'T-000';
  const caseId = `T-${String(Number(last.slice(2)) + 1).padStart(3, '0')}`;
  await fetch(`${base}/rest/v1/charge_sheets`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: caseId, body: { case_id: caseId, drafting: true, accused: '(drafting)', deceased: '(drafting)', provenance } }),
  });

  const deliberation_id = `d-${caseId}-${Date.now()}-${gate.iphash}`;
  const store = new SupabaseStore({ url, serviceKey: key, deliberation_id });
  const models = modelMap(panel);
  const job = {
    deliberation_id, case_id: caseId, status: 'pending', stage: 'advocates', terminal_reason: null,
    calls: 0, spend_usd: 0, attempts_by_role: {}, claimed_at: null, completed_roles: [], failed_roles: [], models,
  };
  await store.putJob({ ...job });

  // The drafting call, logged to the deliberation it opens.
  const caps: Caps = JSON.parse(readFileSync(join(process.cwd(), 'config/caps.json'), 'utf8'));
  const client = new ModelClient({
    caps, models: { intake: intakeModel }, deliberation_id, budget: store,
    transport: openRouterTransport(requireEnv('OPENROUTER_API_KEY')),
    freeFallbacks: modelsConfig.free_fallbacks ?? [], roleFallbacks: modelsConfig.role_fallbacks ?? {},
  });

  const { promptBase, shape } = readIntakePrompt();
  const prompt = `${promptBase}\n\nThe submitted scenario:\n${scenario}`;
  let failures: string[] = [];
  let drafted: { sheet: FiledChargeSheet; sketches: Sketch[] } | null = null;

  // One corrective retry, and only on a validation failure: the corrective names what failed and
  // restates the form, exactly as the protocol's does. A refusal or a transport failure is never
  // argued with (spec.md criterion 6), so it ends the intake on the attempt it happened.
  for (let attempt = 1; attempt <= 2 && drafted === null; attempt++) {
    const text = attempt === 1 ? prompt : `${prompt}\n\n${correctiveBlock(failures, shape)}`;
    const call = await client.call({ role_id: 'intake', prompt: text, hash: hashPrompt(text), attempt });
    if (call.outcome !== 'ok') {
      const detail = `the drafting call ended in ${call.outcome}`;
      await failIntake(base, headers, store, job, caseId, provenance, [detail], `${NO_CASE}: ${detail}`);
      return json({ error: `${detail}; no case was drafted`, case_id: caseId, deliberation_id }, 502);
    }
    const parsed = parseObject(call.text);
    if (!parsed.ok) { failures = [parsed.detail]; continue; }
    const sheet = validateChargeSheet(parsed.obj.charge_sheet);
    const sketchResult = validateSketches(parsed.obj.sketches);
    if (sheet.ok && sketchResult.ok) { drafted = { sheet: sheet.sheet, sketches: sketchResult.sketches }; break; }
    failures = [
      ...(sheet.ok ? [] : sheet.failures.map((f) => `charge_sheet: ${f.code} at ${f.field}`)),
      ...(sketchResult.ok ? [] : describe('sketches', sketchResult.failures)),
    ];
  }

  if (drafted === null) {
    await failIntake(base, headers, store, job, caseId, provenance, failures, NO_CASE);
    return json({ rejected: true, failures, case_id: caseId, deliberation_id }, 422);
  }

  const stamped = stampChargeSheet(drafted.sheet, caseId);
  const body = { ...stamped, sketches: drafted.sketches, provenance };
  await fetch(`${base}/rest/v1/charge_sheets?case_id=eq.${caseId}`, {
    method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
  });

  // Invoke the background function; it authenticates the shared function secret.
  await fetch(`${new URL(req.url).origin}/.netlify/functions/tribunal-run-background`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tribunal-function-secret': process.env.TRIBUNAL_FUNCTION_SECRET! },
    body: JSON.stringify({ deliberation_id, case_id: caseId }),
  });
  return json({ case_id: caseId, deliberation_id, status: 'pending' }, 202);
};

// Marks a failed intake in both places the schema requires it to be visible: the job goes
// terminal, and the reserved charge sheet — PATCH replaces the whole body column, not a merge —
// is rewritten as a failure placeholder that still satisfies ?list=1's read of body.accused and
// body.deceased (tribunal-case.mts, untouched by this lane).
async function failIntake(
  base: string, headers: Record<string, string>, store: SupabaseStore, job: Record<string, unknown>,
  caseId: string, provenance: Provenance, failures: string[], reason: string,
): Promise<void> {
  await store.putJob({ ...job, status: 'failed', terminal_reason: reason });
  await fetch(`${base}/rest/v1/charge_sheets?case_id=eq.${caseId}`, {
    method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { drafting_failed: true, accused: '(intake failed)', deceased: '(intake failed)', provenance, failures } }),
  });
}

// The intake prompt is a file on disk, like every other prompt. Its header comment is stripped
// before use; its own fenced JSON template is pulled out once so a corrective retry can restate
// it verbatim rather than re-describing it in prose.
function readIntakePrompt(): { promptBase: string; shape: string } {
  const raw = readFileSync(join(process.cwd(), 'prompts/_intake.md'), 'utf8');
  const promptBase = raw.replace(HEADER, '').trim();
  const m = raw.match(/```\n([\s\S]*?)\n```/);
  if (!m) throw new Error('prompts/_intake.md is missing its fenced JSON shape');
  return { promptBase, shape: m[1]!.trim() };
}

// Names what failed and restates the required form, exactly as the protocol's corrective does for
// every other role: it never rephrases the task and never adds pressure (spec.md criterion 6).
function correctiveBlock(failures: string[], shape: string): string {
  return [
    'Your previous response could not be accepted.',
    `What failed: ${failures.join('; ')}.`,
    'Return your response again in the required form: one JSON object, with the charge sheet under "charge_sheet" and the four advocate sketches under "sketches", and nothing else, exactly in this shape:',
    shape,
  ].join('\n\n');
}

function describe(prefix: string, failures: { code: string; detail: string }[]): string[] {
  return failures.map((f) => `${prefix}: ${f.code} — ${f.detail}`);
}

// Both limits answer 429 before any write and before the drafting call. The IP hash rides on the
// end of the deliberation id, so the per-IP cooldown needs no schema change: a LIKE query on the
// suffix. Identical to the filing function's: one door must not be a way around the other's limit.
async function rateLimit(url: string, key: string, req: Request, panel: 'single' | 'multi'): Promise<{ ok: true; iphash: string } | { ok: false; response: Response }> {
  const base = url.replace(/\/$/, '');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  // The daily cap binds only the paid panel: free-panel deliberations cost nothing and the
  // free-model chain absorbs per-model limits, so their count is policy-irrelevant (decision,
  // 2026-09-01). The per-IP cooldown below still throttles everyone.
  if (panel === 'multi') {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const day = (await (await fetch(`${base}/rest/v1/jobs?select=models&created_at=gt.${dayAgo}`, { headers })).json()) as { models: Record<string, string> }[];
    const paid = day.filter((j) => new Set(Object.values(j.models ?? {})).size > 1).length;
    if (paid >= 10) return { ok: false, response: json({ error: 'the paid panel is limited to 10 deliberations per 24 hours; try again later, or convene the free panel' }, 429) };
  }
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const iphash = createHash('sha256').update(ip).digest('hex').slice(0, 8);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const recent = (await (await fetch(`${base}/rest/v1/jobs?select=deliberation_id,created_at&deliberation_id=like.*-${iphash}&created_at=gt.${fiveMinAgo}`, { headers })).json()) as unknown[];
  if (recent.length > 0) return { ok: false, response: json({ error: 'per-IP limit: 5 minutes between convenings from one IP; try again shortly' }, 429) };
  return { ok: true, iphash };
}

function modelMap(panel: 'single' | 'multi'): Record<string, string> {
  const panels = JSON.parse(readFileSync(join(process.cwd(), 'config/models.json'), 'utf8'));
  return { ...panels[panel] };
}
const json = (b: unknown, status: number) => new Response(JSON.stringify(b, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
const requireEnv = (k: string): string => { const v = process.env[k]; if (!v) throw new Error(`${k} not set`); return v; };
