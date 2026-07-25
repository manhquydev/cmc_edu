# Phase 6 part 2 — P2-04 + P2-08-GV: XONG (đóng Phase 6)

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-06-dot-ghi-danh-van-hanh-lop.md`
**Ngày:** 2026-07-25 · **Branch:** `acceptance-journey-38-lms`

Đóng nốt part 2: **P2-04** (bài tập PDF) + **P2-08-GV** (session evidence). Sổ
**14 → 16/38**. Cả hai là journey e2e đầu tiên upload file thật.

## Đã giao

| Flow | Kết quả | Upload |
|---|---|---|
| P2-04 Cung cấp bài tập PDF | xanh 4×, phủ **đủ 5/5 procedure** | PDF (`/upload/exercise-pdf`) |
| P2-08-GV Gửi ảnh & tóm tắt | xanh 4×, phủ hẹp (nửa GV) | ảnh PNG (`/upload/session-photo`) |

## File upload trong e2e — tiền lệ mới

Chưa journey nào từng upload file. Cơ chế (cả hai flow):
`setInputFiles` (input ẩn) → onChange → `fetch POST` với staff cookie →
`LocalDiskBlobStorage` (S3 unset). Upload route chỉ kiểm Content-Type + non-empty
+ size cap, KHÔNG parse cấu trúc file:
- PDF: buffer `%PDF` tối thiểu, Content-Type `application/pdf`.
- Ảnh: 1x1 PNG (base64), Content-Type `image/png` (route đòi image/*).

## P2-04: đủ 5/5 procedure

GĐĐT tạo bài (chọn unit + loại + upload PDF) → Publish → Đóng. Drive
create/publish/close/list/curriculumUnit.list + exercise.manage. Vòng
draft→published→closed đọc lại từ row = bằng chứng sống. **"proven" trung thực =
toàn bộ bề mặt khai** (reviewer xác nhận).

3 lệch contract bắt được: Selector-có-search render **button** vs không-search
render **combobox**; nút header "**+** Tạo bài tập" vs submit "Tạo bài tập"
(cần `exact`); **RLS** cleanup phải dùng `getPrivilegedDb()` (cmc_app không có
DELETE grant trên Exercise/CurriculumUnit).

## P2-08-GV: phủ hẹp có chủ ý (nửa GV)

GV chọn lớp mình sở hữu + buổi → tóm tắt → upload ảnh → công bố. Drive
sessionEvidence.upsert/addPhoto/publish + classBatch.list/classSession.list. Ảnh
**load-bearing** (assert "Ảnh đã upload (1)" trước publish). **Nửa phụ huynh**
(listForChild, guardian.setPhotoConsent, /parent/evidence) là journey xuyên app —
**thuộc Phase 8**, chưa drive. Manifest ghi rõ.

Ownership như P2-06: GV chỉ thấy lớp mình sở hữu — seed teacher AppUser +
seedClassBatch(teacher=GV) + session userId khớp.

## Falsification (chạy thật)

| Flow | Phá gì | Kết quả |
|---|---|---|
| P2-04 | bỏ Publish | status ở draft → `published` assert đỏ ✅ |
| P2-08 | bỏ Publish | không có "Đã công bố" + nút còn → assert đỏ ✅ |
| P2-08 | (assert ảnh) | "Ảnh đã upload (1)" trước publish → ảnh load-bearing ✅ |

Cả hai 4× liên tiếp xanh.

## Kiểm chứng

- Full `ui-chromium`: **24/24 xanh** (3.6′)
- `typecheck` 27/27 · `lint` sạch · `test` 2100 · 0 file sản phẩm bị chạm
- `git diff packages/auth/src/index.ts` rỗng
- Sổ: **16/38 luồng đã chứng minh chạy**
- P2-04 code review: DONE (0 critical/high/medium; "proven" đủ 5/5 xác nhận)

## Phase 6 — bức tranh đóng batch

| Flow | Trạng thái |
|---|---|
| P1-01 phễu (loss) | proven | P2-04 bài tập PDF | proven |
| P1-05 ghi danh | proven (cũ) | P2-05 làm bài | no-ui-path |
| P2-01 tạo lớp | no-ui-path | P2-06 chấm bài | proven (nửa) |
| P2-02 điểm danh | no-ui-path | P2-07 nhận xét | proven (cũ) |
| P2-03 mở bài | no-ui-path | P2-08 ảnh buổi | proven (nửa GV) |

**Phase 6 xong**: mọi flow ghi-danh + vận-hành-lớp có trạng thái máy-chứng hoặc
no-ui-path có bằng chứng. Còn Phase 7 (HR/rewards/admin) + Phase 8 (đuôi LMS).

## Finding sản phẩm tích luỹ (bàn giao plan sửa)
1. Ô học phí từ chối số tròn · 2. `Cmc2026@` literal lặp 4 chỗ · 3. recon
`self_approved` dead-path + mô tả `exceeds_threshold` lệch code · 4. mark-lost
không refresh màn chi tiết · 5. banner grading hardcode "⭐ +1 sao" ·
6. **Upload blob rác trên đĩa** (P2-04/P2-08): DB rows dọn sạch nhưng file blob
(.data/blobs) không xoá — tích luỹ per-run (~50-70 bytes). Thấp; scratch dir.

## Câu hỏi chưa giải quyết
- P2-08 nửa phụ huynh (parent view + consent) — Phase 8 (journey xuyên app).
- P2-06 saveTeacherAnnotation — mở rộng hoặc bỏ khỏi expected (chưa quyết).
- Phase 7 (HR/rewards/admin) là đợt tiếp; bản đồ ở triage P3/P4/ADM.
