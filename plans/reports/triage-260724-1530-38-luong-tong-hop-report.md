# Phase 2 — Triage 38 luồng: bản tổng hợp + cổng quyết định

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-02-triage-38-luong.md`
**Ngày:** 2026-07-24 · **Branch/HEAD:** `acceptance-journey-38-lms` @ `a57e71d`

Hai nửa triage chạy song song, mỗi nửa là một report độc lập và là **nguồn chi tiết
chính thức** (bảng 38 dòng, evidence block, lệnh grep + output đầy đủ):

- P1-01…P1-09 + P2-01…P2-08 (17 luồng) — [`triage-260724-1512-flows-p1-p2-report.md`](./triage-260724-1512-flows-p1-p2-report.md)
- P3-01…P3-11 + P4-01…P4-05 + ADM-01…ADM-05 (21 luồng) — [`triage-260724-1512-flows-p3-p4-adm-report.md`](./triage-260724-1512-flows-p3-p4-adm-report.md)

File này chỉ tổng hợp con số, ghi các quyết định thi công đã tự chốt (kèm lý do),
và liệt kê những quyết định **phải do user chốt** trước khi viết spec đợt 5-7.

## 1. Độ phủ

38/38 luồng có phân loại, cột `đợt`, cột `nav-reachability` xác minh riêng theo
`nav-registry.ts`. **0 luồng "chưa xem".**

| Phân loại | Số luồng | Ghi chú |
|---|---:|---|
| `trùng-journey-hiện-có` | 9 | 5 hợp lệ 1:1, 4 hợp lệ nhưng phủ hẹp hơn `expected` |
| `viết-được` (không cần duyệt gì) | 12 | |
| `viết-được` nhưng **chờ user duyệt** seed/seam | 12 | xem §4 |
| `thiếu-đường-UI` — không có đường journey nào | 5 | P1-06, P1-08, P2-02, P3-10, P3-11 |

**Spec dự kiến:** 18 spec mới chắc chắn + ~4 spec phụ thuộc quyết định §4.
Cộng 13 spec hiện có ⇒ **~31–35 spec** khi đóng plan (dự phóng Phase 1 dùng ~40 —
vẫn nằm trong dải, verdict F-B không đổi).

## 2. Chia đợt (cột `đợt`, KHÔNG dùng `cluster` — RT-8)

| Đợt | Phase | Luồng |
|---|---|---|
| `tiền` | 5 | P1-02, P1-03, P1-08, P1-09 |
| `ghi-danh` | 6 | P1-01, P1-05 |
| `vận-hành-lớp` | 6 | P2-01…P2-08 |
| `HR` | 7 | P3-01…P3-11, ADM-05 |
| `rewards-admin` | 7 | P4-01…P4-05, ADM-01…ADM-04 |
| `LMS` | 4 + 8 | P1-04, P1-06, P1-07 |

P1-06/P1-07 đã có chủ sở hữu phase rõ ràng (Phase 4 hạ tầng phiên + Phase 8 đuôi
LMS) — đóng đúng lỗ RT-8 nêu. **ADM-05** ("Cấu hình ca làm") xếp vào `HR` vì
ShiftGroup/Template là đầu vào của P3-02/03/04/05; quyết định này đảo ngược được.

## 3. Quyết định thi công tự chốt (không cần user — có tiền lệ hoặc rủi ro rất thấp)

| # | Quyết định | Lý do |
|---|---|---|
| T1 | Nhiều flow ĐƯỢC trỏ chung một file `journey:` | `verify.ts` đã cho phép về mặt kỹ thuật; luật H2 vẫn áp từng flow — chỉ gắn khi spec THẬT SỰ drive `expected` của flow đó. Áp cho P3-03/04/07 (ticket-lock ép tuần tự) và P3-06/08 |
| T2 | Journey ADM-03 KHÔNG bấm "Bật" dải IP | Bật dải IP làm punch của P3-01 thành offsite ⇒ hỏng luồng khác. Chỉ create → update → detectMyIp → delete |
| T3 | ADM-01: mở rộng `cleanupFacility` xoá theo tiền tố tên của run | `facility.delete` không tồn tại (`rg -n "delete" apps/api/src/facility/router.ts` → 0 matches) nên spec sẽ để lại rác. Sửa dọn dẹp ở tầng test, KHÔNG đụng app |
| T4 | P4-03/P4-05: tạo học sinh tiền đề qua đường UI thật, không seed | Đường UI đã có tiền lệ chứng minh; seed sẽ là ngoại lệ thừa |
| T5 | KPI P3-06/P3-08 dùng kỳ quá khứ tính tại runtime (tháng-trước-tháng-trước) | Tiền lệ `apps/e2e/tests/kpi-lifecycle.spec.ts:9-11`; đây là **dữ liệu**, không phải mock đồng hồ — giữ đúng bất biến "không mock thời gian hệ thống" |

## 4. Cổng duyệt — **ĐÃ CÓ QUYẾT ĐỊNH USER 2026-07-24**

> Khi viết report này mọi mục còn là yêu cầu mở. User đã chốt trong phiên
> **2026-07-24** (ghi lại ở plan.md, mục "Session 2 (tiếp)" — V5/V6/V7).
> Nguyên tắc user chọn: **dữ liệu trơ thì seed được; cơ chế mà chính luồng đó
> tồn tại để chứng minh thì KHÔNG.**

| Mục | Phán quyết |
|---|---|
| S1, S4, S8 | **DUYỆT** |
| S3 — phần seed `CurriculumUnit` làm dữ liệu trơ cho P2-04 | **DUYỆT** |
| S3 — phần gán `ClassSession.curriculumUnitId` (cơ chế open-tier của P2-03) | **TỪ CHỐI** |
| S2 (goto `?session=`) | **TỪ CHỐI** → P2-02 nhận `statusReason`, lỗ UI vào plan sửa |
| S5 (seed `GuardianLinkRequest`) | **TỪ CHỐI** → P1-06 nhận `statusReason`, lỗ provisioning vào plan sửa |
| S6 (`readOtpCodeByEmail` trong `db.ts`) | Đã nằm trong phạm vi plan đã duyệt (phase-04 yêu cầu (b)) — không cần duyệt lại |
| S7 (đặt email PH) | Phụ thuộc S5 → không có đường UI; P1-07 xử theo `statusReason` |
| B1 (`managerId`) | **Seed `managerId`** (V6); thiếu UI ghi sổ bàn giao |
| B2 (P3-10/P3-11) | **`no-ui-path` + bằng chứng** (V7); spec API-level thuộc plan sau |
| B3 (P1-06) | Theo S5 → đánh dấu không nghiệm thu được bằng journey |

Bảng gốc giữ nguyên bên dưới để đối chiếu bằng chứng.

### 4.1 Ngoại lệ seed làm rỗng nghĩa chính luồng cần chứng minh — rủi ro CAO

| # | Luồng | Đề nghị | Vì sao rủi ro |
|---|---|---|---|
| S2 | P2-02 Điểm danh | cho `page.goto('/teaching/attendance?session=<id>')` | Phá luật "không goto màn đích". Menu vào được nhưng không link nào mang `?session` ⇒ màn báo thiếu tham số |
| S3 | P2-03/04/05 Bài tập | seed `CurriculumUnit` + gán thẳng `ClassSession.curriculumUnitId` | Seed đúng cơ chế open-tier mà P2-03 tồn tại để chứng minh |
| S5 | P1-06 Liên kết PH–con | seed 1 `GuardianLinkRequest` pending | Seed đúng hành vi "phụ huynh gửi yêu cầu" — tức toàn bộ nội dung luồng |
| S7 | P1-07 email PH | phụ thuộc S5 (modal cập nhật email chỉ render trên row link-request) | Nếu S5 bị từ chối, email OTP phụ huynh **không có đường UI nào** |

### 4.2 Ngoại lệ rủi ro thấp (vẫn cần duyệt vì là ngoại lệ)

| # | Luồng | Đề nghị | Rủi ro |
|---|---|---|---|
| S1 | 6 luồng P2 | tái dùng `seedClassBatch` (`db.ts:677`, đã có ngoại lệ ghi nhận từ phase trước) | Thấp — mở rộng phạm vi dùng của ngoại lệ đã duyệt trước đó |
| S4 | P2-06 Chấm bài | tái dùng `seedSubmittedSubmission` (`db.ts:536`) | Thấp — regression cần bắt là `submission.grade` |
| S6 | P1-07 | thêm reader `readOtpCodeByEmail` trong `db.ts` | Thấp kỹ thuật; nhưng luồng tự mang nhãn "[DEV ONLY — blocked-on-comms]" trong chính UI |
| S8 | P1-09 Đối soát | helper gọi `runReconcileFinanceFlags` một lần (kiểu `drainEmailOutboxOnce`) | Rất thấp — chạy worker thật, dữ liệu vào hoàn toàn từ UI |

### 4.3 Bế tắc sản phẩm cần chọn hướng

| # | Vấn đề | Bằng chứng | Lựa chọn |
|---|---|---|---|
| B1 | **P3-06/P3-08**: `kpi.confirm` đòi `scoreOwner.managerId === confirmUser.id`, không UI nào set `managerId` | `rg -n "managerId" apps/admin/src` → 0 matches; `rg -n "user\.update\b" apps/admin/src` → 0 matches (procedure CÓ nhận `managerId`) | (a) seed helper set managerId · (b) dùng super_admin (được miễn guard) · (c) red-fixme |
| B2 | **P3-10/P3-11**: worker nội bộ, không procedure/route/call-site UI | `rg -n "runDoneSweep\|runCancelSweep" apps/admin/src apps/lms/src` → 0 matches | (a) red-fixme, không viết gì · (b) spec API-level ngoài `tests/journeys/` |
| B3 | **P1-06** bế tắc kép | provisioning tạo thẳng `Guardian`, KHÔNG tạo `GuardianLinkRequest` (`provision-from-receipt.ts:101-103`) ⇒ queue `/admin/parents` luôn rỗng; màn lại là URL-only | (a) seed (S5) · (b) đánh dấu **không nghiệm thu được bằng journey** + `statusReason` |

## 5. Drift manifest/UI mới phát hiện (chưa sửa — sẽ vào `statusReason` ở Phase 3+)

| Flow | Drift | Bằng chứng |
|---|---|---|
| P1-07 | manifest khai `lmsAuth.requestOtp`/`verifyOtp`; UI gọi `requestOtpEmail`/`verifyOtpEmail` | `rg "trpc\.lmsAuth\.requestOtp\b"` → 0 matches; `login.tsx:51,61` |
| P1-07 | `enrollment.mine` không có consumer nào trong `apps/lms/src` | 0 matches |
| P2-07 | `assessment.discard` không có consumer UI | 0 matches |
| P2-03 | `exercise.listForStudent` không có consumer UI | 0 matches |
| ADM-02 | `user.update` không có consumer UI | 0 matches |
| P1-05 | 4 procedure trong `expected` không có consumer UI (đã ghi nhận từ trước) | — |

## 6. `journey:` hiện có — kết quả tái kiểm H2

**0 trường hợp gắn nhầm file.** 5 hợp lệ 1:1 (P1-02, P1-03, P3-01, P4-02, và P1-05
hợp lệ-một-phần đã tự khai). 4 hợp lệ nhưng **phủ hẹp hơn `expected`**, cần mở rộng
hoặc ghi nhận: P2-07 (không drive `assessment.*` nào), P3-02 (thiếu
`manualPunch.reject|resubmit` — UI CÓ cả hai), P3-05 (chỉ chạm `user.pickList`/10
procedure), P4-01 (thiếu `rewards.reject` + toàn bộ nửa LMS).

## 7. Câu hỏi chưa giải quyết

- Toàn bộ §4 (S1–S8, B1–B3) đang chờ user.
- Có sửa 6 drift ở §5 trong manifest ngay ở Phase 3 không, hay để nguyên và mô tả
  bằng `statusReason`? (Plan cấm sửa hành vi app; sửa `expected` của manifest là sửa
  lời khai, không phải sửa app — nhưng vẫn nên có chủ ý.)
