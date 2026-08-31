// Renders one deliberation as the case page. Pure: data in, HTML out. Used by the static
// render (fresh clone, file store) and by the live page. No framework, no network.
// The three opinions render with equal prominence and identical structure, and nothing here
// computes agreement, sums positions, or produces any combined result.

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

// A citation renders as the advocate's name and the claim text, expandable to the support.
// A raw id on screen is a failed citation.
function citation(id: string, stances: Map<string, StoredStance>): string {
  const [role] = id.split('.');
  const stance = stances.get(role ?? '');
  const point = stance?.points.find((p) => p.id === id);
  if (!point) return `<span class="citation citation-unresolved">an argued point that could not be found</span>`;
  return `<details class="citation"><summary>${esc(NAMES[role!] ?? role!)}: ${esc(point.claim)}</summary><blockquote>${esc(point.support)}</blockquote></details>`;
}

function failureCard(rec: FailureRecord, roleTitle: string): string {
  // The one door for a failure record. It never reaches stance or opinion markup.
  return `<article class="failure">
<h3>${esc(roleTitle)}</h3>
<p class="failure-label">This role produced no output.</p>
<p>${esc(rec.reason)}</p>
<details><summary>What the model actually returned, attempt by attempt</summary>
<p class="explain">The text below failed validation. It is not a stance and not an opinion, and nothing in it counts as this role's position.</p>
${rec.attempts.map((a, i) => `<details><summary>Attempt ${i + 1}: ${esc(a.outcome)}${a.detail ? `, ${esc(a.detail)}` : ''}</summary>${a.text ? `<pre>${esc(a.text)}</pre>` : '<p>No text was returned.</p>'}</details>`).join('\n')}
</details>
</article>`;
}

function panelName(models: Record<string, string> | undefined): string {
  if (!models || Object.keys(models).length === 0) return '';
  const distinct = new Set(Object.values(models)).size;
  return distinct === 1 ? `Panel: one model for all seven roles (${[...new Set(Object.values(models))][0]})` : `Panel: ${distinct} distinct models, one per role`;
}

function modelLine(models: Record<string, string> | undefined, role: string): string {
  const m = models?.[role];
  return m ? `<p class="model">Model: ${esc(m)}</p>` : '';
}

function stanceCard(s: StoredStance, models?: Record<string, string>): string {
  const against = s.seat === 'defense' ? s.position === 'not_justified' : s.position === 'justified';
  return `<article class="stance">
<header class="card-head"><h3>${esc(NAMES[s.role_id] ?? s.role_id)}</h3><p class="seat">${esc(s.seat)} seat</p>${modelLine(models, s.role_id)}</header>
<p class="position">${esc(s.position.replace('_', ' '))}</p>
${against ? '<p class="against-seat">Concluded against this seat</p>' : ''}
${s.points.map((p) => `<details class="point"><summary>${esc(p.claim)}</summary><blockquote>${esc(p.support)}</blockquote></details>`).join('\n')}
</article>`;
}

function reasonBlock(r: Reason, stances: Map<string, StoredStance>): string {
  return `<div class="reason"><p>${esc(r.text)}</p><div class="relies">${r.relies_on.map((id) => citation(id, stances)).join('\n')}</div></div>`;
}

function opinionColumn(o: StoredOpinion, stances: Map<string, StoredStance>, models?: Record<string, string>): string {
  return `<article class="opinion">
<header class="card-head"><h3>${esc(o.label)}</h3><p class="seat">ruling alone</p>${modelLine(models, o.role_id)}</header>
<p class="verdict">${esc(o.verdict.replace('_', ' '))}</p>
<h4>Reasons</h4>
${o.reasons.map((r) => reasonBlock(r, stances)).join('\n')}
<h4>Strongest consideration against this verdict</h4>
${reasonBlock(o.against, stances)}
</article>`;
}

