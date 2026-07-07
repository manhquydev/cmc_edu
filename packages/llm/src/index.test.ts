import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLLMClient } from './index.js';

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
