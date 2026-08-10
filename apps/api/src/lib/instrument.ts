// Sentry/GlitchTip error-tracking init (observability Tier 1).
//
// MUST be imported before any other application module — @sentry/node v10
// relies on early init to auto-instrument. server.ts and worker/index.ts do
// `import './lib/instrument.js';` as their very first import.
//
// Points at a self-hosted GlitchTip instance via SENTRY_DSN (GlitchTip speaks
// the Sentry ingest protocol, so @sentry/node talks to it unchanged). Runs on
// the laptop next to the app — error data (which can carry student PII in
// request context/breadcrumbs) never leaves the machine.
//
// FAIL-OPEN: if SENTRY_DSN is unset (local dev, or GlitchTip not running yet
// because the laptop just booted), Sentry is simply not initialized and every
// Sentry.* call becomes a no-op. The app must never block or crash because the
// error tracker is down — observability is not a hard dependency of serving
// traffic.

import * as Sentry from '@sentry/node';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // UAT: capture everything. Revisit sampling only if event volume becomes a
    // problem (it won't at UAT scale on a single instance).
    tracesSampleRate: 1.0,
    // PII scrub — load-bearing for the on-laptop-with-student-data decision.
    // GlitchTip stores what we send; strip the fields most likely to carry a
    // student's or parent's identity before the event leaves the process.
    // Correlation is preserved via reqId (a tag, set at capture sites), so
    // dropping raw PII does not cost us the ability to tie an error to its
    // request/session.
    beforeSend(event) {
      // Never ship cookies or auth headers (session tokens, staff cookie).
      if (event.request?.headers) {
        delete event.request.headers['cookie'];
        delete event.request.headers['authorization'];
        delete event.request.headers['x-dev-user'];
        delete event.request.headers['x-dev-lms-user'];
      }
      // Drop request body/query — tRPC inputs routinely contain names, emails,
      // grades. The stack trace + reqId are what an agent needs to debug; the
      // raw payload is PII we should not retain.
      if (event.request) {
        delete event.request.data;
        delete event.request.query_string;
      }
      // Scrub obvious PII keys from any structured context we do send.
      if (event.user) {
        // Keep an opaque id for grouping; drop email/username/ip.
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

export { Sentry };
