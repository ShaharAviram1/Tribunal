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
    page = page.replace('</body>', LIVE_SCRIPT.replace('__ID__', JSON.stringify(deliberation_id)) + '\n</body>');
  } else if (['complete', 'incomplete'].includes(job.status) && ROLES.some((r) => r.startsWith('judge') && outputs[r] !== undefined) && u.searchParams.has('live')) {
    // Arrived from a live view that just turned terminal: the gavel falls once, then the bench speaks.
    page = page.replace('</body>', GAVEL_ONLY + '\n</body>');
  }
  return html(page, 200);
};
// The live view's rules: nothing on screen is placeholder content; a card exists only because
// the model's output is in the store, and the client only reveals server-rendered cards.
// Advocates reveal one at a time in seat order with a capped hold; judges show status chrome
// only (deliberating / returned / failed, never content, never a count) until the job is
// terminal; then, if at least one opinion exists, the gavel falls and all three columns appear
// in the same frame. A stalled run shows the job state instead of polling forever.
const GAVEL_CSS = `<style>
.gavel-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,Canvas 70%,transparent);z-index:10;animation:gv-fade 1.6s ease forwards}
.gavel{font-size:5rem;transform-origin:80% 80%;animation:gv-strike .6s ease-in 1}
.role-slot[data-held]{display:none}
.judge-status{border:2px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:.4rem;padding:.75rem 1rem;font-style:italic}
.judge-status .state{font-style:normal;font-weight:bold}
@keyframes gv-strike{0%{transform:rotate(-40deg)}55%{transform:rotate(12deg)}70%{transform:rotate(-6deg)}100%{transform:rotate(0)}}
@keyframes gv-fade{0%,70%{opacity:1}100%{opacity:0;visibility:hidden}}
.role-slot.revealed{animation:rise .5s ease}
@keyframes rise{from{opacity:0;transform:translateY(.6rem)}to{opacity:1;transform:none}}
</style>`;

const GAVEL_ONLY = GAVEL_CSS + `<script>
const ov = document.createElement('div'); ov.className = 'gavel-overlay'; ov.innerHTML = '<div class="gavel">\u2696\uFE0F</div>';
document.body.appendChild(ov); setTimeout(() => ov.remove(), 1700);
</script>`;

