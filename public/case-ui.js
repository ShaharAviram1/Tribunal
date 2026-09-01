// Reason stepper and the global Read all. Loaded on every case page. Client-side state only:
// per-judge reason index and one global read-all flag; the reason index resets to 0 whenever a
// column's markup is replaced, because init runs again on the new nodes.
(() => {
  let readAll = false;
  function initColumn(col) {
    const reasons = [...col.querySelectorAll('.reason')];
    if (!reasons.length) return;
    let idx = 0;
    const show = () => reasons.forEach((r, i) => { r.hidden = !readAll && i !== idx; });
    col.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => {
      idx = (idx + Number(b.dataset.step) + reasons.length) % reasons.length; readAll = readAll && false; syncButtons(); showAll();
    }));
    const ra = col.querySelector('.read-all');
    if (ra) ra.addEventListener('click', () => { readAll = !readAll; syncButtons(); showAll(); });
    col._show = show;
    show();
  }
  function showAll() { document.querySelectorAll('.judge').forEach((c) => c._show && c._show()); }
  function syncButtons() { document.querySelectorAll('.read-all').forEach((b) => b.setAttribute('aria-pressed', String(readAll))); }
  function initAll() { document.querySelectorAll('.judge').forEach(initColumn); syncButtons(); }
  initAll();
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && (n.matches?.('.role-slot') || n.querySelector?.('.judge'))) { (n.matches('.judge') ? [n] : [...n.querySelectorAll('.judge')]).forEach(initColumn); syncButtons(); }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
