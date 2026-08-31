// Renders one deliberation as the case page: a courtroom, the bench above, the floor below.
// Pure: data in, HTML out. Used by the static render (fresh clone, file store) and by the live
// page. No framework, no client bundle; the live script only reveals what this renderer made.
// Three constraints the design never breaks: the verdict is the largest element in its card and
// typographically identical whatever it says; the three judge columns are identical in every
// visual respect; colour marks the seat, never the outcome.

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
const SEATS: Record<string, string> = { jon: 'defense', tyrion: 'defense', daenerys: 'prosecution', greyworm: 'prosecution' };

function citation(id: string, stances: Map<string, StoredStance>): string {
  const [role] = id.split('.');
  const stance = stances.get(role ?? '');
  const point = stance?.points.find((p) => p.id === id);
  if (!point) return `<p class="cite cite-unresolved">an argued point that could not be found</p>`;
  return `<details class="cite"><summary><span class="cite-who">${esc(NAMES[role!] ?? role!)}</span> ${esc(point.claim)}</summary><blockquote>${esc(point.support)}</blockquote></details>`;
}

function failureCard(rec: FailureRecord, roleTitle: string, model: string | undefined): string {
  // The one door for a failure record. It never reaches stance or opinion markup.
  return `<article class="failure">
<header class="card-head"><h3>${esc(roleTitle)}</h3><p class="seat">no output</p>${model ? `<p class="model">${esc(model)}</p>` : ''}</header>
<p class="failure-label">This seat produced no output.</p>
<p>${esc(rec.reason)}</p>
<details><summary>What the model actually returned, attempt by attempt</summary>
<p class="explain">The text below failed validation. It is not a stance and not an opinion, and nothing in it counts as this role's position.</p>
${rec.attempts.map((a, i) => `<details><summary>Attempt ${i + 1}: ${esc(a.outcome)}${a.detail ? `, ${esc(a.detail)}` : ''}</summary>${a.text ? `<pre>${esc(a.text)}</pre>` : '<p>No text was returned.</p>'}</details>`).join('\n')}
</details>
</article>`;
}

function stanceCard(s: StoredStance, models?: Record<string, string>): string {
  const against = s.seat === 'defense' ? s.position === 'not_justified' : s.position === 'justified';
  return `<article class="stance seat-${esc(s.seat)}">
<header class="card-head"><h3>${esc(NAMES[s.role_id] ?? s.role_id)}</h3><p class="seat">${esc(s.seat)} seat</p><p class="model">${esc(models?.[s.role_id] ?? '')}</p></header>
<p class="position">${esc(s.position.replace('_', ' '))}</p>
${against ? '<p class="against-seat">Against this seat</p>' : ''}
<ul class="points">
${s.points.map((p) => `<li><details class="point"><summary>${esc(p.claim)}</summary><blockquote>${esc(p.support)}</blockquote></details></li>`).join('\n')}
</ul>
</article>`;
}

function reasonItem(r: Reason, stances: Map<string, StoredStance>): string {
  return `<li><p>${esc(r.text)}</p><div class="cites">${r.relies_on.map((id) => citation(id, stances)).join('\n')}</div></li>`;
}

function opinionColumn(o: StoredOpinion, stances: Map<string, StoredStance>, models?: Record<string, string>): string {
  const cites = o.reasons.reduce((n, r) => n + r.relies_on.length, 0) + o.against.relies_on.length;
  return `<article class="opinion">
<header class="card-head"><h3>${esc(o.label)}</h3><p class="seat">ruling alone</p><p class="model">${esc(models?.[o.role_id] ?? '')}</p></header>
<div class="verdict-band"><p class="verdict-word">Verdict</p><p class="verdict">${esc(o.verdict.replace('_', ' '))}</p></div>
<h4>Reasons</h4>
<ol class="reasons">
${o.reasons.map((r) => reasonItem(r, stances)).join('\n')}
</ol>
<h4>Strongest consideration against this verdict</h4>
<ul class="reasons against-list">${reasonItem(o.against, stances)}</ul>
<p class="card-foot">${o.reasons.length} reasons · ${cites} citations</p>
</article>`;
}

