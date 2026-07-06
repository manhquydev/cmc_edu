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
    // eslint-disable-next-line no-console
    console.log(`[email-outbox] would send to ${email.to}`, email.payload);
  }
}
