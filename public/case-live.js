// The live view. A plain static file: nothing here is assembled server-side, and nothing on
// screen is ever text a model did not produce. This script only reveals server-rendered cards;
// placeholder bars are geometry; judge chips are chrome with a per-judge state, never a count.
(async () => {
  const me = document.currentScript;
  const id = me.dataset.id;
  const terminalArrival = me.dataset.terminal === '1';
  const SEAT_ORDER = ['jon', 'tyrion', 'daenerys', 'greyworm'];
  const JUDGES = ['judge-1', 'judge-2', 'judge-3'];
  const MIN_HOLD = 9000, POLL = 5000, STALL_MS = 240000;

  const GAVEL = '<div class="gavel-overlay"><div class="gavel-scene"><div class="gavel-arm"><div class="gavel-handle"></div><div class="gavel-head"></div></div><div class="gavel-base"></div><div class="gavel-podium"></div></div></div>';
  function strikeGavel(atStrike) {
    document.body.insertAdjacentHTML('beforeend', GAVEL);
    const scene = document.querySelector('.gavel-scene');
    setTimeout(() => { scene.classList.add('struck'); if (atStrike) atStrike(); }, 430);
    setTimeout(() => document.querySelector('.gavel-overlay')?.remove(), 2100);
  }
  if (terminalArrival) { strikeGavel(); return; }

  const t0 = Date.now();
  const shown = new Set();
  let lastChange = Date.now(), lastSignature = '', lastReveal = 0;
  const queue = [];

  const mast = document.querySelector('.masthead');
  mast.insertAdjacentHTML('afterend',
    '<div class="live-rail"><span>Elapsed <b id="lr-el">0:00</b></span><span>Calls <b id="lr-calls">0</b> of 20</span><span>Spend <b id="lr-spend">$0.0000</b></span><span id="lr-panel"></span>'
    + '<span class="stagebar"><span class="lab">The Floor</span><span class="seg"><i id="seg-floor"></i></span><span class="lab">The Bench</span><span class="seg"><i id="seg-bench"></i></span></span></div>');
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    document.getElementById('lr-el').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }, 1000);

  const slot = (r) => document.querySelector('.role-slot[data-role="' + r + '"]');
  function holdJudge(j, stateText) {
    const el = slot(j); if (!el) return;
    el.dataset.held = '1';
    let chip = document.querySelector('.judge-status[data-for="' + j + '"]');
    const head = el.querySelector('.card-head');
    const who = head?.querySelector('h3')?.textContent ?? j;
    const model = head?.querySelector('.model')?.textContent ?? '';
    if (!chip) { chip = document.createElement('div'); chip.className = 'judge-status'; chip.dataset.for = j; el.parentNode.insertBefore(chip, el); }
    chip.innerHTML = '<p class="who">' + who + '</p><p class="model-line">' + model + '</p><p class="state">' + stateText + '</p>';
  }
  for (const j of JUDGES) holdJudge(j, 'Awaiting argument');

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
    const res = await fetch(location.pathname + '?poll=1&t=' + Date.now(), { headers: { 'Cache-Control': 'no-store' } });
    if (!res.ok) return null;
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }
  const stateOf = (doc, r) => doc.querySelector('.role-slot[data-role="' + r + '"]')?.dataset.state ?? 'absent';
  function adopt(doc, r) {
    const fresh = doc.querySelector('.role-slot[data-role="' + r + '"]'); const mine = slot(r);
    if (fresh && mine) mine.replaceWith(document.importNode(fresh, true));
  }

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
      document.getElementById('seg-floor').style.width = (SEAT_ORDER.filter((r) => ['returned', 'failed'].includes(stateOf(doc, r))).length / 4) * 100 + '%';
      document.getElementById('seg-bench').style.width = (JUDGES.filter((j) => ['returned', 'failed'].includes(stateOf(doc, j))).length / 3) * 100 + '%';
    }
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
    lightNext();
    if (job && job.stage === 'judges' && job.status === 'running') {
      for (const j of JUDGES) {
        const st = stateOf(doc, j);
        holdJudge(j, st === 'failed' ? 'No opinion will come from this seat' : st === 'returned' ? 'Opinion returned, under seal until the bench rules' : 'Deliberating…');
      }
    }
    if (terminal) {
      while (queue.length) { const r = queue.shift(); adopt(doc, r); shown.add(r); }
      lightNext();
      const reveal = () => {
        document.querySelectorAll('.judge-status').forEach((c) => c.remove());
        for (const j of JUDGES) adopt(doc, j);
        const n = doc.querySelector('.notice'); if (n) document.querySelector('.masthead')?.after(document.importNode(n, true));
        const sl = doc.querySelector('.status-line'); if (sl) document.querySelector('.status-line')?.replaceWith(document.importNode(sl, true));
      };
      const anyReturned = JUDGES.some((j) => stateOf(doc, j) === 'returned');
      if (anyReturned) strikeGavel(reveal); else reveal();
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
