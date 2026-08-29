// The one place that talks to OpenRouter. Exact model, fallbacks off, no JSON mode.
import type { Transport } from './model-client.ts';

const REFUSAL_FINISH = new Set(['content_filter']);

export function openRouterTransport(apiKey: string, fetchImpl: typeof fetch = fetch): Transport {
  return async ({ model, prompt, temperature, timeout_ms, max_tokens }) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout_ms);
    try {
      const res = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: ctl.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, temperature, max_tokens, messages: [{ role: 'user', content: prompt }],
          provider: { allow_fallbacks: false }, usage: { include: true },
        }),
      });
      let body: any = null;
      try { body = await res.json(); } catch { /* fall through */ }
      if (!res.ok) {
        const detail = body?.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 403 && /moderation|flagged|refus/i.test(detail)) return { kind: 'refusal', model_served: null, http_status: res.status, detail };
        return { kind: 'transport_error', http_status: res.status, detail };
      }
      const choice = body?.choices?.[0];
      const finish = choice?.finish_reason ?? null;
      const text: string = choice?.message?.content ?? '';
      const served: string | null = body?.model ?? null;
      if (REFUSAL_FINISH.has(finish) || (text.trim() === '' && choice?.message?.refusal)) {
        return { kind: 'refusal', model_served: served, http_status: res.status, detail: choice?.message?.refusal ?? `finish_reason=${finish}` };
      }
      return {
        kind: 'ok', text, model_served: served, http_status: res.status, finish_reason: finish,
        tokens_in: body?.usage?.prompt_tokens ?? null, tokens_out: body?.usage?.completion_tokens ?? null,
        cost_usd: body?.usage?.cost ?? null, temperature_honoured: null,
      };
    } catch (e: any) {
      if (e?.name === 'AbortError') return { kind: 'timeout' };
      return { kind: 'transport_error', http_status: null, detail: String(e?.message ?? e) };
    } finally {
      clearTimeout(timer);
    }
  };
}
