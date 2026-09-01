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

  // The gavel is timed by the video itself, not by a clock racing a 3 MB download: the veil
  // holds solid black until the clip is actually playing, the word rises with the strike, and
  // the fade begins when the media fragment ends. A hidden element buffers the clip during the
  // bench stage so the strike starts the instant it is called for.
  let buffered = null;
  function bufferGavel() {
    if (buffered) return;
    buffered = document.createElement('video');
    buffered.src = '/gavel.mp4#t=2.4,4.6';
    buffered.muted = true; buffered.playsInline = true; buffered.preload = 'auto';
    buffered.load();
  }
  function mountGavel(atStrike) {
    const veil = document.createElement('div');
    veil.className = 'gavel-veil held';
    const v = buffered ?? document.createElement('video');
    if (!buffered) { v.src = '/gavel.mp4#t=2.4,4.6'; v.muted = true; v.playsInline = true; }
    v.autoplay = true; v.muted = true; v.playsInline = true;
    veil.appendChild(v);
    veil.insertAdjacentHTML('beforeend', '<div class="gavel-vignette"></div><p class="gavel-word">The bench has ruled</p>');
    document.body.appendChild(veil);
    // Choreography anchored to the measured impact frame (t=3.2s absolute: hammer meets block,
    // smoke). The clip becomes visible as it plays; the word and the verdict reveal land ON the
    // bang, not two seconds ahead of it; the fade rides out on the smoke. Floors keep a slow or
    // failed load from ever holding the verdicts hostage.
    const IMPACT = 3.15, FADE_AT = 4.45;
    let shown2 = false, struck = false, faded = false;
    const show = () => { if (shown2) return; shown2 = true; veil.classList.remove('held'); };
    const strike = () => { if (struck) return; struck = true; show(); veil.classList.add('rolling'); if (atStrike) atStrike(); };
    const done = () => { if (faded) return; faded = true; strike(); veil.classList.add('fading'); setTimeout(() => veil.remove(), 900); };
    v.addEventListener('playing', show, { once: true });
    v.addEventListener('timeupdate', () => {
      if (v.currentTime >= IMPACT) strike();
      if (v.currentTime >= FADE_AT) done();
    });
    v.addEventListener('pause', done, { once: true });  // a media fragment pauses at its end time
    v.addEventListener('ended', done, { once: true });
    v.addEventListener('error', () => done(), { once: true });
    setTimeout(() => { strike(); }, 3000);              // floor: reveal even if the clip never plays
    setTimeout(() => { if (document.body.contains(veil)) done(); }, 8000);
    v.play?.();
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
      bufferGavel();
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