function roleSection(out: CaseData['outputs'][string], role: string, title: string, stances: Map<string, StoredStance>, kind: 'stance' | 'opinion', jobState: string, models?: Record<string, string>): string {
  const wrap = (state: string, inner: string) => `<div class="role-slot" data-role="${esc(role)}" data-kind="${kind}" data-state="${state}">${inner}</div>`;
  if (isFailureRecord(out)) return wrap('failed', failureCard(out, title));
  if (out === undefined) return wrap('absent', `<article class="absent"><h3>${esc(title)}</h3><p>No output yet. Deliberation is ${esc(jobState)}.</p></article>`);
  return wrap('returned', kind === 'stance' ? stanceCard(out as StoredStance, models) : opinionColumn(out as StoredOpinion, stances, models));
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
<style>${CSS}</style>
</head>
<body>
<header>
<p class="crumbs"><a href="/">\u2190 All cases</a></p>
<h1>Case ${esc(cs.case_id)}</h1>
<p><strong>Accused:</strong> ${esc(cs.accused)} \u00b7 <strong>Deceased:</strong> ${esc(cs.deceased)}</p>
<p><strong>Act alleged:</strong> ${esc(cs.act_alleged)}</p>
<p class="guard">A fictional proceeding. Each judge adapts a judicial method from a real jurist's published opinions; no judge represents the jurist or predicts how they would decide. The panel judges the record as filed.</p>
</header>
${incomplete}
${data.job?.models ? `<p class="panel">${esc(panelName(data.job.models))}</p>` : ''}
<section id="opinions"><h2>The three opinions</h2><p class="explain">Three judicial methods, each ruling alone on the same record. The opinions are presented side by side and are not combined.</p>
<div class="grid grid-3">${JUDGE_ORDER.map((r) => roleSection(data.outputs[r], r, (data.outputs[r] as StoredOpinion | undefined)?.label ?? r.replace('judge-', 'Judge '), stances, 'opinion', jobState, data.job?.models)).join('\n')}</div></section>
<section id="advocates"><h2>The four advocates</h2><p class="explain">Each seat fixes a procedural role, not a conclusion; each advocate states the position it actually reached. Positions are shown per advocate.</p>
<div class="grid grid-4">${ADVOCATE_ORDER.map((r) => roleSection(data.outputs[r], r, NAMES[r] ?? r, stances, 'stance', jobState, data.job?.models)).join('\n')}</div></section>
<section id="question"><h2>Question for judgment</h2><p>${esc(cs.question)}</p><p class="scope">${esc(cs.scope_note)}</p></section>
<details id="background"><summary><h2>Background for readers new to the story</h2></summary><p>${esc(cs.base_premises)}</p></details>
<details id="record"><summary><h2>Agreed factual record</h2></summary><ol>${cs.agreed_record.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>
<footer><p>${esc(cs.scope_note)}</p></footer>
</body>
</html>`;
}

const CSS = `
:root{color-scheme:light dark}
body{margin:0 auto;max-width:80rem;padding:1rem 1.5rem;font:16px/1.55 Georgia,serif;background:Canvas;color:CanvasText}
header{border-bottom:3px double currentColor;padding-bottom:.75rem;margin-bottom:1rem}
h1{font-variant:small-caps;letter-spacing:.05em;margin:.2rem 0}
h2{font-variant:small-caps;border-bottom:1px solid color-mix(in srgb,currentColor 30%,transparent);padding-bottom:.2rem}
.crumbs{margin:.1rem 0}.crumbs a{color:inherit}
.grid{display:grid;gap:1rem;align-items:stretch}
.grid-4{grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
.grid-3{grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))}
article{border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:.4rem;padding:.75rem 1rem;height:100%;box-sizing:border-box}
.role-slot{height:100%}
.opinion{border-width:2px}
.card-head{min-height:5.2rem;border-bottom:1px solid color-mix(in srgb,currentColor 15%,transparent);margin-bottom:.5rem;padding-bottom:.35rem}
.card-head h3{margin:.1rem 0}
.seat{font-size:.85em;font-style:italic;opacity:.75;margin:.1rem 0}
.model{font-size:.85em;opacity:.8;margin:.1rem 0;font-family:ui-monospace,monospace;overflow-wrap:anywhere}
.position,.verdict{font-variant:small-caps;font-weight:bold;font-size:1.35em;letter-spacing:.03em;margin:.4rem 0}
.against-seat{display:inline-block;border:1.5px solid currentColor;border-radius:.3rem;padding:.05rem .5rem;font-size:.85em;font-weight:bold;letter-spacing:.03em;text-transform:uppercase}
details{margin:.35rem 0}
summary{cursor:pointer}
details#background,details#record{border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:.4rem;padding:.3rem .8rem;margin:.8rem 0}
details#background summary h2,details#record summary h2{display:inline;border:none}
blockquote{margin:.4rem 0 .4rem 1rem;padding-left:.6rem;border-left:3px solid color-mix(in srgb,currentColor 30%,transparent);opacity:.9}
.point>summary{list-style:none}
.point>summary::before{content:'\u2295 ';opacity:.7}
.point[open]>summary::before{content:'\u2296 '}
.citation summary{font-size:.92em;opacity:.9;list-style:none}
.citation summary::before{content:'\u00bb cites ';font-style:italic;opacity:.75}
.citation-unresolved{opacity:.7;font-style:italic}
.failure{border-style:dashed;background:color-mix(in srgb,currentColor 6%,transparent)}
.failure-label{font-weight:bold}
.failure pre{white-space:pre-wrap;font-size:.85em}
.notice{border:2px dashed currentColor;padding:.5rem 1rem;font-weight:bold}
.scope,.explain{font-style:italic;opacity:.85}
.guard{font-size:.9em;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:.3rem;padding:.4rem .7rem;opacity:.9;font-weight:normal}
.panel{font-style:italic;opacity:.85}
footer{margin-top:2rem;border-top:3px double currentColor;padding-top:.5rem;font-style:italic;opacity:.8}
`;
