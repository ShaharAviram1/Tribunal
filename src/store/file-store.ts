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
  constructor(root: string, deliberation_id: string, staleMs = 5 * 60 * 1000) {
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
  // Claim, the file approximation of the atomic rule in spec.md criterion 15. Files cannot make
  // a conditional write, so this is read-then-write and documented as the approximation.
  // Claimable when there is no job or it is pending, or when running with a heartbeat older than
  // the threshold. A terminal status is never claimable.
  claim(): boolean {
    const job = this.getJob() as { status?: string; heartbeat_at?: string } | undefined;
    if (job && ['complete', 'incomplete', 'failed'].includes(job.status ?? '')) return false;
    if (job && job.status === 'running') {
      const hb = job.heartbeat_at ? Date.parse(job.heartbeat_at) : 0;
      if (Date.now() - hb < this.#staleMs) return false;
    }
    const claimed = { ...(job ?? {}), status: 'running', claimed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() };
    this.putJob(claimed);
    return true;
  }
  heartbeat(): void {
    const job = this.getJob() as Record<string, unknown> | undefined;
    if (job && job.status === 'running') this.putJob({ ...job, heartbeat_at: new Date().toISOString() });
  }
  // Budget: the job's totals are the sum of the log rows on disk, never process memory.
  readLog(): LogRow[] {
    const p = this.#path('log.jsonl');
    return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LogRow) : [];
  }
  async read() { const rows = this.readLog(); return { calls: rows.length, spend_usd: rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0) }; }
  async add(row: LogRow) { appendFileSync(this.#path('log.jsonl'), JSON.stringify(row) + '\n'); }
}
