---
phase: 1
title: "Nền dữ liệu thư viện"
status: pending
priority: P1
dependencies: []
---

# Phase 1 — Nền dữ liệu

> **Phải vào cùng Phase 2.** Phase 1 một mình làm vỡ typecheck, phát bài và e2e.

## Lược đồ

**Thêm `ExerciseFolder`** — `id`, `name`, `description?`, `archivedAt?`, `createdById`, `createdAt`.
**Phẳng một cấp**, không tự trỏ.

⚠ **KHÔNG `facilityId`, KHÔNG RLS.** `Exercise` và `CurriculumUnit` là danh mục dùng chung toàn hệ
(QĐ 0021) và router bài tập gọi `ctx.db` không qua `withFacility`. Gắn RLS ⇒ mọi truy vấn trả 0 hàng.
Theo đúng khuôn `Exercise`.

**Sửa `Exercise`:**

| Việc | Ghi chú |
|------|---------|
| Bỏ `curriculumUnitId` + quan hệ + `@@unique([curriculumUnitId, type])` | Gốc nút thắt |
| Thêm `title String` | Bài đang **không có tên**; bỏ unit thì vô danh |
| Thêm `folderId` + `orderInFolder Int` | `@@unique([folderId, orderInFolder])` |
| Giữ `status`, `type`, `maxScore`, `starReward`, `basePdfRef` | Đang dùng thật |

## Migration — ba bước, không gộp

1. `CREATE TABLE "ExerciseFolder"` + `GRANT SELECT, INSERT, UPDATE` cho `cmc_app`
   (mặc định Wave-A chỉ `SELECT`/`INSERT` — thiếu `UPDATE` thì ẩn/đổi tên thư mục bị từ chối quyền)
2. Tạo thư mục **"Chưa phân loại"**; thêm `folderId`/`orderInFolder`/`title` **nullable**;
   backfill (`orderInFolder` **đánh số tuần tự**, `title` suy từ dữ liệu có sẵn); rồi mới `SET NOT NULL`
3. Tạo `UNIQUE (folderId, orderInFolder)` **sau khi** backfill xong; bỏ FK + unique cũ; bỏ cột

## Success Criteria

- [ ] Migration chạy sạch trên DB trắng **và** trên DB đã có bài tập
- [ ] `ExerciseFolder` không có `facilityId`, không RLS, có `GRANT UPDATE`
- [ ] Tạo được nhiều bài `homework` không giới hạn theo unit
