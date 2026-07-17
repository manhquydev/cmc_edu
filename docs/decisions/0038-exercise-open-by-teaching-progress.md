# 0038 — Thời điểm mở bài tập theo tiến độ dạy (Tier A/B)

Date: 2026-07-05

## Status

Accepted (formalize `lib/exercise-open.ts`).

## Context

Bài tập gắn `curriculumUnit`. Cần định rõ *khi nào* một bài mở cho học viên — không thể
mở ngay khi tạo, phải theo tiến độ học thực tế; và buổi học bù chỉ dạy cho HS vắng, không thể mở cho
cả lớp.

## Decision

- Điều kiện nền: Exercise `status = published` **và** HS không ở `BLOCKED_LMS_LIFECYCLE`.
- **Tier A (mở cả lớp):** một `curriculumUnitId` mở cho **toàn batch** khi buổi học **không phải bù**
  dạy unit đó **đã kết thúc** — mốc kết thúc tính theo **giờ ICT** (`sessionEndUtc`, UTC+7), không theo
  cột `sessionDate` UTC-midnight.
- **Tier B (mở riêng HS):** buổi **bù** (`isMakeup`) mà HS **có mặt/đi muộn** (`present`/`late`) mở
  unit đó **chỉ cho HS ấy** (keyed trên `Attendance`), **không** mở cả lớp.
- Buổi `cancelled` không mở gì.

## Consequences

"Học tới đâu mở bài tới đó"; công bằng buổi bù; phụ thuộc `SessionStatus` +
`isMakeup` + giờ ICT. Nếu đổi cách tính giờ kết thúc, phải giữ nguyên ngữ nghĩa Tier A/B.

## Alternatives bỏ

Mở ngay khi published (không theo tiến độ) — bị loại vì học viên thấy bài chưa học.

---

Nguồn đầy đủ: `docs/22-adr-rule-chi-code-0038-0041.md`. Liên kết: `docs/19` §4.
