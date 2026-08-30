// Store + Budget over Supabase PostgREST. The only code that knows the table names.
// The claim and heartbeat are SQL functions from the committed migration, so the atomicity
// lives in the database, not in this file.
import type { Store } from '../protocol/run.ts';
import type { Budget, LogRow } from '../client/model-client.ts';

export class SupabaseStore implements Store, Budget {
  readonly #url: string; readonly #key: string; readonly #id: string; readonly #fetch: typeof fetch;
  readonly #staleSeconds: number;
  constructor(o: { url: string; serviceKey: string; deliberation_id: string; staleSeconds?: number; fetchImpl?: typeof fetch }) {
    this.#url = o.url.replace(/\/$/, ''); this.#key = o.serviceKey; this.#id = o.deliberation_id;
    this.#staleSeconds = o.staleSeconds ?? 300; this.#fetch = o.fetchImpl ?? fetch;
  }
  async #req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<unknown> {
    const res = await this.#fetch(`${this.#url}/rest/v1${path}`, {
      method,
      headers: { apikey: this.#key, Authorization: `Bearer ${this.#key}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`supabase ${method} ${path}: HTTP ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  async getOutput(role_id: string): Promise<unknown> {
    const rows = (await this.#req('GET', `/outputs?deliberation_id=eq.${this.#id}&role_id=eq.${role_id}&select=body`)) as { body: unknown }[];
    return rows.length ? rows[0]!.body : undefined;
  }
  async putOutput(role_id: string, obj: unknown): Promise<void> {
    await this.#req('POST', '/outputs', { deliberation_id: this.#id, role_id, body: obj }, { Prefer: 'resolution=merge-duplicates' });
  }
  async getJob(): Promise<unknown> {
    const rows = (await this.#req('GET', `/jobs?deliberation_id=eq.${this.#id}`)) as Record<string, unknown>[];
    return rows.length ? rows[0] : undefined;
  }
  async putJob(job: unknown): Promise<void> {
    const j = { ...(job as Record<string, unknown>) };
    for (const k of Object.keys(j)) if (!JOB_COLUMNS.has(k)) delete j[k];
    await this.#req('POST', '/jobs', { ...j, deliberation_id: this.#id, updated_at: new Date().toISOString() }, { Prefer: 'resolution=merge-duplicates' });
  }
  async claim(): Promise<boolean> {
    const r = await this.#req('POST', '/rpc/claim_job', { p_deliberation_id: this.#id, p_stale_seconds: this.#staleSeconds });
    return r === true;
  }
  async heartbeat(): Promise<void> { await this.#req('POST', '/rpc/heartbeat_job', { p_deliberation_id: this.#id }); }
  async read(): Promise<{ calls: number; spend_usd: number }> {
    const rows = (await this.#req('GET', `/call_log?deliberation_id=eq.${this.#id}&select=row`)) as { row: LogRow }[];
    return { calls: rows.length, spend_usd: rows.reduce((s, r) => s + (r.row.cost_usd ?? 0), 0) };
  }
  async add(row: LogRow): Promise<void> { await this.#req('POST', '/call_log', { deliberation_id: this.#id, row }); }
  async readLog(): Promise<LogRow[]> {
    const rows = (await this.#req('GET', `/call_log?deliberation_id=eq.${this.#id}&select=row&order=id`)) as { row: LogRow }[];
    return rows.map((r) => r.row);
  }
}
const JOB_COLUMNS = new Set(['deliberation_id','case_id','status','stage','terminal_reason','calls','spend_usd','attempts_by_role','claimed_at','heartbeat_at','completed_roles','failed_roles','models','updated_at']);
