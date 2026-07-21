---
title: Fix P1-07 login redirect + synthetic-seed env (mo gate Phase 4)
description: >-
  TDD fix bug redirect đổi-mật-khẩu LMS (test.fixme thành PASS thật) + dựng DB
  throwaway synthetic-seed với sentinel — mở gate điều kiện 2+3 của Phase 4
  evidence.
status: completed
priority: P2
branch: main
tags:
  - bugfix
  - lms-auth
  - synthetic-seed
  - phase4-gate
blockedBy: []
blocks: []
created: '2026-07-17T22:26:10.153Z'
createdBy: 'ck:plan'
source: skill
---

# Fix P1-07 login redirect + synthetic-seed env (mo gate Phase 4)

## Overview

Hai việc dev còn lại để mở gate Phase 4 (evidence collector — spec sẵn tại
plans/260717-1213-so-nghiem-thu-song/phase-04, red-team 2 vòng):

1. **Fix bug P1-07** — HS đăng nhập mật khẩu mặc định `Cmc2026@` với `mustChangePassword: true`
   bị bounce về `/student/home` thay vì màn `/student/change-password`. Test characterization
   đang `test.fixme` (lms-login.ui.spec.ts:168). TDD: un-fixme trước, fix đến xanh.
2. **Synthetic-seed env** — sentinel row vào seed.mjs + quy trình lặp lại được dựng DB throwaway
   (KHÔNG local-sim — chứa cmc_prod thật, CẤM per D6 plan gốc) + validate.

Sau đợt: gate 2 ✅, gate 3 **◐** (blocker fixme cleared; target evidence hợp lệ là deliverable của
chính Phase 4 step 3 — F8), gate 1 ⏳ (PO dùng thật dashboard với giám đốc) — ngoài dev scope.
KHÔNG implement evidence collector đợt này (chờ đủ gate — quyết định R2-1 plan gốc giữ nguyên).

Nguồn: `plans/reports/brainstorm-260718-0519-p107-login-fix-synthetic-seed-gate-report.md`.

## Facts đã scout (2026-07-18, bổ sung Red Team R1 — không phải phỏng đoán)

- **3 nguồn bounce ứng viên trên student path** (R1-A1/S1, hiệu chỉnh R2-M1 — KHÔNG phải 1):
  (1) `login.tsx:290-294` root guard — shape THẬT (R2-M1):
  `if (session) { const dest = session.kind === 'parent' ? '/parent/home' : '/student/home'; navigate(dest) }`
  — đã phân nhánh parent/student NHƯNG nhánh student vẫn bounce vô điều kiện bất kể
  mustChangePassword → **ứng viên mạnh, chờ capture chốt** (không gọi "nghi phạm chính" — lập luận
  hydrated-session mâu thuẫn với mechanism lag của ứng viên 2; capture bước 2 phân định). Fix nếu
  trúng: thêm nhánh mustChangePassword cho student-arm, GIỮ NGUYÊN parent-arm (regression risk).
  (2) `change-password.tsx:27-30` — chỉ bounce sai khi session stale/thiếu field (optional,
  trpc.ts:36, `!undefined`=true). (3) `home.tsx:93-97` guard gương — nguy cơ ping-pong
  change-password↔home. Cả 3 đều navigate-in-render (anti-pattern).
- **Enforcement thật ở server** (R1-S5): `assertPasswordNotExpired` (apps/api/src/trpc.ts:309-327)
  chặn MUTATION của student mustChangePassword; queries miễn trừ có chủ đích. Client redirect =
  advisory UX → bug là **UX-severity**, fix guard là security-neutral (verified: StudentOnly +
  kind-guard + API guard không đổi).
- Login flow: `login.tsx:162-172` setSession rồi phân nhánh ĐÚNG theo `data.mustChangePassword`
  → navigate change-password/home; session context không gọi `session.me`.
- change-password.tsx comment "do not fix this logic here" thuộc đợt UI-migration cũ — hết hiệu lực.
- **seed.mjs**: plain ESM, `main()` chạy TOP-LEVEL (:112 — import là chạy seed, R1-A3/S3);
  find-or-create theo name idempotent NHƯNG create thiếu `code` — **`Facility.code String @unique`
  BẮT BUỘC không default** (schema.prisma:237; migration 20260706170000:26-30 backfill một lần,
  không DB default) → dev-seed khả năng đã vỡ từ migration đó (R1-S2 — verify bước 0 phase 2).
  `Facility.name` KHÔNG unique (confirmed) — find-or-create theo name an toàn.
