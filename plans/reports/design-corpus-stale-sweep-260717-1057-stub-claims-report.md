# Stale "not built yet" claims — design corpus sweep

Scope: docs/00–21 (excluding files already deep-checked this session). Focus: claims of
deferred/stub/not-implemented/blocked that code now contradicts. Full-corpus keyword sweep run
first (chưa làm/có/build/merge, TODO, stub, deferred, BLOCKED, coming-soon, NOT YET BUILT,
placeholder), then each hit verified against code/git before reporting.

## Confirmed stale

### 1. docs/12-design-system-ui.md:109 — "3 màn stub premium-coming-soon" overstates by 2/3
> "3 màn stub premium-coming-soon (leaderboard, network-ip, shift-config) chờ backend + spec."

Only `leaderboard` is still a stub (`apps/admin/src/pages/engagement/leaderboard.tsx:1-25`, own
comment: "No backend ... Stays a premium coming-soon EmptyState").

`network-ip` and `shift-config` are fully built, real pages — not stubs:
- `apps/admin/src/pages/admin/network-ip.tsx:1-40` — DataTable + create/dialog form wired to
  `trpc.facilityNetwork.list/*`.
- `apps/admin/src/pages/admin/shift-config.tsx:1-6` — own header comment: "Real build on the
  phase-04/2 procedures that already exist ... **Replaces the premium-plan coming-soon
  EmptyState**."

Shipped in PR #34 (commit 35cff7d, 2026-07-17, "super-admin completion — facility mgmt, network
CRUD, audit log"). Fix: reword to "1 màn stub (leaderboard); network-ip/shift-config shipped
PR #34."

### 2. docs/12-design-system-ui.md:162 and docs/15-ra-soat-dong-bo-va-register.md:28 — OTP email BLOCKED-ON-COMMS is stale
> docs/12:162 — "Tab Phụ huynh chưa hoạt động production (email transport stub)."
> docs/15:28 — "**BLOCKED-ON-COMMS**: email OTP dùng ConsoleEmailTransport stub, chưa production."

Real production email transport now exists and is wired to OTP delivery:
- `apps/api/src/worker/email-transport.ts:34-50` — `BrevoEmailTransport` (RT-8), real API-key-gated
  class; `ConsoleEmailTransport` is now only the dev/test default.
- `apps/api/src/worker/relay-email-outbox.ts:31-34` — `CONSOLE_TRANSPORT_PROD_FORBIDDEN = true`,
  worker fails fast if console transport is selected in production.
- `apps/api/src/lms-auth/router.ts` — `requestOtpEmail` enqueues a real `EmailOutbox` row (commit
  640bd45, 2026-07-10, "wire requestOtpEmail to real Brevo delivery via EmailOutbox").
- commit 737273a, "feat(email): implement Graph transport + shared renderer, both providers live."

Both docs' absolute "chưa production / stub" framing is false; only an env-misconfiguration case
(`EMAIL_TRANSPORT=console` in prod) is still worth a UI warning, which docs/12:162's second
sentence already covers correctly — just the lead sentence is stale.

### 3. docs/15-ra-soat-dong-bo-va-register.md:128 — US-010 Student Lookup is built, not deferred
> "US-010 | Student Lookup | P2 | ⏳ Deferred | K4: requires enrollment→name→UUID query (P2 scope)"

`apps/api/src/student/router.ts:257-308` — `lookup` procedure (phone or name search, audit-logged,
facility-scoped), plus `apps/api/src/student/lookup.test.ts`. Fully shipped, not deferred.

### 4. docs/15-ra-soat-dong-bo-va-register.md:129 — "Class Ops / HR / Payroll / Redemption ... not built" is stale
> "**P2+** | **Class Ops / HR / Payroll / Redemption** | P2–P4 | ⏳ Pending | TL26–TL28 designed,
> not built"

All four areas are live in `apps/api/src/router.ts:60-117`:
- Class Ops: `classBatch`, `classSession`, `schedule`, `attendance` routers.
- HR: `user`, `shift`, `compensationPolicy`, `salaryTier` routers.
- Payroll: `payslip`, `kpi` routers.
- Redemption: `rewards: rewardRouter` (`apps/api/src/rewards/reward-router.ts`, P4 gift/star
  redemption lifecycle: redeem/approve/deliver/reject).

This is the single highest-impact stale line in the sweep — the whole P2–P4 row reads as
un-started when in fact it shipped across several merged phases.

## Verified NOT stale (checked, still accurate — no action)

- **AI Agent/MCP layer** (docs/13, docs/04): both are prospective specs, not "unbuilt" claims.
  docs/04:125-127 correctly says Teacher-assist Agent "đã có" — confirmed real
  (`packages/llm/src/index.ts`, real OpenAI-compatible provider path + deterministic stub fallback
  when no API key). `packages/mcp-server/src/index.ts` and `tools.ts` genuinely remain a skeleton
  (SDK not installed, `callTool` returns a placeholder) — consistent with the "MCP skeleton" framing
  in commit 08e4966 (P5, US-010/#10, 2026-07-07). No false claim found here.
- **docs/15:141 K2 "reconciler ready; scheduler deferred"** — accurate. Reconciliation worker/router
  are fully implemented and real (`apps/api/src/reconciliation/router.ts`,
  `apps/api/src/worker/reconcile-finance-flags.ts`), but no cron/scheduler wiring exists anywhere in
  `apps/api/src/worker/` or CI — it's still manually/externally triggered.
- **docs/03:111 web-lead inbox / Callio sync "chưa build"** — accurate, no matching code found
  anywhere under `apps/`.

## Lower-confidence, included for completeness

- **docs/00-ke-hoach-tai-lieu-va-lo-trinh.md:106** — "nhận xét HS **chưa có test** + ADR" is now
  half-stale: a test exists (`apps/api/src/assessment/draft-confirm.test.ts`), but no dedicated ADR
  for the assessment/nhận xét feature was found in docs/16. Consider rewording to "chưa có ADR"
  only.

Status: DONE
Summary: Found 4 confirmed stale "not built" claims (docs/12 stub-screen list, docs/12+15
BLOCKED-ON-COMMS OTP email, docs/15 US-010 Student Lookup, docs/15 P2+ Class Ops/HR/Payroll/
Redemption row — the last is the biggest, since 4 whole feature areas are marked "not built" when
fully shipped) plus 1 half-stale minor claim (docs/00 assessment test). AI-agent/MCP framing in
docs/04 and docs/13 checked and found accurate, not stale.
