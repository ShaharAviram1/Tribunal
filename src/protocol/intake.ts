// The clerk: drafts a case from a submitted scenario. Runs only inside the background
// function, because a drafting call cannot fit a synchronous ceiling (learned live, 2026-09-01,
// as a gateway 504). One corrective retry restating the required shape; on failure the docket
// and the job both say so; nothing is repaired or substituted.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModelClient, hashPrompt, type Caps } from '../client/model-client.ts';
import { openRouterTransport } from '../client/openrouter-transport.ts';
import type { SupabaseStore } from '../store/supabase-store.ts';
import { parseObject } from './parse-object.ts';
import { validateChargeSheet } from './validate-charge-sheet.ts';
import { validateSketches, type Sketch } from './validate-sketches.ts';
import { stampChargeSheet } from './stamp.ts';
import type { StoredChargeSheet } from './types.ts';

export type DraftResult = { ok: true; sheet: StoredChargeSheet & { sketches: Sketch[] } } | { ok: false; failures: string[] };

export async function draftCase(o: {
  scenario: string; caseId: string; deliberation_id: string; store: SupabaseStore;
  caps: Caps; url: string; serviceKey: string; apiKey: string;
}): Promise<DraftResult> {
  const base = o.url.replace(/\/$/, '');
  const headers = { apikey: o.serviceKey, Authorization: `Bearer ${o.serviceKey}`, 'Content-Type': 'application/json' };
  const modelsConfig = JSON.parse(readFileSync(join(process.cwd(), 'config/models.json'), 'utf8'));
  const intakeModel: string = modelsConfig.intake;
  const provenance = { kind: 'intake', scenario_words: o.scenario.trim().split(/\s+/).length, intake_model: intakeModel, drafted_at: new Date().toISOString() };
  const promptFile = readFileSync(join(process.cwd(), 'prompts', '_intake.md'), 'utf8').replace(/^<!--[\s\S]*?-->\n?/, '').trim();
  const prompt = `${promptFile}\n\nThe submitted scenario:\n${o.scenario}`;
  const shape = extractShape(promptFile);
  const client = new ModelClient({
    caps: o.caps, models: { intake: intakeModel }, deliberation_id: o.deliberation_id, budget: o.store,
    transport: openRouterTransport(o.apiKey),
    freeFallbacks: modelsConfig.free_fallbacks ?? [], roleFallbacks: modelsConfig.role_fallbacks ?? {},
  });
  const job = (await o.store.getJob()) as Record<string, unknown>;

  let failures: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = attempt === 1 ? prompt : `${prompt}\n\n${correctiveBlock(failures, shape)}`;
    const call = await client.call({ role_id: 'intake', prompt: text, hash: hashPrompt(text), attempt });
    if (call.outcome !== 'ok') {
      const detail = `intake call ${call.outcome}`;
      await failIntake(base, headers, o.store, job, o.caseId, provenance, [detail]);
      return { ok: false, failures: [detail] };
    }
    const parsed = parseObject(call.text);
    if (!parsed.ok) { failures = [`response: ${parsed.detail}`]; continue; }
    const sheetResult = validateChargeSheet(parsed.obj.charge_sheet);
    const sketchResult = validateSketches(parsed.obj.sketches);
    failures = [
      ...(sheetResult.ok ? [] : sheetResult.failures.map((f) => `charge_sheet: ${f.code} — ${f.field}`)),
      ...(sketchResult.ok ? [] : sketchResult.failures.map((f) => `sketches: ${f.code} — ${f.detail}`)),
    ];
    if (sheetResult.ok && sketchResult.ok) {
      const stamped = stampChargeSheet(sheetResult.sheet, o.caseId);
      const body = { ...stamped, sketches: sketchResult.sketches, provenance };
      await fetch(`${base}/rest/v1/charge_sheets?case_id=eq.${o.caseId}`, { method: 'PATCH', headers, body: JSON.stringify({ body }) });
      return { ok: true, sheet: body as StoredChargeSheet & { sketches: Sketch[] } };
    }
  }
  await failIntake(base, headers, o.store, job, o.caseId, provenance, failures);
  return { ok: false, failures };
}

async function failIntake(base: string, headers: Record<string, string>, store: SupabaseStore, job: Record<string, unknown>, caseId: string, provenance: Record<string, unknown>, failures: string[]): Promise<void> {
  await store.putJob({ ...job, status: 'failed', terminal_reason: 'intake produced no valid case' });
  await fetch(`${base}/rest/v1/charge_sheets?case_id=eq.${caseId}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ body: { drafting_failed: true, accused: '(intake failed)', deceased: '(intake failed)', provenance, failures } }),
  });
}

// The corrective block restates the required shape verbatim from the intake prompt and names
// every failure; it never rephrases the task (spec.md criterion 6).
function correctiveBlock(failures: string[], shape: string): string {
  return ['Your previous response could not be accepted.', `What failed: ${failures.join('; ')}.`, 'Return your response again in the required form:', shape].join('\n\n');
}

function extractShape(promptText: string): string {
  const m = promptText.match(/```\n([\s\S]*?)\n```/);
  return m ? m[1]! : promptText;
}
