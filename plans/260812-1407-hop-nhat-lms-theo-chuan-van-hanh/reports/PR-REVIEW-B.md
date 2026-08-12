# PR-REVIEW-B — PR #117 · lăng kính **an toàn dữ liệu & di trú**

**Mode:** `/ak:review-pr` review-only · **không** sửa code · **không** commit · **không** post GitHub  
**PR:** https://github.com/manhquydev/cmc_edu/pull/117  
**Base…Head:** `develop...HEAD` (`c15bb3d`…`0cae180`)  
**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Tiêu đề:** feat(lms): khung chương trình thật, gỡ buổi bù, và tiến trình unit gap-aware  

**Scope lăng kính này:** migration, import catalog, RLS/quyền `cmc_app`, mất cờ makeup, audit trail.  
**Không** đánh giá sâu gap-aware math / UI (đã cover ở review khác).

---

## Summary

PR thêm migration đổi `CurriculumUnit.level` Int→Text và **DROP** hai cột makeup trên `ClassSession`; nạp khung 96 unit qua upsert CSV; gỡ API/UI/Tier B buổi bù. Trên CSDL đã có dữ liệu thật, **migration SQL chạy được và không xóa hàng session/unit**, nhưng **mất vĩnh viễn cờ/liên kết buổi bù** và **level tạm thành `"1"`** cho đến khi import/seed chạy. Import an toàn với 4 unit nháp cũ (giữ UUID). **Lỗ hổng quyền:** `cmc_app` **không có UPDATE** trên `CurriculumUnit` — import/seed phải chạy bằng role owner.

**Risk level (data/migration):** **Medium**  
(không critical SQL “nổ” hay wipe bảng; có mất metadata makeup có chủ đích + phụ thuộc ops chạy import sau migrate + UPDATE grant cho app role)

---

## (1) Migration trên CSDL đã có dữ liệu thật

**File:** `packages/db/prisma/migrations/20260812120000_curriculum_level_text_drop_session_makeup/migration.sql`

```sql
-- L11–12
ALTER TABLE "CurriculumUnit"
  ALTER COLUMN "level" TYPE TEXT USING "level"::text;

-- L20–23
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_fkey";
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_key";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "makeupForSessionId";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "isMakeup";
```

### Chuyện gì xảy ra khi chạy?

| Bước | Hiệu ứng trên data có sẵn |
|------|---------------------------|
| `level` INTEGER → TEXT `USING level::text` | Mỗi giá trị số `1` thành chuỗi `"1"` (không mất hàng). Index `(program, level, monthIndex)` vẫn dùng được với kiểu text. Bảng catalog nhỏ (vài–vài chục hàng) → lock ngắn. |
| DROP FK + UNIQUE + `makeupForSessionId` | Mất **liên kết** “buổi bù → buổi gốc”. Hàng `ClassSession` **không** bị xóa. |
| DROP `isMakeup` | Mất cờ phân biệt buổi bù. Hàng session **giữ nguyên** status/thời gian/`curriculumUnitId`/điểm danh. |

**Không** có `DELETE` unit/session; **không** rewrite `EnrollmentUnitRange` / `orderGlobal`.

### `level` Int→Text có an toàn không?

- **SQL-safe:** cast `integer::text` luôn thành công cho mọi integer hiện có.  
- **Ngữ nghĩa tạm sai:** sau migrate, trước import, UI/API thấy `level = "1"` chứ không phải `"U2"`. Comment migration L8–9 thừa nhận: *CSV import overwrites with framework codes*.  
- **Không** đụng `orderGlobal` (trục quyền học) → dải đã bán **không** bị remap bởi migration này.

### Xóa `isMakeup` / `makeupForSessionId` có mất data cần giữ?

| Dữ liệu | Mất? |
|---------|------|
| Bản thân buổi học (ngày/giờ/status/điểm danh) | **Không** |
| Cờ “đây là buổi bù” | **Có — vĩnh viễn** |
| Con trỏ buổi bù ↔ buổi gốc | **Có — vĩnh viễn** |
| Unit stamp / attendance / exercise delivery gắn session | **Không** (cột khác) |

