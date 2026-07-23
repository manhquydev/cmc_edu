# Brainstorm — làm rõ 4 luồng `nhan_vien`, 21 unreachable, và P4-03

Ngày: 2026-07-23 · Branch `main` · Vai: Solution Brainstormer
Nguồn: `plans/reports/from-scout-to-brainstorm-260723-0153-actor-that-4-luong-nhan-vien-report.md`

## Vấn đề

Sau khi audit actor↔permission chạy, còn 3 câu hỏi PO chưa hiểu (do tôi diễn đạt bằng ngôn ngữ kỹ thuật):
1. "Actor thật của 4 luồng `nhan_vien`" là gì?
2. "Triage 21 unreachable" nghĩa là gì?
3. "Rotate Brevo key" nghĩa là gì?

## Phát hiện đổi bản chất vấn đề

### `nhan_vien` KHÔNG phải vai bị xoá — là **lỗi dịch**

TL25 **không hề** chứa chuỗi `nhan_vien`. Tài liệu viết tiếng Việt **"nhân viên"** = *nhân sự nói chung*. Người soạn manifest dịch chữ đó thành một mã vai giả.

**Bằng chứng quyết định:** cùng cụm P3, `docs/27-workflow-spec-p3.md:88` ghi `Actors: nhân viên (sale/giáo viên)` — manifest **đã dịch đúng** thành `['sale','giao_vien']` (`flow-manifest.ts:323`). 4 luồng còn lại chỉ **dịch sót**. Thêm: `docs/25:93` liệt "nhân viên" rồi kết luận *"Cả 4 vai trò active"*.

⇒ Câu hỏi "actor thật là ai" **không phải câu hỏi nghiệp vụ** — đáp án nằm sẵn trong tài liệu, chỉ cần dịch đúng. Tôi đã hỏi PO một câu lẽ ra tự tra được.

## Quyết định (PO chốt 2026-07-22 → 2026-07-23)

| # | Luồng | Quyết định | Căn cứ |
|---|---|---|---|
| **A1** | **P4-04** | Manifest sai actor — bỏ `giao_vien`. **Không** nới quyền | PO: *"GV chỉ có việc đã setup, không đặt kiểm tra đầu vào"* |
| **A2** | **P3-01** chấm công | `[GĐKD, GĐĐT, sale, giao_vien]` | `checkIn.punch` (`auth:117`) mở cho cả 4 — **4 nguồn khớp, CHẮC** |
| **A3** | **P4-01** đổi thưởng | `hoc_vien` (đổi) + `[GĐKD, GĐĐT, sale]` (duyệt/giao) | `rewards.manage` (`auth:143`) — **CHẮC về quyền** |
| **A4** | **P3-02** gửi lại phiếu | chủ phiếu: `[sale, giao_vien]` · duyệt: `[GĐKD, GĐĐT]` | `resubmit` là owner-check (`checkin/router.ts:378-383`), không phải vai cố định — **NGỜ** |
| **A5** | **P4-03** | **TÁCH ĐÔI** — xem §P4-03 | PO chốt 2026-07-23 |

## P4-03 — vì sao tách đôi

PO mô tả nhu cầu: *"hệ thống họp PH chỉ mang tính lên lịch thôi, để nhắc sắp tới có lịch họp PH **của lớp này**, thông tin lớp… từ đó có chuẩn bị"*.

Ba thành phần — đối chiếu code chỉ **một** tồn tại:

| PO cần | Hiện trạng |
|---|---|
| lên lịch | ✅ `parentMeeting.schedule` |
| **nhắc** | ❌ `remindedAt` **đã drop** phase 10, có **test khoá cứng** cấm tái xuất (`parent-meeting.test.ts:58-59`) |
| **theo LỚP** | ❌ `ParentMeeting` gắn **từng học sinh** (`studentId`), **không có** `classBatchId` |

Thêm: `parentMeeting.list` trả **`studentName`** — họ tên trẻ em (`meeting/router.ts:27-30`).