function roleSection(out: CaseData['outputs'][string], role: string, title: string, stances: Map<string, StoredStance>, kind: 'stance' | 'opinion', jobState: string, models?: Record<string, string>): string {
  const wrap = (state: string, inner: string) => `<div class="role-slot" data-role="${esc(role)}" data-kind="${kind}" data-state="${state}">${inner}</div>`;
  if (isFailureRecord(out)) return wrap('failed', failureCard(out, title, models?.[role]));
  if (out === undefined) {
    const waiting = kind === 'stance'
      ? `<article class="stance pending seat-${esc(SEATS[role] ?? 'defense')}"><header class="card-head"><h3>${esc(title)}</h3><p class="seat">${esc(SEATS[role] ?? '')} seat</p><p class="model">${esc(models?.[role] ?? '')}</p></header><p class="waiting">Yet to take the floor. Deliberation is ${esc(jobState)}.</p></article>`
      : `<article class="opinion pending"><header class="card-head"><h3>${esc(title)}</h3><p class="seat">ruling alone</p><p class="model">${esc(models?.[role] ?? '')}</p></header><p class="waiting">Awaiting argument. Deliberation is ${esc(jobState)}.</p></article>`;
    return wrap('absent', waiting);
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
  const jobState = data.job ? data.job.status : 'not started';
  const stances = new Map<string, StoredStance>();
  for (const r of ADVOCATE_ORDER) { const o = data.outputs[r]; if (o && !isFailureRecord(o)) stances.set(r, o as StoredStance); }
  const incomplete = data.job && ['incomplete', 'failed'].includes(data.job.status)
    ? `<p class="notice">This deliberation is ${esc(data.job.status)}: ${esc(data.job.terminal_reason ?? '')}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cs.case_id)}: The Realm v. ${esc(cs.accused)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,600;6..96,700&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<header class="masthead">
<p class="crumbs"><a href="/">← All cases</a></p>
<p class="tribunal-name">The Tribunal</p>
<h1>Case ${esc(cs.case_id)} · The Realm v. ${esc(cs.accused)}</h1>
<p class="status-line">Accused ${esc(cs.accused)} · Deceased ${esc(cs.deceased)} · ${esc(jobState)}${data.job?.models ? ` · ${esc(panelName(data.job.models))}` : ''}</p>
<p class="guard">A fictional proceeding. Each judge adapts a judicial method from a real jurist's published opinions; no judge represents the jurist or predicts how they would decide. The panel judges the record as filed.</p>
</header>
${incomplete}
<section id="opinions"><h2>The Bench</h2><p class="explain">Three judicial methods, each ruling alone on the same record. The opinions are presented side by side and are not combined.</p>
<div class="grid grid-3">${JUDGE_ORDER.map((r) => roleSection(data.outputs[r], r, (data.outputs[r] as StoredOpinion | undefined)?.label ?? r.replace('judge-', 'Judge '), stances, 'opinion', jobState, data.job?.models)).join('\n')}</div></section>
<hr class="rail">
<section id="advocates"><h2>The Floor</h2><p class="explain">Each seat fixes a procedural role, not a conclusion; each advocate states the position it actually reached. Positions are shown per advocate.</p>
<div class="grid grid-4">${ADVOCATE_ORDER.map((r) => roleSection(data.outputs[r], r, NAMES[r] ?? r, stances, 'stance', jobState, data.job?.models)).join('\n')}</div></section>
<details id="sheet"><summary><h2>The charge sheet, the background, and the agreed record</h2></summary>
<h3>Act alleged</h3><p>${esc(cs.act_alleged)}</p>
<h3>Question for judgment</h3><p>${esc(cs.question)}</p>
<h3>Background for readers new to the story</h3><p>${esc(cs.base_premises)}</p>
<h3>Agreed factual record</h3><ol>${cs.agreed_record.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
</details>
<footer><p>${esc(cs.scope_note)}</p><p class="guard-foot">A fictional proceeding; the panel judges the record as filed.</p></footer>
</body>
</html>`;
}

const CSS = `
:root{
  --ground:#14100c;--panel:#1d1712;--hairline:#3a2f22;--ink:#efe7d8;--ink2:#9b8d76;--muted:#7a6b55;
  --brass:#c9a227;--defense:#7d8fa3;--prosecution:#a3705d;
  --display:"Bodoni Moda",Didot,"Playfair Display",Georgia,serif;
  --text:Spectral,Georgia,"Times New Roman",serif;
}
*{box-sizing:border-box}
body{margin:0 auto;max-width:82rem;padding:1rem 1.5rem 2rem;font:16px/1.6 var(--text);background:var(--ground);color:var(--ink)}
.masthead{border-bottom:3px double var(--brass);padding-bottom:.8rem;margin-bottom:1.2rem}
.tribunal-name{font-family:var(--display);font-size:.95rem;letter-spacing:.35em;text-transform:uppercase;color:var(--brass);margin:.2rem 0 0}
h1{font-family:var(--display);font-weight:700;font-size:clamp(1.5rem,4vw,2.4rem);margin:.15rem 0}
.status-line{color:var(--ink2);margin:.2rem 0;font-size:.95rem}
h2{font-family:var(--display);font-variant:small-caps;letter-spacing:.12em;font-size:1.5rem;border-bottom:1px solid var(--hairline);padding-bottom:.25rem}
h3{font-family:var(--display);margin:.1rem 0;font-size:1.25rem}
h4{font-family:var(--display);font-variant:small-caps;letter-spacing:.06em;margin:.9rem 0 .3rem;color:var(--ink2)}
.crumbs{margin:.1rem 0}.crumbs a{color:var(--ink2)}
.grid{display:grid;gap:1rem;align-items:stretch}
.grid-4{grid-template-columns:repeat(auto-fit,minmax(15.5rem,1fr))}
.grid-3{grid-template-columns:repeat(auto-fit,minmax(19rem,1fr))}
article{background:var(--panel);border:1px solid var(--hairline);border-radius:.45rem;padding:.9rem 1.1rem;height:100%}
.role-slot{height:100%}
.stance.seat-defense{border-top:4px solid var(--defense)}
.stance.seat-prosecution{border-top:4px solid var(--prosecution)}
.opinion{border-top:4px solid var(--brass)}
.card-head{min-height:5.4rem;border-bottom:1px solid var(--hairline);margin-bottom:.6rem;padding-bottom:.4rem}
.seat{font-size:.85em;font-style:italic;color:var(--ink2);margin:.15rem 0}
.seat-defense .seat{color:var(--defense)}
.seat-prosecution .seat{color:var(--prosecution)}
.model{font-size:.85em;color:var(--ink2);margin:.15rem 0;font-family:ui-monospace,monospace;overflow-wrap:anywhere;min-height:1.2em}
.verdict-band{border-top:1px solid var(--brass);border-bottom:1px solid var(--brass);margin:.6rem 0 .4rem;padding:.5rem 0 .6rem;text-align:center}
.verdict-word{font-family:var(--display);font-variant:small-caps;letter-spacing:.3em;font-size:.85rem;color:var(--ink2);margin:0}
.verdict{font-family:var(--display);font-weight:700;font-size:clamp(2rem,3vw,2.9rem);line-height:1.1;margin:.1rem 0 0;font-variant:small-caps}
.position{font-family:var(--display);font-weight:600;font-size:1.4rem;font-variant:small-caps;margin:.4rem 0 .2rem}
.against-seat{display:inline-block;border:1px solid var(--brass);color:var(--brass);border-radius:.3rem;padding:.1rem .55rem;font-size:.78em;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:.1rem 0 .4rem}
.reasons{margin:.2rem 0;padding-left:1.3rem}
.reasons>li{margin:.6rem 0}
.reasons>li>p{margin:.2rem 0}
.against-list{list-style:none;padding-left:.2rem}
.cites{margin:.25rem 0 .1rem}
.cite{margin:.15rem 0 .15rem 1rem;font-size:.9em;color:var(--ink2)}
.cite summary{cursor:pointer;list-style:none}
.cite summary::before{content:'» ';color:var(--brass)}
.cite-who{font-family:var(--display);font-weight:600}
.cite-unresolved{font-style:italic}
.card-foot{border-top:1px solid var(--hairline);margin:.8rem 0 0;padding-top:.4rem;font-size:.85em;color:var(--muted)}
.points{list-style:none;margin:.4rem 0;padding:0}
.points>li{margin:.45rem 0}
.point summary{cursor:pointer;list-style:none}
.point summary::before{content:'✠ ';color:var(--brass);opacity:.8}
blockquote{margin:.4rem 0 .4rem 1.1rem;padding-left:.7rem;border-left:3px solid var(--hairline);color:var(--ink2)}
details#sheet{border:1px solid var(--hairline);background:var(--panel);border-radius:.45rem;padding:.4rem 1rem;margin:1.4rem 0}
details#sheet summary{cursor:pointer}
details#sheet summary h2{display:inline;border:none;font-size:1.15rem}
.rail{border:none;border-top:3px double var(--brass);margin:1.6rem 0}
.waiting{font-style:italic;color:var(--ink2)}
.failure{border-style:dashed;border-top:4px dashed var(--muted)}
.failure-label{font-weight:600}
.failure pre{white-space:pre-wrap;font-size:.85em;color:var(--ink2)}
.notice{border:2px dashed var(--brass);border-radius:.4rem;padding:.5rem 1rem;font-weight:600}
.explain,.scope{font-style:italic;color:var(--ink2)}
.guard{font-size:.88em;border:1px solid var(--hairline);background:var(--panel);border-radius:.35rem;padding:.45rem .8rem;color:var(--ink2)}
.guard-foot{font-style:italic;color:var(--muted)}
footer{margin-top:2rem;border-top:3px double var(--brass);padding-top:.6rem;color:var(--ink2)}
a{color:var(--brass)}
`;