- E2e: 11 specs (9 API + 2 UI); ui-chromium cần `PLAYWRIGHT_UI=1` (build ~4-5min) +
  `APP_DATABASE_URL` DB throwaway đã migrate + secrets (global-setup.ts:99) — precondition
  phase 1 (R1-A4). 35 migrations có sẵn → `prisma migrate deploy` khả thi.
- Ràng buộc kế thừa: D6 (cấm local-sim/cmc_prod), Safety Gate plan gốc — **name-check bị socat
  decouple, guard phải là positive signal** (R1-S4 áp cho cả đường ghi sentinel của đợt này);
  `assertNotProdDatabase` hiện module-private (extraction R2-8 kéo về phase 2 đợt này).

## Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| F1 | TDD đúng nghĩa: bước 1 của phase 1 là **un-fixme test và chạy để thấy FAIL thật** (reproduce trước), rồi mới chẩn đoán/fix. Không sửa code trước khi thấy đỏ | Prove-before-fix; test comment ghi hypothesis từ 2026-07-10 chưa từng được verify lại |
| F2 (rev R1+R2) | Fix **behavioral** tại nguồn bounce đã chứng minh qua capture — cả 3 ứng viên ngang hàng chờ bằng chứng (R2-M1); nếu là login root guard: thêm nhánh mustChangePassword vào student-arm, parent-arm `/parent/home` GIỮ NGUYÊN; guard change-password thu hẹp `=== false` tường minh; **hygiene** `<Navigate>` cho CẢ 3 điểm navigate-in-render — hygiene KHÔNG được bán như thuốc chữa (R1-A5) | R1-A1/S1: 3 nguồn không phải 1; sửa đúng nguồn theo bằng chứng, không vá triệu chứng |
| F3 | Nếu reproduce cho thấy root cause KHÁC hypothesis (vd context provider remount) → dừng, chẩn đoán lại bằng state capture, ghi finding vào plan trước khi fix — KHÔNG fix mò | Debug rule: root cause proven trước khi đổi behavior |
| F4 (rev R1) | Sentinel = find-or-create `Facility` theo name marker, create data gồm **cả unique `code: '__SYNTH__'`** (R1-S2 — code bắt buộc); constants ở **`seed-constants.mjs` side-effect-free riêng** (R1-A3/S3 — seed.mjs top-level main(), import = chạy seed); seed.mjs thêm entrypoint guard `import.meta.url === pathToFileURL(process.argv[1]).href` (R2-M3 — phải `.href`: so URL-object với string luôn false, seed thành no-op im lặng); bước 0 verify dev-seed hiện có xanh không (khả năng đã vỡ vì thiếu code) | Import an toàn; content-based proof đúng Safety Gate 3; không build trên nền seed vỡ |
| F5 (rev R1) | Script `scripts/synthetic-seed-env.sh` (Git Bash): yêu cầu **`SYNTH_SEED_ALLOW=1` positive signal** + guard node dùng **`assert-not-prod.ts` extraction** (kéo R2-8 plan gốc về sớm; global-setup import lại — 1 nguồn guard) trên cả 2 URL; name-check cmc_synth CHỈ là defense-in-depth phụ (R1-S4 Critical — name-check bị socat decouple, không được là control trên đường GHI); tạo DB qua `psql "$ADMIN_URL" -c 'CREATE DATABASE...'` không dùng binary createdb (R1-A6); LF + .gitattributes | Nightmare scenario: sentinel plant vào cmc_prod = phá Safety Gate tương lai; positive-signal là bài đã học của chính dự án |
| F6 | Đợt này KHÔNG chạm plan gốc phase-04 ngoài việc cập nhật mục GATE (đánh dấu điều kiện 2+3 đạt kèm bằng chứng) | Tránh scope creep vào phase gated |
| F7 | 2 documented gaps (course.create, parentAccount.updateEmail): **giữ nguyên là documented gaps** — không tạo WF mới đợt này; quyết định cuối thuộc PO khi xem dashboard thật (gate 1) | Không phải dev decision; dashboard đã hiển thị trung thực |
| F8 (mới R1) | Gate 3 sau đợt này = **◐ KHÔNG ✅** (R1-A2): fix P1-07 chỉ gỡ blocker `test.fixme`; test student-redirect KHÔNG phải business-flow evidence target (R2-10/11 phase-04 cấm lms-login làm target; yêu cầu terminal business assertion); target hợp lệ = `acceptance-evidence-p1.ui.spec.ts` — deliverable của chính Phase 4 step 3 | Không overclaim gate; giữ đúng câu chữ và tinh thần R2-10 |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [TDD fix P1-07 mustChangePassword redirect](./phase-01-tdd-fix-p1-07-mustchangepassword-redirect.md) | Completed |
| 2 | [Synthetic-seed throwaway DB env + gate update](./phase-02-synthetic-seed-throwaway-db-env-gate-update.md) | Completed |