Product intent (commit `7c17c7c`): **cố ý gỡ** mô hình makeup. Trên DB đã production-hóa với makeup thật, đây là **mất metadata phân loại**, không phải mất hàng học vụ cốt lõi — nhưng **không reversible** sau deploy.

### Thứ tự drop constraint/cột?

**Đúng:** FK → UNIQUE → column `makeupForSessionId` → column `isMakeup`.  
`IF EXISTS` an toàn nếu đã drop tay. Không drop column trước constraint (tránh lỗi phụ thuộc).

### Cần bước chuyển đổi data **trước** khi xóa?

| Bước | Bắt buộc để SQL succeed? | Nên làm ops? |
|------|--------------------------|--------------|
| Cast/backfill `level` sang mã `U2`… | **Không** (cast text đủ) | **Nên** chạy import ngay sau migrate |
| Export inventory `WHERE "isMakeup" = true` / `makeupForSessionId IS NOT NULL` | **Không** | **Nên** nếu môi trường từng dùng makeup thật — sau DROP không query lại được |
| Xóa/hủy/restamp các session makeup trước | **Không** bắt buộc | **Nên cân nhắc:** session `isMakeup=true` thường `curriculumUnitId` null (addMakeup cũ không stamp) nhưng vẫn `status != cancelled` → sau gỡ vẫn **chiếm slot restamp** như mọi buổi thường |

**Kết luận (1):** Migration **chạy được trên DB có data**; level cast an toàn kỹ thuật; drop makeup **đúng thứ tự** và **mất cờ/link có chủ đích**. Thiếu bước bắt buộc trong SQL; **thiếu guardrail ops** (export makeup + bắt buộc import catalog).

---

## (2) Hàng đã có `isMakeup = true` sau migration mất gì?

**Mất (không cảnh báo trong migration):**

1. Cột `isMakeup` → không còn phân biệt UI badge “bù”, calendar `(bù)`, open-tier Tier B (đã gỡ song song).  
2. `makeupForSessionId` → không truy vết buổi gốc.  
3. **Không** có `RAISE NOTICE`, precheck count, hay backup table trong migration.

**Còn lại:**

- Hàng `ClassSession` full (trừ 2 cột).  
- Attendance / evidence / delivery nếu có vẫn theo `classSessionId`.

**Hệ quả vận hành sau gỡ (logic app, không phải SQL crash):**

- Buổi makeup cũ thường **không có unit** (`addMakeup` trên `develop` set `isMakeup: true`, không `curriculumUnitId` — `class-session-router.ts` ~L406 develop).  
- Vẫn non-cancelled → `restampBatchSessions` **vẫn đếm** chúng → **lệch unit** đúng bug product muốn triệt bằng cách không tạo makeup mới; **data lịch sử** nếu còn thì bug **vẫn sống** cho đến khi cancel/restamp tay.

**Mức:** **Important (ops / data classification loss)** — không Critical wipe; cần runbook “đếm & hủy/gắn nhãn trước migrate” nếu env từng bật makeup.

---

## (3) Script nhập khung trên DB đã có 4 unit nháp

**File:** `packages/db/prisma/import-curriculum-units.mjs` L250–296  
**Gọi từ:** `packages/db/prisma/seed.mjs`, `scripts/ensure-curriculum-units.ts`

### Unique key conflict?

Unique: `@@unique([program, orderGlobal])` (`schema.prisma` CurriculumUnit).

| Tình huống | Kết quả |
|------------|---------|
| UCREA `orderGlobal` 1–4 đã có | `findUnique` → **UPDATE** cùng `id` (FK Exercise/Session **giữ nguyên**) |
| UCREA 5–36 / Bright / Black Hole chưa có | **CREATE** |
| Chạy lần 2 | 96 lần UPDATE, `created=0` |

**Không** expect `P2002` trên đường upsert chuẩn.

### Ghi đè nhầm?

UPDATE cố ý ghi đè: `level`, `monthIndex`, `unitType`, `title` (L277–281).  
**Không** đổi `program`/`orderGlobal`/`id`.

