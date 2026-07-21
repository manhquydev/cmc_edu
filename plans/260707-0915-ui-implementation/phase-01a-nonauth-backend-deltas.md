# Phase 01a — Backend deltas (non-auth): mã SO + ReceiptDto + ngưỡng + session.me + teacher-annotation

## Context links
- `docs/06` §3C (route finance), `docs/11` (API), `docs/16` (ADR-B second-eye = role-elevation), `docs/19`.
- Red-team findings áp dụng: H1 (over-threshold role-elevation), H2 (ReceiptDto createdById), C3 (teacher-annotation writer), M1/M4 (mã SO + test), M5 (framing session.me), L3 (pad tràn).

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: pending · Review gate: **reviewer 1 vòng** (finance read-delta + teaching writer; adversarial-spot cho teacher-annotation vì ghi dữ liệu bài trẻ).
- Tách từ phase-01 (vượt 1 story-boundary sau khi phình theo red-team). 01a = phần KHÔNG chạm auth-substrate → chặn phase 02/03/04. 01b = auth 2 tầng (chặn 07). 01a và 01b độc lập, có thể chạy song song.

## Key insights
- Mã phiếu hiện `PT-000001` (`packages/domain-finance/src/receipt-code.ts:17`, hàm thuần). Đổi → `SO` + pad-5 tăng dần, **KHÔNG gạch** → `SO00183` (khớp wireframe). Counter atomic (`ReceiptCodeCounter`) giữ nguyên.
- **Over-threshold là ROLE-ELEVATION, KHÔNG phải 2 chữ ký** (H1): phiếu >20tr phải do `giam_doc_dao_tao`/`super_admin` duyệt — **một người như vậy duyệt một mình** (`finance/router.ts:184-193`). `APPROVAL_SECOND_EYE_THRESHOLD=20_000_000` là hằng số code (`finance/router.ts:34`), chưa procedure nào expose.
- **ReceiptDto không expose `createdById`** (H2, `finance/router.ts:76-88`) — UI không tính được self-approval để ẩn nút trước; server chặn bằng `createdById` (`:180`). Cần thêm cờ.
- **Teacher-annotation CHƯA có writer** (C3): `annotationLayer` chỉ ghi qua `submission.saveDraft` = **lmsProcedure/học sinh** (`submission/router.ts:3-4`). Thủ tục GV là `grade` (chỉ `{submissionId, score}`, `:25-36`) — KHÔNG lưu chú thích GV. QĐ#4 vòng trước ("backend đã có, verified") SAI cho phía GV.
- **`session.me` KHÔNG "server-authoritative" dưới dev-header** (M5): danh tính staff do client tự khẳng định qua `x-dev-user` (`context.ts:22-24,68-76`); `session.me` chỉ echo lại. "Authoritative" chỉ đúng SAU Entra SSO. Server `can()` vẫn là gate thật.

## Requirements
1. **Mã SO** (M1): `nextReceiptCode` → `SO` + `padStart(5,'0')` + counter, không gạch → `SO00183`. Giữ mã `PT-` đã cấp. Cập nhật **cả 2** test: `receipt-code.test.ts` + `finance/create-from-opp.test.ts:62` (`toMatch(/^PT-\d{6}$/)` → SO format). (M4). Ghi chú L3: `padStart(5)` tự nới ≥6 số khi >99999 (`SO100000`) — không bug, chỉ lệch style wireframe.
2. **ReceiptDto expose approval-context** (H2): thêm `createdById` HOẶC cờ dẫn xuất `canApprove`/`isSelfDrafted` vào ReceiptDto (`finance/router.ts:76-88`) để UI ẩn nút duyệt cho người lập + role không đủ quyền TRƯỚC khi gọi (không mời hành động cấm).
3. **Expose ngưỡng + semantic over-threshold** (H1): thêm ngưỡng `APPROVAL_SECOND_EYE_THRESHOLD` vào `session.me` (hoặc procedure config finance) để UI đọc, KHÔNG hardcode. Cùng cờ `canApprove` (req2) đã phản ánh role-elevation → UI chỉ cần ẩn/disable nút cho role không phải second-eye khi phiếu vượt ngưỡng.
4. **`session.me`** (M5): procedure protectedProcedure trả `{userId, roles, facilityId, config:{approvalSecondEyeThreshold}}`. Framing: **client-side mirror của dev-header**, trở thành authoritative sau SSO. UI dùng cho nav gate + ẩn nút; **server `can()` là gate bảo mật thật**.
5. **Teacher-annotation writer** (C3): thêm endpoint lưu `annotationLayer` của GV trên submission — **tách với `saveDraft` của HS** (writer riêng, protectedProcedure + `can('submission','grade')`), cùng cap 1MB (tái dùng `assertAnnotationLayerSize`), audit actor = GV. Trường lưu: cân nhắc cột annotation riêng cho GV hoặc namespaced trong annotationLayer (chốt ở spec build — tránh ghi đè lớp vẽ của HS).

