// The case page: a courtroom in walnut, stone, and brass, recreated pixel-for-pixel from
// docs/07-design/handoff.md. Pure: data in, HTML out; used by the static render and the live
// page. Hard constraints the markup never breaks: verdicts never combined; the three judge
// columns identical in every visual respect; the verdict largest in its card and identical
// whatever it says; colour marks the seat, never the outcome; waiting states are geometry;
// a failure is shown as a failure, by name, with the other columns intact.

import type { StoredChargeSheet, StoredStance, StoredOpinion, FailureRecord, Reason } from '../protocol/types.ts';
import type { Job } from '../protocol/run.ts';

export type CaseData = {
  chargeSheet: StoredChargeSheet;
  job: Job | null;
  outputs: Record<string, StoredStance | StoredOpinion | FailureRecord | undefined>;
};

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const isFailureRecord = (o: unknown): o is FailureRecord =>
  !!o && typeof o === 'object' && (o as FailureRecord).failed === true;

const ADVOCATE_ORDER = ['jon', 'tyrion', 'daenerys', 'greyworm'] as const;
const JUDGE_ORDER = ['judge-1', 'judge-2', 'judge-3'] as const;
const NAMES: Record<string, string> = { jon: 'Jon Snow', tyrion: 'Tyrion Lannister', daenerys: 'Daenerys Targaryen', greyworm: 'Grey Worm' };
const SEATS: Record<string, 'defense' | 'prosecution'> = { jon: 'defense', tyrion: 'defense', daenerys: 'prosecution', greyworm: 'prosecution' };
const METHOD_LINE = 'Method adapted from published opinions. Not the jurist, and not a prediction of how he would decide.';

function citation(id: string, stances: Map<string, StoredStance>): string {
  const [role] = id.split('.');
  const stance = stances.get(role ?? '');
  const point = stance?.points.find((p) => p.id === id);
  if (!point) return `<p class="cite-unresolved">an argued point that could not be found</p>`;
  return `<details class="cite"><summary><span class="cite-who">${esc(NAMES[role!] ?? role!)}:</span> <span class="cite-claim">${esc(point.claim)}</span></summary><blockquote>${esc(point.support)}</blockquote></details>`;
}

function shimmer(label: string, jobState: string): string {
  return `<div class="waiting"><p class="micro">${esc(label)}</p>
<div class="bars" aria-hidden="true"><span></span><span class="b2"></span><span class="b3"></span></div>
<div class="reserve" aria-hidden="true"></div>
<span class="sr">${esc(label)}. Deliberation is ${esc(jobState)}.</span></div>`;
}

function attemptsDetails(rec: FailureRecord): string {
  const body = rec.attempts.map((a, i) => `attempt ${i + 1}: ${a.outcome}${a.detail ? ` — ${a.detail}` : ''}${a.text ? `\n${a.text}` : '\n(no text returned)'}`).join('\n\n');
  return `<details class="attempts"><summary>Attempts</summary><pre>${esc(body)}</pre></details>`;
}

function advocateFailureCard(rec: FailureRecord, role: string, model: string | undefined): string {
  return `<article class="advocate failed seat-${esc(SEATS[role] ?? 'defense')}">
${advocateHead(role, model)}
<div class="fail-body">
<p class="micro dashed-top">No output from this seat</p>
<p class="fail-title">This seat produced no output.</p>
<p class="fail-note">Nothing returned validated as a stance. The seat has no position, and no position is inferred for it.</p>
${attemptsDetails(rec)}
</div>
</article>`;
}

function judgeFailureColumn(rec: FailureRecord, label: string, model: string | undefined): string {
  return `<article class="judge failed">
${judgeHead(label, model)}
<div class="fail-body grow">
<p class="micro dashed-top">No opinion from this seat</p>
<p class="fail-title fail-title-judge">This seat produced no opinion.</p>
<p class="fail-note">Every attempt failed validation, and nothing in what was returned counts as a verdict.</p>
${attemptsDetails(rec)}
</div>
</article>`;
}