- Title nháp `"Bài 1: Làm quen"` → title khung `"U2.1 — …"`: **đúng ý product**.  
- `level` `"1"` (sau cast) → `"U2"`: **đúng**.  
- **Không** xóa unit orphan ngoài CSV (vd. test tạo `orderGlobal=101`): **còn lại** — trục program có thể “bẩn” nếu env test/prod lẫn synthetic units.

### Chạy hai lần có an toàn?

- **Upsert-idempotent** trên 96 key.  
- **Không** bọc `$transaction` → fail giữa chừng: một phần updated/created; **re-run** hội tụ.  
- An toàn cho re-seed; **không** “delete-idempotent”.

### Phụ thuộc role DB (liên quan (4))

Nếu client là **`cmc_app`**: INSERT unit mới OK; **UPDATE unit cũ → permission denied** (xem §4).  
Seed/migrate owner (`DATABASE_URL`) thì OK.

**Mức:** **Important** nếu ai chạy import bằng `APP_DATABASE_URL`; **Low** nếu luôn owner như `prisma db seed`.

---

## (4) RLS & phân quyền `cmc_app`

### CurriculumUnit global / không `facilityId`?

**Đúng khuôn QĐ 0021** — migration tạo bảng gốc:

```71:78:packages/db/prisma/migrations/20260706190000_t2i_exercise_foundation/migration.sql
-- No RLS on CurriculumUnit/Exercise (QĐ 0021/0022 ...)
--   - CurriculumUnit: read-only from the app (curriculumUnit.list) + seed
--     insert — default SELECT/INSERT is sufficient, no extra grant needed.
```

Nạp 96 dòng **không** cần policy RLS facility — catalog toàn hệ thống.  
**Không** “lọt facility”: không có cột facility để lọt; mọi cơ sở đọc chung một khung (by design).

### Migration 20260812 có cần GRANT cho `cmc_app`?

**ALTER TYPE / DROP COLUMN:** chạy bằng role migrate (owner) — **không** cần GRANT thêm cho `cmc_app` để migrate succeed.

**Runtime app sau migrate:**

| Thao tác | `cmc_app` hiện có? | Nguồn |
|----------|-------------------|--------|
| `SELECT` / `curriculumUnit.list` | Yes (default) | wave-A DEFAULT PRIVILEGES SELECT/INSERT |
| `INSERT` seed/import unit mới | Yes INSERT | same |
| **`UPDATE` import/ensure ghi đè 4 unit cũ + re-import** | **Không** | t2i chỉ `GRANT UPDATE ON "Exercise"`; **không** có `GRANT UPDATE ON "CurriculumUnit"` |

Wave-A (`20260706150000_...privilege_hardening`) đặt default **SELECT/INSERT only** cho bảng mới; CurriculumUnit tạo sau đó → **không UPDATE**.

**Kịch bản hỏng cụ thể:**

1. Ops: `migrate deploy` (OK).  
2. Chạy `node prisma/import-curriculum-units.mjs` với `DATABASE_URL=APP`/`cmc_app` → **fail** trên UPDATE UCREA 1–4; Bright/Black Hole có thể insert một phần.  
3. Hoặc app sau này có procedure “refresh catalog” bằng `ctx.db` app role → same fail.

**Migration PR không thêm GRANT UPDATE** — nhất quán với “app không sửa catalog runtime”, nhưng **mâu thuẫn** với script import khi trỏ nhầm role.

**Mức:** **Important** (ops misconfig / ensure script), không phải lỗ RLS facility.

**Khuyến nghị (không implement trong review này):** document “import chỉ DATABASE_URL owner”; hoặc thêm migration `GRANT UPDATE ON "CurriculumUnit" TO cmc_app` **chỉ nếu** product muốn app role import (trade-off: mọi process app có thể sửa catalog toàn cục).

---

## (5) Mất vết audit?

