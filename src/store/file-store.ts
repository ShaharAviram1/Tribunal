// Local file store for turn one: runs/<deliberation_id>/{job.json, outputs/<role>.json, log.jsonl}.
// Implements the protocol's Store and the client's Budget. The committed run directories are the
// seed for the fresh-clone criterion (problem.md item 9); they are not temporary.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Store } from '../protocol/run.ts';
import type { Budget, LogRow } from '../client/model-client.ts';

export class FileStore implements Store, Budget {
  readonly dir: string;
  #staleMs: number;
  constructor(root: string, deliberation_id: string, staleMs = 16 * 60 * 1000) {
    this.dir = join(root, deliberation_id);
    this.#staleMs = staleMs;
    mkdirSync(join(this.dir, 'outputs'), { recursive: true });
  }
  #path(...p: string[]) { return join(this.dir, ...p); }
  getOutput(role_id: string): unknown {
    const p = this.#path('outputs', `${role_id}.json`);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined;
  }
  putOutput(role_id: string, obj: unknown): void { writeFileSync(this.#path('outputs', `${role_id}.json`), JSON.stringify(obj, null, 2) + '\n'); }
  getJob(): unknown { const p = this.#path('job.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined; }
  putJob(job: unknown): void { writeFileSync(this.#path('job.json'), JSON.stringify(job, null, 2) + '\n'); }
  // Claim: refuse if a claim exists and is younger than the function ceiling plus margin.
  claim(): boolean {
    const p = this.#path('claim.json');
    if (existsSync(p)) {
      const { at } = JSON.parse(readFileSync(p, 'utf8')) as { at: string };
      const job = this.getJob() as { status?: string } | undefined;
      const terminal = job && ['complete', 'incomplete', 'failed'].includes(job.status ?? '');
      if (!terminal && Date.now() - Date.parse(at) < this.#staleMs) return false;
    }
    writeFileSync(p, JSON.stringify({ at: new Date().toISOString() }) + '\n');
    return true;
  }
  // Budget: the job's totals are the sum of the log rows on disk, never process memory.
  readLog(): LogRow[] {
    const p = this.#path('log.jsonl');
    return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LogRow) : [];
  }
  async read() { const rows = this.readLog(); return { calls: rows.length, spend_usd: rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0) }; }
  async add(row: LogRow) { appendFileSync(this.#path('log.jsonl'), JSON.stringify(row) + '\n'); }
}
