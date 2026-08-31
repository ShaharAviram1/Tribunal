// The live case page: server-rendered by the same renderer the static render uses, so there is
// exactly one renderer and no client bundle. While the job is pending or running, a few inline
// lines of plain JS poll the JSON endpoint and reload when the job advances.
import { SupabaseStore } from '../../src/store/supabase-store.ts';
import { renderCasePage, type CaseData } from '../../src/page/render-case.ts';
import { checkEnv } from '../../src/functions-env.ts';

const ROLES = ['jon', 'tyrion', 'daenerys', 'greyworm', 'judge-1', 'judge-2', 'judge-3'];

export default async (req: Request): Promise<Response> => {
  const env = checkEnv(['TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (!env.ok) return env.response;
  const u = new URL(req.url);
  const deliberation_id = u.searchParams.get('deliberation_id') ?? u.pathname.split('/').filter(Boolean).pop() ?? '';
  if (!deliberation_id.startsWith('d-')) return html('<p>No deliberation named. A case page address looks like /case/&lt;deliberation id&gt;.</p>', 400);
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const store = new SupabaseStore({ url, serviceKey: key, deliberation_id });
  const job = (await store.getJob()) as (CaseData['job'] & { case_id: string }) | undefined;
  if (!job) return html('<p>Unknown deliberation.</p>', 404);
  const sheetRes = await fetch(`${url.replace(/\/$/, '')}/rest/v1/charge_sheets?case_id=eq.${job.case_id}&select=body`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const chargeSheet = ((await sheetRes.json()) as { body: CaseData['chargeSheet'] }[])[0]?.body;
  if (!chargeSheet) return html('<p>Unknown case.</p>', 404);
  const outputs: CaseData['outputs'] = {};
  for (const r of ROLES) { const o = await store.getOutput(r); if (o !== undefined) outputs[r] = o as never; }
  let page = renderCasePage({ chargeSheet, job, outputs });
  if (job.status === 'pending' || job.status === 'running') {
    const poll = `<script>
(async () => {
  const done = ${JSON.stringify(Object.keys(outputs).length)};
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch('/.netlify/functions/tribunal-case?deliberation_id=' + encodeURIComponent(${JSON.stringify(deliberation_id)}));
      if (!res.ok) continue;
      const data = await res.json();
      const n = Object.keys(data.outputs ?? {}).length;
      const terminal = ['complete', 'incomplete', 'failed'].includes(data.job?.status);
      if (n !== done || terminal) { location.reload(); return; }
    } catch {}
  }
})();
</script>`;
    page = page.replace('</body>', poll + '\n</body>');
  }
  return html(page, 200);
};
const html = (b: string, status: number) => new Response(b, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