## Architecture notes
- Teacher-annotation: KHÔNG trộn vào lớp annotation của HS (append-mindset, không ghi đè bài trẻ). Hoặc thêm `teacherAnnotationLayer` (cột JSON mới) hoặc sub-key. Ưu tiên cột riêng để phân tách rõ actor + audit.
- Ngưỡng expose qua `session.me.config` giữ 1 nguồn (DRY) — UI không định nghĩa lại 20tr.
- `createdById`/`canApprove`: tính `canApprove` server-side (đã biết subject) an toàn hơn expose raw `createdById` (giảm rò danh tính nội bộ) — ưu tiên cờ dẫn xuất.

## Related code files
- Sửa: `packages/domain-finance/src/receipt-code.ts` (+ `receipt-code.test.ts`); `apps/api/src/finance/create-from-opp.test.ts:62` (M4).
- Sửa: `apps/api/src/finance/router.ts` (ReceiptDto + expose canApprove/threshold).
- Sửa: `apps/api/src/submission/router.ts` (teacher-annotation writer) + test.
- Thêm: `apps/api/src/session/router.ts` (`session.me`) + mount `apps/api/src/router.ts`.
- Sửa (nếu cần cột): `packages/db/prisma/schema.prisma` (teacherAnnotationLayer) + migration.

## Implementation steps
1. `nextReceiptCode` → SO pad-5 + cập nhật 2 test (receipt-code + create-from-opp).
2. ReceiptDto thêm `canApprove` (dẫn xuất từ subject vs createdById + role vs ngưỡng).
3. `session.me` + expose `approvalSecondEyeThreshold`.
4. Teacher-annotation writer (protected + can grade + cap 1MB + audit) + migration nếu thêm cột.
5. Test: format SO, canApprove đúng (self/role/threshold), session.me, teacher-annotation gate + size + append.

## Todo list
- [x] Mã SO `SO00183` (pad-5) + 2 test (receipt-code + create-from-opp)
- [x] ReceiptDto canApprove (server-derived, 3-condition: notSelf+secondEye+permission)
- [x] session.me + expose ngưỡng 20tr (`apps/api/src/session/router.ts`)
- [x] Teacher-annotation writer + cap 1MB + audit (`submission.saveTeacherAnnotation`)
- [x] Migration teacherAnnotationLayer (cột riêng JSONB nullable)
- [ ] Test suite xanh — **BLOCKED: PostgreSQL service stopped (cần `net start postgresql-x64-18` với quyền admin để chạy integration tests)**

## Success criteria
- `nextReceiptCode` sinh `SO00183` (pad-5, không gạch); cả `receipt-code.test.ts` + `create-from-opp.test.ts` xanh (không còn assert `PT-`).
- ReceiptDto trả `canApprove`: false cho người lập + false cho role không second-eye khi >20tr; UI ẩn nút đúng.
- `session.me` trả subject + ngưỡng; UI đọc ngưỡng từ đây (grep xác nhận không hardcode 20tr ở FE).
- Teacher-annotation lưu được qua endpoint GV (gate `submission.grade`), cap 1MB, KHÔNG ghi đè lớp HS, có audit actor GV.
- **Verify**: `pnpm -F @cmc/domain-finance test`, `pnpm -F @cmc/api test`, typecheck+build, migrate dry-run.
- **Review**: reviewer 1 vòng + spot adversarial teacher-annotation (ghi dữ liệu bài trẻ).

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| Đổi SO gãy test ẩn khác ngoài 2 test đã biết | TB×TB | grep toàn repo `PT-\\d` trước sửa; cập nhật seed/e2e |
| `canApprove` tính sai (lộ/ẩn nhầm nút) | TB×Cao | tính server-side; test 3 case self/role/threshold |
| Teacher-annotation ghi đè bài HS | TB×Cao | cột/namespace riêng; append-mindset; test |
| Expose createdById rò danh tính nội bộ | Thấp×TB | ưu tiên cờ dẫn xuất `canApprove` thay raw id |

## Security considerations
- Teacher-annotation là ghi dữ liệu bài trẻ → gate `submission.grade`, audit actor, không cho HS ghi lớp GV và ngược lại.
- `session.me` chỉ trả roles/facility/threshold — không dữ liệu nhạy cảm; framing dev-header rõ (M5).
- Ngưỡng tiền expose là số cấu hình, không bí mật.

## Next steps
→ phase-02 dùng `session.me` + ngưỡng; phase-03 dùng `canApprove` + ResultPanel; phase-04 dùng teacher-annotation writer. 01b (auth) chạy song song.
