---
phase: 1
title: "Actor contract & manifest truth"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Actor contract & manifest truth

## Overview

Trường `actorRoles` trong sổ nghiệm thu hiện là **văn bản trang trí**: kiểu `string[]`, không ai kiểm chứng. Phase này biến nó thành hợp đồng có hiệu lực — sai vai thì đỏ ngay lúc typecheck, mâu thuẫn vai↔quyền thì đỏ lúc chạy report.

## Requirements

**Functional**
- Manifest chỉ nhận role có thật trong `@cmc/auth`.
- `verify.ts` khẳng định hai chiều: mọi procedure của luồng có ≥1 actor gọi được; mọi actor khai báo gọi được ≥1 procedure.
- Vi phạm → exit code ≠ 0 (không chỉ cảnh báo), để CI chặn được.

**Non-functional**
- Chạy tĩnh, không cần DB, không cần server — giữ `pnpm acceptance:report` vẫn là một lệnh.
- Không tăng đáng kể thời gian chạy report.

## Architecture

Nguồn sự thật đã có sẵn, chỉ chưa nối vào nhau:

```
packages/auth/src/index.ts   ROLES / ACTIVE_ROLES  ─┐
                             PERMISSIONS map       ─┼─→ permission → roles[]
apps/api/src/router.ts       appRouter (ts-morph)  ─┤
apps/api/src/**/router.ts    requirePermission()   ─┴─→ "ns.proc" → permission

                                     ↓
                    flow.expected.trpc × flow.actorRoles
                                     ↓
                    ORPHAN-PROC / IDLE-ACTOR assertions
```

**Loại khỏi phép tính:** `super_admin` (bypass registry — `packages/auth/src/index.ts:147` (hàm `can()`)), `he_thong`, `agent` (không phải vai người dùng), và các subject LMS (`phu_huynh`, `hoc_vien`) vốn không nằm trong staff `Role`.

> Quyết định cần cân nhắc khi thực thi: `phu_huynh`/`hoc_vien` **không** thuộc `Role` của `@cmc/auth` (staff enum) nhưng là actor thật ở tầng LMS. Nếu siết `actorRoles: Role[]` cứng thì P1-06/P1-07/P2-03/P2-05/P4-01 sẽ gãy typecheck. → Cần union type riêng: `type FlowActor = Role | 'phu_huynh' | 'hoc_vien' | 'he_thong' | 'agent'`, và chỉ phần `Role` mới bị đưa vào phép tính permission. **Đây là điểm dễ làm sai nhất của phase này.**

## Related Code Files

- Modify: `scripts/acceptance-report/types.ts` — `actorRoles: string[]` → `FlowActor[]`
- Modify: `scripts/acceptance-report/flow-manifest.ts` — sửa 3 luồng khai `nhan_vien`
- Modify: `scripts/acceptance-report/verify.ts` — thêm assertion actor↔permission
- Create: `scripts/acceptance-report/scanners/permission-scanner.ts` — `ns.proc → permission → roles`
- Read-only tham chiếu: `packages/auth/src/index.ts`, `apps/api/src/router.ts`

## Implementation Steps

1. **Viết `permission-scanner.ts`** (ts-morph, theo D5): đi từ `appRouter` trong `apps/api/src/router.ts` theo import graph — **tái dùng đúng cách `trpc-scanner.ts` đang làm**, không viết lại bằng regex. Xuất `Map<"ns.proc", "module.action">` và `Map<"module.action", Role[]>`.
   - Xử lý được: `mergeRouters(...)` (guardian, exercise), một file export nhiều router (payroll → 4 key), file ngoài pattern `router*.ts`.
   - Thêm liveness guard giống các whitelist hiện có: nếu scanner ra 0 permission → ném lỗi (im lặng ra rỗng là cách nói dối mới).

2. **Đổi kiểu `actorRoles`** trong `types.ts` sang `FlowActor[]` (union nêu ở Architecture). Chạy `pnpm typecheck` → **kỳ vọng đỏ** ở 3 luồng khai `nhan_vien`.

