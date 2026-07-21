# Build Status Scout Report — 2026-07-11

> **✅ RESOLVED 2026-07-11 (later same session):** everything below was caused by a stale local `node_modules`
> on this dev machine (147 packages drifted from `pnpm-lock.yaml`, including `eslint` never being installed).
> Not a real `@astryxdesign/core`/Astryx-migration bug. `pnpm install --frozen-lockfile` fixed it: build 14/14,
> typecheck 26/26, test 21/21 (527 API tests), lint clean — all green. Confirmed independently: the local
> self-hosted `cmcv2-prod` Docker stack's `lms` container (built via `Dockerfile.lms`'s own clean
> `pnpm install --frozen-lockfile` inside `node:22-alpine`) was never affected and has been serving `200` on
> `/lms/` the whole time. See `docs/project-changelog.md` `[2026-07-11]` for full resolution details.

Scope: root `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint` run on branch `main` @ `b81710a`, working tree clean except 3 untracked journal docs.

## Summary

| Check | Result | Failing target |
|---|---|---|
| `pnpm build` | ❌ FAIL | `@cmc/lms#build` |
| `pnpm typecheck` | ❌ FAIL | `@cmc/lms#typecheck` |
| `pnpm test` | ❌ FAIL | `@cmc/admin#test` (1 file) |
| `pnpm lint` | ❌ FAIL | root — `eslint` binary not found |

Everything else passes: `@cmc/db`, `@cmc/api`, `@cmc/admin` build+typecheck, `@cmc/e2e` typecheck, and all package tests (`auth` 447/447, `domain-identity` 7/7, `domain-finance` 17/17, `domain-grading` 14/14, `domain-payroll` 19/19, `storage` 7/7+1 skip, `llm` 9/9, `api` passing incl. relay-email-outbox 21/21).

## Root cause (confirmed, single defect)

`@astryxdesign/core@0.1.4` does not expose the deep per-component subpaths (`@astryxdesign/core/Text`, `/Stack`, `/Button`, `/Dialog`, ~28 more) that `packages/ui/src/primitives.ts` and most of `packages/ui/src/components/*.tsx` import from. This is the "single door" barrel from the Astryx UI migration (memory: `cmc-astryx-ui-migration-decision`, marked DONE 2026-07-10, merged via PR #28/#29).

Confirmed two independent ways:
- **Static**: `tsc` reports `TS2307: Cannot find module '@astryxdesign/core/Text'` etc. (~30 occurrences) when compiling `apps/lms` (which pulls in `packages/ui/src/primitives.ts` and every component file via `@cmc/ui`'s `export *` barrel).
- **Runtime**: `vitest`/Vite reports the same failure for `apps/admin`'s `src/pages/cockpit-counter.test.ts`: `Failed to load url @astryxdesign/core/Text ... Does the file exist?` — proves the subpath genuinely doesn't resolve, not a tsc-only quirk.

**Open anomaly**: `@cmc/admin`'s `tsc -p tsconfig.json --noEmit` (both in `build` and standalone `typecheck`) passes clean, even though `apps/admin/src/lib/enroll-picker.tsx` imports `Dialog, DialogHeader, HStack, Spinner, Stack, Text` from `@cmc/ui`, which resolves through the same broken `primitives.ts` barrel that fails for `lms`. The Vite/vitest runtime error above proves the module genuinely doesn't exist for admin too — so tsc is silently *not* surfacing a real defect for admin, for a reason I couldn't pin down from tsconfig/exports inspection (both apps share near-identical `tsconfig.json`, both hit `moduleResolution: "Bundler"`). Worth a second look — this could mask this same defect in other admin files that only get exercised at runtime, not narrowed to just this one test.

Also 10 unrelated, pre-existing `TS7006` (implicit `any` param) errors in `apps/lms` (`login.tsx`, `parent/report-card.tsx`, `parent/reset-child-password.tsx`, `student/exercise.tsx`) — small, independent fixes, not migration-related.

## lint: broken tooling, not code

`pnpm lint` → `eslint` not recognized as a command; `pnpm exec eslint --version` and `pnpm why eslint` both confirm eslint isn't resolvable in `node_modules` despite being a root `devDependency` (`^10.6.0`). Needs `pnpm install` (or investigate a broken/partial install) before lint can run at all — did not attempt `pnpm install` since that's a mutating action.

## Context from journals (not yet committed: `docs/journals/26070{9,10}-*.md`)

Cross-checked against `git log` (agent found the journals are stale relative to git history — the Astryx plan-vs-code state they describe as "chưa code" was actually later executed and merged):
- 2026-07-09: Go-live sprint (SSO Phase1, docker-prod Phase2, flow-audit Phase3, UAT-automated Phase4) — all landed, verdict "REDEPLOY NOT REQUIRED".
- 🔴 Known open item from journal: Brevo `BREVO_API_KEY` returned `401` in live `cmcv2-prod` as of 2026-07-10 — blocks OTP email KB1 sign-off. Not verifiable from this build pass; needs live-env check.
- 🔴 Manual UAT (real users) still blocked/pending, owner Product/UX.
- 1 known pre-existing unrelated test gap: `finance/receipt-get.test.ts` RLS issue (raw `db.receipt.create()` outside `withFacility`) — not touched, not part of this run's failures (that test wasn't in the failing set above, so likely already fixed or not currently failing — flagging since journal called it out).

## Side note (informational, not a bug)

Several cached task logs (`@cmc/domain-payroll`, `domain-identity`, `auth`, `storage`, `@cmc/ui:build`) replay stdout referencing `D:\project\vip\worktrees\CMC-feat-astryx-migration\...` — a leftover/parallel git worktree used during the Astryx migration. Cosmetic only (turbo cache keys are content-hash based, not path based) but confirms a worktree may still exist on disk.

## Recommendation (not actioned — reporting only, per scout scope)

1. Fix `@astryxdesign/core` subpath resolution first — check installed version's `exports` map / whether `0.1.4` actually ships those entry points, or whether the correct import style changed (single root import vs. deep subpath). This blocks `lms` build+typecheck and at least one `admin` test.
2. Re-run `pnpm typecheck` for `admin` after the above fix — don't trust its current green result given the runtime evidence it's masking the same defect.
3. `pnpm install` to fix the missing `eslint` binary, then re-run `pnpm lint`.
4. The 10 `TS7006` implicit-`any` errors in `lms` are trivial, unrelated cleanup.

## Unresolved questions

- Why does `apps/admin`'s `tsc --noEmit` not surface the same `TS2307` errors that `apps/lms`'s does, given both import from the same broken `packages/ui/src/primitives.ts` barrel? (Runtime proves the defect is real for admin too.)
- Is `BREVO_API_KEY` 401 in `cmcv2-prod` (per 2026-07-10 journal) still unresolved? Not checked in this pass (would require live-env access).
- Is `finance/receipt-get.test.ts` RLS gap (from journal) still present? It did not appear in this test run's failures — needs explicit confirmation it's fixed vs. just not exercised.