Dependency (rev R2-M2): độc lập về file. Ràng buộc thật duy nhất: **phase-02 step 5 (gate update)
cần verdict phase 1**. Steps 0-4 của phase 2 được phép chạy TRƯỚC phase 1 khi máy chưa có env e2e
(escape hatch V1) — không deadlock.

## Acceptance Criteria

- [ ] Reproduce trước fix: bước 1 phase 1 ghi FAIL thật; nguồn bounce chứng minh trong 3 ứng viên
  (login:291 / change-password:28 / home:94) ghi vào Implementation Log
- [ ] Test `correct default-password login redirects to mustChangePassword` hết fixme, PASS thật
  dưới `PLAYWRIGHT_UI=1`; các UI/API specs còn lại pass nguyên trạng; parent tab không regression
- [ ] Fix trong apps/lms (login.tsx + change-password.tsx + home.tsx theo bằng chứng); không còn
  navigate-in-render trên student path; apps/api, packages behavior không đổi; typecheck+lint xanh
- [ ] Dev-seed verdict (vỡ-và-fixed hay xanh-có-lý-do) ghi lại TRƯỚC khi build sentinel (R1-S2)
- [ ] Import `seed-constants.mjs`/`seed.mjs` từ module khác: 0 side-effect (test tường minh — R1-A3/S3)
- [ ] Script: `--fresh` + idempotent pass; negative tests abort đúng (thiếu SYNTH_SEED_ALLOW;
  URL tên prod); sentinel query theo `code='__SYNTH__'` OK; `assert-not-prod.ts` là nguồn guard
  duy nhất (global-setup + script dùng chung)
- [ ] KHÔNG kết nối local-sim/cmc_prod ở bất kỳ bước nào; KHÔNG implement evidence collector
- [ ] Plan gốc phase-04 GATE cập nhật: 2 ✅ (bằng chứng script+sentinel), **3 ◐** (blocker cleared,
  target hợp lệ = Phase-4 step-3 deliverable — F8/R1-A2), 1 ⏳ PO-side

## Red Team Review

### Session 1 — 2026-07-18
**Reviewers:** Security Adversary (5 findings) + Assumption Destroyer (6 findings). 11 thu về,
merge 1 cặp (seed tự chạy khi import) → **10 unique, 10 Accept, 0 Reject** (tất cả file:line).

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| S4 | Script guard theo TÊN DB trên đường GHI sentinel = name-check socat-bypassable mà Safety Gate kế thừa đã bác; nightmare: sentinel plant vào cmc_prod | **Critical** | Accept — SYNTH_SEED_ALLOW positive signal + assert-not-prod extraction (kéo R2-8 về sớm) trên cả 2 URL; name-check hạ xuống defense-in-depth phụ | F5, Phase 2 |
| A1 | Root-cause thiếu nguồn: `login.tsx:291` root guard bounce mọi student session — nghi phạm chính (session đúng thì guard change-password không bounce) | High | Accept — 3 ứng viên enumerate, capture phân定, diff scope mở rộng | Facts, F2, Phase 1 |
| S1 | `home.tsx:93-97` guard gương → nguy cơ ping-pong change-password↔home; plan chưa scout | High | Accept — ứng viên 3, hygiene cả 3 điểm | Facts, F2, Phase 1 |
| A2 | Gate-3 overclaim: test student-redirect ≠ P1 business flow; R2-10/11 cấm lms-login làm evidence target | High | Accept — F8 mới: gate 3 = ◐, target hợp lệ là Phase-4 step-3 deliverable | F8, AC, Phase 2 |
| S2 | `Facility.code` unique BẮT BUỘC không default — seed create thiếu code → dev-seed khả năng đã vỡ từ migration 20260706170000; claim "không đụng unique code" SAI | High | Accept — bước 0 verify dev-seed; sentinel + dev-seed đều set code deterministic | Facts, F4, Phase 2 |
| A3+S3 | seed.mjs top-level `main()` (:112) — export const rồi import = chạy seed side-effect | High | Accept (merged) — `seed-constants.mjs` side-effect-free + entrypoint guard import.meta | F4, Phase 2 |
| A4 | Phase 1 thiếu preconditions (APP_DATABASE_URL migrated DB, secrets, ~4-5min build); nghịch đảo dependency 1→2 nếu env chưa từng dựng | Medium | Accept — Preconditions section + note "env chưa có → chạy bước env Phase 2 trước" | Phase 1 |
| A5 | `<Navigate>` swap là hygiene, chỉ `=== false`/fix-nguồn là behavioral — không bán hygiene như thuốc chữa | Medium | Accept — F2 reframe | F2, Phase 1 |
| S5 | Plan không nêu enforcement boundary server-side (`assertPasswordNotExpired` trpc.ts:309-327) → không chứng minh được fix là security-neutral | Medium | Accept — fact line + UX-severity framing | Facts, Phase 1 |
| A6 | `createdb` binary không chắc có trên Git Bash PATH | Medium | Accept — psql qua ADMIN_URL | F5, Phase 2 |

