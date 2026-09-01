// The live view. Static file; nothing here is assembled server-side, and nothing on screen is
// ever text a model did not produce. This script reveals server-rendered cards on a cadence,
// keeps the progress rail honest (roles returned or failed over roles expected, never a count
// of positions), and mounts the gavel exactly once on the transition to a terminal job with at
// least one returned opinion. Waiting states are geometry; labels are chrome.
(async () => {
  const me = document.currentScript;
  const id = me.dataset.id;
  const terminalArrival = me.dataset.terminal === '1';
  const SEAT_ORDER = ['jon', 'tyrion', 'daenerys', 'greyworm'];
  const JUDGES = ['judge-1', 'judge-2', 'judge-3'];
  const MIN_HOLD = 9000, POLL = 5000, STALL_MS = 240000;

  const GAVEL = '<div class="gavel-veil"><video src="/gavel.mp4#t=1,5" autoplay muted playsinline></video><div class="gavel-vignette"></div><p class="gavel-word">The bench has ruled</p></div>';
  const GAVEL_CSS = '<style>'
    + '.gavel-veil{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:#000;animation:gv-veil 4.4s ease forwards}'
    + '.gavel-veil video{width:100%;height:100%;object-fit:cover;opacity:.92;grid-area:1/1}'
    + '.gavel-vignette{grid-area:1/1;width:100%;height:100%;background:radial-gradient(58% 52% at 50% 48%,transparent 0%,rgba(5,4,3,.55) 72%,#000 100%)}'
    + '.gavel-word{position:absolute;bottom:56px;left:0;right:0;text-align:center;font:600 19px "Bodoni Moda",Georgia,serif;letter-spacing:.28em;text-transform:uppercase;color:#e8e2d2;animation:gv-word 4.4s ease forwards}'
    + '@keyframes gv-veil{0%{opacity:0}8%{opacity:1}82%{opacity:1}100%{opacity:0;visibility:hidden}}'
    + '@keyframes gv-word{0%,30%{opacity:0;letter-spacing:.5em}46%{opacity:1;letter-spacing:.28em}92%{opacity:1}100%{opacity:0}}'
    + '.progress-rail{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:18px 0 0;padding:12px 18px;background:var(--card);border:1px solid var(--edge);border-radius:var(--r)}'
    + '.progress-rail .half{display:flex;align-items:center;gap:10px}'
    + '.progress-rail .lab{font:400 10px "JetBrains Mono",monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--card-ink3);width:82px}'
    + '.progress-rail .track{flex:1;height:3px;background:var(--rule)}'
    + '.progress-rail .fill{display:block;height:100%;width:0;background:var(--accent);transition:width .7s ease}'
    + '.speaking-card{outline:1px solid var(--accent);outline-offset:2px}'
    + '</style>';
  document.head.insertAdjacentHTML('beforeend', GAVEL_CSS);
  function mountGavel() {
    document.body.insertAdjacentHTML('beforeend', GAVEL);
    setTimeout(() => document.querySelector('.gavel-veil')?.remove(), 4500);
  }
  if (terminalArrival) { mountGavel(); return; }

  const head = document.querySelector('.case-head');
  head.insertAdjacentHTML('afterend',
    '<div class="progress-rail"><span class="half"><span class="lab">The Floor</span><span class="track"><span class="fill" id="pr-floor"></span></span></span>'
    + '<span class="half"><span class="lab">The Bench</span><span class="track"><span class="fill" id="pr-bench"></span></span></span></div>');
  const meta = document.querySelector('[data-meta]');
  const t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    if (meta) meta.textContent = 'Elapsed ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' · ' + (meta.dataset.calls ?? meta.textContent.replace(/^Elapsed [0-9:]+ · /, ''));
  }, 1000);

  const shown = new Set();
  let lastChange = Date.now(), lastSignature = '', lastReveal = 0;
  const queue = [];

  // Background tabs freeze timers, which froze the whole view and, on the refresh it forced,
  // skipped the gavel (which fires only on a live transition or a ?live=1 arrival). The sleep is
  // therefore abortable: returning to the foreground kicks an immediate poll, so a stall catches
  // up in one cycle and a terminal transition that happened while hidden still strikes the gavel.
  let wake = null;
  const sleep = (ms) => new Promise((resolve) => { wake = resolve; setTimeout(resolve, ms); });
  const kick = () => { if (document.visibilityState === 'visible' && wake) wake(); };
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('pageshow', kick);
  window.addEventListener('focus', kick);
  const slot = (r) => document.querySelector('.role-slot[data-role="' + r + '"]');
  const stateOfLocal = (r) => slot(r)?.dataset.state ?? 'waiting';

  function speakNext() {
    document.querySelectorAll('.speaking-card').forEach((el) => el.classList.remove('speaking-card'));
    const next = SEAT_ORDER.find((r) => !shown.has(r) && stateOfLocal(r) === 'waiting');
    if (!next) return;
    const el = slot(next)?.querySelector('article'); if (!el) return;
    el.classList.add('speaking-card');
    const lab = el.querySelector('.waiting .micro'); if (lab) lab.textContent = 'Taking the floor';
  }
  speakNext();

  async function fetchDoc() {
    const res = await fetch(location.pathname + '?poll=1&t=' + Date.now(), { headers: { 'Cache-Control': 'no-store' } });
    if (!res.ok) return null;
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }
  const stateOf = (doc, r) => doc.querySelector('.role-slot[data-role="' + r + '"]')?.dataset.state ?? 'waiting';
  function adopt(doc, r) {
    const fresh = doc.querySelector('.role-slot[data-role="' + r + '"]'); const mine = slot(r);
    if (fresh && mine) mine.replaceWith(document.importNode(fresh, true));
  }

  for (;;) {
    await sleep(POLL);
    const doc = await fetchDoc(); if (!doc) continue;
    let job = null;
    try { job = (await (await fetch('/.netlify/functions/tribunal-case?deliberation_id=' + encodeURIComponent(id))).json()).job; } catch {}
    if (job && meta) { meta.dataset.calls = 'Calls ' + (job.calls ?? 0) + ' of 20'; }
    const floorDone = SEAT_ORDER.filter((r) => ['returned', 'failed'].includes(stateOf(doc, r))).length;
    const benchDone = JUDGES.filter((j) => ['returned', 'failed', 'sealed'].includes(stateOf(doc, j))).length;
    const pf = document.getElementById('pr-floor'); if (pf) pf.style.width = (floorDone / 4) * 100 + '%';
    const pb = document.getElementById('pr-bench'); if (pb) pb.style.width = (benchDone / 3) * 100 + '%';

    const signature = SEAT_ORDER.concat(JUDGES).map((r) => stateOf(doc, r)).join(',');
    if (signature !== lastSignature) { lastSignature = signature; lastChange = Date.now(); }

    for (const r of SEAT_ORDER) {
      const st = stateOf(doc, r);
      if ((st === 'returned' || st === 'failed') && !shown.has(r) && !queue.includes(r)) queue.push(r);
    }
    queue.sort((a, b) => SEAT_ORDER.indexOf(a) - SEAT_ORDER.indexOf(b));
    const terminal = job && ['complete', 'incomplete', 'failed'].includes(job.status);
    const judgesMoving = terminal || (job && job.stage === 'judges');
    while (queue.length && (judgesMoving || Date.now() - lastReveal >= MIN_HOLD || shown.size === 0)) {
      const r = queue.shift(); adopt(doc, r); shown.add(r); lastReveal = Date.now();
      if (!judgesMoving) break;
    }
    speakNext();
    if (job && job.stage === 'judges' && job.status === 'running') {
      for (const j of JUDGES) {
        if (['waiting', 'sealed'].includes(stateOf(doc, j))) {
          const lab = slot(j)?.querySelector('.waiting .micro'); if (lab) lab.textContent = stateOf(doc, j) === 'sealed' ? 'Opinion returned, under seal until the bench rules' : 'Deliberating';
        }
      }
    }
    if (terminal) {
      while (queue.length) { const r = queue.shift(); adopt(doc, r); shown.add(r); }
      const anyReturned = JUDGES.some((j) => stateOf(doc, j) === 'returned');
      const reveal = () => {
        for (const j of JUDGES) adopt(doc, j);
        const n = doc.querySelector('.notice'); if (n) document.querySelector('.case-head')?.after(document.importNode(n, true));
        const hr = doc.querySelector('.head-right'); if (hr) document.querySelector('.head-right')?.replaceWith(document.importNode(hr, true));
      };
      if (anyReturned) { mountGavel(); reveal(); } else { reveal(); }
      document.querySelector('.progress-rail')?.remove();
      return;
    }
    if (Date.now() - lastChange > STALL_MS && document.visibilityState === 'visible' && job) {
      const p = document.createElement('p'); p.className = 'notice';
      p.textContent = 'This run has not advanced for a while. Job state: ' + job.status + ', stage ' + job.stage + (job.terminal_reason ? ', ' + job.terminal_reason : '') + '. The page has stopped polling; reload to look again.';
      document.querySelector('.case-head')?.after(p);
      return;
    }
  }
})();
