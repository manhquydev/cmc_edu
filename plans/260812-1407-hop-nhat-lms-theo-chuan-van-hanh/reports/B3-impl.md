# B3-impl — Bài tập chỉ từ buổi đã phát (delivery-only)

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch:** `feat/lms-delivery-only-homework`  
**Ownership:** `apps/api/src/exercise/**`, `apps/api/src/submission/**`  
**Date:** 2026-08-12  
**Commit:** none

## Mục tiêu

Gỡ đường **Tier A (ADR 0038)** và hai cờ `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE`.  
Đường duy nhất: **`SessionExercise` phát bài + dual-gate roster**.

## Thay đổi (owned)

### `apps/api/src/exercise/open-tier.ts` (~256 → **136 dòng**)

- Xóa `isOpenTierEnabled`, `isEntitlementGateOnOpenTier`, `resolveOpenCurriculumUnitIds` (Tier A), `getOpenCurriculumUnitIdsForStudent`.
- `listOpenExercisesForStudent` / `assertExerciseOpenForStudent`: chỉ `deliveredExerciseIdsForStudent` + `status=published` + fail-closed.
- Giữ `loadLmsStudent`, `exerciseOpenTierRouter.openForStudent` / `listForStudent` (tên procedure **không đổi**).
- **Không đổi tên file** (tránh sửa import ngoài ownership: `router.ts`, rewards).

### `apps/api/src/submission/router.ts`

- Comment: gate = delivered + roster (không còn “Tier window”).
- Vẫn gọi `assertExerciseOpenForStudent` ở `saveDraft` + `submit` (fail-closed).

### Tests

| File | Việc |
|------|------|
| `exercise/open-tier.test.ts` | Viết lại: on-roster sees delivered; off-roster hidden; no delivery → empty; unpublished hidden; blocked FORBIDDEN; alias; ownership |
| `submission/annotate-submit.test.ts` | Deliver + unit range; never-delivered reject; **off-roster saveDraft reject** |
| `submission/grade.test.ts` | Deliver + unit range fixtures |
| `submission/list-for-child.test.ts` | Deliver + unit range |
| `submission/teacher-annotation.test.ts` | Deliver + unit range |

## Verification

```text
cd apps/api && npx tsc -p tsconfig.json --noEmit
→ 0 errors

cd apps/api && npx vitest run \
  src/exercise/open-tier.test.ts \
  src/submission/annotate-submit.test.ts \
  src/submission/grade.test.ts \
  src/submission/list-for-child.test.ts \
  src/submission/teacher-annotation.test.ts
→ 5 files / 47 tests pass

Full suite (shared dev Postgres): 1197–1198 pass; 1–2 fails outside ownership / flaky:
  - apps/api/src/attendance/gate.test.ts (M2 FinalGrade cancel) — still uses Tier-A-style open (session ended, no SessionExercise)
  - apps/api/src/worker/session-done-sweep.test.ts — intermittent pollution (length 7 vs 1); passes in isolation
```

Postgres: dùng env máy sẵn (`DATABASE_URL` / `APP_DATABASE_URL`); không spin container mới (DB đã migrate).

## Code review

`ak-engineer:code-reviewer` → **APPROVE_WITH_CONCERNS**  
- Runtime owned: đúng delivery-only, fail-closed.  
- Đã bổ sung off-roster `saveDraft` test (Important #1).  
- Residual flag ceremony in `lms-ops/exercise-delivery.int.test.ts` + docs ADR 0038 → outside ownership / follow-up.

## Ngoài ownership — **cần agent khác sửa** (không tự sửa)

| File | Vì sao |
|------|--------|
| `apps/api/src/attendance/gate.test.ts` ~L344–383 | Fixture “PAST session opens exercise (ADR 0038)” rồi `saveDraft` — **hỏng sau B3**. Cần `assignExerciseSequence` + `deliverSessionExercise` + `unitRange` giống submission tests. |
| `apps/api/src/lms-ops/exercise-delivery.int.test.ts` | Vẫn set `LMS_OPEN_TIER_ENABLED=0` (no-op); nên bỏ env ceremony. |
| `apps/api/src/router.ts` comments, `class-session-router.ts` assignUnit comment, rewards (imports only OK) | Comment stale Tier A |
| `docs/**` (ADR 0038, TL19, architecture) | Vẫn mô tả Tier A / cờ — doc sync riêng |
| `apps/lms` | Không sửa (procedure name giữ nguyên) |

## Status

**DONE_WITH_CONCERNS**

B3 owned code + tests xong và xanh. Full API suite còn **1 fail deterministic** ngoài scope (`attendance/gate.test.ts` M2) cần fix deliver fixture; `session-done-sweep` flaky trên DB chia sẻ. Không commit.

---

## Bổ sung bắt buộc (agent follow-up) — 2026-08-12

### (1) Giữ kiểm dải unit trong dual-gate roster — **ĐÃ XÁC NHẬN / KHÔNG GỠ**

**Đọc lại** `apps/api/src/lms-ops/on-roster.ts`:

```ts
export function onRoster(input: RosterInputs): boolean {
  if (input.enrollmentStatus !== 'active') return false;
  if (BLOCKED_TEACHING_LIFECYCLES.has(input.studentLifecycle)) return false;
  if (!enrollmentCoversSession(input.archivedDayUtc, input.sessionDate)) return false;
  if (input.sessionOrderGlobal == null) return false;
  return isEntitled(input.ranges, input.sessionOrderGlobal);  // ← dải unit BẮT BUỘC
}
```

- `LMS_ENTITLEMENT_GATE` (cờ env trên đường Tier A) = **đã xóa** đúng brief.
- Kiểm **EnrollmentUnitRange vs session orderGlobal** trong `onRoster` / `deliveredExerciseIdsForStudent` = **giữ nguyên**.
- Comment trong `open-tier.ts` + `deliveredExerciseIdsForStudent` nói rõ: entitlement nằm ở roster, không phải cờ env.

### (2) Lỗ “phát rồi mất” (buổi chưa gán unit) — **ĐÃ CHẶN**

**Vấn đề:** `deliverForSession` trước đây cho phép phát khi có sequence dù `curriculumUnitId = null` → `SessionExercise` tạo xong nhưng `deliveredExerciseIdsForStudent` lấy `orderGlobal = null` → `onRoster` fail-closed → HS không thấy bài.

**Cách xử lý (tối thiểu, đúng yêu cầu):** chặn phát sớm, lỗi rõ nghĩa:

```ts
// deliverForSession — sau check ended, trước gán exercise
if (!session.curriculumUnitId) {
  throw badRequest(
    'Cannot deliver exercise: session has no curriculum unit assigned. Assign a unit before delivering homework.',
  );
}
```

- Idempotent: nếu đã có `SessionExercise` thì vẫn trả bản cũ (không double-create).
- Fallback homework-by-unit đơn giản hóa (unit đã bắt buộc).
- Test mới: `exercise-delivery.int.test.ts` → `refuses delivery when session has no curriculum unit`.

### Verify bổ sung

```text
onRoster still: isEntitled(ranges, sessionOrderGlobal)  ✓
npx tsc -p tsconfig.json --noEmit  ✓
vitest: exercise-delivery.int (7) + open-tier (8) + annotate-submit (12)  ✓ 27 pass
```

### Status cập nhật

**DONE_WITH_CONCERNS** (không đổi) — vẫn còn `attendance/gate.test.ts` ngoài scope cần fixture deliver; hai ràng buộc bổ sung đã áp.
