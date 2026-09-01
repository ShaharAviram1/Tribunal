// The protocol: order of calls, id assignment, validation, retry or fail. Deterministic code with
// no model call of its own (spec.md part three). Two concurrent stages. Resumes from stored state.
// Resolves with the terminal job state; throws only on programmer error (criterion 18).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemblePrompt, ADVOCATES, JUDGES, type RoleId } from '../prompt/assemble.ts';
import { validateStance } from './validate-stance.ts';
import { ingestStance } from './ingest-stance.ts';
import { validateOpinion } from './validate-opinion.ts';
import type { StoredChargeSheet, StoredStance, StoredOpinion, FailureRecord } from './types.ts';

export type CallOutcome =
  | { outcome: 'ok'; text: string; truncated?: boolean; row?: { model_requested?: string } }
  | { outcome: 'refusal' }
  | { outcome: 'transport_error' }
  | { outcome: 'cap_exceeded' };
export type ModelClient = {
  call(req: { role_id: string; prompt: string; hash: string; attempt: number; max_output_tokens?: number }): Promise<CallOutcome>;
  log: unknown[];
};
type MaybePromise<T> = T | Promise<T>;
export type Store = {
  getOutput(role_id: string): MaybePromise<unknown>;
  putOutput(role_id: string, obj: unknown): MaybePromise<void>;
  getJob(): MaybePromise<unknown>;
  putJob(job: unknown): MaybePromise<void>;
  claim(): MaybePromise<boolean>;
};
export type Job = {
  deliberation_id: string;
  case_id: string;
  status: 'pending' | 'running' | 'complete' | 'incomplete' | 'failed';
  stage: 'advocates' | 'judges';
  terminal_reason: string | null;
  calls: number;
  spend_usd: number;
  attempts_by_role: Record<string, number>;
  claimed_at: string | null;
  completed_roles: string[];
  failed_roles: string[];
  models: Record<string, string>;
};
export type RunDeps = {
  client: ModelClient;
  store: Store;
  chargeSheet: StoredChargeSheet;
  deliberation_id: string;
  models?: Record<string, string>;
  promptsDir?: string;
  rolesConfigPath?: string;
  caps?: { max_output_tokens: number; truncation_retry_ceiling_multiplier: number };
  now?: () => Date;
};

type RoleConfig = Record<string, { seat?: 'defense' | 'prosecution'; label?: string }>;

