# IMPL-B5-api — Phase 1 + Phase 2

**Ngày:** 2026-08-13
**Nhánh:** `feat/lms-exercise-library`
**Phạm vi sở hữu:** `packages/db/**`, `apps/api/src/**`, `scripts/acceptance-report/**`
**Không sửa:** `apps/admin`, `apps/lms`, `apps/e2e`
**Không commit**

Đặc tả: `plans/260813-0053-thu-vien-bai-tap-va-xep-day/{plan,phase-01,phase-02}.md`

---

## Kết quả

Phase 1 và 2 đã vào **cùng một lần**. Schema + API + bỏ fallback + manifest. Typecheck API 0 lỗi. Toàn bộ test `apps/api` xanh trên Postgres tạm (đã xóa). P2-04 vẫn `built`; không luồng nào tụt `built` → `partial`/`missing`.

| Cổng | Kết quả |
|------|---------|
| `npx tsc -p tsconfig.json --noEmit` (`apps/api`) | 0 lỗi |
| `npx vitest run` (`apps/api`) | **129 file / 1204 test passed** |
| `npx tsx scripts/acceptance-report/verify.ts` | 42 luồng: **40 built, 2 partial, 0 missing**; 14 orphan đã phân loại, 0 chưa phân loại |
| P2-04 | `status: built` |
| 2 partial | P2-03, P2-05 — sẵn `no-ui-path`, không phải hồi quy lần này |
| Migration DB trắng | `prisma migrate deploy` áp dụng `20260813010000_exercise_library_folders` |
| Migration DB đã có bài | 2 hàng Exercise → `orderInFolder` 1,2; title `Unit A — homework` / `Unit A — test_entrance`; folder `Chưa phân loại` |
| `ExerciseFolder` RLS | `relrowsecurity=f`, `relforcerowsecurity=f` |
| `facilityId` trên folder | không có cột |
| GRANT `cmc_app` | SELECT, INSERT, **UPDATE** |

---

## Blast radius (GitNexus, trước khi sửa)

| Symbol | Risk | Ghi chú |
|--------|------|---------|
| `toExerciseDto` | MEDIUM (97) | Admin/LMS/e2e ngoài phạm vi sẽ typecheck-đỏ đến Phase 3. Cố ý. |
| `cleanupCurriculumUnits` | MEDIUM (8 test API) | Đã sửa helper + mọi caller tạo bài trong `apps/api`. |
| `deliverForSession` | index stale (không resolve) | Đổi hành vi có chủ đích: hết fallback. Test viết lại. |

Không có HIGH/CRITICAL từ impact trên symbol resolve được. Cảnh báo: surface admin/LMS **chưa** dùng `folderId`/`title` — Phase 3.

---

## Việc đã làm

### Phase 1 — dữ liệu

- Model `ExerciseFolder`: `id`, `name`, `description?`, `archivedAt?`, `createdById`, `createdAt`. **Không** `facilityId`, **không** RLS.
- `Exercise`: bỏ `curriculumUnitId` + unique `(unit, type)`; thêm `title`, `folderId`, `orderInFolder`, unique `(folderId, orderInFolder)`.
- Migration ba bước: tạo bảng + `GRANT UPDATE`; cột nullable + backfill tuần tự + `SET NOT NULL`; unique **sau**.

### Phase 2 — API

- `exerciseFolder.create/update/archive/list` — gate `exercise.manage`, `ctx.db` không `withFacility`.
- `exercise.create/update` nhận `folderId` + `title`; `list` lọc theo folder; `get` trả folder; `publish`/`close` giữ.
- `deliverForSession`: `sequence.length === 0` → `null`. Không còn `findFirst({ curriculumUnitId, type: 'homework' })`.
- Test `'class without a sequence does not receive a delivery (no unit-stamp fallback)'` khẳng định `{ delivered: false, reason: 'no_sequence_or_exhausted' }` và không có hàng `SessionExercise`.
- `cleanupCurriculumUnits` chỉ xóa unit; `cleanupExerciseLibrary` xóa bài + folder.
- P2-04 khai `exerciseFolder.*` + `exercise.update`; `curriculumUnit.list` chuyển sang `DOCUMENTED_GAPS` (màn lớp vẫn dùng).
- `submission.listForChild` đọc `Exercise.title` thay `curriculumUnit.title`.

---

## File đổi

Mới:

- `packages/db/prisma/migrations/20260813010000_exercise_library_folders/migration.sql`
- `apps/api/src/exercise/folder-router.ts`
- `apps/api/src/exercise/folder-router.test.ts`

Sửa: schema, `router.ts` (app + exercise), `open-tier.ts`, `exercise-delivery.ts` + int test, `test/db.ts`, publish/open-tier/submission/attendance tests, `submission/router.ts`, `flow-manifest.ts`, `verify.ts`.

---

## Review

`ak-engineer:code-reviewer`: **Approve**. Không finding chặn. Ghi chú thấp (JSDoc/comment lệch, P2002 trên `update`) đã vá sau review.

---

## Postgres tạm

Container `cmc-b5-pg` (port 55433, DB `cmc_b5` + `cmc_b5_pre`) — **đã `docker rm -f`**.

---

## Việc cố ý chưa làm

- Màn admin/LMS/e2e (Phase 3–4).
- `folderNameAtAssign` (plan đã bỏ).
- `archivedAt` trên bài (chỉ trên thư mục).
- `pnpm typecheck` toàn repo — user chỉ đòi `apps/api` tsc.

---

## Tiếp theo

Phase 3 (màn thư viện) và Phase 4 (màn xếp dãy) trên contract API này. Form tạo bài phải chọn folder + title. Journey P2-04 cần viết lại ở Phase 3 (file spec vẫn tồn tại nên verify không vỡ cấu trúc).