**Held up under attack:** `Facility.name` không unique (find-or-create name an toàn) ✓;
35 migrations → migrate deploy khả thi ✓; F2 `=== false` security-neutral (StudentOnly/kind-guard/API
guard không đổi) ✓; ui harness mechanics (baseURL 4174, beforeAll tự provision) ✓.

### Whole-Plan Consistency Sweep (session 1)
- Files reread: plan.md + 2 phase files sau khi áp 10 findings
- Decision deltas: 6 (Facts rewrite, F2/F4/F5 rev, F8 mới, AC rewrite, phase files rewrite)
- Reconciled stale: "gate 3 ✅" (plan.md AC + phase-02), "diff giới hạn change-password" (phase-01),
  "không đụng unique code" (F4 cũ), "createdb" (phase-02), export-từ-seed.mjs (F4 cũ)
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-07-18 (autonomous)

| # | Câu hỏi (từ R1 unresolved) | Quyết định | Căn cứ |
|---|---|---|---|
| V1 | ui-chromium đã từng chạy xanh trên máy này chưa? (unverifiable từ repo) | Precondition check là bước 0 phase 1; nếu env chưa từng dựng → chạy phần env-setup của Phase 2 (script) TRƯỚC — thứ tự thực thi linh hoạt, dependency danh nghĩa 1→2 giữ cho gate-status | R1-A4; phase-01 Preconditions đã ghi |
| V2 | API dev-mode có cần secret ký LMS token cho loginStudent? | Xử lý trong precondition check bước 0 — nếu thiếu secret, lỗi lộ ngay trước browser launch; không block plan (env đã từng chạy 17/18 e2e Mode-B trước đây theo UAT log) | docs/uat-checklist-go-live.md Run 1-2 PASS |
| V3 | Dev-seed vỡ từ migration 20260706170000? | Không đoán — bước 0 phase 2 verify thật; cả 2 nhánh (vỡ/xanh) đều có hành động ghi sẵn | R1-S2; điều tra trước khi build |

### Whole-Plan Consistency Sweep (validation session 1)
- Files reread: plan.md + 2 phase files — 0 mâu thuẫn thêm

### Session 2 — 2026-07-18 (convergence check, Failure Mode Analyst)
**Verify:** MỌI factual claim mới của revision đều ĐÚNG khi đọc code — đặc biệt xác nhận
**dev-seed thật sự vỡ** (seed.mjs:25 create thiếu code; migration 20260706170000:26-30 NOT NULL
không default) và fix security-neutral (trpc.ts:319-327). Gate-3 ◐ nhất quán toàn plan.

| # | Finding | Severity | Disposition | Applied |
|---|---------|----------|-------------|---------|
| R2-M1 | login.tsx:290-294 shorthand sai — guard THẬT đã phân nhánh kind parent/student; "nghi phạm chính" mâu thuẫn logic với mechanism lag của ứng viên 2 | Medium | Accept — Facts sửa shape thật + parent-arm regression note; hạ "nghi phạm chính" → "ứng viên mạnh chờ capture" | Facts, F2 |
| R2-M2 | frontmatter `dependencies: [1]` mâu thuẫn escape hatch V1 (fresh-env = deadlock cho scheduler máy móc) | Medium | Accept — annotation: dependency chỉ áp step 5 (gate update); steps 0-4 là precondition provider, chạy trước được | Phase 2 Overview, plan Dependency |
| R2-M3 | F4 guard expression thiếu `.href` — so URL-object với string luôn false → seed thành no-op im lặng | Medium | Accept — sửa F4 (phase-02:38 vốn đã đúng) | F4 |

