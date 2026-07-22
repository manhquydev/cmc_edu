---
title: "Nghiem thu bang chung dung vai: siet actor contract + go permission chan luong"
description: >-
  Bằng chứng của dự án đang mù vai trò — mọi tầng (unit, e2e, runtime-proof)
  thu bằng vai thuận tiện, kể cả 35 "proven" chụp bằng super_admin. Plan siết
  hợp đồng actor trong sổ nghiệm thu, gỡ 3 lỗi phân quyền chặn luồng thật, và
  đổi định nghĩa "xong" để placeholder không còn được đếm là "đã xây".
status: superseded
priority: P1
branch: "main"
tags: [acceptance, rbac, e2e, tooling]
blockedBy: []
blocks: [260717-1213-so-nghiem-thu-song]
created: "2026-07-22T02:43:35.014Z"
createdBy: "ck:plan"
source: skill
---

# Nghiem thu bang chung dung vai

> ## 🗄️ TRẠNG THÁI: SUPERSEDED (2026-07-22)
> Thay bằng hướng 2 nhịp tại `plans/reports/brainstorm-huong-trien-khai-260722-1114-nhip-sua-loi-roi-do-runtime-report.md` (PO chốt hướng C).
> **Giữ file này làm hồ sơ red-team** — bảng 29 finding bên dưới là checklist có `file:line`, vẫn dùng cho các plan kế tiếp.
> Red-team 2026-07-22 (4 reviewer) bác bỏ tiền đề nền của Phase 5/6. **29 finding — 10 Critical. Mới áp 2, còn 27.**
> ☢️ **Finding #15 phá hạ tầng dùng chung**: chạy spec Phase 4 trước khi vá `cleanupFacility` sẽ rò facility không xoá được trên DB `cmc_edu`. Đọc "Cảnh báo vận hành" cuối file trước khi chạy e2e.
> Các mục Overview, D4, D6, "Phát hiện được xử lý" và Acceptance Criteria bên dưới **vẫn chứa tuyên bố đã bị bác bỏ** (rõ nhất: *"35 proven chụp bằng super_admin"* — sai, xem `## Red Team Review` cuối file).
> Không thực thi plan này trước khi các finding được áp và chạy lại sweep nhất quán.

## Overview

**Vấn đề gốc:** mọi tầng bằng chứng của dự án được thu bằng **vai trò thuận tiện**, không phải vai trò nghiệp vụ. Không tầng nào từng hỏi *"vai X, chỉ với quyền của X, có hoàn thành được việc Y không?"*

Bằng chứng đắt nhất: plan `260720-1230-independent-runtime-verification-38-flows` (completed, qua red-team, **sinh ra chính vì PO nghi ngờ `38/38 built`**) báo **35 proven** — nhưng `flow-ui-routes.ui.spec.ts:52-55` chụp **mọi** luồng bằng `roles: ['super_admin']`, mà vai đó **bypass toàn bộ permission registry** (`packages/auth/src/index.ts:147` (hàm `can()`)). `P1-02` và `P2-07` đều mang nhãn `proven` trong khi không vai nghiệp vụ nào dùng nổi.

Nguồn phân tích (đọc trước khi thực thi):
- `plans/reports/brainstorm-problem-first-260722-0908-evidence-role-blindness-report.md` — gốc rễ + 8 phát hiện F1–F8, có mục tự bác bỏ (F3, F4′)
- `plans/reports/skeptical-acceptance-audit-260722-0848-cmc-system-state-report.md` — chạy lại toàn bộ gate + UAT + mutation test

**Kết quả mong đợi:** sổ nghiệm thu không thể tuyên bố một luồng "xong" khi chưa có vai trò thật nào làm nổi nó; ba lỗi chặn luồng được gỡ; bẫy `super_admin` bị chặn ở tầng CI.