function advocateHead(role: string, model: string | undefined, against = false): string {
  const seat = SEATS[role] ?? 'defense';
  return `<header class="a-head"><h3>${esc(NAMES[role] ?? role)}</h3><p class="seat seat-${esc(seat)}${against ? ' struck' : ''}">${esc(seat)} seat</p><p class="a-model">${esc(model ?? '')}</p></header>`;
}

function judgeHead(label: string, model: string | undefined): string {
  return `<header class="j-head">
<div class="nameplate"><h3>${esc(label)}</h3></div>
<p class="method">${METHOD_LINE}</p>
<p class="j-model">${esc(model ?? '')}</p>
</header>`;
}

function stanceCard(s: StoredStance, models?: Record<string, string>): string {
  const against = s.seat === 'defense' ? s.position === 'not_justified' : s.position === 'justified';
  return `<article class="advocate seat-${esc(s.seat)}">
${advocateHead(s.role_id, models?.[s.role_id], against)}
<div class="pos-block"><p class="micro">Position</p><p class="position">${esc(s.position.replace('_', ' '))}</p></div>
${against ? `<div class="against-seat"><p class="against-line">This seat argued against itself.</p><p class="against-sub">Seated for the ${esc(s.seat)}, it reached the opposite conclusion.</p></div>` : ''}
<div class="points"><p class="micro">${s.points.length} points as argued</p>
${s.points.map((p) => `<details class="point"><summary>${esc(p.claim)}</summary><blockquote>${esc(p.support)}</blockquote></details>`).join('\n')}
</div>
</article>`;
}

function reasonBlock(r: Reason, i: number, total: number, stances: Map<string, StoredStance>): string {
  return `<div class="reason" data-reason="${i}">
<p class="micro">Reason ${i + 1} of ${total}</p>
<p class="reason-text">${esc(r.text)}</p>
${r.relies_on.length ? `<p class="micro relies">Relies on</p>\n${r.relies_on.map((id) => citation(id, stances)).join('\n')}` : ''}
</div>`;
}

function opinionColumn(o: StoredOpinion, stances: Map<string, StoredStance>, models?: Record<string, string>): string {
  const cites = o.reasons.reduce((n, r) => n + r.relies_on.length, 0) + o.against.relies_on.length;
  return `<article class="judge">
${judgeHead(o.label, models?.[o.role_id])}
<div class="verdict-wrap"><div class="verdict-block"><p class="micro">Verdict</p><p class="verdict">${esc(o.verdict.replace('_', ' '))}</p></div>
<div class="stepper"><p class="micro">Reasons</p><span class="step-controls"><button class="step-btn" data-step="-1" aria-label="previous reason">‹</button><button class="step-btn" data-step="1" aria-label="next reason">›</button><button class="read-all" data-readall>Read all</button></span></div>
<div class="reasons">
${o.reasons.map((r, i) => reasonBlock(r, i, o.reasons.length, stances)).join('\n')}
</div></div>
<footer class="j-foot"><p class="micro">Strongest consideration against this verdict</p>
<p class="against-text">${esc(o.against.text)}</p>
${o.against.relies_on.map((id) => citation(id, stances)).join('\n')}
<p class="counts">${o.reasons.length} reasons · ${cites} citations</p></footer>
</article>`;
}

