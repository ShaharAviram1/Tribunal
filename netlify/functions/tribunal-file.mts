// Filing: rate limits, rule validation (all failures named), stamp, job row, invoke background.
// No model call happens here or anywhere outside the background function.
import { validateChargeSheet } from '../../src/protocol/validate-charge-sheet.ts';
import { stampChargeSheet } from '../../src/protocol/stamp.ts';
import { makeStore } from '../../src/store/index.ts';
import { makeCatalogue, type Catalogue } from '../../src/store/catalogue.ts';
import { checkEnv, FILE_ENV } from '../../src/functions-env.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const env = checkEnv(FILE_ENV);
  if (!env.ok) return env.response;
  if (process.env.TRIBUNAL_FILING_ENABLED === 'false') return json({ error: 'filing is disabled; reading still works' }, 503);
  const panelRaw = new URL(req.url).searchParams.get('panel') ?? 'single';
  if (panelRaw !== 'single' && panelRaw !== 'multi') return json({ error: `unknown panel "${panelRaw}"; use single or multi` }, 400);
  const panel = panelRaw as 'single' | 'multi';
  let input: unknown;
  try { input = await req.json(); } catch { return json({ error: 'body is not JSON' }, 400); }
  const catalogue = makeCatalogue();

  // Both rate limits run before any write or model call.
  const gate = await rateLimit(catalogue, req);
  if (!gate.ok) return gate.response;

  // Convene mode: { case_id } deliberates an existing charge sheet afresh.
  const asConvene = input as { case_id?: string };
  if (asConvene && typeof asConvene === 'object' && 'case_id' in asConvene) {
    if (Object.keys(asConvene).length !== 1 || !/^T-[0-9]{3}$/.test(asConvene.case_id ?? '')) return json({ error: 'convene body is exactly { case_id: "T-nnn" }' }, 400);
    if ((await catalogue.getSheet(asConvene.case_id!)) === undefined) return json({ error: `unknown case ${asConvene.case_id}` }, 404);
    return start(asConvene.case_id!, panel, req, gate.iphash);
  }

  const v = validateChargeSheet(input);
  if (!v.ok) return json({ rejected: true, failures: v.failures }, 422);
  // Next unused case id, assigned by the system (charge sheet spec 1b).
  const caseId = await catalogue.nextCaseId();
  await catalogue.putSheet(caseId, stampChargeSheet(v.sheet, caseId));

  return start(caseId, panel, req, gate.iphash);
};

// Both limits answer 429 before any write or model call. The IP hash rides on the end of the
// deliberation id; the hash ties a run to its origin without storing an address. (The per-IP on the suffix.
async function rateLimit(catalogue: Catalogue, req: Request): Promise<{ ok: true; iphash: string } | { ok: false; response: Response }> {
  // Every deliberation is a paid run (paid only, decision 2026-09-01), so the daily cap counts
  // them all. Correction, 2026-09-02: the cap once counted only multi-model jobs, a filter from
  // the free-single-panel era; after paid-only it let single-panel paid runs escape the cap.
  // (The per-IP cooldown was removed by decision 2026-09-01, as self-limiting.)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const day = await catalogue.countJobsSince(dayAgo);
  if (day >= 10) return { ok: false, response: json({ error: 'the tribunal is limited to 10 deliberations per 24 hours; try again later' }, 429) };
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const iphash = createHash('sha256').update(ip).digest('hex').slice(0, 8);
  return { ok: true, iphash };
}

async function start(caseId: string, panel: 'single' | 'multi', req: Request, iphash: string): Promise<Response> {
  const deliberation_id = `d-${caseId}-${Date.now()}-${iphash}`;
  const store = makeStore(deliberation_id);
  // Two fields the Supabase row gets from the database and the file store cannot: created_at is a
  // column default there (and is stripped from this write by the store's column filter), and
  // deliberation_id is written by the store itself. The file store writes exactly what it is
  // given, the daily cap counts created_at, and src/protocol/run.ts resumes an existing row only
  // when the id on it matches, so the row carries both.
  // The columns the database filled in by default on Supabase (supabase/migrations/0001_tribunal.sql)
  // are written explicitly, so the file store's row has the same shape the runner reads.
  await store.putJob({
    deliberation_id, case_id: caseId, status: 'pending', stage: 'advocates', terminal_reason: null,
    calls: 0, spend_usd: 0, attempts_by_role: {}, completed_roles: [], failed_roles: [],
    created_at: new Date().toISOString(), models: modelMap(panel),
  });
  // Invoke the background function; it authenticates the shared function secret.
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
