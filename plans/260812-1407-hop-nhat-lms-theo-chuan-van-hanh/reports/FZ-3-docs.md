# FZ-3 — Rà soát docs sau ba PR + đóng băng `cmc-lms`

**Mode:** `/ak:docs` audit rồi sửa (update workflow + doc-content-rules)  
**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch:** `docs/freeze-cmc-lms-and-session-journal`  
**Date:** 2026-08-12  
**Ownership:** `docs/**` trừ `docs/journals/` (agent khác)  
**Không đụng:** `plans/`, code sản phẩm, commit/push

## Cách làm

1. Đọc `BRIEF-FREEZE.md` + brief/docs đợt trước (`BRIEF-DOCS`, `GAP-5`, `DOC-A/B/C`).
2. Đối chiếu 5 điểm soi với code: `open-tier.ts`, `schema.prisma` (`Submission` / `SessionExercise`), `submission/router.ts`, route LMS `/student/exercise/:sessionExerciseId`, CSV 96 unit.
3. Sửa **chỗ còn lệch so với sự thật hiện tại**; thêm ghi chú ngày **2026-08-12**. Không sửa cho có.

## Sự thật hiện tại (bằng chứng)

| Chủ đề | Code |
|--------|------|
| Mở bài | `apps/api/src/exercise/open-tier.ts`: chỉ `SessionExercise` đã phát trên buổi chưa hủy + `onRoster` (dải unit bắt buộc). Tên file/procedure giữ để import ổn định. |
| Cờ env | `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE` **đã xóa** — comment trong `open-tier.ts` và `exercise-delivery.ts` nói rõ chúng không còn. |
| Bài nộp | `Submission @@unique([sessionExerciseId, studentId])`. `saveDraft`/`submit` nhận `sessionExerciseId`. URL LMS: `/student/exercise/:sessionExerciseId`. |
| Khung / level | CSV 96 unit (36/18/42); `CurriculumUnit.level` = chuỗi. Bright I.G mã cấp `J,T,C,W,Q,U` (6×3=18). |
| Buổi bù | Cột/API/UI đã gỡ; sweep chỉ hủy + restamp. |
| `cmc-lms` | Đóng băng 12/08 tại `031d193`; sửa lỗi vẫn làm; không thêm tính năng. Không tắt hệ cũ. |

## Kết luận audit

Đợt trước (11 tài liệu) đã vá buổi bù / khung 96 unit / gap-aware **đúng hướng**, nhưng **đóng đinh “chỉ còn Tier A”** ngay trước PR #118. PR #118 gỡ luôn Tier A + hai cờ env + đổi khóa nộp → những file vừa sửa trở thành lệch mới.

Không có tài liệu evergreen nào còn mô tả hai cờ như **đang tồn tại** sau lần sửa này. Không có tài liệu evergreen nào còn khóa nộp theo `exerciseId` như luật sống.

`docs/journals/` và changelog: **không đụng** (snapshot đúng thời điểm / agent khác giữ journals). Journal `260812-lms-thuc-trang-ba-loi-dong-bang-cmc-lms.md` đã ghi freeze — ngoài ownership.

## Chỗ đã sửa (16 file)

### 1. ADR + gương ADR (PR #118 — quan trọng nhất)

| File | Lệch | Việc |
|------|------|------|
| `docs/decisions/0038-exercise-open-by-teaching-progress.md` | Banner 2026-08-12 vẫn nói **chỉ còn Tier A** + hai cờ env còn sống | Đánh dấu **Tier A cũng gỡ**; cờ **đã xóa**; đường mở = `SessionExercise` + `onRoster`; gạch ngang Decision gốc; ghi chú Consequences |
| `docs/decisions/0045-course-unit-entitlement-and-dual-gates.md` | Homework dual-gate “deferred” tới khi `LMS_ENTITLEMENT_GATE` default on; điểm 5 vẫn nói 0038 + kill-switch còn sống | Dual-gate **live** qua `onRoster`; cờ xóa; 0038 không còn là đường mở bài |
| `docs/decisions/0046-order-global-stability.md` | Consequences còn “Product CSV import **(later)**” | Giữ câu gốc (ADR không viết lại lịch sử) + ghi chú 2026-08-12: CSV đã nạp, contiguous chỉ test, `level` là chuỗi |
| `docs/22-adr-rule-chi-code-0038-0041.md` | “Tier A còn hiệu lực”; Consequences bắt giữ ngữ nghĩa Tier A | Gương 0038: gỡ Tier A + hai cờ; ghi chú PR #118 |

### 2. Quy tắc / workflow / test / index (sót đợt trước + lệch PR #118)

