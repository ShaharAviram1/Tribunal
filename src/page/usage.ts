// Per-seat usage from log rows: cost and tokens summed across every attempt for the role.
import type { LogRow } from '../client/model-client.ts';
import type { RoleUsage } from './render-case.ts';

export function usageFromLog(rows: LogRow[]): Record<string, RoleUsage> {
  const u: Record<string, RoleUsage> = {};
  for (const r of rows) {
    const x = (u[r.role_id] ??= { cost_usd: 0, tokens_in: 0, tokens_out: 0, attempts: 0 });
    x.attempts += 1;
    x.cost_usd += r.cost_usd ?? 0;
    x.tokens_in += r.tokens_in ?? 0;
    x.tokens_out += r.tokens_out ?? 0;
  }
  return u;
}
