// Fake ModelClient and Store for driving src/protocol/run.ts offline.
// The client is scripted per role: each call to a role consumes the next scripted response.
// The store is an in-memory map. Neither touches the network or the filesystem.
import type { ModelClient, Store } from '../../src/protocol/run.ts';

export type ScriptedResponse =
  | { outcome: 'ok'; text: string }
  | { outcome: 'refusal' }
  | { outcome: 'transport_error' }
  | { outcome: 'cap_exceeded' };

export type CallRecord = {
  seq: number;
  role_id: string;
  prompt: string;
  hash: string;
  outcome: ScriptedResponse['outcome'];
  // How many calls were in flight (this one included) when this call started.
  inFlightAtStart: number;
  // Role ids whose calls had already resolved when this call started.
  completedBefore: string[];
};

export type FakeLogRow = {
  role_id: string;
  hash: string;
  outcome: ScriptedResponse['outcome'];
  attempt: number;
};

export type FakeClient = ModelClient & {
  log: FakeLogRow[];
  calls: CallRecord[];
  callsFor(role_id: string): CallRecord[];
  promptsFor(role_id: string): string[];
};

// A tiny async gap so that calls issued concurrently overlap and calls issued
// sequentially do not. A sequential protocol sees inFlightAtStart === 1 on every call.
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 2));

export function makeClient(script: Record<string, ScriptedResponse[]>): FakeClient {
  const queues: Record<string, ScriptedResponse[]> = {};
  for (const [role, responses] of Object.entries(script)) queues[role] = [...responses];
  const log: FakeLogRow[] = [];
  const calls: CallRecord[] = [];
  const completed: string[] = [];
  const attempts: Record<string, number> = {};
  let inFlight = 0;
  let seq = 0;

  const client: FakeClient = {
    log,
    calls,
    callsFor: (role_id) => calls.filter((c) => c.role_id === role_id),
    promptsFor: (role_id) => calls.filter((c) => c.role_id === role_id).map((c) => c.prompt),
    async call(req: { role_id: string; prompt: string; hash: string }) {
      const queue = queues[req.role_id];
      const next = queue?.shift();
      if (!next) {
        throw new Error(`fake client: no scripted response left for ${req.role_id} (call #${seq + 1})`);
      }
      inFlight += 1;
      attempts[req.role_id] = (attempts[req.role_id] ?? 0) + 1;
      const record: CallRecord = {
        seq: seq++,
        role_id: req.role_id,
        prompt: req.prompt,
        hash: req.hash,
        outcome: next.outcome,
        inFlightAtStart: inFlight,
        completedBefore: [...completed],
      };
      calls.push(record);
      // One row per attempt, whatever the outcome (spec.md criterion 7).
      log.push({ role_id: req.role_id, hash: req.hash, outcome: next.outcome, attempt: attempts[req.role_id]! });
      await tick();
      inFlight -= 1;
      completed.push(req.role_id);
      return next;
    },
  };
  return client;
}

export type FakeStore = Store & {
  outputs: Map<string, unknown>;
  jobs: unknown[];
  claimResult: boolean;
  claimCalls: number;
};

export function makeStore(opts: { outputs?: Record<string, unknown>; job?: unknown; claim?: boolean } = {}): FakeStore {
  const outputs = new Map<string, unknown>(Object.entries(opts.outputs ?? {}));
  let job: unknown = opts.job;
  const jobs: unknown[] = [];
  const store: FakeStore = {
    outputs,
    jobs,
    claimResult: opts.claim ?? true,
    claimCalls: 0,
    getOutput: (role_id: string) => outputs.get(role_id),
    putOutput: (role_id: string, obj: unknown) => {
      outputs.set(role_id, obj);
    },
    getJob: () => job,
    putJob: (next: unknown) => {
      job = next;
      jobs.push(next);
    },
    claim: () => {
      store.claimCalls += 1;
      return store.claimResult;
    },
  } as FakeStore;
  return store;
}

// Recursively collect every key name in an object graph.
export function allKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) allKeys(v, acc);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      acc.push(k);
      allKeys(v, acc);
    }
  }
  return acc;
}

// Recursively collect every string value in an object graph.
export function allStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) for (const v of value) allStrings(v, acc);
  else if (value && typeof value === 'object') for (const v of Object.values(value as Record<string, unknown>)) allStrings(v, acc);
  return acc;
}