### Whole-Plan Consistency Sweep (session 2 — FINAL)
- Files reread: plan.md + 2 phase files sau fix M1-M3
- Grep verify: 0 "gate 3 ✅" sống; guard shape nhất quán; `.href` nhất quán cả 2 file
- Unresolved contradictions: 0
- **CONVERGED** (0 finding Critical/High mới ở R2; 3 Medium là doc-consistency đã fix + verify)

## Implementation Log

### 2026-07-18 — DONE (implement → capture → fix → review)

**Phase 1 (bug fix):** Reproduce thật qua PLAYWRIGHT_UI trên synthetic-seed env → FAIL (`/student/home`).
Instrument 3 guard + browser-console capture → **CHỐT root cause = ứng viên 1** (`login.tsx:290` LoginPage
root guard): `onSuccess data.mustChangePassword=true` → setSession → LoginPage re-render → guard
`if(session) navigate('/student/home')` fire trong render, **clobber** navigate('/student/change-password')
của handler. Hypothesis change-password 2026-07-10 SAI (change-password không hề render). Fix: 3 guard
render-body navigate → `<Navigate>`; LoginPage dest mustChangePassword-aware (parent→/parent/home,
student+mCP→change-password, else→home). Test un-fixmed → **PASS**. Loop-safe (3 điều kiện loại trừ,
`=== false` bảo vệ ca undefined). Diff đúng 4 file, session-context/trpc KHÔNG đổi.

**Phase 2 (env):** `cmc-synth-pg` postgres container riêng (port 55432, NGOÀI local-sim). Phát hiện
**dev-seed VỠ thật** (Facility.code NOT NULL, seed create thiếu code) → fixed. `seed-constants.mjs`
side-effect-free + `seed.mjs` entrypoint guard (`.href`, argv[1]-undefined-safe cho `node -e`).
`assert-not-prod.ts` extract (R2-8), global-setup import lại. `synthetic-seed-env.sh` self-contained:
SYNTH_SEED_ALLOW + shared guard 2 URL → dedicated container → migrate (prisma v6 của @cmc/db, KHÔNG
v7 root) → cmc_app password → seed → sentinel verify qua cmc_app. `--fresh` + idempotent + negative
tests pass. Gate phase-04: 2 ✅, 3 ◐, 1 ⏳.

**Infra nuances gặp & xử lý:** (a) local-sim là postgres DUY NHẤT đang chạy, chứa cmc_prod → dựng
container riêng thay vì DB mới trên đó; (b) root `npx prisma` = v7 reject `url=env()` → dùng prisma
v6 của package; (c) API server từ chối superuser (ADR 0042 RLS) → tách role: cmc_app (app, NOSUPERUSER)
+ postgres (owner/migrate); (d) sentinel verify qua Prisma client nạp nhầm prisma/.env → chuyển psql-in-container.

**Verify (tester-path + reviewer):** typecheck lms/e2e/db exit 0; lint sạch; API e2e 15 pass; UI 4/4
lms-login pass. **Pre-existing fails (KHÔNG do đợt này, đã chứng minh tái hiện trên clean HEAD bằng
git stash):** 5 attendance specs (batch date-range 1-ngày), 2 admin-shell.ui (EmptyState) — out of scope.
Code-review độc lập (reviewer-p107) **9/10 APPROVE no blockers**: root-cause fix đúng+đủ, 0 redirect-loop,
security-neutral (enforce server-side trpc.ts:319-327), 0 side-effect stop-ask. W1 (comment home.tsx
stale) đã fix.

**Scope:** 6 modified (login/change-password/home, global-setup, seed.mjs, lms-login spec) + 3 new
(assert-not-prod.ts, seed-constants.mjs, synthetic-seed-env.sh) + README + docs phase-04 GATE + .gitattributes.

## Dependencies

- Unblocks (một phần): `260717-1213-so-nghiem-thu-song` phase-04 (GATED — sau đợt này còn gate 1
  PO-side + target spec là deliverable của chính Phase 4).
- Không xung đột file với plans mở khác (hr-kpi, attendance, happy-path đã completed/khác vùng).
- Chạm `apps/e2e/src/global-setup.ts` (extraction assert-not-prod) — thay đổi này NẰM TRONG spec
  phase-04 plan gốc (R2-8) — kéo về sớm, không xung đột.
