---
title: "Go permission chan luong (nhip A) + do runtime & luoi an toan (nhip B)"
description: >-
  Nhịp A gỡ 3 lỗi phân quyền chặn luồng thật (F1 luồng tiền, F2 màn nhận xét,
  F4 màn chốt lương) bằng TDD, verify không cần e2e. Nhịp B vá teardown e2e,
  dựng runtime capture quét ~150 tổ hợp màn×vai (nguồn: route tree), và cho gate một chỗ để chạy.
status: completed  # 6/6 phase xong 2026-07-22; 11 denial runtime còn lại chuyển sang plan kế tiếp
priority: P1
branch: "main"
tags: [rbac, acceptance, e2e, ci]
blockedBy: []
blocks: [260717-1213-so-nghiem-thu-song]
created: "2026-07-22T04:34:14.283Z"
createdBy: "ck:plan"
source: skill
---

# Gỡ permission chặn luồng + đo runtime

## Overview

**Bối cảnh:** dự án **chưa live**, đang chuẩn bị go-live. F1 chặn go-live chứ không đang mất tiền → làm đúng thay vì vá gấp.

Ba lỗi phân quyền đã được chẩn đoán và **cả 4 reviewer red-team xác nhận đúng từng dòng**. Chúng tồn tại từ 2026-07-06/07 — **chưa từng chạy được**, không phải hồi quy:

- **F1** `/finance/new` — `classBatch.list` đòi `class.create` (chỉ GĐĐT) nhưng `finance.receiptCreate` chỉ sale/GĐKD ⇒ **không vai nghiệp vụ nào tạo nổi phiếu thu học phí**
- **F2** `/teaching/session-assessment` — GV thấy menu nhưng 3 query đòi `class.create` ⇒ dropdown rỗng **im lặng**
- **F4** `/hr/payroll` — nav mở cho GĐKD/GĐĐT nhưng `payroll.tsx:414` gọi `user.list` đòi `user.manage: []` ⇒ không lấy được danh sách nhân viên

**Nguồn (đọc trước khi thực thi):**
- `plans/reports/brainstorm-huong-trien-khai-260722-1114-nhip-sua-loi-roi-do-runtime-report.md` — thiết kế chốt của đợt này
- `plans/260722-0908-acceptance-role-true-evidence/plan.md` §`Red Team Review` — **29 finding có `file:line`, dùng làm checklist** (plan đó đã superseded, giữ làm hồ sơ)
- `plans/reports/brainstorm-deep-260722-1030-nguon-su-that-nghiem-thu-report.md` — chẩn đoán gốc rễ

## Quyết định đã chốt (PO 2026-07-22 — không tự đảo)

| # | Quyết định | Ghi chú |
|---|---|---|
| Q1 | Chưa live → ưu tiên làm đúng, không vá gấp | |
| Q2 | Hướng C: sửa cái đã biết (nhịp A) rồi đo phần còn lại (nhịp B) | |
| ~~Q3~~ | ~~Giữ `class.read` gộp 1 quyền~~ — **ĐÃ ĐẢO 2026-07-22 vì có bằng chứng mới** | Xem Q3′ |
| **Q3′** | **TÁCH `classRoster.read` (chỉ `classBatch.listStudents`) cho [`giao_vien`, `giam_doc_dao_tao`]**; `class.read` (list/get + classSession.list) giữ cho 4 vai | **Bằng chứng mới làm đổ tiền đề của Q3:** (1) S3 chứng minh nav gate + `canDo()` là lớp **client**, không chặn được `sale` gọi thẳng `/trpc/classBatch.listStudents` từ devtools ⇒ "giảm nhẹ bằng nav gate" là sai; (2) đo thực tế: **chỉ 2 màn** dùng `listStudents` — `classes/class-detail.tsx:71` (GĐĐT) và `teaching/session-assessment.tsx:53` (GV) — **sale không dùng màn nào**, nên tách **không mất chức năng gì**. Chi phí: 1 dòng registry + 1 dòng `requirePermission` |
| **Q4′** | `/finance/class-placement` **KHÔNG cần page-level guard** | Màn xếp lớp, gọi `classBatch.list` + `student.lookup` + `enrollment.enroll`. Actor tự nhiên = sale/GĐKD/GĐĐT, đúng nhóm được cấp `class.read`. Hành động ghi đã bị `enrollment.enroll` chặn ở API; GV vào được nhưng không enroll được. **Không gọi `listStudents`** nên không nằm trên đường rò PII. Vấn đề thật là **khám phá** (không có nav entry) — cần xác nhận vào từ đâu hoặc thêm nav entry, không phải chặn |
| Q4 | Giữ ADR-B: `finance.receiptCreate` **không** cấp cho GĐĐT | Sửa phía đọc lớp, không đụng phía duyệt tiền |
| Q5 | **KHÔNG nới `class.create`** | Nới = trao quyền tạo lớp cho sale/GV |
| **D-RT** | **Nguồn màn của Phase 5 = `scanUiRoutes()` (route tree), nguồn vai = nav-registry** | Chốt 2026-07-22 sau red-team vòng 2. Hai thứ khác nhau và bản đầu đã lẫn: route tree nói *màn nào tồn tại* (57 route), nav-registry nói *ai thấy menu* (22 màn). `/finance/new` — nơi F1 sống — **không** có nav entry, nên ma trận sinh từ nav sẽ không bao giờ mở nó. Quyết định này gỡ đồng thời 2 Critical |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Nhip A - quyen doc lop (TDD)](./phase-01-nhip-a-quyen-doc-lop-tdd.md) | ✅ Completed (2026-07-22) |
| 2 | [Nhip A - chan duong vao UI](./phase-02-nhip-a-chan-duong-vao-ui.md) | ✅ Completed (2026-07-22) |
| 3 | [Nhip A - man chot luong](./phase-03-nhip-a-man-chot-luong.md) | ✅ Completed (2026-07-22) |
| 4 | [Nhip B - va teardown e2e](./phase-04-nhip-b-va-teardown-e2e.md) | ✅ Completed (2026-07-22) |
| 5 | [Nhip B - runtime capture](./phase-05-nhip-b-runtime-capture.md) | ✅ Completed (2026-07-22) |
| 6 | [Nhip B - luoi an toan CI](./phase-06-nhip-b-luoi-an-toan-ci.md) | ✅ Completed (2026-07-22) |

