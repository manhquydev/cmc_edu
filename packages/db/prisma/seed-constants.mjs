// Side-effect-free constants shared by seed.mjs and any tooling that needs to
// KNOW the seed markers without RUNNING the seed. seed.mjs executes main() at
// module top level, so importing seed.mjs to read a constant would run a full
// seed against whatever DATABASE_URL is set — this module exists so consumers
// (e.g. the synthetic-seed env verifier, a future Phase-4 sentinel check) can
// import the marker names/codes safely. NO imports with side effects here.

// Dev-seed facility (find-or-create by name). `code` is a system-wide unique,
// NOT-NULL column with no DB default (migration 20260706170000) — a direct
// Prisma create MUST supply it (the API-layer facility.create auto-derives one,
// but seed.mjs bypasses that layer).
export const DEV_SEED_FACILITY_NAME = 'CMC EDU — Cơ sở mặc định (dev seed)';
export const DEV_SEED_FACILITY_CODE = 'DEVSEED';

// Sentinel facility — content-based proof that a DB was built by our seed
// tooling (dev or synthetic throwaway), therefore NOT the real prod DB (prod
// data comes from real usage, never from seed.mjs). The synthetic-seed env
// verifier queries this exact code to confirm it is safe to operate on.
export const SYNTHETIC_SEED_FACILITY_NAME = '__SYNTHETIC_SEED__ — CMC EDU throwaway';
export const SYNTHETIC_SEED_FACILITY_CODE = '__SYNTH__';
