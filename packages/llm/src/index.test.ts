import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLLMClient, PROMPT_VERSION, SYSTEM_PROMPT } from './index.js';

function mockFetchOnce(response: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.json,
      text: async () => response.text ?? '',
    })),
  );
}

describe('createLLMClient — stub (no key)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns deterministic stub text and makes no network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const client = createLLMClient({}); // no apiKey, env unset in test
    const out = await client.draftAssessment('Học sinh tiến bộ tốt.');
    expect(out).toContain('AI nhận xét nháp');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('createLLMClient — metadata (T8 audit trail)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stub client exposes model="stub" and promptVersion=PROMPT_VERSION', () => {
    const client = createLLMClient({});
    expect(client.model).toBe('stub');
    expect(client.promptVersion).toBe(PROMPT_VERSION);
  });

  it('real client exposes the resolved model (no drift vs the fetch body) and promptVersion', async () => {
    mockFetchOnce({ ok: true, json: { choices: [{ message: { content: 'ok' } }] } });
    const client = createLLMClient({ apiKey: 'k', model: 'my-model' });
    expect(client.model).toBe('my-model');
    expect(client.promptVersion).toBe(PROMPT_VERSION);
    await client.draftAssessment('Buổi học tốt.');
    const [, requestInit] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(requestInit.body as string) as { model: string };
    expect(body.model).toBe(client.model);
  });
});

describe('createLLMClient — SYSTEM_PROMPT hash-lock (R1-12)', () => {
  // Hardcoded sha256(SYSTEM_PROMPT) as of PROMPT_VERSION 'v1'. If this test
  // goes red, SYSTEM_PROMPT changed — bump PROMPT_VERSION AND update this
  // literal in the same commit; do not silently re-derive it.
  const LOCKED_SYSTEM_PROMPT_SHA256 =
    'a9b8997edc178b5f612e82f71c3bdbbe118ab1c2d34d8fba8888f90eb280f0ef';

  it('SYSTEM_PROMPT matches the hash locked for the current PROMPT_VERSION', () => {
    expect(PROMPT_VERSION).toBe('v1');
    const actual = createHash('sha256').update(SYSTEM_PROMPT, 'utf8').digest('hex');
    expect(actual).toBe(LOCKED_SYSTEM_PROMPT_SHA256);
  });
});

describe('createLLMClient — stub prod-guard (R2-1: lazy, call-time only)', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  it('does NOT throw at createLLMClient() call time, even in production', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => createLLMClient({})).not.toThrow();
  });

  it('throws LLM_STUB_PROD_FORBIDDEN from draftAssessment() when NODE_ENV=production', async () => {
    process.env['NODE_ENV'] = 'production';
    const client = createLLMClient({});
    await expect(client.draftAssessment('ok')).rejects.toThrow('LLM_STUB_PROD_FORBIDDEN');
  });

  it('stub works normally when NODE_ENV is not production', async () => {
    process.env['NODE_ENV'] = 'test';
    const client = createLLMClient({});
    const out = await client.draftAssessment('ok');
    expect(out).toContain('AI nhận xét nháp');
  });
});

describe('createLLMClient — real path (with key)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts to /chat/completions and returns choices[0].message.content', async () => {
    mockFetchOnce({ ok: true, json: { choices: [{ message: { content: 'Nhận xét nháp thật.' } }] } });
    const client = createLLMClient({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' });
    const out = await client.draftAssessment('Buổi học tốt.');
    expect(out).toBe('Nhận xét nháp thật.');
    expect(fetch).toHaveBeenCalledWith(
      'https://x/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on non-2xx response', async () => {
    mockFetchOnce({ ok: false, status: 401, text: 'unauthorized' });
    const client = createLLMClient({ apiKey: 'k' });
    await expect(client.draftAssessment('ok')).rejects.toThrow(/HTTP 401/);
  });

  it('throws on unexpected response shape', async () => {
    mockFetchOnce({ ok: true, json: { choices: [] } });
    const client = createLLMClient({ apiKey: 'k' });
    await expect(client.draftAssessment('ok')).rejects.toThrow(/unexpected response shape/);
  });

  it('runs the PII guard BEFORE any network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const client = createLLMClient({ apiKey: 'k' });
    await expect(client.draftAssessment('Liên hệ 0912345678')).rejects.toThrow(
      'PII_BOUNDARY_VIOLATION',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
