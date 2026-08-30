// The one place that chooses a storage implementation. Everything reads through the interface.
import { join } from 'node:path';
import { FileStore } from './file-store.ts';
import { SupabaseStore } from './supabase-store.ts';

export function makeStore(deliberation_id: string): FileStore | SupabaseStore {
  const kind = process.env.TRIBUNAL_STORE ?? 'file';
  if (kind === 'file') return new FileStore(join(process.cwd(), 'runs'), deliberation_id);
  if (kind === 'supabase') {
    const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('TRIBUNAL_STORE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return new SupabaseStore({ url, serviceKey: key, deliberation_id });
  }
  throw new Error(`unknown TRIBUNAL_STORE: ${kind}`);
}