export async function runDeliberation(deps: RunDeps): Promise<Job> {
  const { client, store, chargeSheet, deliberation_id } = deps;
  const now = deps.now ?? (() => new Date());
  const roles: RoleConfig = JSON.parse(readFileSync(deps.rolesConfigPath ?? join(process.cwd(), 'config/roles.json'), 'utf8'));
  const caps = deps.caps ?? (JSON.parse(readFileSync(join(process.cwd(), 'config/caps.json'), 'utf8')) as { max_output_tokens: number; truncation_retry_ceiling_multiplier: number });

  const existing = (await store.getJob()) as Job | undefined;
  if (!(await store.claim())) return existing ?? blankJob(deliberation_id, chargeSheet.case_id, deps.models ?? {});

  const job: Job = existing && existing.deliberation_id === deliberation_id
    ? { ...existing, attempts_by_role: { ...existing.attempts_by_role }, completed_roles: [...existing.completed_roles], failed_roles: [...existing.failed_roles] }
    : blankJob(deliberation_id, chargeSheet.case_id, deps.models ?? {});
  job.status = 'running'; job.stage = 'advocates'; job.claimed_at = now().toISOString(); job.terminal_reason = null;
  await store.putJob({ ...job });

  let capHit: string | null = null;
  const stored = async (role: string): Promise<unknown> => (await store.getOutput(role)) ?? undefined;
  const isFailure = (o: unknown) => !!o && typeof o === 'object' && (o as FailureRecord).failed === true;
  const syncBudget = () => {
    job.calls = client.log.length;
    job.spend_usd = (client.log as { cost_usd?: number | null }[]).reduce((s, r) => s + (typeof r.cost_usd === 'number' ? r.cost_usd : 0), 0);
  };
  const markDone = async (role: string, ok: boolean) => {
    (ok ? job.completed_roles : job.failed_roles).push(role);
    syncBudget();
    await store.putJob({ ...job });
  };
  const fail = async (role: string, reason: string, attempts: FailureRecord['attempts']) => {
    const rec: FailureRecord = { failed: true, role_id: role, deliberation_id, reason, attempts };
    await store.putOutput(role, rec);
    await markDone(role, false);
  };

  // One role, start to finish. Judges: one corrective retry. Advocates: two, because a failed
  // advocate aborts the whole deliberation before the bench, and one transient flake should not
  // be the first thing a visitor sees (spec revision, 2026-09-01). The abort stays as last resort.
  const runRole = async (role: RoleId, stances?: StoredStance[]) => {
    const already = await stored(role);
    if (already !== undefined) return; // re-entry: never call a stored role again
    const isJudge = (JUDGES as readonly string[]).includes(role);
    const validIds = stances ? stances.flatMap((s) => s.points.map((p) => p.id)) : [];
    const attempts: FailureRecord['attempts'] = [];
    let corrective: string | undefined;
    let ceiling = caps.max_output_tokens;
    const rounds = (JUDGES as readonly string[]).includes(role) ? 2 : 3;
    for (let round = 0; round < rounds; round++) {
      if (capHit) { await fail(role, `not dispatched: ${capHit}`, attempts); return; }
      const attempt = (job.attempts_by_role[role] ?? 0) + 1;
      job.attempts_by_role[role] = attempt;
      const p = assemblePrompt({ role_id: role, chargeSheet, stances, corrective, promptsDir: deps.promptsDir });
      const res = await client.call({ role_id: role, prompt: p.text, hash: p.hash, attempt, max_output_tokens: ceiling });
      syncBudget();
      if (res.outcome === 'cap_exceeded') {
        capHit = capHit ?? `cap exceeded at ${job.calls} calls, ${job.spend_usd.toFixed(4)} USD`;
        attempts.push({ hash: p.hash, text: null, outcome: 'cap_exceeded', detail: capHit });
        await fail(role, capHit, attempts); return;
      }
      if (res.outcome === 'refusal') { attempts.push({ hash: p.hash, text: null, outcome: 'refusal', detail: 'provider signalled a refusal' }); await fail(role, 'refusal', attempts); return; }
      if (res.outcome === 'transport_error') { attempts.push({ hash: p.hash, text: null, outcome: 'transport_error', detail: 'transport retries exhausted' }); await fail(role, 'transport_error', attempts); return; }
      if (res.truncated) {
        // Truncation is the ceiling's failure, not the text's: one retry at a raised ceiling, same prompt,
        // no corrective text. A second truncation fails the role as truncated (spec.md criterion 6).
        attempts.push({ hash: p.hash, text: res.text, outcome: 'ok', detail: `truncated at ${ceiling} output tokens` });
        if (round === rounds - 1) { await fail(role, `truncated on all ${rounds} attempts`, attempts); return; }
        ceiling = ceiling * caps.truncation_retry_ceiling_multiplier;
        continue;
      }
      const v = isJudge ? validateOpinion(res.text, validIds) : validateStance(res.text);
      if (v.ok) {
        const used = (res as { row?: { model_requested?: string } }).row?.model_requested;
        if (used && job.models[role] !== used) job.models[role] = used; // the map records the model that actually served
        const out: StoredStance | StoredOpinion = isJudge
          ? { role_id: role, label: roles[role]?.label ?? role, deliberation_id, ...(v as { opinion: StoredOpinion }).opinion }
          : ingestStance((v as { stance: StoredStance }).stance, role, roles[role]?.seat ?? 'defense', deliberation_id);
        await store.putOutput(role, out);
        await markDone(role, true);
        return;
      }
      attempts.push({ hash: p.hash, text: res.text, outcome: 'ok', detail: `${v.kind}: ${v.detail}` });
      if (round === rounds - 1) { await fail(role, `${v.kind} on all ${rounds} attempts`, attempts); return; }
      corrective = correctiveBlock(isJudge, v.kind, v.detail, 'unresolved' in v ? v.unresolved : undefined, validIds, deps.promptsDir);
    }
  };

  // Stage one: advocates, concurrently.
  await Promise.all(ADVOCATES.map((r) => runRole(r)));
  const stances: StoredStance[] = [];
  for (const r of ADVOCATES) { const o = await stored(r); if (o !== undefined && !isFailure(o)) stances.push(o as StoredStance); }

  if (capHit) return finish(job, store, 'failed', capHit);
  if (stances.length < 4) return finish(job, store, 'incomplete', `fewer than four stances succeeded in the advocates stage (${stances.length} of 4); judges not called`);

  // Stage two: judges, concurrently, only on four stances.
  job.stage = 'judges'; await store.putJob({ ...job });
  await Promise.all(JUDGES.map((r) => runRole(r, stances)));
  if (capHit) return finish(job, store, 'failed', capHit);
  const judgeFailures = [] as string[];
  for (const r of JUDGES) if (isFailure(await stored(r))) judgeFailures.push(r);
  if (judgeFailures.length) return finish(job, store, 'incomplete', `judge column(s) ${judgeFailures.join(', ')} produced no opinion; the others stand`);
  return finish(job, store, 'complete', null);
}

async function finish(job: Job, store: Store, status: Job['status'], reason: string | null): Promise<Job> {
  job.status = status; job.terminal_reason = reason;
  await store.putJob({ ...job });
  return { ...job };
}

function blankJob(deliberation_id: string, case_id: string, models: Record<string, string>): Job {
  return { deliberation_id, case_id, status: 'pending', stage: 'advocates', terminal_reason: null, calls: 0, spend_usd: 0, attempts_by_role: {}, claimed_at: null, completed_roles: [], failed_roles: [], models: { ...models } };
}

// The corrective block restates the output format and names what failed. It never argues with a
// refusal, never rephrases the task, never adds pressure (spec.md criterion 6).
function correctiveBlock(isJudge: boolean, kind: string, detail: string, unresolved: string[] | undefined, validIds: string[], promptsDir?: string): string {
  const contract = readFileSync(join(promptsDir ?? join(process.cwd(), 'prompts'), '_contract.md'), 'utf8');
  const heading = isJudge ? '## Output contract, judges' : '## Output contract, advocates';
  const start = contract.indexOf(heading) + heading.length;
  const rest = contract.slice(start); const end = rest.indexOf('\n## ');
  const form = (end < 0 ? rest : rest.slice(0, end)).trim();
  const lines = ['Your previous response could not be accepted.', `What failed: ${detail}.`];
  if (isJudge && (kind === 'unresolvable_id' || (unresolved && unresolved.length))) {
    lines.push(`The point ids that exist in this deliberation are exactly: ${validIds.join(', ')}. Cite only these, written exactly as shown.`);
  }
  lines.push('Return your response again in the required form:', form);
  return lines.join('\n\n');
}
