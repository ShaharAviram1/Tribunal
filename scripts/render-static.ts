// Renders a committed run from the file store to a single HTML file. No key, no network.
//   node scripts/render-static.ts run-02 [out.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileStore } from '../src/store/file-store.ts';
import { renderCasePage, type CaseData } from '../src/page/render-case.ts';
import { usageFromLog } from '../src/page/usage.ts';

const [id, out] = process.argv.slice(2);
if (!id) throw new Error('usage: render-static.ts <run-id> [out.html]');
const store = new FileStore(join(process.cwd(), 'runs'), id);
const chargeSheet = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/charge-sheets/T-001.stored.json'), 'utf8'));
const outputs: CaseData['outputs'] = {};
for (const r of ['jon', 'tyrion', 'daenerys', 'greyworm', 'judge-1', 'judge-2', 'judge-3']) outputs[r] = store.getOutput(r) as never;
const html = renderCasePage({ chargeSheet, job: store.getJob() as never, outputs, usage: usageFromLog(store.readLog()) });
const dest = out ?? join(store.dir, 'case.html');
writeFileSync(dest, html);
console.log(`rendered ${dest} (${html.length} bytes)`);