function roleSection(out: CaseData['outputs'][string], role: string, title: string, stances: Map<string, StoredStance>, kind: 'stance' | 'opinion', job: Job | null, models?: Record<string, string>): string {
  const jobState = job ? job.status : 'not started';
  const wrap = (state: string, inner: string) => `<div class="role-slot" data-role="${esc(role)}" data-kind="${kind}" data-state="${state}">${inner}</div>`;
  if (isFailureRecord(out)) return wrap('failed', kind === 'stance' ? advocateFailureCard(out, role, models?.[role]) : judgeFailureColumn(out, title, models?.[role]));
  if (out === undefined) {
    const stopped = job !== null && ['incomplete', 'failed'].includes(job.status);
    if (kind === 'stance') {
      return wrap('waiting', `<article class="advocate waiting-card seat-${esc(SEATS[role] ?? 'defense')}">${advocateHead(role, models?.[role])}${shimmer('Yet to take the floor', jobState)}</article>`);
    }
    const label = stopped ? 'Never convened' : (job && job.stage === 'judges' ? 'Deliberating' : 'Awaiting argument');
    return wrap('waiting', `<article class="judge waiting-card">${judgeHead(title, models?.[role])}${shimmer(label, jobState)}</article>`);
  }
  return wrap('returned', kind === 'stance' ? stanceCard(out as StoredStance, models) : opinionColumn(out as StoredOpinion, stances, models));
}

function panelName(models: Record<string, string> | undefined): string {
  if (!models || Object.keys(models).length === 0) return '';
  const distinct = new Set(Object.values(models)).size;
  return distinct === 1 ? `One model for all seven roles: ${[...new Set(Object.values(models))][0]}` : `${distinct} distinct models, one per role`;
}

export function renderCasePage(data: CaseData): string {
  const cs = data.chargeSheet;
  const job = data.job;
  const stances = new Map<string, StoredStance>();
  for (const r of ADVOCATE_ORDER) { const o = data.outputs[r]; if (o && !isFailureRecord(o)) stances.set(r, o as StoredStance); }
  const stageWord = !job ? 'not started' : job.status === 'complete' ? 'Concluded' : job.status === 'running' ? (job.stage === 'judges' ? 'The bench is deliberating' : 'The floor is speaking') : job.status;
  const stoppedNotice = job && job.status === 'incomplete' && job.stage === 'advocates'
    ? `<p class="notice">This deliberation is incomplete: it stopped before the bench was convened. The floor is shown as filed. No judge was called, and no verdict exists for this run.</p>`
    : job && ['incomplete', 'failed'].includes(job.status)
      ? `<p class="notice">This deliberation is ${esc(job.status)}: ${esc(job.terminal_reason ?? '')}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cs.case_id)}: The Realm v. ${esc(cs.accused)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,600;6..96,700&family=Spectral:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="atmosphere" aria-hidden="true"></div>
<header class="case-head">
<span class="watermark" aria-hidden="true">${esc(cs.case_id)}</span>
<div class="head-left">
<p class="micro crumb"><a href="/">The Tribunal</a> · Docket ${esc(cs.case_id)}</p>
<h1>The Realm v. ${esc(cs.accused)}</h1>
<p class="head-sub">Accused ${esc(cs.accused)} · Deceased ${esc(cs.deceased)}. The panel judges the record as filed and does not combine its opinions.</p>
</div>
<div class="head-right micro">
<p>${esc(stageWord)}</p>
<p>${esc(panelName(job?.models))}</p>
<p class="head-meta" data-meta>Calls ${job ? job.calls : 0} of 20</p>
</div>
</header>
${stoppedNotice}
<section id="opinions"><div class="section-head"><h2>The Bench</h2><p class="section-note">Three judicial methods, each ruling alone on the same record. Presented side by side; not combined.</p></div>
<div class="plinth"><div class="bench-grid">${JUDGE_ORDER.map((r) => roleSection(data.outputs[r], r, (data.outputs[r] as StoredOpinion | undefined)?.label ?? r.replace('judge-', 'Judge '), stances, 'opinion', job, job?.models)).join('\n')}</div></div></section>
<hr class="rail">
<section id="advocates"><div class="section-head"><h2>The Floor</h2><p class="section-note">The seat fixes a procedural role, not a conclusion. Each advocate states the position it actually reached.</p></div>
<div class="floor-grid">${ADVOCATE_ORDER.map((r) => roleSection(data.outputs[r], r, NAMES[r] ?? r, stances, 'stance', job, job?.models)).join('\n')}</div></section>
<section class="sheet">
<div class="sheet-left">
<p class="micro">Act alleged</p><p class="act">${esc(cs.act_alleged)}</p>
<p class="micro">Question for judgment</p><p class="question">${esc(cs.question)}</p>
<p class="scope">${esc(cs.scope_note)}</p>
</div>
<div class="sheet-right">
<p class="micro">Agreed factual record</p>
${cs.agreed_record.map((x, i) => `<div class="rec-row"><span class="rec-n">${String(i + 1).padStart(2, '0')}</span><span class="rec-t">${esc(x)}</span></div>`).join('\n')}
<details class="background"><summary>Background for readers new to the story</summary><p>${esc(cs.base_premises)}</p></details>
</div>
</section>
<footer class="page-foot"><span>A fictional proceeding; the panel judges the record as filed.</span><span>No opinion is combined with another.</span></footer>
<p class="guard-inline">A fictional proceeding. Each judge adapts a judicial method from a real jurist's published opinions; no judge represents the jurist or predicts how they would decide.</p>
<script src="/case-ui.js" defer></script>
</body>
</html>`;
}

