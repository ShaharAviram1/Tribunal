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
.gavel-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(20,16,12,.82);z-index:10;animation:gv-fade 2s ease forwards}
.gavel-scene{position:relative;width:220px;height:170px}
.gavel-arm{position:absolute;left:30px;top:10px;width:150px;height:90px;transform-origin:10% 85%;animation:gv-strike .55s cubic-bezier(.5,0,1,1) 1}
.gavel-head{position:absolute;right:0;top:6px;width:74px;height:40px;background:#5a4128;border:2px solid #c9a227;border-radius:9px}
.gavel-handle{position:absolute;left:0;top:22px;width:120px;height:11px;background:#5a4128;border:2px solid #c9a227;border-radius:6px;transform:rotate(18deg)}
.gavel-podium{position:absolute;left:20px;bottom:18px;width:180px;height:16px;background:#1d1712;border:2px solid #c9a227;border-radius:4px}
.gavel-base{position:absolute;left:60px;bottom:34px;width:100px;height:10px;background:#5a4128;border:2px solid #c9a227;border-radius:4px}
.gavel-scene.struck .gavel-podium{animation:gv-shudder .3s ease-out 1}
@keyframes gv-strike{0%{transform:rotate(-55deg)}78%{transform:rotate(9deg)}100%{transform:rotate(3deg)}}
@keyframes gv-shudder{0%{transform:translateY(0)}30%{transform:translateY(3px)}100%{transform:translateY(0)}}
@keyframes gv-fade{0%,75%{opacity:1}100%{opacity:0;visibility:hidden}}
.role-slot[data-held]{display:none}
.judge-status{background:#1d1712;border:1px solid #3a2f22;border-top:4px solid #c9a227;border-radius:.45rem;padding:.9rem 1.1rem;font-style:italic;color:#9b8d76;height:100%}
.judge-status .who{font-family:"Bodoni Moda",Georgia,serif;font-style:normal;font-size:1.25rem;color:#efe7d8;margin:.1rem 0}
.judge-status .state{font-style:normal;font-weight:600;letter-spacing:.05em}
.judge-status .model-line{font-family:ui-monospace,monospace;font-size:.85em;overflow-wrap:anywhere}
.speaking{outline:2px solid #c9a227;outline-offset:2px}
.bars{margin:.6rem 0}
.bars span{display:block;height:.7rem;border-radius:.2rem;background:linear-gradient(90deg,#3a2f22 25%,#5a4128 50%,#3a2f22 75%);background-size:200% 100%;animation:shimmer 1.4s linear infinite;margin:.45rem 0}
.bars span:nth-child(2){width:86%}.bars span:nth-child(3){width:64%}
@keyframes shimmer{from{background-position:200% 0}to{background-position:0 0}}
.live-rail{display:flex;flex-wrap:wrap;gap:.4rem 1.4rem;align-items:center;border:1px solid #3a2f22;background:#1d1712;border-radius:.45rem;padding:.5rem .9rem;margin:.6rem 0;color:#9b8d76;font-size:.92rem}
.live-rail b{color:#efe7d8;font-weight:600}
.stagebar{flex-basis:100%;display:flex;gap:.4rem;align-items:center}
.stagebar .seg{flex:1;height:.5rem;border:1px solid #3a2f22;border-radius:.25rem;overflow:hidden}
.stagebar .seg i{display:block;height:100%;width:0;background:#c9a227;transition:width .8s ease}
.stagebar .lab{font-variant:small-caps;letter-spacing:.08em}
</style>`;

const GAVEL_HTML = `<div class="gavel-overlay"><div class="gavel-scene"><div class="gavel-arm"><div class="gavel-handle"></div><div class="gavel-head"></div></div><div class="gavel-base"></div><div class="gavel-podium"></div></div></div>`;

const GAVEL_ONLY = GAVEL_CSS + `<script>
const ov = document.createElement('div'); ov.innerHTML = ${JSON.stringify('__G__')}.replace('__G__',''); document.body.insertAdjacentHTML('beforeend', ` + '`' + `${GAVEL_HTML}` + '`' + `);
const sc = document.querySelector('.gavel-scene'); setTimeout(() => sc.classList.add('struck'), 430);
setTimeout(() => document.querySelector('.gavel-overlay')?.remove(), 2100);
</script>`;

const LIVE_SCRIPT = GAVEL_CSS + `<script>
(async () => {
  const id = __ID__;
  const SEAT_ORDER = ['jon', 'tyrion', 'daenerys', 'greyworm'];
  const JUDGES = ['judge-1', 'judge-2', 'judge-3'];
  const MIN_HOLD = 9000, POLL = 5000, STALL_MS = 240000;
  const t0 = Date.now();
  const shown = new Set(); let lastChange = Date.now(); let lastSignature = '';

  // The live rail: elapsed, calls against the cap, spend, panel, and a two-stage bar.
  const mast = document.querySelector('.masthead');
  mast.insertAdjacentHTML('afterend', '<div class="live-rail"><span>Elapsed <b id="lr-el">0:00</b></span><span>Calls <b id="lr-calls">0</b> of 20</span><span>Spend <b id="lr-spend">$0.0000</b></span><span id="lr-panel"></span><span class="stagebar"><span class="lab">The Floor</span><span class="seg"><i id="seg-floor"></i></span><span class="lab">The Bench</span><span class="seg"><i id="seg-bench"></i></span></span></div>');
  setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); document.getElementById('lr-el').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);

  const slot = (r) => document.querySelector('.role-slot[data-role="' + r + '"]');
  // Judges show status chrome only while the bench works; their content stays hidden.
  for (const j of JUDGES) holdJudge(j, 'Awaiting argument');
  function holdJudge(j, stateText) {
    const el = slot(j); if (!el) return;
    el.dataset.held = '1';
    let chip = document.querySelector('.judge-status[data-for="' + j + '"]');
    const head = el.querySelector('.card-head');
    const who = head?.querySelector('h3')?.textContent ?? j;
    const model = head?.querySelector('.model')?.textContent ?? '';
    const inner = '<p class="who">' + who + '</p><p class="model-line">' + model + '</p><p class="state">' + stateText + '</p>';
    if (!chip) { chip = document.createElement('div'); chip.className = 'judge-status'; chip.dataset.for = j; el.parentNode.insertBefore(chip, el); }
    chip.innerHTML = inner;
  }
  // The advocate currently expected to speak next is lit and shows moving bars: geometry, never words.
  function lightNext() {
    document.querySelectorAll('.speaking').forEach((el) => { el.classList.remove('speaking'); el.querySelector('.bars')?.remove(); });
    const next = SEAT_ORDER.find((r) => !shown.has(r));
    if (!next) return;
    const el = slot(next)?.querySelector('article'); if (!el) return;
    el.classList.add('speaking');
    el.insertAdjacentHTML('beforeend', '<div class="bars"><span></span><span></span><span></span></div>');
  }
  lightNext();

  async function fetchDoc() {
    const res = await fetch(location.pathname + '?live=1&t=' + Date.now(), { headers: { 'Cache-Control': 'no-store' } });
    if (!res.ok) return null;
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }
  const stateOf = (doc, r) => doc.querySelector('.role-slot[data-role="' + r + '"]')?.dataset.state ?? 'absent';
  function adopt(doc, r) {
    const fresh = doc.querySelector('.role-slot[data-role="' + r + '"]'); const mine = slot(r);
    if (fresh && mine) { mine.replaceWith(fresh); }
  }

  let queue = []; let lastReveal = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL));
    const doc = await fetchDoc(); if (!doc) continue;
    let job = null;
    try { job = (await (await fetch('/.netlify/functions/tribunal-case?deliberation_id=' + encodeURIComponent(id))).json()).job; } catch {}
    if (job) {
      document.getElementById('lr-calls').textContent = job.calls ?? 0;
      document.getElementById('lr-spend').textContent = '$' + Number(job.spend_usd ?? 0).toFixed(4);
      const models = job.models ? Object.values(job.models) : [];
      document.getElementById('lr-panel').textContent = new Set(models).size <= 1 ? 'One model for all seven roles' : new Set(models).size + ' distinct models';
      const floorDone = SEAT_ORDER.filter((r) => ['returned', 'failed'].includes(stateOf(doc, r))).length;
      document.getElementById('seg-floor').style.width = (floorDone / 4) * 100 + '%';
      const benchDone = JUDGES.filter((j) => ['returned', 'failed'].includes(stateOf(doc, j))).length;
      document.getElementById('seg-bench').style.width = (benchDone / 3) * 100 + '%';
    }
    const signature = SEAT_ORDER.concat(JUDGES).map((r) => stateOf(doc, r)).join(',');
    if (signature !== lastSignature) { lastSignature = signature; lastChange = Date.now(); }

    for (const r of SEAT_ORDER) {
      const st = stateOf(doc, r);
      if ((st === 'returned' || st === 'failed') && !shown.has(r) && !queue.includes(r)) queue.push(r);
    }
    queue.sort((a, b) => SEAT_ORDER.indexOf(a) - SEAT_ORDER.indexOf(b));
    const judgesMoving = job && (job.stage === 'judges' || ['complete', 'incomplete', 'failed'].includes(job.status));
    while (queue.length && (judgesMoving || Date.now() - lastReveal >= MIN_HOLD || shown.size === 0)) {
      const r = queue.shift(); adopt(doc, r); shown.add(r); lastReveal = Date.now();
      if (!judgesMoving) break;
    }
    lightNext();
    if (job && job.stage === 'judges' && job.status === 'running') {
      for (const j of JUDGES) { const st = stateOf(doc, j); holdJudge(j, st === 'failed' ? 'No opinion will come from this seat' : st === 'returned' ? 'Opinion returned, under seal until the bench rules' : 'Deliberating\u2026'); }
    }
    if (job && ['complete', 'incomplete', 'failed'].includes(job.status)) {
      while (queue.length) { const r = queue.shift(); adopt(doc, r); shown.add(r); }
      lightNext();
      const anyReturned = JUDGES.some((j) => stateOf(doc, j) === 'returned');
      const reveal = () => {
        document.querySelectorAll('.judge-status').forEach((c) => c.remove());
        for (const j of JUDGES) adopt(doc, j);
        const n = doc.querySelector('.notice'); if (n) document.querySelector('.masthead')?.after(n);
        const sl = doc.querySelector('.status-line'); if (sl) document.querySelector('.status-line')?.replaceWith(sl);
      };
      if (anyReturned) {
        // The gavel strikes the podium; the verdicts appear at the strike, together.
        document.body.insertAdjacentHTML('beforeend', ` + '`' + `${GAVEL_HTML}` + '`' + `);
        const sc = document.querySelector('.gavel-scene');
        setTimeout(() => { sc.classList.add('struck'); reveal(); }, 430);
        setTimeout(() => document.querySelector('.gavel-overlay')?.remove(), 2100);
      } else {
        reveal(); // no opinion exists: no gavel, the banner speaks.
      }
      document.querySelector('.live-rail')?.remove();
      return;
    }
    if (Date.now() - lastChange > STALL_MS && job) {
      const p = document.createElement('p'); p.className = 'notice';
      p.textContent = 'This run has not advanced for a while. Job state: ' + job.status + ', stage ' + job.stage + (job.terminal_reason ? ', ' + job.terminal_reason : '') + '. The page has stopped polling; reload to look again.';
      document.querySelector('.masthead')?.after(p);
      return;
    }
  }
})();
</script>`;

const html = (b: string, status: number) => new Response(b, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
