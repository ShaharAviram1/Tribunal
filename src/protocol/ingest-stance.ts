import type { EmittedStance, StoredStance } from './types.ts';

export function ingestStance(stance: EmittedStance, role_id: string, seat: 'defense' | 'prosecution', deliberation_id: string): StoredStance {
  return { role_id, seat, deliberation_id, position: stance.position, points: stance.points.map((p, i) => ({ id: `${role_id}.p${i + 1}`, claim: p.claim, support: p.support })) };
}
