// K6 remediation: pluggable email transport port. `EmailOutbox` already
// records `transport: 'graph' | 'brevo'` per row (schema.prisma), but no
// concrete Graph/Brevo integration exists yet — that lands with a later
// comms phase. This interface is the seam: `relayEmailOutbox` depends on it,
// not on a concrete provider, so swapping in the real Graph/Brevo client
// later is a one-file change with no call-site edits.

export interface OutboxEmail {
  id: string;
  to: string;
  payload: unknown;
}

export interface EmailTransport {
  send(email: OutboxEmail): Promise<void>;
}

/**
 * Default transport until a real Graph/Brevo integration lands: logs instead
 * of sending. Never throws — a stub send is not a delivery failure, so the
 * relay always marks these rows `sent` (deterministic behavior for
 * development/CI, and for any environment where comms are not yet wired up).
 */
export class ConsoleEmailTransport implements EmailTransport {
  async send(email: OutboxEmail): Promise<void> {
    // Log only non-sensitive identifiers — never the payload (may contain OTP).
    // eslint-disable-next-line no-console
    console.log(`[email-outbox] would send id=${email.id} to=${email.to}`);
  }
}

/**
 * RT-8: Brevo transactional email transport.
 * Reads BREVO_API_KEY from env at construction time — throws immediately if
 * the key is absent so the worker fails fast rather than enqueueing rows that
 * can never be delivered.
 *
 * Security: only `email.id` and `email.to` are logged. Payload content (which
 * may include OTPs or PII) is never written to stdout/stderr.
 */
export class BrevoEmailTransport implements EmailTransport {
  private readonly apiKey: string;

  constructor() {
    const key = process.env.BREVO_API_KEY;
    if (!key) {
      throw new Error('BrevoEmailTransport: BREVO_API_KEY env var is required');
    }
    this.apiKey = key;
  }

  async send(email: OutboxEmail): Promise<void> {
    // Log only non-sensitive identifiers — never the payload.
    // eslint-disable-next-line no-console
    console.log(`[brevo] sending id=${email.id} to=${email.to}`);

    const body = {
      to: [{ email: email.to }],
      // Payload shape is opaque at this layer; the caller (relay-email-outbox)
      // passes whatever the finance router stored in EmailOutbox.payload.
      ...(typeof email.payload === 'object' && email.payload !== null ? email.payload : {}),
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      throw new Error(`BrevoEmailTransport: HTTP ${response.status} — ${text}`);
    }
  }
}

/**
 * RT-8: Microsoft Graph / Exchange Online transport stub.
 * Constructor validates all required env vars (GRAPH_TENANT_ID,
 * GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER_EMAIL) — throws if any
 * is absent so the worker fails fast.
 *
 * Real implementation lands in the Entra SSO phase:
 *   1. POST /oauth2/v2.0/token (client credentials) → access_token
 *   2. POST /v1.0/users/{GRAPH_SENDER_EMAIL}/sendMail → send
 */
export class GraphEmailTransport implements EmailTransport {
  // Stored to validate env at construction; used by the real implementation.
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly senderEmail: string;

  constructor() {
    const tenantId = process.env.GRAPH_TENANT_ID;
    const clientId = process.env.GRAPH_CLIENT_ID;
    const clientSecret = process.env.GRAPH_CLIENT_SECRET;
    const senderEmail = process.env.GRAPH_SENDER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      const missing = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_SENDER_EMAIL']
        .filter((k) => !process.env[k])
        .join(', ');
      throw new Error(`GraphEmailTransport: missing required env vars: ${missing}`);
    }

    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.senderEmail = senderEmail;
  }

  async send(_email: OutboxEmail): Promise<void> {
    // Real implementation: client credentials flow → POST /sendMail
    // (lands in Entra SSO phase — GraphEmailTransport constructor validates
    //  env vars now so the worker fails fast when Graph is misconfigured).
    void this.tenantId;
    void this.clientId;
    void this.clientSecret;
    void this.senderEmail;
    throw new Error('GraphEmailTransport: not yet implemented');
  }
}
