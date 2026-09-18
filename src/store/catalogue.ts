// The docket: the reads and writes that are per case or across deliberations, which the
// per-deliberation Store interface does not carry — the charge sheets, the list of cases with
// their deliberations, and the count of recent jobs the daily cap is measured against. Until
// 2026-09-18 the handlers made these as raw PostgREST calls inline, which is why the site could
// not run without Supabase even with TRIBUNAL_STORE=file. They are gathered here behind one
// interface with two implementations, chosen the same way makeStore chooses a store, so a handler
// never asks which store it has.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runsRoot } from './index.ts';

// The shape the system assigns (charge sheet spec 1b). The file catalogue turns a case id into a
// path, so nothing else is read or written.
const CASE_ID = /^T-[0-9]{3}$/;

export type DocketJob ={ deliberation_id: string; case_id: string; status: string; created_at: string; models: Record<string, string> };
export type DocketCase = { case_id: string; body: { accused: string; deceased: string } };

export interface Catalogue {
  getSheet(case_id: string): Promise<unknown | undefined>;
  putSheet(case_id: string, sheet: unknown): Promise<void>;
  nextCaseId(): Promise<string>;
  listCases(): Promise<DocketCase[]>;
  listJobs(): Promise<DocketJob[]>;
  countJobsSince(iso: string): Promise<number>;
}

export function makeCatalogue(): Catalogue {
  const kind = process.env.TRIBUNAL_STORE ?? 'file';
  if (kind === 'file') return new FileCatalogue(runsRoot());
  if (kind === 'supabase') return new SupabaseCatalogue(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
  throw new Error(`unknown TRIBUNAL_STORE: ${kind}`);
}

// Sheets live beside the deliberations, one file per case, under <root>/cases/. The repository's
// committed sheets in fixtures/charge-sheets/ seed the docket: a fresh volume holds no sheet of
// its own, and a site whose docket was empty would offer nothing to convene. A sheet written at
// filing time shadows a fixture of the same id; nothing in the image is ever written to.
export class FileCatalogue implements Catalogue {
  readonly #dir: string;
  readonly #root: string;
  readonly #fixtures: string;
  constructor(root: string) {
    this.#root = root;
    this.#dir = join(root, 'cases');
    this.#fixtures = join(process.cwd(), 'fixtures', 'charge-sheets');
  }
  #ids(): string[] {
    const stored = existsSync(this.#dir) ? readdirSync(this.#dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)) : [];
    const seeded = existsSync(this.#fixtures) ? readdirSync(this.#fixtures).filter((f) => f.endsWith('.stored.json')).map((f) => f.slice(0, -'.stored.json'.length)) : [];
    return [...new Set([...stored, ...seeded])].filter((id) => CASE_ID.test(id)).sort();
  }
  #read(case_id: string): unknown | undefined {
    if (!CASE_ID.test(case_id)) return undefined; // a case id becomes a path here; only the assigned shape
    for (const p of [join(this.#dir, `${case_id}.json`), join(this.#fixtures, `${case_id}.stored.json`)]) {
      if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
    }
    return undefined;
  }
  async getSheet(case_id: string): Promise<unknown | undefined> { return this.#read(case_id); }
  async putSheet(case_id: string, sheet: unknown): Promise<void> {
    if (!CASE_ID.test(case_id)) throw new Error(`not a case id: ${JSON.stringify(case_id)}`);
    mkdirSync(this.#dir, { recursive: true });
    writeFileSync(join(this.#dir, `${case_id}.json`), JSON.stringify(sheet, null, 2) + '\n');
  }
  async nextCaseId(): Promise<string> {
    const ids = this.#ids();
    const last = ids.length ? ids[ids.length - 1]! : 'T-000';
    return `T-${String(Number(last.slice(2)) + 1).padStart(3, '0')}`;
  }
  async listCases(): Promise<DocketCase[]> {
    return this.#ids().map((case_id) => ({ case_id, body: this.#read(case_id) as DocketCase['body'] }));
  }
  async listJobs(): Promise<DocketJob[]> {
    if (!existsSync(this.#root)) return [];
    const jobs: DocketJob[] = [];
    for (const entry of readdirSync(this.#root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'cases') continue;
      const p = join(this.#root, entry.name, 'job.json');
      if (!existsSync(p)) continue;
      const j = JSON.parse(readFileSync(p, 'utf8')) as Partial<DocketJob>;
      jobs.push({ deliberation_id: entry.name, case_id: j.case_id ?? '', status: j.status ?? '', created_at: j.created_at ?? '', models: j.models ?? {} });
    }
    return jobs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  async countJobsSince(iso: string): Promise<number> {
    return (await this.listJobs()).filter((j) => j.created_at > iso).length;
  }
}

// The same six operations as PostgREST calls, exactly the requests the handlers made inline
// before they were gathered here. The service-role key stays server-side, as it did.
export class SupabaseCatalogue implements Catalogue {
  readonly #base: string; readonly #key: string;
  constructor(url: string, serviceKey: string) { this.#base = url.replace(/\/$/, ''); this.#key = serviceKey; }
  get #headers(): Record<string, string> { return { apikey: this.#key, Authorization: `Bearer ${this.#key}` }; }
  async #get(path: string): Promise<unknown> {
    const res = await fetch(`${this.#base}/rest/v1${path}`, { headers: this.#headers });
    return res.json();
  }
  async getSheet(case_id: string): Promise<unknown | undefined> {
    const rows = (await this.#get(`/charge_sheets?case_id=eq.${case_id}&select=body`)) as { body: unknown }[];
    return rows[0]?.body;
  }
  async putSheet(case_id: string, sheet: unknown): Promise<void> {
    await fetch(`${this.#base}/rest/v1/charge_sheets`, { method: 'POST', headers: { ...this.#headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id, body: sheet }) });
  }
  async nextCaseId(): Promise<string> {
    const rows = (await this.#get('/charge_sheets?select=case_id&order=case_id.desc&limit=1')) as { case_id: string }[];
    const last = rows[0]?.case_id ?? 'T-000';
    return `T-${String(Number(last.slice(2)) + 1).padStart(3, '0')}`;
  }
  async listCases(): Promise<DocketCase[]> {
    return (await this.#get('/charge_sheets?select=case_id,body&order=case_id')) as DocketCase[];
  }
  async listJobs(): Promise<DocketJob[]> {
    return (await this.#get('/jobs?select=deliberation_id,case_id,status,created_at,models&order=created_at')) as DocketJob[];
  }
  async countJobsSince(iso: string): Promise<number> {
    return ((await this.#get(`/jobs?select=deliberation_id&created_at=gt.${iso}`)) as unknown[]).length;
  }
}

const requireEnv = (k: string): string => { const v = process.env[k]; if (!v) throw new Error(`${k} not set`); return v; };
