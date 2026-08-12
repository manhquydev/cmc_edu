# DOC-A — Đồng bộ tài liệu buổi bù / Tier B đã gỡ

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Date:** 2026-08-12  
**Ownership (chỉ 3 file):**  
- `docs/22-adr-rule-chi-code-0038-0041.md`  
- `docs/19-quy-tac-nghiep-vu-chi-tiet.md`  
- `docs/20-quy-tac-nghiep-vu-van-hanh.md`  
**Code / commit:** không đụng

## Brief đã áp

Sự thật hiện tại (2026-08-12):

- Không còn Tier B open-tier; chỉ Tier A.
- Sweep 0 điểm danh: **chỉ hủy + restamp**, không tạo buổi bù.
- Đã xóa: `isMakeup`, `makeupForSessionId`, API `addMakeup`, UI buổi bù, `roomConflict` tạo bù.
- Lý do gỡ: buổi bù lệch trục unit (restamp đếm mọi non-cancelled); LMS vận hành thật cũng bỏ.
- HS nghỉ vẫn nhận bài (roster); học bù thật ngoài hệ thống / thêm khung lịch tuần.

Nguyên tắc: ADR = đánh dấu gỡ, giữ quyết định gốc; TL19/TL20 = viết lại rule đang hiệu lực + ghi chú ngày.

## Chỗ đã sửa (theo số dòng sau edit)

### 1. `docs/22-adr-rule-chi-code-0038-0041.md` (ADR — không xóa lịch sử)

| Vùng | Trước | Sau |
|------|-------|-----|
| **§ ADR 0038 title/status/context** ~L14–20 | "Tier A/B"; context bắt buộc buổi bù | Title "Tier A; Tier B đã gỡ"; status ghi gỡ 2026-08-12; context tách phần bù |
| **Decision Tier A** ~L24–27 | "buổi không phải bù" | Tier A còn hiệu lực; mọi non-cancelled là buổi chính sau khi gỡ cờ bù |
| **Decision Tier B** ~L28–35 | Tier B `isMakeup` còn hiệu lực | ~~gạch ngang~~ bản gốc + **Gỡ 2026-08-12** (cột/API/UI/Tier B + lý do + cấm tái tạo) |
| **Consequences** ~L37–38 | "công bằng buổi bù"; "giữ Tier A/B"; phụ thuộc `isMakeup` | Chỉ Tier A + giờ ICT; không tái tạo Tier B |
| **ADR 0044 sweep** ~L178–185 | Tự tạo buổi bù cuối slot; `roomConflict` | ~~gạch ngang~~ hành vi cũ + **Gỡ 2026-08-12**: chỉ hủy + restamp, không bù |

### 2. `docs/19-quy-tac-nghiep-vu-chi-tiet.md` (spec đang hiệu lực)

| Vùng | Trước | Sau |
|------|-------|-----|
| **§4 L92–111** | Tier A (không phải bù) + Tier B `isMakeup` như luật sống | Tier A **đường duy nhất**; bỏ bullet Tier B; blockquote **2026-08-12** giải thích gỡ + lý do + cấm thêm lại |
| **Bảng tóm tắt L183** (phát hiện thêm trong cùng file) | `lib/exercise-open.ts` (Tier A/B) | `(Tier A only; Tier B gỡ 2026-08-12 — §4)` |

### 3. `docs/20-quy-tac-nghiep-vu-van-hanh.md` (vận hành đang hiệu lực)

| Vùng | Trước | Sau |
|------|-------|-----|
| **§4b L158–161** | Auto-cancel + tự tạo buổi bù; `addMakeup`; `makeupForSessionId` | Auto-cancel **chỉ hủy + restamp**; nêu rõ không còn cột/API makeup |
| **§4b roomConflict L163–165** | Phòng bận → `roomConflict`, xếp bù tay | Gộp vào blockquote **2026-08-12** (đã gỡ toàn bộ nhánh bù / conflict phòng cho bù) |

## Chỗ khác cần sửa (ngoài ownership — không đụng)

Grep nhanh trong `docs/` (không sửa):

- Có thể còn nhắc buổi bù / Tier B / `isMakeup` / `addMakeup` ở file khác (TL26, TL29, data model, decisions/*.md, README index, v.v.) — **chưa quét toàn bộ** trong phiên này; brief chỉ giao 3 file.
- Brief cũng nêu khung 96 unit + gap-aware progression: **không thuộc 3 đoạn lệch được giao** → không sửa trong DOC-A.

## Verification

- Chỉ 3 path trên bị edit (`git` sẽ cho thấy diff docs).
- Không sửa code.
- Không commit.

## Status

**DONE**

Đã chỉnh đủ 3 chỗ lệch từ báo cáo rà soát (+ 1 dòng bảng TL19 cùng file) cho khớp code 2026-08-12, kèm ghi chú ngày/lý do để người đọc sau không thêm lại buổi bù.
