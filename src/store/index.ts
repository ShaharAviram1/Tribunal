// The one place that chooses a storage implementation. Everything reads through the interface.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FileStore } from './file-store.ts';
import { SupabaseStore } from './supabase-store.ts';

// Where the file store keeps its deliberations. The default is the repository's own runs/, so the
// scripts and the offline suite are unchanged; the container sets TRIBUNAL_RUNS_DIR to the mounted
// volume (deploy/docker-compose.yml) so a deliberation outlives the container.
export const runsRoot = (): string => process.env.TRIBUNAL_RUNS_DIR ?? join(process.cwd(), 'runs');

// The repository's committed runs are evidence, not state: they ship inside the image and must
// still resolve when the live root is a volume somewhere else. An id that exists under the
// repository's runs/ is read from there; every other id belongs to the live root. Nothing is
// copied on start, so a committed run cannot be written over by a live one.
export const storeRootFor = (deliberation_id: string): string => {
  const live = runsRoot();
  const committed = join(process.cwd(), 'runs');
  return live !== committed && existsSync(join(committed, deliberation_id)) ? committed : live;
};

// A deliberation id reaches a handler from the query string, and the file store turns it into a
// path. One path segment of the ids the system assigns, and nothing else: without this, a
// traversal in the id would name a directory outside the root.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function makeStore(deliberation_id: string): FileStore | SupabaseStore {
  const kind = process.env.TRIBUNAL_STORE ?? 'file';
  if (kind === 'file') {
    if (!SAFE_ID.test(deliberation_id)) throw new Error(`not a deliberation id: ${JSON.stringify(deliberation_id)}`);
    return new FileStore(storeRootFor(deliberation_id), deliberation_id);
  }
  if (kind === 'supabase') {
    const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('TRIBUNAL_STORE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return new SupabaseStore({ url, serviceKey: key, deliberation_id });
  }
  throw new Error(`unknown TRIBUNAL_STORE: ${kind}`);
}
