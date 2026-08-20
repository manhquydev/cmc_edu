import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrevoEmailTransport, GraphEmailTransport, SmtpEmailTransport } from './email-transport.js';
import { renderOutboxEmail } from './email-templates.js';

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn();
  const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));
  return { mockSendMail, mockCreateTransport };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

const RECEIPT_PAYLOAD = { receiptId: 'r-1', studentName: 'Nguyễn An', kind: 'new' };

describe('renderOutboxEmail', () => {
  it('renders a receipt notification with the student name (escaped)', () => {
    const out = renderOutboxEmail({ ...RECEIPT_PAYLOAD, studentName: 'A <b>' });
    expect(out.subject).toContain('A <b>');
    expect(out.html).toContain('A &lt;b&gt;'); // escaped in HTML body
    expect(out.text.length).toBeGreaterThan(0);
  });

  it('falls back to a generic message for unknown payloads', () => {
    const out = renderOutboxEmail({ foo: 'bar' });
    expect(out.subject).toBe('CMC EDU — Thông báo');
    expect(out.html).not.toHaveLength(0);
  });
});

describe('BrevoEmailTransport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs rendered subject+htmlContent to Brevo', async () => {
    process.env.BREVO_API_KEY = 'k';
    const fetchSpy = vi.fn(async (_url: unknown, _opts: unknown) => ({ ok: true, status: 201, text: async () => '' }));
    vi.stubGlobal('fetch', fetchSpy);
    await new BrevoEmailTransport().send({ id: 'e1', to: 'p@x.com', payload: RECEIPT_PAYLOAD });
    const opts = fetchSpy.mock.calls[0]![1] as { body: string };
    const body = JSON.parse(opts.body);
    expect(body.subject).toContain('Nguyễn An');
    expect(body.htmlContent).toContain('CMC EDU');
    expect(body.to).toEqual([{ email: 'p@x.com' }]);
  });

  it('throws on non-2xx', async () => {
    process.env.BREVO_API_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, text: async () => 'bad' })));
    await expect(
      new BrevoEmailTransport().send({ id: 'e1', to: 'p@x.com', payload: RECEIPT_PAYLOAD }),
    ).rejects.toThrow(/HTTP 400/);
  });
});

describe('GraphEmailTransport', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setGraphEnv(): void {
    process.env.GRAPH_TENANT_ID = 't';
    process.env.GRAPH_CLIENT_ID = 'c';
    process.env.GRAPH_CLIENT_SECRET = 's';
    process.env.GRAPH_SENDER_EMAIL = 'noreply@cmc.edu';
  }

  it('fetches a token then POSTs sendMail (202)', async () => {
    setGraphEnv();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }), text: async () => '' })
      .mockResolvedValueOnce({ ok: true, status: 202, text: async () => '' });
    vi.stubGlobal('fetch', fetchSpy);

    await new GraphEmailTransport().send({ id: 'e1', to: 'p@x.com', payload: RECEIPT_PAYLOAD });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const tokenCall = fetchSpy.mock.calls[0] as unknown as [string, unknown];
    expect(String(tokenCall[0])).toContain('/oauth2/v2.0/token');
    const sendCall = fetchSpy.mock.calls[1] as unknown as [string, { body: string }];
    expect(String(sendCall[0])).toContain('/sendMail');
    const msg = JSON.parse(sendCall[1].body);
    expect(msg.message.subject).toContain('Nguyễn An');
    expect(msg.message.toRecipients[0].emailAddress.address).toBe('p@x.com');
  });

  it('throws when the token request fails', async () => {
    setGraphEnv();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'no' })));
    await expect(
      new GraphEmailTransport().send({ id: 'e1', to: 'p@x.com', payload: RECEIPT_PAYLOAD }),
    ).rejects.toThrow(/token HTTP 401/);
  });

  it('constructor throws when env vars are missing', () => {
    delete process.env.GRAPH_TENANT_ID;
    delete process.env.GRAPH_CLIENT_ID;
    delete process.env.GRAPH_CLIENT_SECRET;
    delete process.env.GRAPH_SENDER_EMAIL;
    expect(() => new GraphEmailTransport()).toThrow(/missing required env vars/);
  });
});

describe('SmtpEmailTransport', () => {
  afterEach(() => {
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
  });

  it('sends rendered subject+html via nodemailer', async () => {
    process.env.SMTP_URL = 'smtp://user:pass@localhost:587';
    process.env.SMTP_FROM = 'noreply@cmc.edu';
    mockSendMail.mockResolvedValue({});

    await new SmtpEmailTransport().send({ id: 'e1', to: 'p@x.com', payload: RECEIPT_PAYLOAD });

    const rendered = renderOutboxEmail(RECEIPT_PAYLOAD);
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'noreply@cmc.edu',
      to: 'p@x.com',
      subject: rendered.subject,
      html: rendered.html,
    });
  });

  it('throws when sendMail rejects', async () => {
    process.env.SMTP_URL = 'smtp://user:pass@localhost:587';
    process.env.SMTP_FROM = 'noreply@cmc.edu';
    mockSendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      new SmtpEmailTransport().send({ id: 'e1', to: 'p@x.com', payload: RECEIPT_PAYLOAD }),
    ).rejects.toThrow(/smtp down/);
  });
});