**Vì sao không sửa được bằng cấp quyền:** Q3′ (PO chốt 2026-07-22) đã đặt nguyên tắc tách `classRoster.read` hẹp hơn `class.read` *chính vì* có tên trẻ em. Cấp `parentMeeting.read` cho GV bây giờ ⇒ **không có `classBatchId` để lọc** ⇒ GV thấy tên **mọi trẻ trong cơ sở**, rộng hơn hẳn ranh giới vừa đặt hôm trước.

**Quyết định:**
- **P4-03 = cái đã xây**: họp sau bán theo học sinh, actor `[GĐKD, GĐĐT, sale]`. Sửa manifest, **không đụng quyền**. (Màn tên "Họp sau bán", nằm nhóm nav *Tài chính & Điều hành* — đúng bản chất chăm sóc khách hàng của sale.)
- **"Lịch họp PH theo LỚP + nhắc + GV xem để chuẩn bị" = tính năng MỚI**, plan riêng. Cần: thêm liên kết lớp vào `ParentMeeting` · khôi phục cơ chế nhắc · scope theo lớp GV dạy (repo **đã có sẵn** `assert-teacher-owns-class.ts`).

## 21 unreachable — kết quả triage (tự làm sau khi agent lỗi 2 lần)

**Không có finding nào thuộc loại (c) "thiếu quyền thật".** Sổ ghi sai, phần mềm không hỏng. Không có gì chặn go-live trong 21 cái này.

Rút về **3 nguyên nhân**:

| Nguyên nhân | Luồng | Số | Loại | Cách sửa |
|---|---|---|---|---|
| Kéo theo lỗi dịch `nhan_vien` | P3-01 (1), P4-01 (4), P4-03 (4) | **9** | — | Tự biến mất khi áp A2/A3/A5 |
| Manifest chỉ khai **một nửa** người tham gia | P1-05 (7), P1-06 (4) | **11** | (a) | Thêm vai nhân viên vào manifest |
| Manifest claim **nhầm bước** | P1-09 (1) | **1** | (b) | Bỏ `audit.list` khỏi P1-09 |

**Bằng chứng P1-09 (dứt điểm):** `audit.list` **chỉ** được gọi ở `apps/admin/src/pages/admin/audit-log.tsx` — màn `/admin/audit-log`, thuộc luồng **ADM-04**. Màn `/ops/recon` của P1-09 chỉ gọi `reconciliation.listFlags/action/dismiss`. ⇒ Manifest gán nhầm bước của luồng khác. Khớp finding #26 plan `0908`, nay có bằng chứng độc lập.

**Loại (a):**
- **P1-05** khai mỗi `he_thong` (side-effect khi duyệt phiếu thu), nhưng luồng gồm 7 bước nhân viên thao tác trên `/admin/students` — hệ thống không "bấm màn".
- **P1-06** khai mỗi `phu_huynh`, nhưng có `guardian.approveLink` + màn `/admin/parents` = **nhân viên duyệt**. Phụ huynh không tự duyệt yêu cầu của mình.

## Brevo — đính chính điều tôi nói sai

Tôi nói *"rotate key"* (đổi khoá) — **SAI**. Journal `260711-build-regression-brevo-otp-fix.md:61-68`:

> Nguyên nhân **không phải** key sai/hết hạn. Dòng `BREVO_API_KEY=` trong `.env.prod` **thiếu ký tự xuống dòng** nên dính luôn dòng kế tiếp vào giá trị ⇒ khoá hỏng lúc chạy ⇒ 401.

Đã sửa tay trên **máy local** 2026-07-11. Nhưng `.env.prod` bị gitignore và journal ghi *"live VPS deploy pending"*.

⇒ Việc cần làm: **kiểm dòng đó trong `.env.prod` trên máy sẽ chạy UAT**, rồi gửi thử 1 email thật. Không phải đổi khoá.

**Vì sao là blocker:** không gửi được email ⇒ phụ huynh không nhận OTP ⇒ **không đăng nhập được LMS**. Nửa sản phẩm hướng khách hàng chết. Tiêu chí Phase 4 đòi ≥1 email thật thành công.

