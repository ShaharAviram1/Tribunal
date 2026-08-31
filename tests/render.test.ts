import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderCasePage, type CaseData } from '../src/page/render-case.ts';

const chargeSheet = JSON.parse(readFileSync('fixtures/charge-sheets/T-001.stored.json', 'utf8'));
const runDir = join(process.cwd(), 'runs/run-02');
const outputs: CaseData['outputs'] = {};
for (const f of readdirSync(join(runDir, 'outputs'))) outputs[f.replace('.json', '')] = JSON.parse(readFileSync(join(runDir, 'outputs', f), 'utf8'));
const job = JSON.parse(readFileSync(join(runDir, 'job.json'), 'utf8'));
const page = () => renderCasePage({ chargeSheet, job, outputs });

test('the committed run renders with the whole case block on the page', () => {
  const html = page();
  for (const s of ['Background for readers new to the story', 'Agreed factual record', 'Question for judgment', chargeSheet.scope_note]) {
    assert.ok(html.includes(s), s);
  }
});

test('citations render as advocate name plus claim text; no raw point id is visible', () => {
  const html = page();
  const visible = html.replace(/<[^>]+>/g, ' ');
  assert.ok(!/\b(?:jon|tyrion|daenerys|greyworm)\.p\d\b/.test(visible), 'a raw id renders on screen');
  assert.ok(/Grey Worm\s/.test(visible) && html.includes('cite-who'), 'citation does not carry the advocate name');
});

test('three opinion columns, identical structure, and no combined result anywhere', () => {
  const html = page();
  assert.equal((html.match(/class="opinion"/g) ?? []).length, 3);
  assert.equal((html.match(/Strongest consideration against this verdict/g) ?? []).length, 3);
  // The rule binds the page's own chrome, not the models' prose (a judge may write
  // "counter-consideration"; G3 guards the source). Whole words, on the rendered text.
  const FORBIDDEN: string[] = JSON.parse(readFileSync('config/forbidden-vocabulary.json', 'utf8')).key_fragments;
  const visible = html.replace(/<[^>]+>/g, ' ');
  const modelText = [
    ...Object.values(outputs).flatMap((o: any) => [...(o.points ?? []).flatMap((p: any) => [p.claim, p.support]), ...(o.reasons ?? []).map((r: any) => r.text), o.against?.text ?? '']),
  ].join(' ');
  let chrome = visible;
  for (const t of modelText.split(/\s+/)) chrome = chrome.split(t).join(' ');
  for (const w of FORBIDDEN) assert.ok(!new RegExp(`\\b${w}\\b`, 'i').test(chrome), `page chrome shows "${w}"`);
  assert.ok(!/\b(all three|unanimous|agree|agreed)\b/i.test(chrome), 'page chrome states agreement for the reader');
});

test('a failure record renders as a failure and cannot go down the output path', () => {
  const failed: CaseData['outputs'] = { ...outputs, 'judge-2': { failed: true, role_id: 'judge-2', deliberation_id: 'x', reason: 'refusal', attempts: [{ hash: 'h', text: 'I refuse.', outcome: 'refusal', detail: null }] } as never };
  const html = renderCasePage({ chargeSheet, job, outputs: failed });
  assert.ok(html.includes('This seat produced no output.'));
  assert.equal((html.match(/class="opinion"/g) ?? []).length, 2, 'failure record entered the opinion path');
  assert.ok(html.includes('I refuse.'), 'raw text of the attempt is not shown');
});

test('an absent output renders the job state, not an empty column', () => {
  const partial: CaseData['outputs'] = { ...outputs }; delete partial['judge-3'];
  const html = renderCasePage({ chargeSheet, job: { ...job, status: 'running' }, outputs: partial });
  assert.ok(html.includes('Awaiting argument'), 'an absent judge does not show its waiting state');
});

test('model text is escaped: a stance containing markup cannot inject it', () => {
  const evil = JSON.parse(JSON.stringify(outputs.jon));
  evil.points[0].claim = '<script>alert(1)</script>';
  const html = renderCasePage({ chargeSheet, job, outputs: { ...outputs, jon: evil } });
  assert.ok(!html.includes('<script>alert(1)'));
});

test('the dossier guard and the as-filed scoping line sit with the opinions', () => {
  const html = page();
  assert.ok(html.includes('no judge represents the jurist or predicts how they would decide'));
  assert.ok(html.includes('The panel judges the record as filed.'));
});

test('failure attempts each sit behind their own disclosure with the not-a-position caveat', () => {
  const failed = { failed: true, role_id: 'tyrion', deliberation_id: 'x', reason: 'truncated on both attempts', attempts: [{ hash: 'h', text: '{"position":"justified"', outcome: 'ok', detail: 'truncated' }] };
  const html = renderCasePage({ chargeSheet, job, outputs: { ...outputs, tyrion: failed as never } });
  assert.ok(html.includes('nothing in it counts as this role'));
  const card = html.slice(html.indexOf('class="failure"'));
  assert.ok(card.indexOf('<pre>') > card.indexOf('<details><summary>Attempt 1'), 'raw text is not behind a per-attempt disclosure');
});

test('the page names the panel and the model behind each card', () => {
  const html = page();
  assert.ok(html.includes('One model for all seven roles'));
  assert.equal((html.match(/class="model"/g) ?? []).length, 7, 'each of the seven cards carries its model');
  assert.ok(html.includes('minimax/minimax-m2.7:free'));
});