## Quyết định đã chốt (PO, 2026-07-22 — không mở lại nếu không có bằng chứng mới)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | **Frame B**, không phải Frame A | A vá được lớp permission nhưng để nguyên `built` mang nghĩa "xong" → F7 sẽ tái diễn dạng khác |
| D2 | Thêm **quyền đọc riêng** (`class.read`) cho sale/GĐKD/GV/GĐĐT; `class.create` **vẫn chỉ GĐĐT** | Least-privilege. KHÔNG nới `class.create` — nới sẽ trao quyền **tạo lớp** cho sale/GV |
| D3 | Giữ nguyên ADR-B: `finance.receiptCreate` **không** cấp cho GĐĐT | Tách trách nhiệm tiền đã thống nhất; sửa phía đọc lớp, không sửa phía duyệt tiền |
| D4 | Branch `test/independent-runtime-verification-38-flows`: **giữ hạ tầng** (`proveFlow`, reporter, `runtime-evidence.json`), **thay** `super_admin` bằng vai nghiệp vụ, **xoá sạch nhãn proven cũ** rồi merge | Hạ tầng tốt, chỉ sai phần chọn vai. Nhãn cũ vô giá trị → cấp lại từ đầu |
| D5 | Scanner mở rộng **phải dùng ts-morph theo import graph**, KHÔNG regex-first | Kế thừa D1 plan `260717-1213`. Đã kiểm chứng thực nghiệm: prototype regex trong phiên brainstorm chỉ resolve **13/40** màn và dính 2 bug (đuôi `.js` trong import, `<Fallback />` của Suspense bắt nhầm) |
| D6 | `super_admin` bị **loại khỏi mọi phép tính actor** trong verifier | Nó bypass registry (`packages/auth/src/index.ts:147`) nên luôn làm mọi thứ "xanh" — đưa vào phép tính là tự làm mù |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Actor contract & manifest truth](./phase-01-actor-contract-manifest-truth.md) | Pending |
| 2 | [Permission fixes (class.read + payroll)](./phase-02-permission-fixes-class-read-payroll.md) | Pending |
| 3 | [Placeholder detection](./phase-03-placeholder-detection.md) | Pending |
| 4 | [Role-true e2e cho luong gay](./phase-04-role-true-e2e-cho-luong-gay.md) | Pending |
| 5 | [Cam super_admin trong spec luong](./phase-05-cam-super-admin-trong-spec-luong.md) | Pending |
| 6 | [Merge runtime-verification + cap lai proven](./phase-06-merge-runtime-verification-cap-lai-proven.md) | Pending |

**Thứ tự phụ thuộc:** 1 → 2 → 4 → 5 → 6; Phase 3 độc lập (chạy song song sau 1).

Phase 2 phải xong trước Phase 4 — không sửa quyền thì spec "một vai đi trọn luồng" **không thể** pass, vì chính luồng đó đang gãy.

## Phát hiện được xử lý

| ID | Nội dung | Phase |
|---|---|---|
| F1 | P1-02 deadlock: không vai nghiệp vụ nào tạo nổi phiếu thu (`classBatch.list` đòi `class.create`) | 2 |
| F2 | P2-07: GV thấy menu "Nhận xét buổi học" nhưng 3 query đòi `class.create` → dropdown rỗng im lặng | 2 |
| F4 | P3-05: `/hr/payroll` nav mở cho GĐKD/GĐĐT nhưng `payroll.tsx:414` gọi `user.list` đòi `user.manage: []` | 2 |
| F5 | P2-04 khai actor `giao_vien` nhưng `exercise.manage` chỉ GĐĐT (IDLE-ACTOR) | 1 |
| F6 | Manifest khai `nhan_vien` — role không tồn tại ở `@cmc/auth`, Prisma `enum Role`, lẫn dữ liệu | 1 |
| F7 | P1-08 = "built" trong khi `/finance/refund` là EmptyState tự khai "Tính năng chưa áp dụng" | 3 |
| F8 | 7/38 luồng mâu thuẫn actor↔permission | 1 |
| — | 35 "proven" thu bằng `super_admin` | 5, 6 |

Đã tự bác bỏ, **không** đưa vào scope: F3 (`cockpit.tsx` — widget render có điều kiện, hợp lệ) và F4′ (`compensationPolicy.manage: []` — chủ ý super_admin-only, UI đã gate bằng EmptyState, có test `shift-config.test.tsx:66`).

## Acceptance Criteria

