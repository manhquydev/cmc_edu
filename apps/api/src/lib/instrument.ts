// Sentry/GlitchTip error-tracking init (observability Tier 1).
//
// SCOPE: this is MANUAL error capture only — Sentry.captureException() called
// explicitly at the raw-http route catches, the tRPC onError hook, and the
// worker drain-failure catch. We deliberately do NOT enable OpenTelemetry
// auto-instrumentation or tracing: that requires launching node with
// `--import ./instrument.js` (this package is ESM; a plain first-line
// `import` does NOT wire up auto-instrumentation in ESM), and distributed
// tracing is overkill for a one-host monolith UAT. captureException works
// regardless of launch flags, which is all Tier 1 needs.
//
// It is still imported first in server.ts / worker/index.ts so init() runs
// before any capture call — harmless, and correct if we ever add `--import`.
//
// Points at a self-hosted GlitchTip instance via SENTRY_DSN (GlitchTip speaks
// the Sentry ingest protocol, so @sentry/node talks to it unchanged). Runs on
// the laptop next to the app — error data can carry student PII, so it never
// leaves the machine.
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
    // No tracesSampleRate: tracing/auto-instrumentation is not enabled (see
    // header) — only manually-captured exceptions are sent. sendDefaultPii
    // stays at its default (false), so Sentry already omits cookies, auth
    // headers, request bodies and IPs; beforeSend below is defence-in-depth
    // that also holds if anyone later flips sendDefaultPii on.
    beforeSend(event) {
      if (event.request) {
        // Raw + parsed cookies and auth headers (session tokens, staff cookie).
        if (event.request.headers) {
          delete event.request.headers['cookie'];
          delete event.request.headers['authorization'];
          delete event.request.headers['x-dev-user'];
          delete event.request.headers['x-dev-lms-user'];
        }
        delete event.request.cookies; // Sentry's parsed-cookie map, if present.
        // tRPC inputs / query routinely contain names, emails, grades. The
        // stack trace + reqId are what an agent needs to debug; the raw payload
        // is PII we should not retain.
        delete event.request.data;
        delete event.request.query_string;
      }
      // Breadcrumbs can carry request URLs with PII query params or logged
      // context — drop them wholesale rather than trying to sanitise each.
      delete event.breadcrumbs;
      // Structured user context: keep an opaque id for grouping, drop identity.
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

export { Sentry };
