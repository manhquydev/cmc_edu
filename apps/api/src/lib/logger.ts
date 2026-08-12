// Structured logging foundation (observability Tier 0).
//
// Before this, the api + worker logged with plain-text `console.error('[api]
// ...', err)`. That is fine for a human tailing a terminal but opaque to an AI
// coding agent operating the system: it cannot filter by level, correlate the
// lines belonging to one failed request, or pull a machine-readable error
// object. pino emits one JSON object per line to stdout, so the agent can run
//   docker compose -p cmcv2-prod logs api | jq 'select(.level >= 50)'
// to get every error, or filter by `reqId` to get every line for one request.
//
// stdout only — Docker's json-file driver captures it (compose caps 10m x 3).
// No file transport, no pretty-printing in prod (pretty-printing is a separate
// dev-only transport and pulls a dep the runtime image should not carry).

import { pino, type Logger } from 'pino';

// Numeric levels pino uses (trace=10 … fatal=60); `jq 'select(.level>=50)'`
// selects error+fatal. Level is env-tunable for ops without a code change.
const level = process.env['LOG_LEVEL'] ?? 'info';

/**
 * Root logger. `base: undefined` drops pino's default pid/hostname fields —
 * inside a container they are noise (pid is always 1, hostname the container
 * id). `service` is set explicitly by each entrypoint via `child()` so a
 * combined log stream stays attributable to api vs worker.
 */
export const logger: Logger = pino({
  level,
  base: undefined,
  // ISO timestamps read better than epoch ms when an agent scans a log dump.
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    // Emit the level as its name ("error") rather than the number, so a human
    // or agent reading raw lines does not have to decode 50 -> error. The
    // numeric level is still available for `jq` range filters via `levelVal`.
    level(label, num) {
      return { level: label, levelVal: num };
    },
  },
});

/**
 * Per-service child logger. Call once in each entrypoint:
 *   const log = serviceLogger('api');
 * so every line carries `service:"api"` for attribution.
 */
export function serviceLogger(service: 'api' | 'worker'): Logger {
  return logger.child({ service });
}
