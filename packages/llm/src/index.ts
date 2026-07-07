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
 * returns the DETERMINISTIC STUB — no network calls, no key required. The
 * stub logs the full prompt to `console.log` for test visibility.
 *
 * Stop-condition: swap the stub body for a real provider call once a key is
 * provisioned (roadmap continues with stub in the meantime).
 */
export function createLLMClient(opts?: { apiKey?: string }): LLMClient {
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

  // Real provider path — placeholder for when a key is available.
  // The prompt contract (no PII, versioned template) is documented at TL13 §5.
  return {
    async draftAssessment(prompt: string): Promise<string> {
      assertNoPii(prompt);
      console.log('[LLMClient real] draftAssessment prompt length:', prompt.length);
      // TODO(stop-condition): call external LLM API using `apiKey`.
      // Until then, fall back to stub behavior so the binary stays deployable.
      return 'AI nhận xét nháp: [tóm tắt buổi học]';
    },
  };
}
