# Stale status claims — docs audit (2026-07-26)

Scope audited: `docs/*.md` (top level only), `README.md`, `AGENTS.md`, `CLAUDE.md`.
Ground truth used: acceptance ledger 27/38 proven · 37 built / 1 partial / 0 missing · actor-audit 0 ·
27 journey specs + 12 other e2e specs = 39 spec files (30 `.ui.spec.ts`) · `ui-chromium` 34 specs green in CI ·
CI restored 2026-07-26 (runs `30184942661`, `30185169572`; `ui-e2e` executed for the first time,
first `gitDirty:false` artifact) · measured CI runtime ui-e2e 6.1 min / typecheck-and-test 3.8 min / e2e(API) 2.0 min ·
11 unproven = 7 `no-ui-path` + 4 journey-not-written · max journey-achievable 31/38 · journeys are smoke-level, human UAT M0 still required.

Cheap verification performed (file counts only — suites not run):
`apps/api` 104 `*.test.ts` files · `apps/admin/src` 39 test files · `apps/e2e` 39 spec files (27 journeys) ·
`packages/db/prisma/schema.prisma` 50 models · `.github/workflows/ci.yml`: `e2e`, `ui-e2e`,
screen-role-matrix and acceptance-report steps are all `continue-on-error: true`.
**Pass counts (977 / 352 etc.) were NOT re-measured — treat as unverified.**

---

## BLOCKER — actively false / misleading about readiness

| file:line | current (stale) text | why wrong | proposed honest correction |
|---|---|---|---|
| `README.md:3` | "production-ready with 889+ API tests passing and P1–P4 workflows complete." | Overstates readiness. Ledger proves 27/38 flows *run*, not correctness; 7 flows have no UI path at all; human UAT M0 never run. "889+" also predates 3 merge waves. | "…TypeScript+React+tRPC. P1–P4 workflows built; 27/38 business flows proven end-to-end by browser journey tests (7 have no UI yet). Real-human UAT (M0) not yet run — not certified production-ready." |
| `docs/codebase-summary.md:9` | "journey coverage (9/10 linked to flow-manifest, **9/38 total flows covered**)" | Superseded: 27 journey specs exist and the ledger records **27/38 proven**. | Replace the parenthetical with "27/38 luồng đã chứng minh chạy (đo 2026-07-26, commit 22bbead); trần khả thi qua journey = 31/38 — 7 luồng `no-ui-path`, 4 luồng chưa viết journey." |
| `docs/codebase-summary.md:9` and `docs/system-architecture.md:9` | "Current e2e count: **~21+ spec files**." | Actual: 39 spec files (27 `journeys/*.journey.ui.spec.ts` + 12 others); 30 `.ui.spec.ts`; `ui-chromium` project = 34 specs. | "Current e2e count: 39 spec files — 27 journey UI specs + 12 others; `ui-chromium` project runs 34 specs, all green in CI 2026-07-26." |
| `docs/29-test-plan.md:62` | "Pipeline **chặn merge**: typecheck → lint → unit → integration (RLS) → **e2e critical** → verify-RLS" | `.github/workflows/ci.yml` marks the `e2e`, `ui-e2e`, screen-role-matrix drift and acceptance-report steps `continue-on-error: true`. Only `typecheck-and-test` actually blocks. There is no `verify-RLS` job. | "Chặn merge hiện tại: `typecheck-and-test` (typecheck → lint → unit/integration RLS → coverage payroll). `e2e`, `ui-e2e`, drift ma trận màn×vai và `acceptance:report` chạy **cảnh báo** (`continue-on-error`), chưa chặn merge — mục tiêu promote sau vài tuần xanh liên tiếp." |
| `docs/system-architecture.md:412` | "**CI Integration:** Pre-merge gate (all tests must pass)" | Same as above — e2e/UI e2e are non-blocking. | "**CI Integration:** `typecheck-and-test` blocks merge; `e2e`, `ui-e2e`, acceptance-report and matrix-drift run warn-only (`continue-on-error`)." |

---

## HIGH — stale numbers / missing record of what changed

