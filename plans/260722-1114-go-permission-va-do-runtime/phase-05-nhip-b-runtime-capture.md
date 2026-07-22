---
phase: 5
title: "Nhip B - runtime capture"
status: pending
priority: P1
dependencies: [4]
---

# Phase 5: Runtime capture

## Overview

Đảo chiều nguồn sự thật: thay vì hỏi người "luồng này cần procedure gì", **mở màn thật bằng vai thật và ghi lại cái nó gọi**. Procedure nào bị từ chối là lỗi.

Đây là thứ duy nhất đã chứng minh tìm ra lỗi thật trong dự án này — phiên brainstorm làm thủ công đúng quy trình đó với 3 màn và tìm ra F1 + F2.

## Requirements

**Functional**
- Với mỗi (màn, vai), mở màn và thu **mọi** lời gọi tRPC cùng kết quả **ở mức procedure**.
- Báo cáo: màn nào, vai nào, procedure nào bị từ chối.
- Kết quả ghi ra file để diff được giữa các lần chạy.

**Non-functional**
- Chỉ điều hướng và đọc — **không mutation**, để rủi ro dữ liệu thấp.
- Ngân sách thật: **~4 phút build** (đã adjudicate ở `260717-1213` #6) **+ ~5 phút chạy** (~150 tổ hợp × ~2s) ≈ **9 phút**. Chưa đo thực tế — `playwright.config.ts` đặt `workers: 1`, `fullyParallel: false`.

## Architecture

**Nguồn danh sách màn = `scanUiRoutes()`, KHÔNG phải nav-registry** (quyết định D-RT, chốt 2026-07-22 sau red-team).

`scripts/acceptance-report/scanners/route-scanner.ts` đã có sẵn, dùng ts-morph theo import graph, và **resolve 57 route** (44 admin + 12 LMS + `/login`) — đo trực tiếp trong phiên. Nav-registry chỉ phủ **22** trong số đó.

| Nguồn | Trả lời câu gì | Dùng cho |
|---|---|---|
| `scanUiRoutes()` | **màn nào tồn tại** | trục MÀN của ma trận |
| `nav-registry.ts` | **ai thấy menu** | trục VAI cho màn có nav entry |

- Màn **có** nav entry → chạy với các vai mà gate cho phép (62 tổ hợp).
- Màn **không có** nav entry (~22 màn admin, gồm `/finance/new` — nơi F1 sống) → chạy với **cả 4 vai nghiệp vụ**, vì không gate nav nào nói ai được vào.
- → **~150 tổ hợp admin**, ~5 phút chạy (chưa kể ~4 phút build — xem Ngân sách). Gấp ~2,4 lần con số 62 của bản đầu.
- ⚠️ **Ma trận phải TÁCH THEO APP.** Trong 57 route có **15 route thuộc LMS** (`/parent/*`, `/student/*`, `/login`, `/`). Spec admin override `baseURL` sang `:4173`, mà admin router **không có** `/parent` hay `/student` ⇒ mở ra no-match/redirect ⇒ **không phát sinh request nào** ⇒ ghi nhận "sạch". 15 route xanh giả, và mitigation đếm-tổ-hợp **vẫn pass** vì đủ số. Thêm nữa, 4 vai nghiệp vụ **không mint được session LMS**.
  → Hoặc chia hai ma trận (admin `:4173` × 4 vai nghiệp vụ; LMS `:4174` × `phu_huynh`/`hoc_vien`), **hoặc loại LMS khỏi Phase 5 và ghi rõ** (khớp mục "Ngoài scope" về tách P2-07 thành 2 chặng).
- ⚠️ **Route có `:param` là 10, không phải 4** (đo bằng scanner: `/admin/classes/:id`, `/admin/students/:id`, `/crm/opportunities/:id`, `/finance/:id`, `/parent/consent/:studentId`, `/parent/evidence/:studentId`, `/parent/homework/:studentId`, `/parent/report-card/:studentId`, `/parent/reset-password/:studentId`, `/student/exercise/:exerciseId`). **Sinh danh sách này từ scanner** (`routes.filter(r => r.includes(':'))`), **không viết tay con số** — bản đầu ghi "4" như thể đã đo, đó là đúng lỗi mà plan này tồn tại để chống.

Hạ tầng tái dùng, không dựng mới:
- Project `ui-chromium` (`playwright.config.ts`) — preview server admin :4173 / lms :4174, same-origin proxy
- `mintStaffCookie` (`apps/e2e/src/session-injection.ts`) cho Mode-B, hoặc `x-dev-user` ở chế độ dev
- `page.on('response')` để thu network

Không hardcode danh sách màn — sinh từ `scanUiRoutes()` để tự cập nhật khi route đổi; trục vai lấy từ nav-registry × `PERMISSIONS`.

**Điểm dễ sai #1 — HTTP status KHÔNG phải discriminator.** Admin client dùng `httpBatchLink` (`apps/admin/src/lib/trpc.ts:2,30`) nên N procedure gộp vào **một** HTTP request, trả **200** với mảng JSON, lỗi 403 nằm **trong body từng phần tử**. `/teaching/session-assessment` bắn 3 procedure trong một batch. Đọc `response.status()` sẽ cho **bảng 403 rỗng ngay trên commit mà F1/F2 đang sống**.
→ Capture **phải parse body** mỗi response tới `/trpc/*`, map từng phần tử về tên procedure (thứ tự phần tử khớp thứ tự trong query string của batch), rồi đọc mã lỗi.

**Điểm dễ sai #2 — màn rỗng dữ liệu và màn thiếu quyền trông giống hệt nhau** (đã gặp: dropdown rỗng vì thiếu quyền, cũng có thể vì chưa có lớp). Phân biệt bằng mã lỗi trong body, không bằng nội dung render.

**Điểm dễ sai #3 — `baseURL` mặc định trỏ LMS.** `playwright.config.ts:79` đặt `baseURL: http://localhost:4174`. Spec admin **phải** override sang `:4173` (mẫu có sẵn: `admin-shell.ui.spec.ts:21-25`), và project `ui-chromium` chỉ đăng ký khi `PLAYWRIGHT_UI=1`. Thiếu override → mở nhầm app → **mọi tổ hợp xanh giả**.

**Giới hạn thứ hai — danh tính tổng hợp gây "sạch giả":** `verifyStaffToken` **không** kiểm `userId` có tồn tại như AppUser, và `createContext` tin claims nguyên văn (`apps/api/src/auth/staff-session.ts:70-100`, `apps/api/src/context.ts:216-231`). Với nhóm procedure mà authz là **owner-check** chứ không phải registry key — `manualPunch.resubmit` (cố ý không có key), họ `payslip.my`/KPI — một `userId` không tồn tại nhận **NOT_FOUND hoặc rỗng**, **không bao giờ FORBIDDEN**. Capture ghi "không lỗi quyền" = sạch, đúng ở nhóm mà registry không phủ.
→ Mint session **gắn với AppUser thật đã seed** cho từng vai; và ghi `NOT_FOUND`/empty-result thành **hạng mục thứ ba riêng** trong output, không gộp vào "sạch".

**Giới hạn phải công bố trong báo cáo, không được lờ đi:** capture chỉ thấy lỗi *có phát sinh request*. Gate **phía client** (`canDo()` — 28 call site trong pages, ví dụ `cockpit.tsx:210` chặn `TodaySchedulePanel`) khiến màn **không gọi gì cả**, nên không có request để bắt. Capture **không thay thế** việc rà `canDo()`; nó bổ sung.

## Đã biết từ plan `260717-1213-so-nghiem-thu-song` — KHÔNG được phát minh lại

Red-team của plan đó đã **accept** 6 finding cho đúng cách tiếp cận capture này. Phase 5 phải kế thừa, không lặp lại sai lầm:

| # | Nội dung | Hệ quả cho Phase 5 |
|---|---|---|
| #6 (Critical) | Runner spawn lệnh test API-only ⇒ 0 screenshot; **ngân sách build ~4 phút** trước khi bất kỳ tổ hợp nào chạy | Ngân sách thật = ~4 phút build + ~5 phút chạy. Con số "~5 phút" ở trên **chưa gồm build** |
| #9 (High) | **Không redaction** ⇒ raw error chứa DB password lọt vào báo cáo | Output capture phải theo **whitelist field**, không dump raw error |
| R2-8 (High) | `assertNotProdDatabase` là module-private, **không import được từ `scripts/`** | Đã extract sang `apps/e2e/src/assert-not-prod.ts` (export) — dùng bản đó |
| R2-9 (High) | Sentinel gate **đứt kết nối** với data path e2e thật (không gì chạy `seed.mjs`) | Nếu Phase 5 cần seed, phải chạy tường minh và verify sentinel **sau** seed |
| R2-12 (Medium) | **stdout pollution** làm vỡ `JSON.parse` | Kết quả ghi ra **file**, không parse stdout |
| #15 (Medium) | Windows `spawn('pnpm')` **ENOENT** | Máy này là Windows — dùng `shell: true` hoặc đường dẫn tuyệt đối |

## Related Code Files

- Create: `apps/e2e/tests/screen-role-capture.ui.spec.ts` (hoặc script riêng dưới `apps/e2e/src/`)
- Create: `apps/e2e/src/screen-role-matrix.ts` — sinh (màn, vai) từ `scanUiRoutes()` ∪ nav-registry + PERMISSIONS
- Read-only: `scripts/acceptance-report/scanners/route-scanner.ts` (tái dùng, không viết lại)
- Read-only: `apps/admin/src/shell/nav-registry.ts`, `packages/auth/src/index.ts`

## Implementation Steps

1. Ghi lại commit hash của `main` **trước Phase 1** (hiện `4237cb5`) — cần cho phép thử chua.
2. Viết `screen-role-matrix.ts`: **`scanUiRoutes()`** cho trục màn; nav-registry + PERMISSIONS cho trục vai; màn không có nav entry thì lấy cả 4 vai nghiệp vụ. Loại `super_admin` (bypass registry nên vô nghĩa). Đánh dấu riêng **10 route `:param`** — sinh bằng `routes.filter(r => r.includes(":"))`, không viết tay con số.
3. Viết capture spec: override `baseURL` sang `:4173`; với mỗi tổ hợp — set cookie/header đúng vai, `page.goto(path)`, đợi network idle, thu mọi response tới `/trpc/*`, **parse body**, tách từng phần tử batch về procedure, ghi `{path, role, procedure, errorCode}`.
4. Xuất kết quả ra file (JSON) trong thư mục output của Playwright; in bảng tóm tắt các 403.
5. **Phép thử chua (bắt buộc).** Capture chưa tồn tại ở commit `4237cb5`, nên cần cơ chế rõ ràng: tạo **git worktree riêng** tại `4237cb5`, copy *chỉ* thư mục capture vào đó, chạy, rồi xoá worktree. Không `git stash`/`checkout` trên cây làm việc chính. Kết quả **phải tự chỉ ra**:
   - `/finance/new` + `sale` → `classBatch.list` 403
   - `/teaching/session-assessment` + `giao_vien` → `classBatch.list` / `classSession.list` 403
   Nếu **không** tìm ra → capture chưa đủ. **Dừng, xét lại thiết kế, không đi tiếp.**
6. Chạy trên `main` sau Phase 1–3 → danh sách 403 còn lại chính là nhóm lỗi chưa ai biết. Ghi vào báo cáo phase, **không sửa trong phase này** (sửa ở plan kế tiếp, sau khi có dữ liệu).

## Test / Validation

- Chạy `--project=ui-chromium` **riêng** (chạy chung gây đỏ giả do dùng chung DB).
- Phép thử chua ở bước 5 là tiêu chí sống-còn của phase.
- Đối chiếu: số tổ hợp chạy thực tế phải khớp con số sinh ra từ **scanner** (không âm thầm bỏ sót màn).
- Chạy 2 lần liên tiếp → kết quả giống nhau (ổn định, không phụ thuộc thứ tự).

## Success Criteria

- [ ] Trục màn sinh từ **`scanUiRoutes()`** (57 route), trục vai từ nav-registry; không hardcode màn nào
- [ ] `/finance/new` **có trong ma trận** — đây là màn chứa F1; thiếu nó thì phép thử chua vô nghĩa
- [ ] Capture **parse body** batch, không đọc HTTP status
- [ ] Spec admin override `baseURL` sang `:4173`; chạy `PLAYWRIGHT_UI=1 --project=ui-chromium`
- [ ] Chạy hết ~150 tổ hợp, số tổ hợp khớp con số sinh ra từ scanner
- [ ] Báo cáo nêu rõ giới hạn: không thấy được gate `canDo()` phía client
- [ ] **Phép thử chua đạt**: trên commit trước Phase 1, capture tự tìm ra F1 và F2 mà không được mớm
- [ ] Kết quả xuất ra file diff được; bảng 403 in ra rõ ràng
- [ ] Chạy 2 lần cho kết quả giống nhau
- [ ] Danh sách 403 còn lại sau Phase 1–3 được ghi vào báo cáo phase (không sửa ở đây)

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Capture bỏ sót màn mà không ai biết (âm tính giả im lặng) | **Cao** | Đối chiếu số tổ hợp chạy vs sinh từ `scanUiRoutes()`; đây là kiểu sai tệ nhất cho nghiệm thu |
| Màn rỗng dữ liệu bị đọc nhầm thành màn thiếu quyền | Cao | Phân biệt bằng **mã lỗi trong body batch**, không bằng HTTP status và không bằng nội dung render |
| Gate `canDo()` phía client không phát sinh request ⇒ capture mù | Cao | Công bố giới hạn trong báo cáo; rà 28 call site `canDo()` thủ công ở Phase 1 |
| Chạy trước Phase 4 → rò facility | **Cao** | `dependencies: [4]` **KHÔNG bảo vệ được phép thử chua** — step 5 theo định nghĩa chạy tại commit *thiếu* bản vá Phase 4. Worktree cô lập **filesystem**, không cô lập **DB**: `globalSetup` vẫn tạo Facility qua `DATABASE_URL` trỏ cùng `cmc_edu`, và `git worktree remove` xoá file chứ không xoá row. → Trong worktree phải copy **cả bản vá `db.ts` của Phase 4** *và* trỏ `DATABASE_URL` sang DB dùng một lần |
| Worktree thiếu `node_modules` và `packages/auth/dist` | **Cao** | `git worktree add` không chia sẻ `node_modules`; `dist/` bị gitignore nên không có trong worktree. Phải `pnpm install && pnpm build` (turbo, để `^build` dựng `dist` **từ source của commit đó**). Copy `dist` từ cây chính sang = chạy bundle post-fix trên API pre-fix ⇒ sour test "đạt" mà không chứng minh gì |
| Phép thử chua bị bỏ qua vì "chắc là chạy đúng" | Cao | Là success criteria riêng; không đạt thì phase **thất bại**, không phải "làm sau" |
| Kết quả nhiễu do dữ liệu seed thiếu | Trung bình | Seed tối thiểu: 1 lớp, 1 học sinh, 1 phiếu thu — đủ để màn không rỗng |
