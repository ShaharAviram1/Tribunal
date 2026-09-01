// The only code that knows the key, the caps, the temperature, the transport retry policy,
// and the log row format (spec.md part three). Caps are read at construction and cannot be
// raised afterwards; call count and spend are read from and written to the job via `budget`,
// never held in process memory alone (spec.md criteria 1, 2, 10; part three, platform retry).
// No provider-side JSON mode; fallback routing disabled; served model logged beside requested.

import { createHash } from 'node:crypto';
import { stripOuterFence } from '../protocol/parse-object.ts';

export type Caps = {
  max_calls_per_deliberation: number;
  max_spend_usd_per_deliberation: number;
  max_attempts_per_role: number;
  transport_retries_per_call: number;
  call_timeout_ms: number;
  temperature: number;
  max_output_tokens: number;
  transport_backoff_base_ms: number;
  truncation_retry_ceiling_multiplier: number;
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
  outcome: 'ok' | 'refusal' | 'forbidden' | 'transport_error' | 'cap_exceeded' | 'timeout';
  max_output_tokens: number;
  finish_reason: string | null;
  http_status: number | null;
  detail: string | null;
  started_at: string;
};

export type CallRequest = { role_id: string; prompt: string; hash: string; attempt: number; max_output_tokens?: number };
export type CallResult =
  | { outcome: 'ok'; text: string; truncated: boolean; row: LogRow }
  | { outcome: 'refusal'; row: LogRow }
  | { outcome: 'forbidden'; row: LogRow }
  | { outcome: 'transport_error'; row: LogRow }
  | { outcome: 'cap_exceeded'; row: LogRow };

// Budget lives on the job row. The client reads and writes through this interface so a fresh
// invocation of the function never gets a fresh budget.
export type Budget = {
  read(): Promise<{ calls: number; spend_usd: number }>;
  add(row: LogRow): Promise<void>;
};

export type Transport = (req: {
  model: string; prompt: string; temperature: number; timeout_ms: number; max_tokens: number;
}) => Promise<
  | { kind: 'ok'; text: string; model_served: string | null; tokens_in: number | null; tokens_out: number | null; cost_usd: number | null; http_status: number; temperature_honoured: boolean | null; finish_reason: string | null }
  | { kind: 'refusal'; model_served: string | null; http_status: number; detail: string }
  | { kind: 'forbidden'; http_status: number; detail: string }
  | { kind: 'transport_error'; http_status: number | null; detail: string }
  | { kind: 'timeout' }
>;

export type ModelClientOptions = {
  caps: Caps;
  models: Record<string, string>;
  freeFallbacks?: string[];
  roleFallbacks?: Record<string, string[]>;
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
  readonly #models: Record<string, string>;
  readonly #fallbacks: readonly string[];
  readonly #roleFallbacks: Record<string, string[]>;
  readonly #reassigned: Record<string, string[]> = {};
  readonly #id: string;
  readonly #budget: Budget;
  readonly #transport: Transport;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #random: () => number;
  readonly #now: () => number;

  constructor(o: ModelClientOptions) {
    this.#caps = Object.freeze({ ...o.caps });
    this.#models = { ...o.models };
    this.#fallbacks = o.freeFallbacks ?? [];
    this.#roleFallbacks = o.roleFallbacks ?? {};
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

  // Reassign a seat to its next configured fallback model. Called by the protocol ONLY after a
  // role has failed all its retries; never because of what a stance said, and never on a
  // provider-signalled refusal (correction, 2026-09-02: the fallback ruling covered failure,
  // not refusal). Returns the new model or null when the chain is exhausted.
  reassignToFallback(role_id: string): string | null {
    const used = (this.#reassigned[role_id] ??= []);
    const next = (this.#roleFallbacks[role_id] ?? []).find((m) => !used.includes(m) && m !== this.#models[role_id]);
    if (!next) return null;
    used.push(next);
    this.#models[role_id] = next;
    return next;
  }

  // A rate or quota status on a free model advances the role to the next free model in the
  // configured chain. Explicit, ordered, and never silent: every attempt logs the model it
  // actually requested, and the caller records the model that finally served the role.
  #rotate(role_id: string, current: string, status: number | null): string | null {
    if (![429, 402, 404, 503].includes(status ?? 0)) return null;
    const i = this.#fallbacks.indexOf(current);
    if (i < 0 || i + 1 >= this.#fallbacks.length) return null;
    const next = this.#fallbacks[i + 1]!;
    this.#models[role_id] = next;
    return next;
  }

  // One logical call. Transport failures are retried here with backoff and jitter, each attempt
  // writing its own row and counting toward the call cap. Refusal and ok return immediately.
  async call(req: CallRequest): Promise<CallResult> {
    let model = this.modelFor(req.role_id);
    let last: CallResult | null = null;
    for (let t = 0; t <= this.#caps.transport_retries_per_call; t++) {
      if (t > 0) await this.#sleep(this.#backoff(t));
      const gate = await this.#gate(req, model);
      if (gate) return gate;
      const started = this.#now();
      const ceiling = req.max_output_tokens ?? this.#caps.max_output_tokens;
      const res = await this.#transport({ model, prompt: req.prompt, temperature: this.#caps.temperature, timeout_ms: this.#caps.call_timeout_ms, max_tokens: ceiling });
      const latency_ms = this.#now() - started;
      const base = { ...this.#row(req, model, latency_ms, started), max_output_tokens: ceiling };
      if (res.kind === 'ok') {
        const row: LogRow = { ...base, outcome: 'ok', model_served: res.model_served, model_mismatch: res.model_served !== null && res.model_served !== model,
          tokens_in: res.tokens_in, tokens_out: res.tokens_out, cost_usd: res.cost_usd, http_status: res.http_status, temperature_honoured: res.temperature_honoured,
          finish_reason: res.finish_reason, detail: stripOuterFence(res.text).fence_stripped ? 'fence_stripped: a single outer code fence was stripped before parsing' : null };
        await this.#record(row);
        return { outcome: 'ok', text: res.text, truncated: res.finish_reason === 'length', row };
      }
      if (res.kind === 'refusal') {
        const row: LogRow = { ...base, outcome: 'refusal', model_served: res.model_served, model_mismatch: res.model_served !== null && res.model_served !== model, http_status: res.http_status, detail: res.detail };
        await this.#record(row);
        return { outcome: 'refusal', row };
      }
      if (res.kind === 'forbidden') {
        // Its own condition: one row, the provider body verbatim, zero retries of any kind.
        const row: LogRow = { ...base, outcome: 'forbidden', http_status: res.http_status, detail: res.detail };
        await this.#record(row);
        return { outcome: 'forbidden', row };
      }
      const row: LogRow = res.kind === 'timeout'
        ? { ...base, outcome: 'timeout', detail: `no response within ${this.#caps.call_timeout_ms}ms` }
        : { ...base, outcome: 'transport_error', http_status: res.http_status, detail: res.detail };
      const rotated = res.kind === 'transport_error' ? this.#rotate(req.role_id, model, res.http_status) : null;
      if (rotated) { row.detail = `${row.detail} — advancing to ${rotated}`; model = rotated; }
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
      max_output_tokens: req.max_output_tokens ?? this.#caps.max_output_tokens, finish_reason: null,
    };
  }

  async #record(row: LogRow): Promise<void> {
    this.log.push(row);
    await this.#budget.add(row);
  }

  #backoff(n: number): number {
    // Base is long enough that two retries span a free-tier per-minute window (15 s, 30 s + jitter).
    const base = this.#caps.transport_backoff_base_ms * 2 ** (n - 1);
    return base + Math.floor(this.#random() * base);
  }
}
