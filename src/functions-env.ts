// Environment validation for the handlers. A handler with a missing variable fails loudly with
// the missing names and makes no model call; a silent default is the failure mode this exists to
// prevent. A missing TRIBUNAL_STORE falling back to the file store would write a deliberation
// into a filesystem that disappears with the invocation and call it success.
//
// TRIBUNAL_PERSISTENT_HOST=1 is the one exception, and it exists because that last sentence
// stopped being true on 2026-09-18: the site now runs as a long-lived container on the owner's
// host with a volume mounted at TRIBUNAL_RUNS_DIR, so the filesystem outlives the request and the
// file store is the right store, not a silent default. The flag is set by the host that owns the
// volume (deploy/docker-compose.yml), never by a function platform, so a Netlify or Render deploy
// still refuses TRIBUNAL_STORE=file exactly as before. With the flag set and the store set to
// file, the SUPABASE_* variables are not required; every other variable is still named when it
// is missing.
export function checkEnv(required: string[]): { ok: true } | { ok: false; response: Response } {
  const store = process.env.TRIBUNAL_STORE;
  const fileOnPersistentHost = persistentHost() && store === 'file';
  const wanted = fileOnPersistentHost ? required.filter((k) => !k.startsWith('SUPABASE_')) : required;
  const missing = wanted.filter((k) => !process.env[k]);
  const wrong: string[] = [];
  if (store && store !== 'supabase' && !fileOnPersistentHost) {
    wrong.push(persistentHost()
      ? `TRIBUNAL_STORE must be "file" or "supabase", got "${store}"`
      : `TRIBUNAL_STORE must be "supabase" in a deployed function, got "${store}": the file store writes into a filesystem that vanishes with the invocation`);
  }
  if (missing.length === 0 && wrong.length === 0) return { ok: true };
  const body = { error: 'environment invalid; no model call was made', missing, wrong };
  return { ok: false, response: new Response(JSON.stringify(body, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } }) };
}
export const persistentHost = (): boolean => process.env.TRIBUNAL_PERSISTENT_HOST === '1';
export const FILE_ENV = ['TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
export const RUN_ENV = ['TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY'];