| Bề mặt | Có mất? | Evidence |
|--------|---------|----------|
| Bảng `AuditLog` (hàng cũ) | **Không** — migration không đụng | — |
| `worker.cancelSweep.restamp` vẫn ghi audit | **Còn** | `session-done-sweep.ts` ~L140–151; chỉ bỏ field `makeup: false` trong `data` JSON |
| `addMakeup` từng ghi audit? | **Không có** trên develop | `addMakeup` chỉ `classSession.create` + `isMakeup: true`, không `auditLog.create` |
| Metadata makeup trên `ClassSession` | **Mất** (cột drop) | migration L20–23 — đây là “vết nghiệp vụ” không phải AuditLog |
| API cancel result `isMakeup` | Bỏ khỏi DTO | `cancel-session.ts` — không xóa audit DB |

**Kết luận (5):** **Không mất hàng AuditLog.** Mất khả năng **truy vết makeup từ schema** sau migrate; lịch sử audit JSON nếu từng có field makeup (sweep `makeup: false`) vẫn nằm trong log cũ. Gỡ field `makeup: false` khỏi audit **mới** là thu hẹp payload, không purge.

**Mức:** **Low / Suggestion** — nếu compliance cần “session từng là bù”, export trước migrate.

---

## Findings (data & migration lens)

### Critical
*Không có* — không thấy path xóa hàng session/unit/enrollment hoặc corrupt `orderGlobal` đã bán trong migration SQL.

### Important

1. **DROP makeup không cảnh báo / không precheck**  
   - File: `.../20260812120000_.../migration.sql` L20–23  
   - Kịch bản: env đã có `isMakeup=true` → mất cờ/link vĩnh viễn; session null-unit vẫn lệch restamp.  
   - Cần: runbook đếm + quyết định cancel/restamp trước deploy.

2. **Import UPDATE cần quyền owner; `cmc_app` không UPDATE `CurriculumUnit`**  
   - Files: `import-curriculum-units.mjs` L273–282; grants t2i L77–85; wave-A default SELECT/INSERT.  
   - Kịch bản: import bằng app URL → fail / partial catalog; level kẹt `"1"`.

3. **Migrate ≠ nạp 96 unit**  
   - Migration chỉ cast level; catalog đầy đủ phụ thuộc seed/import.  
   - Kịch bản: chỉ `migrate deploy` trên staging/prod → Bright/Black Hole vẫn trống, level `"1"`.

### Suggestion

4. Import không transaction / không xóa orphan ngoài CSV — re-run OK nhưng trục có thể dính unit test.  
5. Audit payload bỏ `makeup: false` — fine; document nếu dashboard từng parse field đó.

---

## Trả lời ngắn 5 câu hỏi

| # | Trả lời |
|---|---------|
| **(1)** | Migration chạy được trên DB có data. Level Int→Text **an toàn kỹ thuật** (`"1"`). Drop makeup **mất cờ/link**, **không** mất hàng session. Thứ tự drop **đúng**. **Không** bắt buộc pre-step SQL; **nên** export makeup + import CSV sau. |
| **(2)** | Mất `isMakeup` + `makeupForSessionId`; session row còn. **Không** có cảnh báo trong migration. Rủi ro restamp nếu buổi bù null-unit còn sống. |
| **(3)** | Chạy được trên 4 unit cũ: upsert **không** conflict unique; **ghi đè** title/level có chủ đích; **giữ id**; chạy 2 lần an toàn (upsert). |
| **(4)** | Global no-RLS **đúng khuôn**. Migration **không** cần GRANT mới để DDL. **`cmc_app` thiếu UPDATE** → import bằng app role **hỏng** trên nhánh update. |
| **(5)** | **Không** mất AuditLog rows; mất vết makeup trên schema; cancelSweep vẫn audit restamp. |

---

## Verdict (lens an toàn dữ liệu & di trú)

**Comment** (không chặn merge thuần SQL; **không Approve** sạch vì Important ops: drop makeup không precheck + import/role + migrate-without-import).

Trên env **chưa production / chưa có makeup thật** (đúng narrative owner “cmc_edu chưa production”): rủi ro thực tế **thấp hơn**, chủ yếu là **quy trình seed sau migrate**.

**Request changes** chỉ nếu merge gate yêu cầu production-hardened migration (export makeup + GRANT/docs import role + post-migrate import bắt buộc trong deploy).

---

## Status

- Review-only: **DONE**  
- Posted to GitHub: **NO** (theo yêu cầu)  
- Code/commit: **NO**