**Phụ thuộc:** 1 → 2 → 3 (**tuần tự, một commit** — xem Rollback); **4 → 5** (bắt buộc); **3 → 6** (Phase 6 bật exit-code, cần Phase 3 đã khai procedure mới vào manifest).

Phase 5 có một ràng buộc ngược thời gian: **phép thử chua phải chạy trên commit TRƯỚC Phase 1** để chứng minh capture tự tìm ra F1/F2. Ghi lại commit hash của `main` hiện tại (`4237cb5`) trước khi bắt đầu Phase 1.

## Nhịp A vs Nhịp B — ranh giới cứng

**Nhịp A (Phase 1–3) KHÔNG chạm:** `apps/e2e/**`, `.github/workflows/**`, branch `test/independent-runtime-verification-38-flows`.
Verify nhịp A bằng **unit/integration test + probe API + UAT trình duyệt** — cách đã chứng minh tìm ra F1/F2 trong phiên brainstorm. Không chạy e2e ⇒ không dính bẫy rò DB (xem Phase 4).

## Acceptance Criteria (toàn đợt)

- [ ] `sale` và `giam_doc_kinh_doanh` tạo được phiếu thu qua UI `/finance/new` trọn vẹn: chọn được lớp trong dropdown, submit thành công
- [ ] `giao_vien` chọn được lớp ở `/teaching/session-assessment` (dropdown có option)
- [ ] `giam_doc_kinh_doanh` thấy danh sách nhân viên ở `/hr/payroll`
- [ ] Negative-authz xanh: `sale` → `classBatch.create` FORBIDDEN; `giao_vien` → `classBatch.assignTeacher` FORBIDDEN; `giam_doc_dao_tao` → `finance.receiptCreate` FORBIDDEN
- [ ] `sale` không vào được surface quản trị `/admin/classes` (cả qua menu lẫn gõ URL)
- [ ] `cleanupFacility` vá xong; chạy e2e không để lại facility rò (residue guard xanh)
- [ ] Runtime capture chạy ~150 tổ hợp (sinh từ `scanUiRoutes()`), `/finance/new` có trong ma trận, và **tự tìm ra F1 + F2 trên commit `4237cb5`** (không được mớm)
- [ ] `scripts/` nằm trong lưới typecheck + lint; CI chạy `acceptance:report`
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` xanh (**không** dùng con số 956 làm ngưỡng)
- [ ] `pnpm acceptance:report` vẫn `0 orphan chưa phân loại` sau khi Phase 3 thêm procedure mới

## Rollback (nhịp A)

**Phase 1–3 land thành MỘT commit, không chạy song song.** (Bản đầu vừa nói "Phase 3 song song" vừa nói "revert 1 commit" — mâu thuẫn: song song mà gộp 1 commit thì buộc phải tuần tự hoá.)

Revert 1 commit, danh sách file **đầy đủ**:
`packages/auth/src/index.ts` · `packages/auth/src/index.test.ts` · 4 router (`class-batch-router.ts`, `class-session-router.ts`, `payroll/router.ts`) · `apps/admin/src/shell/nav-registry.ts` (+ test) · `apps/admin/src/pages/classes/{index,class-detail}.tsx` · `apps/admin/src/pages/hr/{payroll,salary-tiers}.tsx` (+ test) · `apps/admin/src/pages/cockpit.tsx` (nếu đổi gate) · `scripts/acceptance-report/flow-manifest.ts` · `docs/14-danh-muc-vai-tro-phan-quyen.md`

⚠️ **Revert `src` là chưa đủ** — phải `pnpm --filter @cmc/auth build` lại, nếu không `dist/` vẫn giữ quyền đã nới và API deploy vẫn cho phép.

⚠️ **Deploy api và admin CÙNG LÚC.** `PERMISSIONS` được `can()` dùng **cả ở browser** (`apps/admin/src/lib/session-context.tsx:35`), Vite bake lúc build — không có toggle runtime.
- Deploy API trước ⇒ sale/GV không thấy nav entry cho màn vừa mở ⇒ dễ bị "sửa" bằng cách nới `class.create` — đúng thứ Q5 cấm.
- Không migration. Không cần invalidate session (cookie mang **role**, không mang permission).

## Môi trường & cạm bẫy đã biết

- ~~DB test `cmc_edu` qua socat `localhost:15432`~~ — **SAI TỪ 2026-07-22**: container `cmc-test-db-socat` **không còn tồn tại** và DB `cmc_edu` **không còn** trên `cmcv2-prod-postgres-1` (chỉ còn `cmc_prod`). Dùng **`SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh`** → container riêng `cmc-synth-pg:55432`, DB `cmc_synth`, tách hoàn toàn khỏi cluster chứa dữ liệu trẻ em. Export 2 URL nó in ra trước khi chạy test.
- `pnpm install` + `pnpm --filter @cmc/db exec prisma generate` là **bắt buộc trên máy sạch**: pnpm 10.24 bỏ qua `pnpm.onlyBuiltDependencies` nên postinstall của Prisma không chạy ⇒ `@prisma/client` là stub CJS, seed/test chết với "Named export 'PrismaClient' not found".
- **Không đụng `cmc_prod`** (dữ liệu trẻ em thật **sau go-live**). ⚠️ **Đính chính 2026-07-22 (đo read-only):** hiện `cmc_prod` **RỖNG** — 1 Facility seed, 0 Student/ParentAccount/Receipt/AppUser. Dự án chưa vận hành. Guard vẫn giữ nguyên vì chúng bảo vệ trạng thái tương lai, **nhưng đừng lấy câu này làm lý do từ chối UAT trên prod lúc này** (xem `docs/runbook-uat-golive.md` §2). `assertNotProdDatabase` chặn theo tên, mà socat decouple tên khỏi DB vật lý ⇒ kiểm URL kỹ.
- E2E UI **phải** chạy `--project=ui-chromium` riêng. Chạy chung khiến 2 project dùng chung DB ⇒ **đỏ giả** (đã gặp).
- `super_admin` bypass registry tại `packages/auth/src/index.ts:147` (`can()`) ⇒ mọi probe/spec dùng nó vô nghĩa về phân quyền. *(Lưu ý: `apps/api/src/trpc.ts:214` là bypass của `requireValidFacility`, **không phải** registry — citation này từng bị nhầm.)*
- `pnpm test` xanh ở một lần đo (2026-07-22 08:37). **Không dùng con số 956 làm tiêu chí** — nó là một phép đo đơn lẻ trên DB dùng chung, và `pnpm test` loại `@cmc/e2e` nên không bao giờ phủ Phase 4–5.
- ~~Rủi ro `EmployeeCodeCounter > 9999` chưa xảy ra~~ — **SAI, đã sửa**: nợ đó **đã xảy ra và đã được xử lý** (`app-user.test.ts:50-52` nới assertion sang tối thiểu 4 chữ số, `HARNESS_BACKLOG` ghi Status: implemented). Bản đầu của plan viết sẵn một cái cớ để bỏ qua lỗi **không còn tồn tại** — nếu `app-user.test.ts` đỏ thì đó là lỗi mới, phải điều tra.

## Ngoài scope đợt này

Plan riêng **sau khi Phase 5 cho dữ liệu thật**: actor contract (`FlowActor` xây trên `ActiveRole`), placeholder detection (F7 + họ `ComingSoon`/"Đang phát triển"), merge branch runtime-verification, chống bắc cầu id trong spec, tách P2-07 thành 2 chặng staff/LMS (17 `lmsProcedure` cố ý không kiểm `can()`).

## Dependencies

- **blocks** `260717-1213-so-nghiem-thu-song` (in-progress) — Phase 4 (Evidence Collector) của plan đó vẫn chờ cách thu bằng chứng đúng; Phase 5 ở đây là bước đầu tiên theo hướng mới.
- Tiêu thụ artifact của `260720-1230-independent-runtime-verification-38-flows` (completed): branch chứa bản vá `cleanupFacility` mà Phase 4 cherry-pick.
- Thay thế `260722-0908-acceptance-role-true-evidence` (superseded) — giữ file đó làm hồ sơ red-team 29 finding.

## Câu hỏi cần PO trả lời

1. Gate mới (`acceptance:report` trong CI) **chặn merge** hay chỉ cảnh báo?
2. Runtime capture chạy **mọi PR** (chậm) hay **nightly + trước release** (rẻ, lỗi lọt lâu hơn)?
3. `/finance/refund` là EmptyState "Tính năng chưa áp dụng" nhưng P1-08 đếm `built` — sửa cách đếm hay xây nốt màn hoàn tiền?
4. Actor thật của 4 luồng khai `nhan_vien` (P3-01, **P3-02**, P4-01, P4-03)? P3-02 khó nhất vì `manualPunch.resubmit` cố ý không có registry key (owner-check).

## Red Team Review — vòng 2

### Session 2026-07-22 (đang chạy: 1/4 reviewer đã nộp)

**Ba lỗi thiết kế Critical trong Phase 5 — đã tự kiểm chứng lại, reviewer đúng:**

| # | Finding | Sev | Bằng chứng | Phán quyết |
|---|---------|-----|-----------|------------|
| 1 | **Phép thử chua của Phase 5 bất khả thi như thiết kế.** `/finance/new` **không có** trong `nav-registry.ts` (0 match). Phase 5 sinh danh sách (màn, vai) *từ registry* ⇒ **không bao giờ mở màn chứa F1** ⇒ không thể chứng minh capture tìm ra F1 | **Critical** | `grep -c "finance/new" apps/admin/src/shell/nav-registry.ts` = 0 | **Accept** — nguồn danh sách phải là **route tree** (`routes/*.tsx`), nav-registry chỉ cho biết *ai thấy menu*. Hai thứ khác nhau và tôi đã lẫn |
| 2 | **"Bất kỳ 403 nào = lỗi" là luật sai.** Admin client dùng `httpBatchLink` ⇒ nhiều procedure gộp vào **một** HTTP request; batch trả **HTTP 200** với mảng kết quả, lỗi 403 nằm *trong body* từng phần tử | **Critical** | `apps/admin/src/lib/trpc.ts:2,30` | **Accept** — capture phải **parse body** của mỗi batch response, không đọc HTTP status |
| 3 | **`ui-chromium` mặc định trỏ LMS.** `baseURL: 'http://localhost:4174'`; spec admin không override ⇒ mở nhầm app, mọi tổ hợp "pass" giả | High | `apps/e2e/playwright.config.ts:79` | **Accept** — bắt buộc `test.use({ baseURL: 'http://localhost:4173' })` cho phần admin |
| 4 | 62 tổ hợp chỉ phủ **22 màn**; 12 màn thật không có nav entry; 5 nav entry gated cho 0 tổ hợp | High | (reviewer) | **Accept** — hệ quả trực tiếp của #1 |
| 5 | Phase 1 sót `cockpit.tsx:210` — gate `class.create` phía client mà Phase 5 không thấy được | High | (reviewer) | **Accept** — thêm vào Related Code Files Phase 1 |
| 6 | Test nav của Phase 2 không kiểm được thứ Phase 2 đổi; tiêu chí "gõ URL" không đạt được từ các bước đã viết | High | (reviewer) | **Accept** |
| 7 | Phase 3 tạo ra đúng vi phạm mà Phase 6 biến thành fatal, và không có gì ràng buộc thứ tự | High | (reviewer) | **Accept** — thêm dependency |
| 8 | Hai tuyên bố "quirk đã biết" mâu thuẫn với chính nguồn plan trích | Medium | (reviewer) | **Accept** |

### Bài học tự rút
Tôi lẫn **nav-registry** (ai *thấy* menu) với **route tree** (màn nào *tồn tại*). Phase 5 xây trên nhầm lẫn đó, và tôi đã ghi con số 62 vào plan như "đã tính, không ước lượng" — đúng loại tự tin mà cả phiên này đang phê phán. Con số 62 đúng về số tổ hợp *nav*, nhưng sai về *phạm vi phủ*.

### Trạng thái
⛔ **Chưa sẵn sàng thực thi.** Phase 5 cần thiết kế lại nguồn danh sách và cách đọc kết quả. Còn **3/4 reviewer** chưa nộp — bảng trên sẽ còn dài thêm.

**Nhịp A (Phase 1–3) ít bị ảnh hưởng hơn** — chỉ finding #5, #6, #7 chạm tới, đều sửa được tại chỗ.

### Bổ sung — findings từ reviewer đã nộp (3/4 reviewer khác báo idle nhưng KHÔNG nộp báo cáo)

| # | Finding | Sev | Phán quyết |
|---|---------|-----|------------|
| 9 | **Phase 2 là phantom test.** `visibleModulesFor` chỉ lọc MODULE; gating con nằm ở `shell.tsx:35 isChildVisible`. Snapshot sẽ báo `/admin/classes` "visible" cho `sale` **trước và sau** khi sửa ⇒ tiêu chí Q3 được ghi là "đã verify" trong khi `sale` vẫn URL vào được `/admin/classes` → `/admin/classes/:id` → `listStudents` → tên trẻ em | **Critical** | **Accept** — dùng page-level guard đã có sẵn trong repo (`users.tsx:307`, dùng ở 5 màn admin); `classes/index.tsx` hiện **không có** `canDo` nào |
| 10 | **Phase 3 ↔ Phase 6 đụng nhau, không ràng buộc thứ tự.** `payslip.assignableStaff` mới sẽ thành orphan **chưa phân loại**; Phase 6 biến đúng đường đó thành exit non-zero trong CI. Baseline đo được: 38 luồng, **1 orphan, 0 chưa phân loại, exit 0** — repo đang ở đúng ngưỡng, một procedure mới là vượt | **Critical** | **Accept** — Phase 3 phải khai procedure mới vào `flow-manifest.ts`; thêm `dependencies` cho Phase 6 |
| 11 | 3 tuyên bố nền của plan **sai**, đã sửa tại chỗ: `verify.ts` "chưa từng exit non-zero" (thực tế có 4 `throw`); `ci.yml` "không e2e" (có, non-blocking); `EmployeeCodeCounter` "chưa xảy ra" (đã xảy ra **và đã sửa** — plan vô tình viết sẵn cớ bỏ qua lỗi không còn tồn tại) | High | **Accept — đã sửa** |
| 12 | `scripts/tsconfig.json` một mình **không đủ** — turbo cần `scripts/package.json` + workspace membership | High | **Accept — đã sửa** Phase 6 bước 1 |
| 13 | 28 call site `canDo()` trong pages là **gate phía client**; capture chỉ đọc 403 **không bao giờ thấy** chúng (không gọi ⇒ không có request). `cockpit.tsx:210` là một ví dụ đang sống | High | **Accept** — capture phải bổ sung một lớp đọc gate client, hoặc thừa nhận giới hạn này công khai |
| 14 | Coverage thật của 62 tổ hợp: **22 màn (~56%)**. 5 nav entry ADMIN có role list `[]` ⇒ 0 tổ hợp; 12 màn thật không có nav entry (`/finance/new`, `/finance/class-placement`, `/admin/courses`, `/admin/parents`, `/admin/report-cards`, 3× engagement, các route `:id`) | High | **Accept** — hệ quả của Critical #1 |

**Một quyết định gỡ được hai Critical cùng lúc:** nguồn danh sách của Phase 5 đổi thành **route-tree ∪ nav-registry** (route tree cho biết màn nào tồn tại; nav-registry cho biết ai thấy menu). Cần PO xác nhận vì nó mở rộng phạm vi Phase 5.

### Trạng thái sau đợt áp findings (2026-07-22, phiên /cook)
**14/14 finding đã áp.** Thay đổi chính:

- **D-RT chốt**: nguồn màn của Phase 5 đổi sang `scanUiRoutes()` (57 route) thay vì nav-registry (22 màn) — gỡ đồng thời Critical #1 và #4. Quy mô 62 → ~150 tổ hợp, ~5 phút.
- **Phase 5**: parse body batch thay vì đọc HTTP status (#2); override `baseURL` sang :4173 (#3); cơ chế worktree cho phép thử chua; công bố giới hạn không thấy gate `canDo()` client (#13).
- **Phase 1**: thêm rà `cockpit.tsx:210` + 28 call site `canDo()` (#5).
- **Phase 2**: thêm page-level guard cho `classes/index.tsx` theo mẫu `users.tsx:307`; cảnh báo test `visibleModulesFor` là test giả, phải đi qua `isChildVisible` (#6, #9).
- **Phase 3**: bắt buộc khai procedure mới vào `flow-manifest.ts` (#7, #10).
- **Phase 6**: `dependencies: [3]`; sửa 2 tuyên bố sai về `verify.ts` và `ci.yml`; `scripts/tsconfig.json` cần kèm `package.json` + workspace (#11, #12).

### Whole-plan consistency sweep
Đã quét lại toàn bộ 7 file sau khi áp. Reconcile 6 chỗ tồn dư trong Phase 5 (ngân sách 2 phút, nguồn nav trùng lặp, tên file matrix, tiêu chí validation, bảng rủi ro, overview) và 2 chỗ trong Phase 2 ("nav là lớp chặn duy nhất", "điểm cần quyết" đã có lời giải). **Unresolved contradictions: 0.**

### Bổ sung tự đo (thay một phần việc reviewer không nộp)
**Blast radius thật của Phase 1: 10 màn, không phải 3** — đo bằng grep, chi tiết trong `phase-01`. Hai màn `teaching/session-evidence.tsx` và `teaching/schedule.tsx` hỏng **cùng kiểu F2** nhưng chưa từng được nêu tên; Phase 1 sẽ gỡ luôn, cần UAT cả hai. Hai màn `enrollment/class-placement.tsx` và `classes/class-detail.tsx` **không có nav entry** — thêm một bằng chứng nữa cho quyết định D-RT.

### Red-team vòng 3 (2026-07-22) — 14 finding mới, đã áp 9

Hai reviewer nộp (failure-mode, scope). **Critical mới, tất cả đã kiểm chứng lại:**

| # | Finding | Đã áp |
|---|---------|-------|
| R3-1 | **F4 có 4 consumer `user.list`, plan chỉ sửa 1.** `hr/salary-tiers.tsx:299` cùng role set — chưa sửa thì `baseSalary` không gán được, fix payroll thành vô nghĩa. `classes/class-detail.tsx:24` (TeacherPicker) làm `classBatch.assignTeacher` không dùng được — **luồng P2-01 bị chặn, chưa ai nêu** | ✅ Phase 3 mở rộng sang cả 3 |
| R3-2 | **Hai bản vá vừa áp triệt tiêu nhau**: nguồn = route tree (57 route, có 15 route LMS) + override `baseURL` sang `:4173` (admin) ⇒ route LMS mở trên admin app, no-match, **không phát sinh request**, ghi nhận "sạch". Mitigation đếm-tổ-hợp vẫn pass | ✅ Phase 5 tách ma trận theo app |
| R3-3 | **Test đọc `src`, API chạy đọc `dist`.** `vitest.config.ts:5-7` nói rõ; `dist/` gitignore; `turbo` task `dev` không có `^build`. ⇒ test xanh, probe FORBIDDEN, áp lực đẩy về nới `class.create` (Q5 cấm) | ✅ Phase 1 thêm bước build |
| R3-4 | **Worktree cô lập filesystem, KHÔNG cô lập DB.** Sour test theo định nghĩa chạy tại commit thiếu bản vá Phase 4 ⇒ vẫn rò facility vào `cmc_edu`. Worktree cũng thiếu `node_modules` và `packages/auth/dist` | ✅ Phase 5 risk table |
| R3-5 | **"4 route `:param`" — thực tế 10.** Lại một con số ghi như đã đo mà chưa đo | ✅ sinh từ scanner |
| R3-6 | `apps/admin/src/pages/admin/classes/*` **không tồn tại** — màn lớp ở `pages/classes/` | ✅ Phase 2 sửa path |
| R3-7 | Rollback thiếu 7 file; "1 commit" mâu thuẫn với "Phase 3 song song" | ✅ tuần tự hoá + liệt kê đủ |

**Đã áp nốt 5 finding tồn đọng (2026-07-22, phiên /cook thứ 2):**
- `scripts/*` glob → đổi sang `scripts` không glob + bắt buộc `scripts/package.json`; bước 1–2 của Phase 6 thành **một commit không tách rời** (tách ra ⇒ `pnpm typecheck` đỏ repo-wide, chặn Phase 1–3 đóng)
- Phase 4: chốt thứ tự **xoá facility → đếm residue → ném**; dọn rác cũ lọc theo prefix tên `E2E Run ` chứ không theo row con; ghi nhận teardown **không atomic** (chuỗi `deleteMany` privileged ngoài transaction, `db.ts:128-143`)
- Phase 5: thêm bảng **6 finding đã adjudicate ở `260717-1213`** (ngân sách build ~4 phút, redaction whitelist, `assert-not-prod.ts` đã export, sentinel sau seed, ghi file thay vì parse stdout, Windows spawn ENOENT); ngân sách thật đổi thành **~9 phút** (4 build + 5 chạy)
- Phase 2: thêm `/finance/class-placement` — màn **không có nav entry nào**, gọi `classBatch.list` nên Phase 1 mở nó ra cho sale/GV mà không cách nào rà qua menu

~~**Chưa áp (5):**~~ *(đã xử lý hết — giữ danh sách gốc bên dưới để truy vết)*
 `scripts/*` glob không match `scripts/package.json` (Phase 6); teardown non-atomic + vị trí residue guard (Phase 4); Phase 6 step 1–2 phải atomic; Phase 5 bỏ qua 6 finding đã adjudicate ở plan `260717-1213` (budget build ~4 phút, redaction, stdout pollution, Windows spawn, `assertNotProdDatabase` không import được từ `scripts/`); `/finance/class-placement` không nav entry và chưa phase nào nhắc.

### Red-team vòng 4 — góc SECURITY (2026-07-22) — 6 finding, 1 Critical, đã áp cả 6

Sau **3 lần thử thất bại**, góc security cuối cùng đã review. Đây là vòng tìm ra finding nguy hiểm nhất toàn plan.

| # | Finding | Sev | Đã áp |
|---|---------|-----|-------|
| S1 | 🔴 **Teardown chạy trên `DATABASE_URL` — URL DUY NHẤT không được canh.** `assertNotProdDatabase` chỉ gọi trên `APP_DATABASE_URL` (`global-setup.ts:81`), nhưng mọi `deleteMany` destructive chạy qua `getPrivilegedDb()` đọc thẳng `process.env.DATABASE_URL` **không guard** (`db.ts:36-40`). Phase 4 thêm ~12 delete nữa vào đúng đường đó. **Kịch bản mất dữ liệu trẻ em thật:** `APP_DATABASE_URL` trỏ `cmc_edu` (guard pass) còn `DATABASE_URL` sót URL `cmc_prod` từ phiên migrate | **Critical** | ✅ Guard đặt **bên trong `getPrivilegedDb()`** — tiền đề của tiền đề, trước cả cherry-pick |
| S2 | Dọn rác theo prefix `E2E Run ` **không phân biệt** facility rò với facility của run **đang chạy** trên cùng DB dùng chung ⇒ phá fixture của agent khác | High | ✅ thêm điều kiện `createdAt` cũ hơn vài giờ |
| S3 | **Phase 2 bị dán nhãn sai là mitigation PII.** Nav gate + `canDo()` là lớp **client**; session `sale` gọi thẳng `/trpc/classBatch.listStudents` từ devtools vẫn dump tên mọi trẻ, **không audit log** | High | ✅ ghi rõ chỉ giảm bề mặt UI; phơi nhiễm tầng API là **residual chưa giảm** của Q3 |
| S4 | **Union 3 quyền buộc quản trị lớp vào roster money-gate ADR-B.** Vô hại hôm nay, nhưng khi `class.create` mở cho vai mới, cách sửa rẻ nhất *trông như* thêm vai đó vào `payslip.assemble` ⇒ trao quyền lắp bảng lương. **Đúng hình dạng lỗi F1** | High | ✅ đổi sang **key riêng** `staff.pickList`, roster tường minh |
| S5 | **Phase 3 kích hoạt một lỗ đang ngủ:** `classBatch.assignTeacher` **không assert vai `giao_vien`**. Picker hiện rỗng nên chưa ai chạm tới; Phase 3 làm nó chạy được **và** feed toàn bộ nhân sự ⇒ gán `sale` làm giáo viên ⇒ **giờ dạy cộng vào payroll/KPI cho người không dạy** | High | ✅ lọc picker về vai GV + assert vai phía server + negative test |
| S6 | Mint session **không khớp AppUser thật** ⇒ procedure owner-check (`manualPunch.resubmit`, `payslip.my`, KPI) trả NOT_FOUND/rỗng **chứ không FORBIDDEN** ⇒ capture ghi "sạch" đúng ở nhóm mà registry quyền không phủ | Medium | ✅ mint gắn AppUser đã seed; NOT_FOUND thành hạng mục thứ ba trong output |

**Reviewer tự ghi phần chưa kiểm** (giữ để truy vết): chưa đọc hết 28 call site `canDo()`; chưa kiểm RLS policy thật xem `withFacility(bypass)` có rò sang đường runtime; chưa đánh giá 17 `lmsProcedure`.

**Đã bác một nghi ngờ:** output `acceptance:report` trong CI **không** rò gì — `verify.ts` là scanner tĩnh ts-morph, không nối DB, output đã gitignore, `ci.yml` không có bước upload artifact.

### Whole-plan consistency sweep #2 (sau khi áp 5 finding tồn đọng)
Tự quét lại 7 file. **Tìm được 3 mâu thuẫn do chính các lượt sửa tạo ra, đã sửa:**
- `phase-05:85` vẫn ghi "4 route `:param`" trong khi `:42` đã đổi thành 10 → đồng bộ, và chuyển sang sinh từ scanner
- `phase-05:41` vẫn ghi "~5 phút" trong khi `:26` đã đổi thành ~9 phút (gồm build) → làm rõ 5 phút là *chạy*, chưa gồm build
- `phase-03` frontmatter `dependencies: []` + câu "chạy song song" mâu thuẫn với quyết định "Phase 1–3 land một commit" → đổi thành `[2]` và sửa câu mô tả

**Bài học lặp lại lần thứ ba trong plan này:** mỗi lượt sửa đều sinh mâu thuẫn mới ở chỗ khác. Sweep sau mỗi lượt là bắt buộc, không phải tùy chọn.

**Unresolved contradictions: 0.**

### Trạng thái cuối (2026-07-22)

**4 vòng red-team, đủ cả 4 góc, ~34 finding đã áp, 3 lần whole-plan sweep, 0 mâu thuẫn còn lại.**

| Vòng | Góc | Kết quả |
|---|---|---|
| 2 | assumption-destroyer | 14 finding (3 góc kia không nộp) |
| 3 | failure-mode, scope | 14 finding — trong đó phát hiện bản vá vòng trước tự sinh lỗi mới |
| 4 | **security** (thử lần thứ 3 mới được) | 6 finding, **1 Critical về an toàn dữ liệu thật** |
| — | consistency sweep ×3 | 3 mâu thuẫn nội tại do chính các lượt sửa tạo ra |

**Điều đáng lo nhất đã tìm được, ở vòng cuối cùng:** guard chống xoá nhầm `cmc_prod` **không phủ** chính connection đang xoá dữ liệu. Nếu security review không bao giờ chạy, plan này sẽ ship với một đường dẫn tới việc xoá dữ liệu trẻ em thật.

**Bài học lặp lại ba lần trong plan này:** mỗi lượt sửa đều sinh mâu thuẫn hoặc lỗi mới ở chỗ khác — vòng 3 phát hiện bản vá vòng 2 tự triệt tiêu nhau; sweep #2 tìm 3 mâu thuẫn do lượt sửa trước đó. Sweep sau mỗi lượt là bắt buộc.

### Rủi ro còn lại (đã biết, chưa xử lý)

Reviewer security tự ghi phần chưa kiểm — **không được coi là đã phủ**:
- Chưa đọc hết **28 call site `canDo()`** để tìm gate client nào khác đang che một lỗ authz server.
- Chưa kiểm RLS policy thật xem `withFacility(bypass)` (`db.ts:146`) có rò sang đường runtime không.
- Chưa đánh giá **17 `lmsProcedure`** cố ý không gọi `can()` (plan để ngoài scope).

### Sẵn sàng thực thi chưa?

**Nhịp A (Phase 1–3): có thể bắt đầu.** Chỉ nới quyền **đọc**, có 3 negative-authz test viết trước chặn nới quá tay, đã qua cả 4 góc review, và hai lỗ nguy hiểm nhất trong đó (S4 union quyền tiền, S5 `assignTeacher` không assert vai) đã được vá ngay trong plan.

**Nhịp B (Phase 4–6): Phase 4 phải làm S1 trước tiên** — guard `DATABASE_URL` bên trong `getPrivilegedDb()`, kèm falsification test, **trước cả** khi cherry-pick `cleanupFacility`. Không có bước đó thì mọi thứ sau nó đều chạy trên một khẩu súng chưa khoá an toàn.

### Câu hỏi vẫn chờ PO

1. Gate `acceptance:report` trong CI: **chặn merge** hay cảnh báo?
2. Runtime capture chạy **mọi PR** hay **nightly + trước release**?
3. `/finance/refund` là EmptyState nhưng P1-08 đếm `built` — sửa cách đếm hay xây nốt màn?
4. Actor thật của 4 luồng khai `nhan_vien` (P3-01, **P3-02**, P4-01, P4-03)?
5. **Mới từ vòng 4:** Q3 nói nav gate là mitigation cho rủi ro PII, nhưng S3 chứng minh đó chỉ là lớp client — phơi nhiễm tầng API (`sale` gọi thẳng `listStudents` dump tên trẻ, không audit log) là **residual chưa giảm**. Chấp nhận, hay tách `listStudents` sang key hẹp hơn?
6. **Mới từ vòng 4:** `/finance/class-placement` không có nav entry nhưng gọi `classBatch.list` — có cần page-level guard không?