| file:line | current (stale) text | why wrong | proposed honest correction |
|---|---|---|---|
| `README.md:56` | "Vitest (API: 99 files/889 tests · admin: 33 files/258 tests) + Playwright (e2e: **11 spec files**)" | File counts measured today: api 104 test files, admin 39, e2e 39 spec files. Pass counts last recorded 2026-07-23 were api 977 / admin 352 — not re-measured. | "Vitest (API: 104 test files · admin: 39 test files; last measured pass counts 2026-07-23: api 977, admin 352) + Playwright (e2e: 39 spec files, incl. 27 journey UI specs)." |
| `docs/system-architecture.md:7` | "As of 2026-07-17: apps/api 99 files/889 tests, apps/admin 33 files/258 tests, apps/e2e **11 spec files**." | Superseded by the 07-23 measurement and by 27 journey specs added since. | Keep the 07-17 line as history but append: "Superseded 2026-07-26 — see the 2026-07-26 note below." Then add a 2026-07-26 banner with the file counts above. |
| `docs/codebase-summary.md:7` | Same 07-17 counts. | Same. | Same treatment as above. |
| `docs/codebase-summary.md:12` | "`pnpm --filter @cmc/e2e test` **20 pass**, 0 facility rò" (đo tại `main` `35d4df0`) | Predates the 27 journey specs; `ui-chromium` now has 34 specs green in CI. | Append: "(đo 2026-07-23 trên 20 spec; sau đó thêm journey — 2026-07-26 CI `ui-chromium` chạy 34 spec, xanh, commit 22bbead)." |
| `docs/codebase-summary.md:16` | "Sổ nghiệm thu: 38/38 built → **37 built / 1 partial**… Gate `acceptance:report` đã vào CI ở mức cảnh báo" | Structural numbers still correct, but the doc never records the **proven tier**, which is now the headline number. | Append one sentence: "Tầng *đã chứng minh chạy* (journey UI thật): **27/38** tại commit 22bbead (2026-07-26) — bằng chứng đầu tiên do CI `ui-e2e` sinh (`gitDirty:false`), trước đó chỉ có chạy cục bộ." |
| `docs/codebase-summary.md:34` | "`tests/*.api.spec.ts` # tRPC API contracts" | No file matching `*.api.spec.ts` exists. The Playwright `api` project uses `testMatch: /(?<!\.ui)\.spec\.ts$/`. | "`tests/*.spec.ts` (không `.ui.`) # tRPC API contracts — Playwright project `api`" |
| `docs/codebase-summary.md:35` | "`tests/*.ui.spec.ts` # Real browser UI specs (admin-shell, lms-login…)" | Understates: 30 `.ui.spec.ts` files including 27 journey specs under `tests/journeys/`. | Add "`tests/journeys/*.journey.ui.spec.ts` # 27 journey specs driving real flows browser→tRPC→Postgres (smoke-level: prove the flow runs, not that business arithmetic is right)." |
| `docs/25-ma-tran-truy-vet-p1.md:12` | "695 API tests passing tại apps/api, cộng **20 e2e spec**" | Both numbers superseded (api ≥977 as of 07-23; e2e 39 specs). | "…apps/api (đo gần nhất 2026-07-23: 977 test), cộng 39 e2e spec tại apps/e2e (27 journey UI)." |
| `docs/runbook-uat-golive.md:8` | "unit/integration 977 test, **e2e 20 spec**, runtime capture 102 tổ hợp…" | e2e is now 39 specs / 27 journeys; the sentence also predates the ledger's proven tier. | "unit/integration 977 test (đo 2026-07-23), e2e 39 spec — trong đó 27 journey UI chứng minh 27/38 luồng chạy thật (CI 2026-07-26)…" |
| `docs/project-changelog.md` (top, before line 9) | Latest entry is `## [2026-07-19]`. | No entry records: journey infrastructure, the acceptance ledger proven tier reaching 27/38, or the 2026-07-26 CI restoration + first `ui-e2e` run. A changelog silent on the largest recent change is itself a false status signal. | Add `## [2026-07-26] Acceptance journeys 27/38 proven + CI restored` covering: 27 journey specs; ledger 27/38 proven (37 built/1 partial, actor-audit 0); CI dead 07-17→07-26 from exhausted Actions minutes (not a workflow defect), restored by making the repo public; first-ever `ui-e2e` run, two consecutive green runs `30184942661` / `30185169572`; measured runtimes ui-e2e 6.1 min, typecheck-and-test 3.8 min, e2e(API) 2.0 min; limitation: journeys are smoke-level, human UAT M0 still required. |
| `docs/project-roadmap.md:56` | M0 status column: "**Đang chạy** — Phase 1 PR #24 CI xanh" | Three weeks stale; says nothing about the acceptance ledger, the 07-17→07-26 CI outage, or that UAT người thật still has not run. | "**Đang chạy** — SSO landed; sổ nghiệm thu 27/38 luồng chứng minh chạy (CI 2026-07-26); **UAT người thật chưa chạy** ⇒ M0 chưa đóng." |
| `docs/uat-checklist-go-live.md:368` (G1 row) | "✅ 2026-07-09 (Run 1+2 PASS 17/1skip, Mode-B staging) — ⚠️ cần chạy lại: … chưa qua **3 đợt merge** tính năng sau mốc này" | More merge waves have landed since 07-17 (journeys, ledger, RBAC split). Also worth recording that CI e2e is now green, while noting it is not the prod-config Mode-B run G1 requires. | "…⚠️ cần chạy lại: kết quả 07-09 chạy trên server tsx riêng và đã qua nhiều đợt merge sau đó. CI `ui-e2e` xanh 2026-07-26 (34 spec) **không thay thế G1** — CI không chạy chồng prod-config `cmcv2-prod`." |
| `docs/uat-checklist-go-live.md:18` | "- [x] E2E critical green 1st run … **✅ RUN 1 + RUN 2 PASSED 2026-07-09** (17/18, Mode-B)" | Checkbox reads as satisfied; the gate table itself says it must be re-run. | Change `[x]` → `[ ]` with "(07-09 pass đã hết hiệu lực — xem G1)". |

---

## LOW — cosmetic, dates, and pre-existing tooling drift

