// What the handlers reach when TRIBUNAL_STORE=file on a persistent host (the move of 2026-09-18):
// the run root the container mounts, the committed runs that ship inside the image, and the
// docket, which before the move was only ever PostgREST calls written inline in the handlers.
// The guard's fetch block stands throughout, so anything reaching the network fails the test.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makeStore, runsRoot, storeRootFor } from '../src/store/index.ts';
import { FileCatalogue, makeCatalogue } from '../src/store/catalogue.ts';
import { FileStore } from '../src/store/file-store.ts';

const VARS = ['TRIBUNAL_STORE', 'TRIBUNAL_RUNS_DIR', 'TRIBUNAL_PERSISTENT_HOST', 'TRIBUNAL_FUNCTION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
beforeEach(() => { for (const v of VARS) delete process.env[v]; });
const tmp = () => mkdtempSync(join(tmpdir(), 'tribunal-root-'));

test('makeStore keeps deliberations under TRIBUNAL_RUNS_DIR, and under runs/ when it is unset', () => {
  assert.equal(runsRoot(), join(process.cwd(), 'runs'));
  assert.equal(storeRootFor('d-T-001-1-abc'), join(process.cwd(), 'runs'));
  const root = tmp();
  process.env.TRIBUNAL_RUNS_DIR = root;
  assert.equal(runsRoot(), root);
  assert.equal((makeStore('d-T-001-2-abc') as FileStore).dir, join(root, 'd-T-001-2-abc'));
});

test('a committed run still resolves inside the image when the live root is the volume', () => {
  process.env.TRIBUNAL_RUNS_DIR = tmp();
  assert.equal(storeRootFor('run-02'), join(process.cwd(), 'runs'), 'a committed id is read from the repository');
  assert.equal(storeRootFor('d-T-001-9-abc'), process.env.TRIBUNAL_RUNS_DIR, 'every other id belongs to the live root');
  assert.equal((makeStore('run-02') as FileStore).getJob()!['status' as never], 'complete' as never);
});

test('a deliberation id that is not one path segment is refused, not turned into a path', () => {
  process.env.TRIBUNAL_RUNS_DIR = tmp();
  for (const id of ['../../etc', 'a/b', '', '.hidden', 'd-T-001-1/../..']) {
    assert.throws(() => makeStore(id), /not a deliberation id/, id);
  }
});

test('the file catalogue is seeded by the committed charge sheets and writes new ones to the root', async () => {
  const root = tmp();
  const cat = new FileCatalogue(root);
  const seeded = (await cat.getSheet('T-001')) as { case_id: string; accused: string };
  assert.equal(seeded.case_id, 'T-001');
  assert.deepEqual((await cat.listCases()).map((c) => c.case_id), ['T-001']);
  assert.equal(await cat.nextCaseId(), 'T-002');
  await cat.putSheet('T-002', { case_id: 'T-002', accused: 'A', deceased: 'B' });
  assert.ok(existsSync(join(root, 'cases', 'T-002.json')), 'the new sheet is on the volume, not in the image');
  assert.equal(((await cat.getSheet('T-002')) as { accused: string }).accused, 'A');
  assert.equal(await cat.nextCaseId(), 'T-003');
  assert.equal(await cat.getSheet('T-404'), undefined);
  assert.equal(await cat.getSheet('../../../etc/passwd'), undefined, 'a case id becomes a path here');
});

test('the docket lists the deliberations on the run root, newest last, and counts them for the daily cap', async () => {
  const root = tmp();
  const cat = new FileCatalogue(root);
  assert.deepEqual(await cat.listJobs(), [], 'a fresh volume holds no deliberation');
  mkdirSync(join(root, 'd-T-001-2-b'), { recursive: true });
  writeFileSync(join(root, 'd-T-001-2-b', 'job.json'), JSON.stringify({ case_id: 'T-001', status: 'running', created_at: '2026-09-18T10:00:00.000Z', models: { jon: 'm' } }));
  mkdirSync(join(root, 'd-T-001-1-a'), { recursive: true });
  writeFileSync(join(root, 'd-T-001-1-a', 'job.json'), JSON.stringify({ case_id: 'T-001', status: 'complete', created_at: '2026-09-17T10:00:00.000Z', models: { jon: 'm' } }));
  mkdirSync(join(root, 'd-T-001-3-c'), { recursive: true }); // claimed but never written: not a deliberation yet
  assert.deepEqual((await cat.listJobs()).map((j) => j.deliberation_id), ['d-T-001-1-a', 'd-T-001-2-b']);
  assert.equal(await cat.countJobsSince('2026-09-18T00:00:00.000Z'), 1);
  assert.equal(await cat.countJobsSince('2026-09-01T00:00:00.000Z'), 2);
});

test('makeCatalogue follows TRIBUNAL_STORE, as makeStore does', () => {
  process.env.TRIBUNAL_RUNS_DIR = tmp();
  assert.ok(makeCatalogue() instanceof FileCatalogue);
  process.env.TRIBUNAL_STORE = 'supabase';
  assert.throws(() => makeCatalogue(), /SUPABASE_URL not set/);
  process.env.TRIBUNAL_STORE = 'postgres';
  assert.throws(() => makeCatalogue(), /unknown TRIBUNAL_STORE/);
});

// The path the container actually takes: a handler, with the flag and the file store, answering
// from the volume and the seeded docket without a single request leaving the process.
test('the case endpoint reads a deliberation from the run root with no Supabase anywhere', async () => {
  const root = tmp();
  process.env.TRIBUNAL_STORE = 'file';
  process.env.TRIBUNAL_PERSISTENT_HOST = '1';
  process.env.TRIBUNAL_RUNS_DIR = root;
  const store = new FileStore(root, 'd-T-001-7-abc');
  store.putJob({ deliberation_id: 'd-T-001-7-abc', case_id: 'T-001', status: 'complete', stage: 'judges', created_at: '2026-09-18T10:00:00.000Z', models: { jon: 'm' } });
  store.putOutput('jon', { role_id: 'jon', position: 'x' });
  const { default: handler } = await import('../netlify/functions/tribunal-case.mts');
  const res = await handler(new Request('https://x/.netlify/functions/tribunal-case?deliberation_id=d-T-001-7-abc'));
  assert.equal(res.status, 200);
  const body = await res.json() as { chargeSheet: { case_id: string }; job: { status: string }; outputs: Record<string, unknown> };
  assert.equal(body.job.status, 'complete');
  assert.equal(body.chargeSheet.case_id, 'T-001', 'the sheet comes from the committed fixtures, not a database');
  assert.deepEqual(Object.keys(body.outputs), ['jon']);

  const list = await (await handler(new Request('https://x/.netlify/functions/tribunal-case?list=1'))).json() as { cases: { case_id: string; deliberations: { deliberation_id: string }[] }[] };
  assert.deepEqual(list.cases.map((c) => c.case_id), ['T-001']);
  assert.deepEqual(list.cases[0]!.deliberations.map((d) => d.deliberation_id), ['d-T-001-7-abc']);
});

test('the case page renders that same deliberation from the run root', async () => {
  const root = tmp();
  process.env.TRIBUNAL_STORE = 'file';
  process.env.TRIBUNAL_PERSISTENT_HOST = '1';
  process.env.TRIBUNAL_RUNS_DIR = root;
  const source = join(process.cwd(), 'runs', 'run-02');
  const store = new FileStore(root, 'd-T-001-8-abc');
  store.putJob({ ...JSON.parse(readFileSync(join(source, 'job.json'), 'utf8')), deliberation_id: 'd-T-001-8-abc' });
  for (const role of ['jon', 'tyrion', 'daenerys', 'greyworm', 'judge-1', 'judge-2', 'judge-3']) {
    store.putOutput(role, JSON.parse(readFileSync(join(source, 'outputs', `${role}.json`), 'utf8')));
  }
  const { default: page } = await import('../netlify/functions/tribunal-case-page.mts');
  const res = await page(new Request('https://x/case?deliberation_id=d-T-001-8-abc'));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Jon Snow/);
  assert.equal(html.includes('SUPABASE'), false);
});

test('the case page renders a committed run by its run-NN id', async () => {
  process.env.TRIBUNAL_STORE = 'file';
  process.env.TRIBUNAL_PERSISTENT_HOST = '1';
  const { default: page } = await import('../netlify/functions/tribunal-case-page.mts');
  const res = await page(new Request('https://x/case?deliberation_id=run-02'));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Jon Snow/);
  const bad = await page(new Request('https://x/case?deliberation_id=runs'));
  assert.equal(bad.status, 400);
});