## Phát hiện phụ (chưa quyết)

| # | Nội dung | Bằng chứng |
|---|---|---|
| S1 | **Tài liệu nói sai theo chiều ngược**: `/crm/post-sale-meeting` bị ghi là EmptyState chưa gọi API — **sai**, màn đã wire (commit `5408ad2`), page gọi `parentMeeting.list:65` | `flow-manifest.ts:466-468`, TL25:51, TL28:59 |
| S2 | `/admin/engagement/rewards` **không có nav entry** ⇒ người test UAT không tìm ra màn đổi thưởng (cùng nhóm `/finance/new`) | `nav-registry.ts` |
| S3 | Tên luồng P4-03 có vế **"& nhắc"** nhưng chức năng nhắc **không tồn tại** — `remindedAt` đã xoá, 3 test khoá | `schema.prisma:1535` |
| S4 | P3-02: TL27:47 khai `super_admin (mọi phiếu)`, TL25:39 không → phạm vi UAT chưa rõ | mâu thuẫn doc↔doc |

## Việc cần làm (một đợt sửa manifest duy nhất)

**Không đụng registry quyền.** Chỉ sửa `scripts/acceptance-report/flow-manifest.ts`:

1. P4-04: bỏ `giao_vien`
2. P3-01: `nhan_vien` → `['giam_doc_kinh_doanh','giam_doc_dao_tao','sale','giao_vien']`
3. P3-02: `nhan_vien` → `['sale','giao_vien']` (giữ GĐKD/GĐĐT đã có)
4. P4-01: `nhan_vien` → `['giam_doc_kinh_doanh','giam_doc_dao_tao','sale']` (giữ `hoc_vien`)
5. P4-03: `nhan_vien` → `['giam_doc_kinh_doanh','giam_doc_dao_tao','sale']`
6. P1-05: thêm vai nhân viên thao tác `/admin/students`
7. P1-06: thêm vai nhân viên duyệt link
8. P1-09: bỏ `audit.list`
9. Sửa chú thích stale ở `:466-468` (S1)

**Kỳ vọng sau khi sửa:** `actor-audit` từ 26 finding → gần 0. Đó là tiêu chí nghiệm thu của đợt này.

Sau đó đồng bộ lại `docs/runbook-uat-golive.md` §5 (checklist sinh từ manifest) — P3-01/P4-03 sẽ xuất hiện, số dòng tăng.

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Sửa manifest làm `acceptance:report` đổi số built/partial | Thấp | Chạy trước/sau, so sánh; kỳ vọng 37/1 **không đổi** (chỉ actor đổi, không đụng procedure/route/model) |
| P3-02 và P4-03 độ tin cậy "NGỜ" | TB | Ghi rõ trong manifest là suy từ registry, chờ PO xác nhận khi UAT chạy thật |
| Quên đồng bộ runbook §5 sau khi sửa manifest | TB | Là bước bắt buộc trong danh sách trên |

## Tiêu chí thành công

- `pnpm acceptance:report` → `actor-audit` **0 invalid-actor**, **0 idle-actor**; unreachable giảm còn ≤ số đã triage có lý do
- Không thay đổi `packages/auth/src/index.ts` (không nới quyền nào)
- 37 built / 1 partial giữ nguyên
- Runbook §5 sinh lại, có P3-01 và P4-03

## Câu hỏi chưa giải

1. **P1-05, P1-06** cụ thể thêm vai nào? (suy được từ quyền: `student.lookup`/`guardian.approveLink` = GĐKD/GĐĐT/sale/GV — cần xác nhận)
2. **P3-02**: `super_admin` có nằm trong phạm vi UAT không (TL27 nói có, TL25 không)?
3. **S2** `/admin/engagement/rewards` — thêm nav entry hay chấp nhận vào bằng URL?
4. Tính năng "họp PH theo lớp + nhắc" — mở plan riêng khi nào?
5. Brevo `.env.prod` trên máy UAT đã có bản sửa 2026-07-11 chưa?
