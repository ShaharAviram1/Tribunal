// Scenario submission, retired 2026-09-05 by decision (spec.md part two, step 0). The endpoint
// stays so a stale page or a bookmarked call gets a plain answer instead of a 404 that looks
// like a broken site. Nothing is drafted; the clerk (src/protocol/intake.ts) is reached by nothing.
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  return json({ error: 'scenario submission was retired on 2026-09-05; choose a case from the docket and convene it' }, 503);
};

const json = (b: unknown, status: number) => new Response(JSON.stringify(b, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