3. **Sửa 3 luồng khai `nhan_vien`** trong `flow-manifest.ts`, kèm comment 1 dòng ghi rõ nguồn suy luận:
   - `P3-01` (chấm công) → `['giam_doc_kinh_doanh','giam_doc_dao_tao','sale','giao_vien']` (các vai có `checkIn.punch`)
   - `P4-01` (đổi quà) → `['hoc_vien','giam_doc_kinh_doanh','giam_doc_dao_tao','sale']` (`rewards.manage` + học viên đổi quà)
   - `P4-03` (họp PH) → `['giam_doc_kinh_doanh','giam_doc_dao_tao','sale']` (`parentMeeting.manage`)
   - ⚠️ Đây là **suy luận từ registry, chưa được PO xác nhận** — ghi rõ trong comment để dễ bác.

4. **Thêm assertion vào `verify.ts`**: với mỗi luồng, tính `orphanProcs` và `idleActors`; gom vào kết quả và **fail** khi có vi phạm. Đưa vào `VerificationResult` để tab Builder hiển thị được.

5. **Xử lý các vi phạm còn lại** (hiện 7/38 luồng). Ba nhóm, xử lý khác nhau:
   - **Sửa manifest** khi manifest sai (P1-06 thiếu actor staff duyệt liên kết — `guardian.approveLink` là việc của staff, không phải phụ huynh).
   - **Chuyển sang Phase 2** khi code sai (P2-04 IDLE-ACTOR `giao_vien`; các luồng vướng `class.create`).
   - **Khai ngoại lệ có lý do** khi cố ý (P1-09 `audit.list` là super_admin-only theo thiết kế ADMIN) — dùng đúng mẫu `DOCUMENTED_GAPS` đã có, mỗi mục 1 dòng lý do, kèm liveness guard.

6. Chạy `pnpm acceptance:report` → còn vi phạm nào phải là vi phạm **đã được giải thích**, không phải vi phạm bị bỏ qua.

## Test / Validation

- `pnpm typecheck` — xanh sau khi sửa manifest.
- **Falsification test (bắt buộc):** tạm đưa `'nhan_vien'` vào một `actorRoles` → `pnpm typecheck` phải **đỏ**; hoàn nguyên. Không làm bước này thì không có bằng chứng hợp đồng thật sự có hiệu lực.
- **Falsification test 2:** tạm đổi `actorRoles` của một luồng sang vai không có quyền → `pnpm acceptance:report` phải **exit ≠ 0**; hoàn nguyên.
- Đơn vị cho `permission-scanner.ts`: khẳng định `classBatch.list → class.create`, `user.list → user.manage`, và namespace qua `mergeRouters` (`guardian.*`) resolve đúng.

## Success Criteria

- [ ] `actorRoles` không còn nhận chuỗi tuỳ ý; `nhan_vien` gây đỏ typecheck (đã kiểm chứng bằng falsification test)
- [ ] `permission-scanner.ts` resolve đúng qua `mergeRouters` và file export nhiều router
- [ ] `pnpm acceptance:report` exit ≠ 0 khi có ORPHAN-PROC hoặc IDLE-ACTOR chưa được giải thích
- [ ] 7 luồng vi phạm hiện tại: mỗi luồng có kết luận rõ — sửa manifest / chuyển Phase 2 / khai ngoại lệ có lý do
- [ ] `super_admin`, `he_thong`, `agent` bị loại khỏi phép tính actor

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Siết `Role[]` cứng làm gãy các luồng có actor LMS (`phu_huynh`, `hoc_vien`) | **Cao** | Dùng union `FlowActor`; chỉ nhánh `Role` vào phép tính permission. Chạy typecheck ngay sau bước 2 để lộ sớm |
| Scanner regex-first sai như prototype brainstorm (13/40 màn) | Cao | D5 bắt buộc ts-morph; tái dùng `trpc-scanner.ts` |
| Suy luận actor cho 3 luồng `nhan_vien` sai ý PO | Trung bình | Comment ghi rõ nguồn suy luận; đưa vào mục câu hỏi của `plan.md`; PO bác thì sửa 1 dòng |
| Biến ngoại lệ thành nơi giấu lỗi | Trung bình | Mỗi ngoại lệ 1 dòng lý do + liveness guard (mẫu `DOCUMENTED_GAPS` đã có); review lại danh sách ở Phase 6 |
