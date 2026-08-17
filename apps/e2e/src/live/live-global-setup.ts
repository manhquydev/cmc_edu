// live-global-setup — the ONLY global setup the live suite uses.
//
// Deliberately NOT src/global-setup.ts (that one FAILS CLOSED on the literal
// DB name cmc_prod via assertNotProdDatabase, spawns a second API server and
// deletes a run facility on teardown — all forbidden here). This setup:
//   - performs a read-only /health reachability preflight on BOTH live
//     domains (nginx routes /health to the API — infra/nginx/api-locations.conf);
//   - never touches the DB, never starts a server, never tears anything down.

// Same env contract as playwright.live.config.ts — the preflight must check
// the SAME origins the specs run against (the old hardcoded erp.clawcmc.io.vn
// / hoc.clawcmc.io.vn are the laptop-tunnel system, not the VPS stack).
const ADMIN_ORIGIN = process.env['LIVE_ADMIN_ORIGIN'] ?? 'https://erp.clawcmc.io.vn';
const LMS_ORIGIN = process.env['LIVE_LMS_ORIGIN'] ?? 'https://hoc.clawcmc.io.vn';

const HEALTH_TIMEOUT_MS = 20_000;

export default async function liveGlobalSetup(): Promise<void> {
  for (const origin of [ADMIN_ORIGIN, LMS_ORIGIN]) {
    try {
      const res = await fetch(origin + '/health', { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      if (!res.ok) {
        throw new Error('GET ' + origin + '/health returned HTTP ' + res.status);
      }
    } catch (error) {
      throw new Error(
        'live-global-setup preflight FAILED: ' +
          origin +
          ' is not healthy (' +
          String(error) +
          '). The live campaign refuses to start against a down stack — check Cloudflare/Caddy/tunnel/nginx, then re-run.',
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log('[live-global-setup] both live origins healthy: ' + ADMIN_ORIGIN + ' / ' + LMS_ORIGIN);
}
