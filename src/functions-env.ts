// Environment validation for the Netlify functions. A function with a missing variable fails
// loudly with the missing names and makes no model call; a silent default is the failure mode
// this exists to prevent. A missing TRIBUNAL_STORE falling back to the file store would write a
// deliberation into a filesystem that disappears with the invocation and call it success.
export function checkEnv(required: string[]): { ok: true } | { ok: false; response: Response } {
  const missing = required.filter((k) => !process.env[k]);
  const wrong: string[] = [];
  if (process.env.TRIBUNAL_STORE && process.env.TRIBUNAL_STORE !== 'supabase') {
    wrong.push(`TRIBUNAL_STORE must be "supabase" in a deployed function, got "${process.env.TRIBUNAL_STORE}": the file store writes into a filesystem that vanishes with the invocation`);
  }
  if (missing.length === 0 && wrong.length === 0) return { ok: true };
  const body = { error: 'environment invalid; no model call was made', missing, wrong };
  return { ok: false, response: new Response(JSON.stringify(body, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } }) };
}
export const FILE_ENV = ['TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
export const RUN_ENV = ['TRIBUNAL_FUNCTION_SECRET', 'TRIBUNAL_STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY'];