| file:line | current (stale) text | why wrong | proposed honest correction |
|---|---|---|---|
| `docs/codebase-summary.md:4` | "**Last Updated:** 2026-07-12 (historical snapshot…)" | Four later banners exist (07-17, 07-23, 07-24) and now a 07-26 one is needed. | "**Last Updated:** 2026-07-26 (số liệu hiện hành trong các banner bên dưới; khối 'Build State' giữ nguyên làm ảnh chụp lịch sử 2026-07-12)." |
| `docs/codebase-summary.md:27` and `:642` | Repo path `D:\project\vip\CMC` | Repo now lives at `/home/manhquy/Downloads/cmc_edu`; the Windows path misleads about the working platform. | Drop the absolute path or write "repo root (path is machine-local)". |
| `docs/codebase-summary.md:645` | "**Last Updated:** 2026-07-10 (Astryx migration Phase 1 GO…)" | Second, older "Last Updated" footer contradicting the header. | Align to the header date or delete the footer. |
| `docs/system-architecture.md:3` | "**Date:** 2026-07-11 (historical snapshot…)" | Same pattern; needs a 2026-07-26 banner (see HIGH row). | Add the 07-26 banner directly under the 07-24 one. |
| `docs/README.md:5` | "Cập nhật: **2026-07-05**" | Index date is 3 weeks stale; harmless but signals a dead doc. | Bump only if the index content itself changes; otherwise annotate "(chỉ mục TL00–TL31; trạng thái sống ở `docs/codebase-summary.md`)". |
| `docs/project-changelog.md:122` | "(CI unavailable due to GHA free-tier exhaustion, verified locally against cmc_edu test DB)" | Historically accurate for the 07-17 entry — **do not edit the claim**. Only risk is a reader taking it as current. | Optional: append "(CI khôi phục 2026-07-26 — xem mục `[2026-07-26]`)." |
| `docs/18-tech-stack-va-chuan-ky-thuat.md:22`, `docs/29-test-plan.md:60`, `docs/08-nfr-va-du-lieu-tre-em.md:58`, `docs/31-phased-build-plan.md:28,78` | "CI/CD **Jenkins** (kế hoạch)" / "Cổng CI (Jenkins — dựng theo DEBT)" | Actual CI is GitHub Actions (`.github/workflows/ci.yml`), live since 2026-07-06. These are frozen TL design docs, so this is intent-drift rather than a status lie. | Minimal footnote in each: "Thực tế đã dựng bằng GitHub Actions (`.github/workflows/ci.yml`), không phải Jenkins." Do not rewrite the frozen corpus. |
| `AGENTS.md` (Project Context block) | Points to `docs/system-architecture.md` as "**authoritative as-built architecture**" and `docs/codebase-summary.md` as "current implementation status". | Not false as routing, but both targets currently carry stale numbers. | No edit needed **once** the BLOCKER/HIGH rows above are applied. If they are not, add "(số liệu test/e2e trong hai file này có thể trễ — nguồn đúng là `pnpm acceptance:report` + CI run gần nhất)". |
| `CLAUDE.md` | — | No stale status claims found (it only imports `AGENTS.md` + GitNexus guidance). | No change. |

---

## Not flagged (checked, still accurate)

- `docs/codebase-summary.md:16` structural ledger numbers (37 built / 1 partial, actor-audit 0) — match ground truth.
- `docs/codebase-summary.md:20` "UAT người thật … **VẪN CHƯA CHẠY**" — still true and correctly stated.
- `docs/runbook-uat-golive.md:12–20` capture-scope caveat (102 run vs 98 current pairs, not re-captured) — honest and unchanged by this effort.
- `docs/uat-checklist-go-live.md` G4–G10 "cần chạy lại" caveats — still correct.
- `README.md:111–115` e2e "must run alone / `--project=ui-chromium`" gotcha — matches `apps/e2e/playwright.config.ts`.
- `docs/TEST_MATRIX.md` — self-deprecated, points at the CLI; no numeric claims.

## Unresolved questions

1. Pass counts (api 977 / admin 352) were **not** re-measured — the suite is slow. Corrections above deliberately label them "last measured 2026-07-23". Re-run if the controller wants hard numbers.
2. `packages/db/prisma/schema.prisma` now has **50** models; `docs/codebase-summary.md:~38` says "48 models" and `README.md:53` says "RLS, 37 tables". Both are outside this audit's brief (not status/CI claims) but are likely stale — flagging for a separate pass.
3. Whether the 98 screen×role pairs have been re-captured since 2026-07-23 was not verifiable from docs alone; the caveat was left as-is.

Status: DONE
Summary: Audited all top-level `docs/*.md`, `README.md`, `AGENTS.md`, and `CLAUDE.md`; found 5 BLOCKER-level false readiness/CI-gate claims, 12 HIGH stale-number or missing-record items, and 8 LOW cosmetic/date items, each with file:line and a minimal surgical correction.
Concerns/Blockers: Unit/integration pass counts could not be re-verified cheaply, so proposed corrections date-stamp them rather than assert them; no docs claimed "CI blocked on billing" (that framing lives only in `plans/`, outside the audited scope).
