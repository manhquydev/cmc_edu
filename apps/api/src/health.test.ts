// Smoke test: the health procedure returns { status: 'ok', ts } (US-001 AC).

import { describe, expect, it } from 'vitest';
import { appRouter } from './router.js';
import { createContext } from './context.js';

describe('health procedure', () => {
  it('returns status ok with an ISO timestamp', async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.health();

    expect(result.status).toBe('ok');
    expect(typeof result.ts).toBe('string');
    expect(Number.isNaN(Date.parse(result.ts))).toBe(false);
  });
});