const CSS = `
:root{
--ground:#181008;--ground2:#0d0906;--card:#1c1510;--card2:#261d14;--edge:#3b2e20;--edge2:#54412b;--rule:#35291c;
--card-ink:#f2ead9;--card-ink2:#a3937a;--card-ink3:#776650;--page-ink:#f2ead9;--page-ink2:#a3937a;--page-ink3:#776650;
--accent:#c9a227;--accent-soft:rgba(201,162,39,.35);--defense:#8ba0b5;--prosecution:#b5806a;--sheen:255,240,205;--r:3px;
--display:"Bodoni Moda",Didot,Georgia,serif;--text:Spectral,Georgia,serif;--mono:"JetBrains Mono",ui-monospace,monospace;
--wood:repeating-linear-gradient(93deg,rgba(255,236,196,.075) 0 1px,rgba(0,0,0,0) 1px 4px,rgba(0,0,0,.11) 4px 5px,rgba(0,0,0,0) 5px 11px,rgba(255,236,196,.05) 11px 13px,rgba(0,0,0,0) 13px 19px,rgba(0,0,0,.07) 19px 21px,rgba(0,0,0,0) 21px 29px),repeating-linear-gradient(88deg,rgba(0,0,0,.05) 0 2px,rgba(0,0,0,0) 2px 47px);
--stone:linear-gradient(112deg,rgba(226,232,240,.055) 0%,rgba(226,232,240,0) 9%,rgba(226,232,240,.03) 13%,rgba(226,232,240,0) 21%,rgba(0,0,0,.22) 44%,rgba(226,232,240,.045) 49%,rgba(226,232,240,0) 58%,rgba(0,0,0,.16) 71%,rgba(226,232,240,.028) 78%,rgba(226,232,240,0) 88%,rgba(226,232,240,.038) 93%,rgba(226,232,240,0) 100%),linear-gradient(28deg,rgba(255,255,255,.02) 0%,rgba(255,255,255,0) 40%,rgba(0,0,0,.14) 100%);
--lift:inset 0 1px 0 rgba(240,222,180,.075),0 2px 3px rgba(0,0,0,.5),0 30px 60px -34px rgba(0,0,0,1);
}
*{box-sizing:border-box}
body{margin:0 auto;max-width:1560px;padding:196px 34px 60px;font:16.5px/1.58 var(--text);color:var(--page-ink);
background:radial-gradient(110% 62% at 50% -6%,var(--accent-soft) 0%,rgba(0,0,0,0) 52%),var(--stone),radial-gradient(150% 128% at 50% -8%,var(--ground) 0%,var(--ground) 34%,var(--ground2) 100%);
background-color:var(--ground2);background-attachment:fixed;text-wrap:pretty}
.atmosphere{position:fixed;inset:0;z-index:30;pointer-events:none;
background:radial-gradient(58% 42% at 50% -4%,rgba(var(--sheen),.10) 0%,rgba(var(--sheen),.03) 34%,rgba(var(--sheen),0) 62%);
box-shadow:inset 0 0 200px 10px rgba(0,0,0,.5),inset 0 -160px 150px -130px rgba(0,0,0,.85)}
.micro{font:400 10px var(--mono);letter-spacing:.25em;text-transform:uppercase;color:var(--card-ink3);margin:.3em 0}
.case-head{position:relative;display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:20px;border-bottom:3px double var(--accent-soft);padding-bottom:20px}
.watermark{position:absolute;right:-6px;top:-58px;font:700 210px/1 var(--display);color:rgba(255,255,255,.028);pointer-events:none;user-select:none}
.crumb{letter-spacing:.3em;font-size:11px}.crumb a{color:var(--page-ink3);text-decoration:none}
h1{font:700 clamp(40px,4.8vw,70px)/0.96 var(--display);letter-spacing:-.02em;margin:.1em 0;text-shadow:0 2px 0 rgba(0,0,0,.5)}
.head-sub{font-size:15px;color:var(--page-ink2);margin:.3em 0}
.head-right{text-align:right;font:400 11px/1.7 var(--mono);color:var(--page-ink3);letter-spacing:.06em}
.head-right p{margin:0}
.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:20px;border-bottom:3px double var(--accent-soft);margin:46px 0 26px;padding-bottom:8px}
h2{font:600 26px var(--display);letter-spacing:.22em;text-transform:uppercase;margin:0}
.section-note{font-size:14px;color:var(--page-ink3);text-align:right;margin:0;font-style:italic}
.plinth{padding:26px 26px 30px;border:1px solid var(--edge);border-top-color:var(--edge2);border-radius:var(--r);
background:var(--wood),linear-gradient(180deg,rgba(240,222,180,.05),rgba(0,0,0,.28));
box-shadow:inset 0 1px 0 rgba(240,222,180,.075),inset 0 0 0 1px rgba(0,0,0,.35),inset 0 -30px 50px -30px rgba(0,0,0,.72),inset 0 0 0 8px rgba(201,162,39,.28),inset 0 0 0 9px rgba(0,0,0,.45)}
.bench-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;align-items:stretch}
.floor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;align-items:stretch}
@media (max-width:1080px){.bench-grid{grid-template-columns:1fr}.floor-grid{grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}.watermark{display:none}body{padding:60px 18px 40px}}
.role-slot{min-width:0;display:flex}
.role-slot>article{width:100%}
.judge{background:var(--card);border:1px solid var(--edge);border-top:2px solid var(--accent);border-radius:var(--r);box-shadow:var(--lift);display:flex;flex-direction:column;min-height:420px}
.j-head{padding:22px 24px 18px;border-bottom:1px solid var(--accent-soft);background:var(--wood),linear-gradient(180deg,var(--card2),var(--card));box-shadow:inset 0 1px 0 rgba(240,222,180,.09)}
.nameplate{padding:11px 14px;background:linear-gradient(178deg,rgba(var(--sheen),.10),rgba(0,0,0,.22));border-top:1px solid var(--accent-soft);border-bottom:1px solid rgba(0,0,0,.55);box-shadow:inset 0 1px 0 rgba(var(--sheen),.10),inset 0 -1px 0 rgba(0,0,0,.4)}
.nameplate h3{font:600 27px/1.05 var(--display);margin:0;text-shadow:0 1px 0 rgba(0,0,0,.7),0 -1px 0 rgba(var(--sheen),.10)}
.method{font-size:12.5px;line-height:1.5;color:var(--card-ink2);margin:10px 0 0}
.j-model{font:400 11px/1.4 var(--mono);color:var(--card-ink);overflow-wrap:anywhere;border-top:1px solid var(--rule);padding-top:10px;margin:10px 0 0}
.verdict-wrap{flex:1;padding:0 24px}
.verdict-block{border-bottom:1px solid var(--rule);padding:24px 0 22px}
.verdict-block .micro{letter-spacing:.3em}
.verdict{font:700 clamp(44px,4.8vw,72px)/0.9 var(--display);letter-spacing:-.03em;margin:.08em 0 0;text-shadow:0 2px 0 rgba(0,0,0,.65)}
.stepper{display:flex;justify-content:space-between;align-items:center;padding:16px 0 10px}
.stepper .micro{white-space:nowrap;margin:0}
.step-controls{display:flex;gap:6px;align-items:center}
.step-btn{font:400 11px var(--mono);border:1px solid var(--rule);background:transparent;color:var(--card-ink2);padding:5px 9px;border-radius:var(--r);cursor:pointer}
.read-all{font:400 10px var(--mono);letter-spacing:.15em;text-transform:uppercase;border:1px solid var(--rule);background:transparent;color:var(--card-ink3);padding:5px 8px;border-radius:var(--r);cursor:pointer}
.read-all[aria-pressed="true"]{border-color:var(--accent-soft);color:var(--card-ink)}
.reason{padding:6px 0 14px}
.reason-text{font-size:16.5px;line-height:1.58;margin:.3em 0;color:var(--card-ink)}
.relies{margin-top:10px}
.cite{border-top:1px solid var(--rule);padding:8px 0 2px;margin:2px 0}
.cite summary{cursor:pointer;list-style:none;display:flex;gap:8px;align-items:baseline}
.cite summary::-webkit-details-marker{display:none}
.cite-who{font:600 13.5px var(--display);color:var(--card-ink);white-space:nowrap}
.cite-claim{font-size:13.5px;line-height:1.45;color:var(--card-ink2)}
.cite blockquote,.point blockquote{margin:8px 0 6px 2px;padding-left:12px;border-left:1px solid var(--edge2);font-size:13.5px;line-height:1.55;color:var(--card-ink2)}
.cite-unresolved{font-size:13.5px;font-style:italic;color:var(--card-ink3)}
.j-foot{margin-top:auto;padding:18px 24px 22px;border-top:1px solid var(--rule)}
.against-text{font-size:14.5px;line-height:1.55;color:var(--card-ink2);margin:.4em 0}
.counts{font:400 10.5px var(--mono);letter-spacing:.1em;color:var(--card-ink3);margin:12px 0 0}
.advocate{background:var(--wood),linear-gradient(180deg,var(--card) 0%,rgba(0,0,0,.22) 100%);background-color:var(--card);border:1px solid var(--edge);border-radius:var(--r);box-shadow:inset 0 1px 0 rgba(255,236,190,.05),0 24px 44px -30px rgba(0,0,0,1);display:flex;flex-direction:column}
.advocate.seat-defense{border-top:2px solid var(--defense)}
.advocate.seat-prosecution{border-top:2px solid var(--prosecution)}
.a-head{padding:20px 20px 14px;border-bottom:1px solid var(--rule)}
.a-head h3{font:600 23px/1.08 var(--display);margin:0}
.seat{font:400 10px var(--mono);letter-spacing:.2em;text-transform:uppercase;margin:.5em 0 0}
.seat.seat-defense{color:var(--defense)}
.seat.seat-prosecution{color:var(--prosecution)}
.seat.struck{text-decoration:line-through}
.a-model{font:400 10.5px/1.4 var(--mono);color:var(--card-ink2);overflow-wrap:anywhere;margin:.6em 0 0}
.pos-block{padding:18px 20px 8px}
.position{font:700 30px/1 var(--display);margin:.15em 0 0}
.against-seat{margin:0 20px;border-top:1px solid var(--card-ink);padding:10px 0 4px}
.against-line{font-size:14px;line-height:1.4;font-weight:600;color:var(--card-ink);margin:0}
.against-sub{font-size:13px;color:var(--card-ink2);margin:.3em 0 0}
.points{flex:1;padding:14px 20px 20px}
.point{border-top:1px solid var(--rule);padding:8px 0}
.point summary{cursor:pointer;list-style:none;font-size:14.5px;line-height:1.45;color:var(--card-ink)}
.point summary::-webkit-details-marker{display:none}
.rail{border:none;margin:58px 0 0;height:8px;border-top:1px solid var(--accent-soft);border-bottom:1px solid var(--edge);background:linear-gradient(180deg,rgba(201,162,39,.22),rgba(201,162,39,.06) 40%,rgba(0,0,0,.45));box-shadow:0 1px 0 rgba(240,222,180,.05)}
.waiting{padding:18px 20px 20px;display:flex;flex-direction:column;flex:1}
.judge .waiting{padding:22px 24px}
.bars span{display:block;height:11px;border-radius:2px;background:linear-gradient(90deg,var(--rule) 25%,var(--edge2) 50%,var(--rule) 75%);background-size:200% 100%;animation:shimmer 1.6s linear infinite;margin:10px 0}
.bars .b2{width:86%}.bars .b3{width:61%}
@keyframes shimmer{from{background-position:200% 0}to{background-position:0 0}}
.reserve{margin-top:auto;border:1px dashed var(--rule);border-radius:var(--r);min-height:64px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.waiting-card{min-height:300px}
.failed{border-style:dashed}
.fail-body{padding:16px 20px 20px;display:flex;flex-direction:column}
.grow{flex:1}
.dashed-top{border-top:1px dashed var(--edge2);padding-top:12px}
.fail-title{font:600 21px/1.2 var(--display);margin:.3em 0}
.fail-title-judge{font-size:24px}
.fail-note{font-size:13.5px;line-height:1.5;color:var(--card-ink2);margin:.2em 0 .8em}
.attempts summary{cursor:pointer;font:400 10px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--card-ink3);list-style:none}
.attempts summary::-webkit-details-marker{display:none}
.attempts pre{font:400 11px/1.5 var(--mono);white-space:pre-wrap;background:var(--card2);border:1px solid var(--rule);border-radius:var(--r);padding:10px 12px;color:var(--card-ink2)}
.notice{margin:20px 0 0;padding:14px 18px;border:1px solid var(--edge2);border-left:3px solid var(--accent);background:var(--card);border-radius:var(--r);font-size:14.5px}
.sheet{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:46px 0 0;padding:32px 34px;border:1px solid var(--edge);border-top-color:var(--accent-soft);border-radius:var(--r);background:var(--wood),linear-gradient(180deg,var(--card2),var(--card) 34%,rgba(0,0,0,.2));background-color:var(--card);box-shadow:var(--lift)}
@media (max-width:900px){.sheet{grid-template-columns:1fr}}
.act{font:400 21px/1.45 var(--display);margin:.3em 0 1.2em}
.question{font-size:15.5px;color:var(--card-ink2);margin:.3em 0 1.2em}
.scope{font-size:14px;color:var(--card-ink2);font-style:italic}
.rec-row{display:grid;grid-template-columns:34px 1fr;gap:6px;border-top:1px solid var(--rule);padding:9px 0}
.rec-n{font:400 11px var(--mono);color:var(--card-ink3)}
.rec-t{font-size:14.5px;line-height:1.55;color:var(--card-ink)}
.background{margin-top:16px}
.background summary{cursor:pointer;font:400 10px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--card-ink3);list-style:none}
.background summary::-webkit-details-marker{display:none}
.background p{font-size:14px;line-height:1.6;color:var(--card-ink2)}
.page-foot{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--edge2);margin-top:46px;padding-top:14px;font:400 11px var(--mono);letter-spacing:.08em;color:var(--page-ink3)}
.guard-inline{font:400 12px/1.6 var(--mono);color:var(--page-ink3);border-left:1px solid var(--edge2);padding-left:14px;margin:26px 0 0;max-width:64ch}
@keyframes fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.role-slot[data-state="returned"]>article{animation:fade-up .7s ease both}
a{color:var(--accent)}
`;
