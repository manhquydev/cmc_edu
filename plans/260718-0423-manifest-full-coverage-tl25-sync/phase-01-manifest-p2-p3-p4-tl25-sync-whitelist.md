---
phase: 1
title: Manifest P2+P3+P4 + TL25 sync + whitelist
status: completed
priority: P1
dependencies: []
effort: 1 session
---

# Phase 1: Manifest P2+P3+P4 + TL25 sync + whitelist

## Overview

Chép 24 luồng P2/P3/P4 từ TL25 §2 (docs/25:30-53) vào `flow-manifest.ts`, đối chiếu từng symbol với kết quả scanner (E1/E2), sửa TL25 tại chỗ lệch (E5), điều chỉnh whitelist (E4).

## Requirements

- Functional: 24 FlowEntry mới (P2-01…08, P3-01…11, P4-01…05) với displayName tiếng Việt lấy từ cột "luồng" TL25; mỗi entry ≥1 expected symbol (E3 — guard verify.ts).
- Non-functional: mode tĩnh vẫn < 30s; không sửa engine ngoài whitelist const.

## Architecture

Quy trình per-flow (lặp 24 lần, đã chứng minh ở P1):
```
TL25 row → nháp expected {trpc, uiRoutes, models}
  → đối chiếu trpc với verification.json orphan list / trpc-scanner output (namespace.procedure thật)
  → đối chiếu route với route-scanner output (full path compose thật)
  → models từ schema.prisma (prisma-scanner đã có list 50 models)
  → lệch TL25 → NOTE trong manifest + sửa docs/25 dòng tương ứng (E5)
```

Nguồn đối chiếu nhanh: chạy `pnpm acceptance:report` giữa chừng — luồng vừa thêm bị đỏ = mapping sai hoặc lệch docs, sửa ngay theo code trước khi thêm tiếp (feedback loop của chính tool).

Drift đã xác minh trước bằng red-team (R1-A3/A4/A6/S5 — không phải phỏng đoán, đã grep route tree thật):
- P2-04: TL25 `/curriculum/:unitId/exercises` → thật `/teaching/exercises` (không có prefix `/curriculum` nào).
- P2-07: TL25 `/teaching/report-cards/:id` → thật `/admin/report-cards` (KHÔNG có `:id`; admin.routes.tsx:80 có comment giải thích vì sao nằm dưới /admin).
- P2-08: TL25 `LMS /child/:id` → thật `/parent/evidence/:studentId` — **ParentOnly** (E2 actor-rule: ảnh buổi học của trẻ là parent-mediated TL08§7, TUYỆT ĐỐI không map sang `/student/*`).
- P2-03/P2-05 (StudentOnly): `/child/:id/exercises*` → `/student/exercise/:exerciseId`.
- P4-01/P4-02: TL25 `/engagement/rewards` → thật `/admin/engagement/rewards`.
- P4-03: `/parent-meetings` KHÔNG tồn tại; route thật `/crm/post-sale-meeting` nhưng page là EmptyState residual CHƯA gọi API (crm.routes.tsx:7-11) → claim route thật + NOTE gap "UI chưa wired — structural pass, luồng chưa dùng được" (V2); tính vào documented gaps.
- P4-02: TL25 `gift.archive` KHÔNG tồn tại (scanner chỉ có gift.list/listForStudent/upsert) — sửa TL25 cột API luôn.
- P3-05 gộp nhiều namespace (payslip + salaryTier + compensation.assignTier) — liệt kê đủ procedure TL25 nêu (đã verify tồn tại 100%).
- P3-10/P3-11 worker: models-only (ClassSession, Attendance, KpiScore theo bản chất từng worker) + NOTE "internal worker, không procedure" (E3).
- E1 mở rộng: claim thêm procedure phụ phục vụ đúng màn hình WF (vd `submission.listForGrading` cho P2-06, `attendance.listBySession` cho P2-02) kèm 1 dòng lý do — KHÔNG staple procedure không liên quan (E7).

## Related Code Files

- Modify: `scripts/acceptance-report/flow-manifest.ts` (+24 entries)
- Modify: `scripts/acceptance-report/verify.ts` (CHỈ `INFRA_NAMESPACE_WHITELIST` — E4, bước cuối phase khi biết ADMIN flows sẽ nhận namespace nào; có thể dời sang Phase 2 nếu ADMIN chưa khai)
- Modify: `docs/25-ma-tran-truy-vet-p1.md` (4 điểm P1 đã flag + lệch mới P2-P4; chỉ cột API/UI — E5)

## Implementation Steps

1. Sửa **5** điểm lệch P1 trong TL25 (NOTE có sẵn trong flow-manifest.ts: P1-02, P1-03, P1-05, P1-09 sửa giá trị; **P1-06 XOÁ claim route `/child/link-request`** — không tồn tại, không có giá trị thay thế; ô UI còn lại `/parents/:id` vẫn coherent — E5). Sau khi sửa TL25, cập nhật các NOTE tương ứng trong flow-manifest.ts thành dạng quá khứ ("TL25 đã sync 2026-07-18") để NOTE không stale (R2-nit).
2. Thêm 8 luồng P2 theo quy trình per-flow; chạy `pnpm acceptance:report` sau cụm — mọi luồng built hoặc đỏ-có-giải-thích.
3. Thêm 11 luồng P3 (chú ý P3-05 multi-namespace, P3-10/11 models-only); chạy lại report.
4. Thêm 5 luồng P4; chạy lại report.
5. Gom danh sách lệch TL25 mới phát hiện ở bước 2-4 → sửa docs/25 một lượt (cột API/UI), NOTE tương ứng trong manifest.
6. Typecheck `tsc --strict` cho verify.ts (manifest là dependency).

## Success Criteria

- [ ] 24 luồng P2/P3/P4 trong manifest, tổng 33 luồng WF-code TL25
- [ ] `pnpm acceptance:report` sạch; không false-red (đỏ/partial nào còn lại có giải thích trong NOTE — P4-03 gap là hợp lệ)
- [ ] Orphan giảm đáng kể (observational — E7; KHÔNG có target số cứng ở phase này)
- [ ] TL25 đã sync: 5 điểm P1 (4 sửa + 1 xoá) + drift P2-P4 đã liệt kê + lệch mới nếu có; corpus không bị sửa gì ngoài cột API/UI; actor-guard được giữ đúng (P2-08 parent-route)
- [ ] Typecheck sạch

## Risk Assessment

- **TL25 P2-P4 lệch nhiều hơn dự kiến** → per-flow feedback loop (chạy report giữa chừng) chặn lệch lan; mỗi lệch vài phút.
- **Route LMS khó map** (`/child/:id/*` không tồn tại — LMS thật dùng `/parent/*`+`/student/*`) → route-scanner output là danh sách đóng 57 routes; map theo bản chất luồng, NOTE lệch.
- **Sửa nhầm nội dung corpus TL25** → diff review giới hạn: chỉ dòng bảng §2, chỉ cột API/UI (E5).
