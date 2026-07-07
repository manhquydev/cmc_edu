// @cmc/llm — LLM client interface + deterministic stub.
//
// The ONLY approved LLM entry-point for this monorepo. Procedures that need
// AI-drafted text import `createLLMClient()` here, never a vendor SDK
// directly — this keeps the real key out of business logic and lets tests run
// entirely offline via the stub.
//
// TL13 §5 PII constraint: `assertNoPii` is called at this boundary before any
// provider path executes. Callers must not include student fullName, phone, or
// other PII in the prompt — the guard detects phone patterns and throws.

import { assertNoPii } from './pii-guard.js';

export interface LLMClient {
  /**
   * Returns an AI-drafted assessment comment string for the given prompt.
   * The real implementation would call an external LLM API; the stub (used
   * when no API key is present) returns a deterministic fixed string so
   * offline tests produce stable, assertable output.
   */
  draftAssessment(prompt: string): Promise<string>;
}

/**
 * Creates an LLMClient.
 *
 * When `opts.apiKey` is absent (or the env var `LLM_API_KEY` is not set),
 * returns the DETERMINISTIC STUB — no network calls, no key required (offline
 * tests). When a key is present, returns the real client that calls an
 * OpenAI-compatible `/chat/completions` endpoint (`LLM_BASE_URL`/`LLM_MODEL`).
 */
const DEFAULT_BASE_URL = 'https://router.clawcmc.io.vn/v1';
const DEFAULT_MODEL = 'ag/gemini-3.5-flash-low';

// System instruction: keep output a short Vietnamese draft comment. The draft
// is never auto-published — staff review + confirm downstream (AI draft-only).
const SYSTEM_PROMPT =
  'Bạn soạn NHÁP nhận xét buổi học bằng tiếng Việt, ngắn gọn, khách quan, ' +
  'không suy diễn thông tin ngoài dữ liệu được cung cấp. Trả về đúng nội dung nhận xét.';

export function createLLMClient(opts?: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): LLMClient {
  const apiKey = opts?.apiKey ?? process.env['LLM_API_KEY'];

  if (!apiKey) {
    return {
      async draftAssessment(prompt: string): Promise<string> {
        assertNoPii(prompt);
        console.log('[LLMClient stub] draftAssessment prompt:', prompt);
        return 'AI nhận xét nháp: [tóm tắt buổi học]';
      },
    };
  }

  // Real provider path — OpenAI-compatible /chat/completions (router.clawcmc).
  // `assertNoPii` runs BEFORE any network call (TL13 §5). Prompt content is
  // never logged (may carry student data); only length is emitted.
  const baseUrl = (opts?.baseUrl ?? process.env['LLM_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = opts?.model ?? process.env['LLM_MODEL'] ?? DEFAULT_MODEL;

  return {
    async draftAssessment(prompt: string): Promise<string> {
      assertNoPii(prompt);
      console.log('[LLMClient real] draftAssessment prompt length:', prompt.length);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          // Non-streaming: the router defaults to SSE (`data: {...}`) otherwise,
          // which is not a single JSON body. We want one JSON response.
          stream: false,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '<no body>');
        throw new Error(`LLMClient: HTTP ${response.status} — ${detail}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('LLMClient: unexpected response shape (no choices[0].message.content)');
      }
      return content;
    },
  };
}