| File | Lệch | Việc |
|------|------|------|
| `docs/19-quy-tac-nghiep-vu-chi-tiet.md` | Bright = 6×4 tháng; Submission `1 bản/[exerciseId, studentId]`; §4 Tier A là đường duy nhất; bảng trỏ `seed-curriculum` / `lib/exercise-open.ts` Tier A | Catalog 96 / Bright 6×3; khóa `(sessionExerciseId, studentId)`; §4 = lần phát + `onRoster`; ghi chú gỡ Tier A/B + cờ |
| `docs/26-workflow-spec-p2.md` | WF-P2-02/03 “chỉ Tier A”; WF-P2-05 unique `exerciseId`; URL `:exerciseId` | Swimlane + happy path + acceptance = delivery + roster; URL `:sessionExerciseId` |
| `docs/29-test-plan.md` | Yêu cầu test “Tier A only” | Đổi thành delivery + `onRoster` + khóa nộp; cấm viết lại test Tier A/B / cờ env |
| `docs/31-phased-build-plan.md` | Acceptance P2 còn `+Tier B` (**sót đợt trước**) | Bài mở khi đã phát + `onRoster` |
| `docs/README.md` | One-liner 0038 “chỉ còn Tier A” | One-liner đường phát + ghi chú gỡ A/B + hai cờ |
| `docs/10-data-model-v2.md` | Hàng Exercise/Submission không nêu lần phát; chưa có V14 | Thêm `SessionExercise` + khóa nộp; hàng **V14** PR #118 |
| `docs/25-ma-tran-truy-vet-p1.md` | P2-03/05 URL `:exerciseId`; nhãn ADR 0038 còn “Tier A” | `:sessionExerciseId`; nhãn ADR cập nhật |
| `docs/runbook-uat-golive.md` | Checklist UAT còn `:exerciseId` | `:sessionExerciseId` |
| `docs/00-ke-hoach-tai-lieu-va-lo-trinh.md` | “seed-curriculum” (**sót đợt trước**) | CSV khung 96 unit |
| `docs/07-glossary-san-pham.md` | Submission/Exercise không nói lần phát | Khóa `(sessionExerciseId, studentId)` + `SessionExercise` |

### 3. As-built (câu hỏi 3 + 4 của brief)

| File | Lệch | Việc |
|------|------|------|
| `docs/system-architecture.md` | Banner 12/08 chưa có PR 117–119; student “open-tier”; hàng LMS Frontend còn “homework flag” / “Evolve parity”; **không** nêu đóng băng `cmc-lms` | Banner chiều 2026-08-12; sửa student + bảng deferred; ghi freeze `031d193` |
| `docs/codebase-summary.md` | `saveDraft(exerciseId)`; `openForStudent(..., tier)` Tier A/B; §16b **còn tail-append makeup** (**sót đợt trước**); không nêu freeze / `lmsOps` | Banner 2026-08-12; sửa chữ ký procedure; sweep chỉ restamp; freeze + trỏ `lmsOps` / `@cmc/domain-lms` |

## Đã rà, không sửa (không còn lệch / ngoài phạm vi)

| File / vùng | Lý do để yên |
|-------------|--------------|
| `docs/20-quy-tac-nghiep-vu-van-hanh.md` | Đợt trước đã đúng: sweep chỉ hủy + restamp |
| `docs/04-…`, `docs/05-…` | Buổi bù đã ghi “gỡ 2026-08-12” |
| `docs/11-api-contract.md` | Không mô tả open-tier / Submission / hai cờ |
| `docs/WORKSPACE-LEAN.md`, `README.md` (root), `docs/project-roadmap.md`, `docs/stories/` | Không claim cờ env / `exerciseId` / “cmc-lms đang phát triển” |
| `docs/journals/**` | Agent khác giữ. Journal 260812 đã ghi freeze. |
| `docs/project-changelog.md`, `docs/project-changelog-history.md` | Snapshot lịch sử — đúng thời điểm viết |
| `plans/**` | Cấm sửa |
| **Tạo mới** `docs/class-unit-spec.md` | Code vẫn trỏ file này nhưng file **không tồn tại**. Không tạo mới trong đợt này (không phải chỗ lệch văn bản). Ghi nhận cho phiên sau nếu cần spec công thức `programAxis`. |

## Năm điểm soi — sau sửa

| # | Kết quả |
|---|---------|
| (1) Hai cờ env như đang tồn tại | **Hết** trên evergreen. Mọi hit còn lại là “đã xóa / không implement lại”. |
| (2) Bài nộp gắn `Exercise` / khóa `exerciseId` | **Hết** trên evergreen. Còn lại chỉ trong ghi chú “từng là … → nay là sessionExerciseId”. |
| (3) `system-architecture.md` + `codebase-summary.md` | Đã phản ánh PR 117–119 + freeze. Số liệu test/acceptance cũ trong banner lịch sử **không** làm mới (ảnh chụp có ngày; SoT vẫn là `pnpm acceptance:report`). |
| (4) `cmc-lms` như hệ đang phát triển tiếp | Trước sửa: **không** có evergreen nào nói “đang phát triển tiếp”; chỉ im lặng. ADR 0038/0045 nói “đang vận hành” — vẫn đúng (hệ cũ chưa tắt). Đã **ghi freeze** vào hai file as-built. |
| (5) ADR 0038 / 0045 / 0046 sau PR #118 | 0038 lệch nặng (Tier A + cờ) → đã đánh dấu gỡ. 0045 lệch cờ/deferred → đã sửa Status + điểm 5. 0046 Status đợt trước đúng; Consequences “CSV later” → thêm ghi chú. |

## Không commit

Working tree chỉ có diff `docs/` (16 file). Không stage, không commit, không push.

---

Status: DONE

Đã sửa 16 file dưới `docs/` (trừ journals). Lệch chính là **PR #118** (gỡ Tier A + xóa hai cờ + khóa nộp `sessionExerciseId`) đè lên bản “chỉ còn Tier A” của đợt docs trước, cộng sót makeup ở `codebase-summary` §16b và `+Tier B` ở TL31.
