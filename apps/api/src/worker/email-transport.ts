// K6 remediation: pluggable email transport port. `EmailOutbox` already
// records `transport: 'graph' | 'brevo'` per row (schema.prisma). Concrete
// implementations live in this file: ConsoleEmailTransport (dev/test only;
// forbidden in prod), BrevoEmailTransport, GraphEmailTransport.
// `relayEmailOutbox` depends on the EmailTransport interface, not a
// provider, so swapping transports is a one-file change with no call-site edits.

import { renderOutboxEmail } from './email-templates.js';

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

    const { subject, html } = renderOutboxEmail(email.payload);
    const sender = process.env.BREVO_SENDER_EMAIL;
    const body = {
      sender: sender ? { email: sender } : undefined,
      to: [{ email: email.to }],
      subject,
      htmlContent: html,
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
 * RT-8: Microsoft Graph / Exchange Online transport (internal HR/payroll/notify
 * mail). Shares the Entra app registration with staff SSO. Constructor
 * validates all required env vars (GRAPH_TENANT_ID, GRAPH_CLIENT_ID,
 * GRAPH_CLIENT_SECRET, GRAPH_SENDER_EMAIL) — throws if any is absent (fail-fast).
 *
 * send():
 *   1. POST /oauth2/v2.0/token (client credentials) → access_token
 *   2. POST /v1.0/users/{GRAPH_SENDER_EMAIL}/sendMail (202 Accepted on success)
 * Message content is rendered from the outbox payload via renderOutboxEmail.
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

  /** Client-credentials OAuth2 → access token for Microsoft Graph. */
  private async fetchAccessToken(): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '<no body>');
      throw new Error(`GraphEmailTransport: token HTTP ${res.status} — ${detail}`);
    }
    const data = (await res.json()) as { access_token?: unknown };
    if (typeof data.access_token !== 'string') {
      throw new Error('GraphEmailTransport: token response missing access_token');
    }
    return data.access_token;
  }

  async send(email: OutboxEmail): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[graph] sending id=${email.id} to=${email.to}`);

    const { subject, html } = renderOutboxEmail(email.payload);
    const token = await this.fetchAccessToken();

    const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.senderEmail)}/sendMail`;
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: email.to } }],
        },
        saveToSentItems: false,
      }),
    });
    // Graph sendMail returns 202 Accepted on success.
    if (!res.ok) {
      const detail = await res.text().catch(() => '<no body>');
      throw new Error(`GraphEmailTransport: sendMail HTTP ${res.status} — ${detail}`);
    }
  }
}