const LIVE_SCRIPT = GAVEL_CSS + `<script>
(async () => {
  const id = __ID__;
  const SEAT_ORDER = ['jon', 'tyrion', 'daenerys', 'greyworm'];
  const JUDGES = ['judge-1', 'judge-2', 'judge-3'];
  const MIN_HOLD = 9000, POLL = 5000, STALL_MS = 240000;
  const shown = new Set(); let lastChange = Date.now(); let lastSignature = '';

  const slot = (r) => document.querySelector('.role-slot[data-role="' + r + '"]');
  // Judge slots show status chrome only while the bench works. Content stays hidden.
  for (const j of JUDGES) { const el = slot(j); if (el) { el.dataset.held = '1'; statusFor(j, 'deliberating'); } }
  function statusFor(j, state) {
    let chip = document.querySelector('.judge-status[data-for="' + j + '"]');
    if (!chip) { chip = document.createElement('div'); chip.className = 'judge-status'; chip.dataset.for = j; slot(j)?.parentNode?.insertBefore(chip, slot(j)); }
    chip.innerHTML = '<span class="state">' + (state === 'deliberating' ? 'Deliberating\u2026' : state === 'failed' ? 'No opinion will come from this seat' : 'Opinion returned, under seal until the bench rules') + '</span>';
  }

  async function fetchDoc() {
    const res = await fetch(location.pathname + '?live=1&t=' + Date.now(), { headers: { 'Cache-Control': 'no-store' } });
    if (!res.ok) return null;
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }
  function stateOf(doc, r) { return doc.querySelector('.role-slot[data-role="' + r + '"]')?.dataset.state ?? 'absent'; }
  function adopt(doc, r) {
    const fresh = doc.querySelector('.role-slot[data-role="' + r + '"]'); const mine = slot(r);
    if (fresh && mine) { mine.replaceWith(fresh); fresh.classList.add('revealed'); }
  }

  let queue = []; let lastReveal = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL));
    const doc = await fetchDoc(); if (!doc) continue;
    const notice = doc.querySelector('.notice');
    const jobText = doc.body.innerHTML;
    const signature = SEAT_ORDER.concat(JUDGES).map((r) => stateOf(doc, r)).join(',') + (notice ? 'N' : '');
    if (signature !== lastSignature) { lastSignature = signature; lastChange = Date.now(); }

    // Advocates: queue newly landed cards in seat order; reveal at most one per MIN_HOLD.
    for (const r of SEAT_ORDER) {
      const st = stateOf(doc, r);
      if ((st === 'returned' || st === 'failed') && !shown.has(r) && !queue.includes(r)) queue.push(r);
    }
    queue.sort((a, b) => SEAT_ORDER.indexOf(a) - SEAT_ORDER.indexOf(b));
    const judgesMoving = JUDGES.some((j) => stateOf(doc, j) !== 'absent') || !!notice;
    while (queue.length && (judgesMoving || Date.now() - lastReveal >= MIN_HOLD || shown.size === 0)) {
      const r = queue.shift(); adopt(doc, r); shown.add(r); lastReveal = Date.now();
      if (!judgesMoving) break; // flush entirely only once the run has moved past the advocates
    }
    // Judge status chrome, per judge, never a count.
    for (const j of JUDGES) { const st = stateOf(doc, j); if (st !== 'absent') statusFor(j, st === 'failed' ? 'failed' : 'returned'); }

    const terminal = /This deliberation is (incomplete|failed)/.test(jobText) || JUDGES.every((j) => stateOf(doc, j) === 'returned') || /complete/.test(doc.querySelector('.role-slot[data-kind="opinion"][data-state="returned"]') ? 'complete' : '');
    // Decide from the JSON job, which is authoritative:
    let job = null;
    try { job = (await (await fetch('/.netlify/functions/tribunal-case?deliberation_id=' + encodeURIComponent(id))).json()).job; } catch {}
    if (job && ['complete', 'incomplete', 'failed'].includes(job.status)) {
      while (queue.length) { const r = queue.shift(); adopt(doc, r); shown.add(r); }
      const anyOpinion = JUDGES.some((j) => ['returned', 'failed'].includes(stateOf(doc, j)));
      const anyReturned = JUDGES.some((j) => stateOf(doc, j) === 'returned');
      document.querySelectorAll('.judge-status').forEach((c) => c.remove());
      if (anyReturned) {
        const ov = document.createElement('div'); ov.className = 'gavel-overlay'; ov.innerHTML = '<div class="gavel">\u2696\uFE0F</div>';
        document.body.appendChild(ov);
        setTimeout(() => { for (const j of JUDGES) adopt(doc, j); ov.remove(); if (notice) document.querySelector('.notice')?.replaceWith(notice); else if (doc.querySelector('.notice')) document.body.prepend(doc.querySelector('.notice')); }, 900);
      } else {
        // No opinion exists: no gavel. Show the banner and whatever state each slot has.
        for (const j of JUDGES) adopt(doc, j);
        const n = doc.querySelector('.notice'); if (n) { document.querySelector('header')?.after(n); }
      }
      return;
    }
    if (Date.now() - lastChange > STALL_MS && job) {
      const p = document.createElement('p'); p.className = 'notice';
      p.textContent = 'This run has not advanced for a while. Job state: ' + job.status + ', stage ' + job.stage + (job.terminal_reason ? ', ' + job.terminal_reason : '') + '. The page has stopped polling; reload to look again.';
      document.querySelector('header')?.after(p);
      return;
    }
  }
})();
</script>`;

const html = (b: string, status: number) => new Response(b, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
