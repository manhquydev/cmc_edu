// PM2 process config for the CMC API and background workers.
// Usage: pm2 start ecosystem.config.cjs --env production
//
// Worker scripts are compiled to dist/ by `pnpm build` before starting PM2.
// Adjust cron_restart intervals for production (comments below indicate
// the recommended prod values).

module.exports = {
  apps: [
    {
      name: 'cmc-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      env_production: { NODE_ENV: 'production' },
    },
    {
      // Finance-flag reconciliation worker. Scans all facilities for
      // self_approved, high_value, and missing_provisioning receipts and
      // raises ReconciliationFlag rows for director review.
      name: 'cmc-worker-recon',
      script: 'dist/worker/reconcile-finance-flags.js',
      instances: 1,
      exec_mode: 'fork',
      // Dev: every 1 min.  Production: change to '*/15 * * * *' (every 15 min).
      cron_restart: '*/1 * * * *',
      watch: false,
      env: { NODE_ENV: 'production', WORKER_INTERVAL_MS: '60000' },
      env_production: { NODE_ENV: 'production', WORKER_INTERVAL_MS: '900000' },
    },
    {
      // Orphaned-receipt reconciliation worker. Promotes receipts whose
      // linked opportunity stalled in a transitional state back to a
      // consistent status (see worker/reconcile-orphaned-receipts.ts).
      name: 'cmc-worker-orphans',
      script: 'dist/worker/reconcile-orphaned-receipts.js',
      instances: 1,
      exec_mode: 'fork',
      // Dev: every 5 min.  Production: '*/30 * * * *' is typically sufficient.
      cron_restart: '*/5 * * * *',
      watch: false,
      env: { NODE_ENV: 'production' },
    },
  ],
};
