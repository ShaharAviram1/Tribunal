// The live case page: server-rendered by the same renderer the static render uses, so there is
// exactly one renderer and no client bundle. While the job is pending or running, a few inline
// lines of plain JS poll the JSON endpoint and reload when the job advances.
import { makeStore } from '../../src/store/index.ts';
import { makeCatalogue } from '../../src/store/catalogue.ts';
import { renderCasePage, type CaseData } from '../../src/page/render-case.ts';
import { usageFromLog } from '../../src/page/usage.ts';
import { checkEnv } from '../../src/functions-env.ts';

const ROLES = ['jon', 'tyrion', 'daenerys', 'greyworm', 'judge-1', 'judge-2', 'judge-3'];

export default async (req: Request): Promise<Response> => {
  const env = checkEnv(['TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (!env.ok) return env.response;
  const u = new URL(req.url);
  const deliberation_id = u.searchParams.get('deliberation_id') ?? u.pathname.split('/').filter(Boolean).pop() ?? '';
  // A live deliberation (`d-…`) or one of the committed runs (`run-NN`), which
  // makeStore reads from the repository's own runs/ directory. Anything else is
  // not an address this page has, and never reaches the store.
  if (!/^(d-[A-Za-z0-9._-]+|run-\d{2,})$/.test(deliberation_id)) return html('<p>No deliberation named. A case page address looks like /case/&lt;deliberation id&gt;.</p>', 400);
  const store = makeStore(deliberation_id);
  const job = (await store.getJob()) as (CaseData['job'] & { case_id: string }) | undefined;
  if (!job) return html('<p>Unknown deliberation.</p>', 404);
  const chargeSheet = (await makeCatalogue().getSheet(job.case_id)) as CaseData['chargeSheet'] | undefined;
  if (!chargeSheet) return html('<p>Unknown case.</p>', 404);
  const outputs: CaseData['outputs'] = {};
  for (const r of ROLES) { const o = await store.getOutput(r); if (o !== undefined) outputs[r] = o as never; }
  const usage = usageFromLog(await store.readLog());
  let page = renderCasePage({ chargeSheet, job, outputs, usage });
  const assets = '';
  if (job.status === 'pending' || job.status === 'running') {
    page = page.replace('</body>', assets + `<script src="/case-live.js" data-id="${deliberation_id}"></script>\n</body>`);
  } else if (['complete', 'incomplete'].includes(job.status) && ROLES.some((r) => r.startsWith('judge') && outputs[r] !== undefined) && u.searchParams.has('live')) {
    // Arrived from a live view that just turned terminal: the gavel falls once over the full page.
    page = page.replace('</body>', assets + `<script src="/case-live.js" data-id="${deliberation_id}" data-terminal="1"></script>\n</body>`);
  }
  return html(page, 200);
};
// The live view's rules: nothing on screen is placeholder content; a card exists only because
// the model's output is in the store, and the client only reveals server-rendered cards.
// Advocates reveal one at a time in seat order with a capped hold; judges show status chrome
// only (deliberating / returned / failed, never content, never a count) until the job is
// terminal; then, if at least one opinion exists, the gavel falls and all three columns appear
// in the same frame. A stalled run shows the job state instead of polling forever.
const html = (b: string, status: number) => new Response(b, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