- [ ] `pnpm typecheck` **fail** nếu manifest khai một `actorRoles` không thuộc `Role` của `@cmc/auth` (kiểm chứng: tạm đưa `nhan_vien` vào → phải đỏ)
- [ ] `pnpm acceptance:report` **fail** (exit ≠ 0) khi tồn tại luồng có procedure không actor nào gọi được, hoặc actor không gọi được procedure nào
- [ ] Sau Phase 2: `sale` và `giam_doc_kinh_doanh` tạo được phiếu thu qua UI `/finance/new` từ đầu đến cuối; `giao_vien` chọn được lớp ở `/teaching/session-assessment`; GĐKD thấy danh sách nhân viên ở `/hr/payroll`
- [ ] `class.create` **vẫn** chỉ `giam_doc_dao_tao` sau khi sửa (kiểm chứng: probe `classBatch.create` bằng `sale` → FORBIDDEN)
- [ ] Luồng có UI route trỏ tới màn placeholder **không** được xếp `built`; P1-08 đổi trạng thái
- [ ] Grep gate: `roles: ['super_admin']` xuất hiện **0 lần** trong spec luồng nghiệp vụ (trừ ADM-* vốn có actor là super_admin)
- [ ] E2E "một vai đi trọn luồng" xanh cho P1-02 và P2-07, không truyền id giữa 2 role
- [ ] `runtime-evidence.json` sau merge: mọi nhãn `proven` đều kèm vai nghiệp vụ, không nhãn nào còn `super_admin` (trừ ADM-*)
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` + e2e xanh khi kết thúc

## Môi trường & cạm bẫy đã biết

- DB test `cmc_edu` trong `cmcv2-prod-postgres-1`, qua socat `localhost:15432`. **Chạy `docker start cmc-test-db-socat` trước** — container này không sống sót qua restart máy (triệu chứng: lệnh test treo vài phút rồi báo "Can't reach database server").
- **Không đụng `cmc_prod`** (dữ liệu trẻ em thật). `assertNotProdDatabase` chặn theo tên, và tên bị socat decouple khỏi DB vật lý → kiểm tra kỹ URL trước khi chạy.
- E2E UI **phải** chạy `--project=ui-chromium`. Chạy `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test` không kèm `--project` khiến cả 2 project dùng chung DB → spec API tạo phiếu thu làm spec UI assert "danh sách rỗng" fail (**đỏ giả**, đã gặp trong phiên brainstorm).
- `super_admin` bypass registry (`packages/auth/src/index.ts:147`) — mọi probe/spec dùng nó đều cho kết quả vô nghĩa về mặt phân quyền.

## Dependencies

- **blocks** `260717-1213-so-nghiem-thu-song` (in-progress): plan này thay thế cách tiếp cận của **Phase 4 (Evidence Collector, GATED)** ở đó — evidence phải thu bằng vai nghiệp vụ, không phải chỉ chụp màn hình render được. Sau khi plan này xong, Phase 4 của `260717-1213` cần được đóng hoặc đánh dấu superseded.
- Tiêu thụ artifact của `260720-1230-independent-runtime-verification-38-flows` (completed): branch `test/independent-runtime-verification-38-flows`, 5 commit chưa merge, chứa `proveFlow` + reporter + `flow-ui-routes.ui.spec.ts`.
- Chạm `docs/14` (danh mục vai trò & phân quyền) và spec P2-Foundation — comment `class-batch-router.ts:112-114` khai registry cố ý chỉ có 4 entry, việc thêm `class.read` phải cập nhật cả tài liệu + ADR.

## Câu hỏi cần PO trả lời trước khi đóng plan

1. **`/finance/refund` (P1-08)**: sửa cách đếm cho trung thực rồi để đó, hay xây nốt màn hoàn tiền? Plan hiện giả định **chỉ sửa cách đếm**; xây màn = plan riêng.
2. **Actor thật của 3 luồng đang khai `nhan_vien`** — Phase 1 suy từ registry: P3-01 → 4 vai có `checkIn.punch` (GĐKD/GĐĐT/sale/GV); P4-01 → 3 vai có `rewards.manage`; P4-03 → 3 vai có `parentMeeting.manage`. Cần PO xác nhận hoặc bác.
3. Audit actor↔permission nên **chặn merge** hay chỉ cảnh báo trong CI?

## Red Team Review

### Session — 2026-07-22
**Findings:** 39 thô từ 4 reviewer (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic) → 14 sau khử trùng lặp
**Severity:** 6 Critical, 6 High, 2 Medium
**Kết quả:** plan **KHÔNG đạt** — luận điểm nền của Phase 5/6 bị bác bỏ bằng chứng cứ. Cần sửa lớn trước khi thực thi.

| # | Finding | Sev | Phán quyết | Áp vào |
|---|---------|-----|------------|--------|
| 1 | **Tiền đề Phase 5 sai**: verdict `proven` KHÔNG do `super_admin` cấp — 0/38 verdict thuộc spec UI; toàn bộ thuộc spec API dùng vai nghiệp vụ thật (`p1-runtime-proofs.spec.ts:49` `roles:['sale']`). Cơ chế làm lọt F1 là **bắc cầu `classBatchId`** (`:49-63`), không phải super_admin | Critical | **Accept** — tự kiểm chứng lại, reviewer đúng | Overview, D4, P5, P6 |
| 2 | `pnpm typecheck` **không cover `scripts/`** (không có `scripts/tsconfig.json`; `turbo run typecheck` chỉ chạy trong workspace) → AC #1 không thể pass như viết | Critical | **Accept** — đã xác minh | AC, P1 |
| 3 | Assertion Phase 1 **mù với chính F1/F2** — nó so `expected.trpc` với actor, mà `classBatch.list` không nằm trong `expected.trpc` của P1-02 | Critical | **Accept** — đây là lỗ hổng logic nền | P1 |
| 4 | **D6 làm nhiều luồng bất khả thi**: loại `super_admin`/`he_thong`/`agent` khiến 9–16 luồng (3 reviewer ra 3 số) không còn actor nào → buộc whitelist hàng loạt, vô hiệu hoá gate. Số vi phạm thật ≫ 7 | Critical | **Accept** — cần tự đếm lại và thiết kế lại D6 | D6, P1 |
| 5 | `class.read` mở **`/admin/classes`** cho sale/GV — nav entry `nav-registry.ts:36` **không có `permission:`**, nên chặn duy nhất hiện nay là 403 từ `classBatch.list` | Critical | **Accept** — đã xác minh | P2 |
| 6 | `class.read` cho `giao_vien` **vượt teacher-scoping**: `listStudents` trả `fullName` trẻ em của **mọi lớp**, trong khi `assert-teacher-owns-class.ts` giới hạn GV theo `ClassBatch.teacherAppUserId` | Critical | **Accept** — tách `classRoster.read` riêng | P2 |
| 7 | **4 luồng** khai `nhan_vien` (P3-01, **P3-02**, P4-01, P4-03), plan chỉ liệt kê 3 — sót P3-02, luồng khó suy actor nhất | High | **Accept** — đã xác minh | P1, F6, câu hỏi PO |
| 8 | Bugfix production (F1 — không ai thu được học phí) bị **chặn sau** Phase 1 tooling mà nó không cần | High | **Accept** — đảo thứ tự, tách bugfix ship trước | Thứ tự phase |
| 9 | Phase 3 **không parallel-safe** — cùng sửa `verify.ts` + `types.ts` với Phase 1 | High | **Accept** — tôi đã tự phát hiện trước khi nhận báo cáo | Thứ tự phase |
| 10 | ~20–27 procedure trong manifest **không có `requirePermission`** (scoped/lms/public) — assertion chưa định nghĩa ngữ nghĩa cho chúng | High | **Accept** | P1 |
| 11 | `permission-scanner.ts` **lặp lại traversal** đã có trong `trpc-scanner.ts` | High | **Accept** — mở rộng scanner cũ thay vì tạo mới | P1 |
| 12 | Phase 2 **không có hàng rollback**; registry ship trong 2 artifact deploy | High | **Accept** | P2 |
| 13 | Phase 4 ghi rows mà **teardown `cleanupFacility` (allowlist đóng) không xoá được**; bản vá lại nằm ở Phase 6 | High | **Accept** | P4/P6 |
| 14 | Phase 3 trùng capability branch đã ship, rồi Phase 6 merge đè lên | Medium | **Accept một phần** — kiểm branch trước khi tự xây | P3/P6 |

**Bị bác (không áp):** các finding dựa trên suy đoán không có `file:line`, và finding cho rằng `pnpm test` đang đỏ — phiên này chạy thực tế **956/956 pass** (log 2026-07-22 08:37), nên tiền đề đó sai ở thời điểm hiện tại; rủi ro `EmployeeCodeCounter > 9999` là có thật nhưng chưa xảy ra.

### Hệ quả với luận điểm gốc
Luận điểm "bằng chứng mù vai trò" **vẫn đứng**, nhưng cơ chế bị quy sai. Dùng đúng vai là **điều kiện cần, không đủ** — tầng runtime-proof đã dùng đúng vai mà vẫn mù vì bắc cầu id. Do đó Phase 5 phải nhắm vào **cấm bắc cầu id**, còn cấm `super_admin` hạ xuống thành biện pháp phụ cho tầng screenshot.

Hai báo cáo nguồn đã được đính chính tại chỗ, ghi rõ phần nào sai và vì sao.

### Whole-Plan Consistency Sweep
- **Chưa chạy** — sweep chỉ có nghĩa sau khi các finding Accept được áp. Hiện 14/14 finding chưa áp vào phase files.
- **Unresolved contradictions: 14.** Plan **không** ở trạng thái sẵn sàng thực thi.

### Bổ sung sau khi 4 reviewer nộp báo cáo đầy đủ (2026-07-22, đợt 2)

Tổng cuối: **39 findings thô → 10 Critical, 15 High, 11 Medium.** Các finding dưới đây **chưa có** trong bảng đợt 1 và đều đã được kiểm chứng bằng `file:line`.

| # | Finding | Sev | Phán quyết |
|---|---------|-----|------------|
| 15 | ☢️ **Phase 4 làm hỏng DB dùng chung.** Spec P2-07 tạo `QualitativeAssessment`; `cleanupFacility` trên main **không xoá bảng đó** (`apps/e2e/src/db.ts:121-191`). FK `studentId` là required, Prisma phát `onDelete: Restrict` → `student.deleteMany` ném lỗi → teardown re-throw (`global-setup.ts:124-128`) → **rò nguyên một facility trên `cmc_edu` mỗi lần chạy, vĩnh viễn**. Bản vá có trên branch nhưng Phase 6 chạy sau cùng | **Critical** | **Accept** — cherry-pick `cleanupFacility` (kèm residue-count guard) làm **tiền đề của Phase 4**, không chờ Phase 6 |
| 16 | Citation `apps/api/src/trpc.ts:214` **sai**, lặp 4 lần — đó là bypass của `requireValidFacility`. Bypass registry thật là `packages/auth/src/index.ts:147` (`can()`). Phase 5 định nướng citation sai vào chuỗi lỗi cho lập trình viên | High | **Accept — đã sửa** ở cả 4 tài liệu trong phiên này |
| 17 | AC "grep `super_admin` = 0 lần" **đã đúng sẵn trên main** (0 match trong `apps/e2e/tests`) → gate ship xanh mà không chứng minh gì | High | **Accept** — AC vô nghĩa, phải thay |
| 18 | Guard runtime tại `mintStaffCookie` **không bao giờ chạy** ở chế độ mặc định: `createE2eStaffClient` chỉ mint cookie khi `NODE_ENV==='production'`, còn lại dùng `x-dev-user` | High | **Accept** — biện pháp "mạnh hơn" của Phase 5 là hư cấu |
| 19 | `verify.ts` **chưa từng** exit non-zero (`main()` chỉ `console.warn`, :160-172); CI (`ci.yml`) chỉ chạy typecheck/test/coverage — **không** chạy `acceptance:report`, **không** lint, và không phase nào sửa `ci.yml` | High | **Accept** — mọi gate trong plan hiện không thể chặn merge |
| 20 | Tiền lệ "plan 260720-1230 cấm `x-dev-user` bằng guard grep = 0" **không tồn tại** trong repo lẫn trên branch | High | **Accept** — tôi trích dẫn một tiền lệ không có thật |
| 21 | `FlowActor` nên xây trên **`ActiveRole` (5 vai)**, không phải `Role` (9) — nếu không `ke_toan/cskh/ctv_mkt/hr` lọt typecheck dù không có quyền nào | High | **Accept** |
| 22 | Phase 3 target "46 route" **thấp hơn baseline hiện tại**: scanner đã resolve **57** route (61 `path:` literal). Đạt 46 = mất 11 route mà vẫn tuyên bố thành công. Còn họ placeholder thứ hai: `ComingSoon` → "Đang phát triển" (`admin.routes.tsx:50`, `hr.routes.tsx:17`, `ops.routes.tsx:13`), inline element không có page file | Medium | **Accept** |
| 23 | Falsification test của Phase 3 định phá `/finance` — **đúng màn mà spec UI Phase 6 assert** (`P1-03`, heading "Phiếu thu học phí"). Ngắt giữa chừng để lại `receipt-list.tsx` thành EmptyState, không có dấu vết revert | Medium | **Accept** — falsify trên route nháp |
| 24 | Blast radius Phase 2 là **8 trang production**, không phải 3. `/teaching/session-evidence` và `/teaching/schedule` hỏng **cùng kiểu F2** nhưng không có trong bảng findings | Medium | **Accept** |
| 25 | `packages/auth/src/index.test.ts` không có trong file list của phase nào, và `ACTIVE_ROLE_MATRIX` **không có assertion exhaustiveness** → `class.read` sẽ land với zero role coverage mà CI vẫn xanh | Medium | **Accept** |
| 26 | P1-09 `audit.list` **không phải** "super_admin-only theo thiết kế" mà là **lỗi trùng lặp manifest** — `audit.list` thuộc ADM-04 (`/admin/audit-log`); `/ops/recon` không gọi audit. Plan định whitelist vĩnh viễn một lỗi | High | **Accept** — sửa manifest, không whitelist |
| 27 | 17 `lmsProcedure` không có registry key (`trpc.ts:240-244`: "deliberately does NOT check can()"), 2 trong số đó nằm trong P2-07 (`assessment.listForChild`, `reportCard.getForChild` — procedure phiên phụ huynh). ⇒ **"một vai đi trọn luồng" là bất khả thi cho P2-07** như manifest định nghĩa | High | **Accept** — tách P2-07 thành nhánh staff + nhánh LMS |
| 28 | D4 sai: sửa tối thiểu là **1 `beforeEach` trong 1 file + chạy lại ui-chromium**, không cần xoá và cấp lại 38 nhãn | High | **Accept** — D4 phải viết lại |
| 29 | Câu "P1-02 và P2-07 mang nhãn proven trong khi không vai nghiệp vụ nào dùng nổi" là **nói quá** — `sale` **đã** gọi `receiptCreate` thành công; nó chỉ không phải tự tìm lớp | Medium | **Accept — đã sửa** trong báo cáo gốc |

**Bác bỏ:** lo ngại spec chạy song song trong một run — `playwright.config.ts` đặt `fullyParallel: false, workers: 1` và mỗi run tự bootstrap facility riêng, nên không có đua trong cùng run.

### Cảnh báo vận hành — đọc trước khi chạy bất kỳ e2e nào của plan này
> Finding #15 là thứ duy nhất **phá hạ tầng** chứ không chỉ tốn thời gian. Không chạy spec nào tạo `QualitativeAssessment` / `SessionEvidence` trên `cmc_edu` trước khi `cleanupFacility` được vá — mỗi lần chạy rò một facility không xoá được, và DB này dùng chung giữa các phiên/agent.

### Whole-Plan Consistency Sweep
- **Chưa chạy.** Tổng **29 finding**, mới áp **2** (citation sai #16, nói quá #29). **Unresolved: 27.**
- Plan giữ nguyên cờ ⛔ **không sẵn sàng thực thi**.
