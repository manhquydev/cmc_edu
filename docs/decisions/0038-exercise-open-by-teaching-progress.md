# 0038 — Thời điểm mở bài tập theo tiến độ dạy (Tier A/B đã gỡ)

Date: 2026-07-05

## Status

Accepted (formalize `lib/exercise-open.ts` / `apps/api/src/exercise/open-tier.ts`).

> **Status sync 2026-08-12 (as-built) — Tier A và Tier B ĐÃ GỠ (PR #118):**
> - **Tier B không còn tồn tại.** Buổi bù đã bị gỡ khỏi sản phẩm cùng hai cột `isMakeup` và
>   `makeupForSessionId`.
>   Lý do gỡ buổi bù: nó tạo buổi không gán unit và không restamp, trong khi việc gán unit đếm
>   **mọi** buổi chưa hủy — nên buổi bù chiếm một vị trí và đẩy lệch các buổi sau, làm một unit
>   4 buổi âm thầm thành 5 buổi thực. LMS đang vận hành thật (`cmc-lms`) cũng đã bỏ buổi bù có
>   chủ đích. Học sinh nghỉ vẫn ở trong roster nên **vẫn nhận bài về nhà**; học bù thật do cơ sở
>   sắp xếp ngoài hệ thống.
> - **Tier A cũng đã gỡ 2026-08-12.** Đường mở bài **không còn** là "buổi dạy unit đã kết thúc
>   (ICT) → mở cả lớp". Bài mở **khi và chỉ khi** được phát trên buổi chưa hủy (`SessionExercise`)
>   **và** học sinh có trên roster dual-gate của buổi đó (`onRoster`: enrollment `active` +
>   `EnrollmentUnitRange` phủ unit của buổi). Kiểm dải unit trên `onRoster` là bắt buộc.
> - **Hai cờ env đã xóa khỏi code** (không còn đọc, không còn hiệu lực): `LMS_OPEN_TIER_ENABLED`,
>   `LMS_ENTITLEMENT_GATE`. Đừng set lại trên môi trường — không có code nào đọc chúng.
> - Tên file `open-tier.ts` / procedure `exercise.openForStudent` giữ để import ổn định.
> - Bài nộp khóa `(sessionExerciseId, studentId)` — xem schema `Submission` (PR #118).

## Context

Bài tập gắn `curriculumUnit`. Cần định rõ *khi nào* một bài mở cho học viên — không thể
mở ngay khi tạo, phải theo tiến độ học thực tế; và buổi học bù (nay đã gỡ) chỉ dạy cho HS vắng, không thể mở cho
cả lớp.

## Decision

- Điều kiện nền: Exercise `status = published` **và** HS không ở `BLOCKED_LMS_LIFECYCLE`.
- ~~**Tier A (mở cả lớp):** một `curriculumUnitId` mở cho **toàn batch** khi buổi học dạy unit đó
  **đã kết thúc** — mốc kết thúc tính theo **giờ ICT** (`sessionEndUtc`, UTC+7), không theo cột
  `sessionDate` UTC-midnight.~~ — **ĐÃ GỠ 2026-08-12 (PR #118).** Đường mở bài hiện tại:
  `SessionExercise` đã phát trên buổi non-cancelled + `onRoster` (xem Status).
- ~~**Tier B (mở riêng HS):** buổi **bù** (`isMakeup`) mà HS **có mặt/đi muộn** mở unit đó chỉ cho
  HS ấy.~~ — **ĐÃ GỠ 2026-08-12** cùng toàn bộ đường buổi bù (xem Status ở trên).
- Buổi `cancelled` không mở gì.

## Consequences

"Học tới đâu mở bài tới đó"; phụ thuộc `SessionStatus` + giờ ICT. Nếu đổi cách tính giờ kết thúc,
phải giữ nguyên ngữ nghĩa Tier A.

> **2026-08-12 (PR #118):** ngữ nghĩa Tier A/B ở trên **không còn** là đường mở bài. Bài mở theo
> lần phát `SessionExercise` + `onRoster`. Hai cờ env đã xóa. Xem Status.

## Alternatives bỏ

Mở ngay khi published (không theo tiến độ) — bị loại vì học viên thấy bài chưa học.

---

Nguồn đầy đủ: `docs/22-adr-rule-chi-code-0038-0041.md`. Liên kết: `docs/19` §4.
