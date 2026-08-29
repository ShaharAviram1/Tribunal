// The only code that knows the key, the caps, the temperature, the transport retry policy,
// and the log row format (spec.md part three). Caps are read at construction and cannot be
// raised afterwards; call count and spend are read from and written to the job via `budget`,
// never held in process memory alone (spec.md criteria 1, 2, 10; part three, platform retry).
// No provider-side JSON mode; fallback routing disabled; served model logged beside requested.

import { createHash } from 'node:crypto';

export type Caps = {
  max_calls_per_deliberation: number;
  max_spend_usd_per_deliberation: number;
  max_attempts_per_role: number;
  transport_retries_per_call: number;
  call_timeout_ms: number;
  temperature: number;
};

export type LogRow = {
  deliberation_id: string;
  role_id: string;
  attempt: number;
  prompt_hash: string;
  model_requested: string;
  model_served: string | null;
  model_mismatch: boolean;
  temperature: number;
  temperature_honoured: boolean | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  latency_ms: number;
  outcome: 'ok' | 'refusal' | 'transport_error' | 'cap_exceeded' | 'timeout';
  http_status: number | null;
  detail: string | null;
  started_at: string;
};

export type CallRequest = { role_id: string; prompt: string; hash: string; attempt: number };
export type CallResult =
  | { outcome: 'ok'; text: string; row: LogRow }
  | { outcome: 'refusal'; row: LogRow }
  | { outcome: 'transport_error'; row: LogRow }
  | { outcome: 'cap_exceeded'; row: LogRow };

// Budget lives on the job row. The client reads and writes through this interface so a fresh
// invocation of the function never gets a fresh budget.
export type Budget = {
  read(): Promise<{ calls: number; spend_usd: number }>;
  add(row: LogRow): Promise<void>;
};

export type Transport = (req: {
  model: string; prompt: string; temperature: number; timeout_ms: number;
}) => Promise<
  | { kind: 'ok'; text: string; model_served: string | null; tokens_in: number | null; tokens_out: number | null; cost_usd: number | null; http_status: number; temperature_honoured: boolean | null; finish_reason: string | null }
  | { kind: 'refusal'; model_served: string | null; http_status: number; detail: string }
  | { kind: 'transport_error'; http_status: number | null; detail: string }
  | { kind: 'timeout' }
>;

export type ModelClientOptions = {
  caps: Caps;
  models: Record<string, string>;
  deliberation_id: string;
  budget: Budget;
  transport: Transport;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
};

export function hashPrompt(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export class ModelClient {
  readonly log: LogRow[] = [];
  readonly #caps: Readonly<Caps>;
  readonly #models: Readonly<Record<string, string>>;
  readonly #id: string;
  readonly #budget: Budget;
  readonly #transport: Transport;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #random: () => number;
  readonly #now: () => number;

  constructor(o: ModelClientOptions) {
    this.#caps = Object.freeze({ ...o.caps });
    this.#models = Object.freeze({ ...o.models });
    this.#id = o.deliberation_id;
    this.#budget = o.budget;
    this.#transport = o.transport;
    this.#sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.#random = o.random ?? Math.random;
    this.#now = o.now ?? Date.now;
  }

  get caps(): Readonly<Caps> { return this.#caps; }

  modelFor(role_id: string): string {
    const m = this.#models[role_id];
    if (!m) throw new Error(`no model configured for role ${role_id}`);
    return m;
  }

  // One logical call. Transport failures are retried here with backoff and jitter, each attempt
  // writing its own row and counting toward the call cap. Refusal and ok return immediately.
  async call(req: CallRequest): Promise<CallResult> {
    const model = this.modelFor(req.role_id);
    let last: CallResult | null = null;
    for (let t = 0; t <= this.#caps.transport_retries_per_call; t++) {
      if (t > 0) await this.#sleep(this.#backoff(t));
      const gate = await this.#gate(req, model);
      if (gate) return gate;
      const started = this.#now();
      const res = await this.#transport({ model, prompt: req.prompt, temperature: this.#caps.temperature, timeout_ms: this.#caps.call_timeout_ms });
      const latency_ms = this.#now() - started;
      const base = this.#row(req, model, latency_ms, started);
      if (res.kind === 'ok') {
        const row: LogRow = { ...base, outcome: 'ok', model_served: res.model_served, model_mismatch: res.model_served !== null && res.model_served !== model,
          tokens_in: res.tokens_in, tokens_out: res.tokens_out, cost_usd: res.cost_usd, http_status: res.http_status, temperature_honoured: res.temperature_honoured,
          detail: res.finish_reason };
        await this.#record(row);
        return { outcome: 'ok', text: res.text, row };
      }
      if (res.kind === 'refusal') {
        const row: LogRow = { ...base, outcome: 'refusal', model_served: res.model_served, model_mismatch: res.model_served !== null && res.model_served !== model, http_status: res.http_status, detail: res.detail };
        await this.#record(row);
        return { outcome: 'refusal', row };
      }
      const row: LogRow = res.kind === 'timeout'
        ? { ...base, outcome: 'timeout', detail: `no response within ${this.#caps.call_timeout_ms}ms` }
        : { ...base, outcome: 'transport_error', http_status: res.http_status, detail: res.detail };
      await this.#record(row);
      last = { outcome: 'transport_error', row };
    }
    return last!;
  }

  async #gate(req: CallRequest, model: string): Promise<CallResult | null> {
    const b = await this.#budget.read();
    let detail: string | null = null;
    if (b.calls >= this.#caps.max_calls_per_deliberation) detail = `call cap ${this.#caps.max_calls_per_deliberation} reached`;
    else if (b.spend_usd >= this.#caps.max_spend_usd_per_deliberation) detail = `spend cap ${this.#caps.max_spend_usd_per_deliberation} USD reached`;
    else if (req.attempt > this.#caps.max_attempts_per_role) detail = `attempt ${req.attempt} exceeds per-role ceiling ${this.#caps.max_attempts_per_role}`;
    if (!detail) return null;
    const row: LogRow = { ...this.#row(req, model, 0, this.#now()), outcome: 'cap_exceeded', detail };
    await this.#record(row);
    return { outcome: 'cap_exceeded', row };
  }

  #row(req: CallRequest, model: string, latency_ms: number, started: number): LogRow {
    return {
      deliberation_id: this.#id, role_id: req.role_id, attempt: req.attempt, prompt_hash: req.hash,
      model_requested: model, model_served: null, model_mismatch: false,
      temperature: this.#caps.temperature, temperature_honoured: null,
      tokens_in: null, tokens_out: null, cost_usd: null, latency_ms,
      outcome: 'ok', http_status: null, detail: null, started_at: new Date(started).toISOString(),
    };
  }

  async #record(row: LogRow): Promise<void> {
    this.log.push(row);
    await this.#budget.add(row);
  }

  #backoff(n: number): number {
    const base = 1000 * 2 ** (n - 1);
    return base + Math.floor(this.#random() * base);
  }
}
