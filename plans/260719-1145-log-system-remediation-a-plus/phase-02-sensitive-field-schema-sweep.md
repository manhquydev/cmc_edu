---
phase: 2
title: "Sensitive-Field Schema Sweep"
status: completed
priority: P1
dependencies: [1]
effort: "0.5 day"
---

# Phase 2: Sensitive-Field Schema Sweep

## Overview

Chuyển denylist PII của audit middleware từ trạng thái "vá reactive sau sự cố OTP"
(journal `docs/journals/260716-super-admin-completion-audit-middleware.md:34-40`)
sang trạng thái đã-quét-chủ-động: rà toàn bộ zod input schema của mọi tRPC mutation,
tìm field nhạy cảm KHÔNG match denylist hiện tại, mở rộng denylist/exclude-list nếu
tìm thấy, và để lại bằng chứng quét.

## Requirements

- Functional: danh sách đầy đủ mọi field name xuất hiện trong input schema của
  mutations toàn `apps/api/src`; phân loại từng field khả nghi; hành động cho mỗi
  field tìm thấy (denylist / exclude-path / xác nhận an toàn kèm lý do).
- Non-functional: không đổi hành vi audit của field không nhạy cảm; test denylist
  cập nhật cho mọi pattern mới.

## Architecture

Denylist hiện tại (`apps/api/src/audit/audit-helpers.ts:73-81`):
regex `/password|otp|token|secret/i` (substring) + exact-match `code` (case-insensitive).

Danh mục từ khoá khả nghi cần đối chiếu khi quét (mở rộng theo ngữ cảnh CMC — dữ liệu
trẻ em + tài chính VN): `pin`, `cccd`, `cmnd`, `passport`, `bankAccount`/`soTaiKhoan`/
`accountNumber`, `answer` (security question), `credential`, `apiKey`, `authorization`,
`signature`, `hash`, `salt`. Free-text fields (`note`, `content`, `comment`) KHÔNG
thuộc phạm vi denylist (không phải secret — đã cân nhắc và loại trong brainstorm).

**Sanitize đệ quy (red-team SA-4):** `sanitizeAuditData` hiện SHALLOW — chỉ strip key
cấp 1 (`audit-helpers.ts:76-78`, không recursion). Input lồng nhau đang mù hoàn toàn:
ví dụ thật `shift.submit` với `entries: z.array(z.object({...}))`
(`apps/api/src/shift/router.ts:64-77`) — field nhạy cảm trong array/nested object sẽ
lọt nguyên vẹn vào AuditLog.data. Phase này PHẢI thêm đệ quy vào `sanitizeAuditData`
(objects + arrays, ~10 dòng) kèm test nested positive/negative — nếu không, sweep này
không được phép tự nhận là "định nghĩa chống-tái-diễn".

## Related Code Files

- Read (sweep): `apps/api/src/**/router.ts`, `apps/api/src/**/*-router.ts` — mọi
  `.input(...)` của `.mutation(...)`
- Modify (nếu có phát hiện): `apps/api/src/audit/audit-helpers.ts` (`sanitizeAuditData`),
  `apps/api/src/trpc.ts` (AUDIT_EXCLUDED_PATHS nếu cần), test tương ứng
- Create: `plans/reports/pii-sweep-260719-audit-denylist-input-schema-report.md`
  (bằng chứng quét — bảng field → verdict → hành động)

## Implementation Steps

1. Enumerate 2-PASS (red-team AD-6 — grep `.input(`/`z.object` một lượt sẽ sót schema
   đặt tên riêng, `.refine`, schema compose):
   - Pass 1: grep mọi `.mutation(` trong `apps/api/src` → danh sách path + biểu thức
     truyền vào `.input(...)` của từng mutation.
   - Pass 2: với mỗi `.input(X)` mà X là identifier (schema const/import), resolve
     đến định nghĩa gốc (kể cả file schema riêng) và trích field từ đó; với schema
     compose (`.merge`, `.extend`, spread) phải trích từ mọi nguồn.
   Đối chiếu path với AUDIT_EXCLUDED_PATHS (path đã exclude + tự audit tay → kiểm tra
   call site manual audit đó có ghi field nhạy cảm không, thay vì chỉ kiểm middleware).
2. Đối chiếu từng field với denylist hiện tại + danh mục khả nghi ở Architecture.
3. Với mỗi field lọt lưới: quyết định denylist-regex mở rộng vs exact-match mới vs
   exclude-path — ưu tiên exact-match cho tên ngắn dễ va chạm (bài học `code`:
   regex substring `code` sẽ nuốt nhầm `facilityCode`, `receiptCode` — phải exact).
   **RÀNG BUỘC CỨNG (red-team R2 — cả 3 reviewer hội tụ):** `hash`, `salt`,
   `signature` nếu thêm thì BẮT BUỘC exact-match, KHÔNG substring — Phase 1 ghi các
   field reserved-safe `resultHash`/`resultLength`/`promptVersion`/`model` qua
   sanitizeAuditData; substring `hash` sẽ strip lặng lẽ resultHash (tamper-evidence
   của Phase 1). Thêm negative test: object chứa `resultHash` đi qua
   sanitizeAuditData phải giữ nguyên field này.
4. Nếu sửa `sanitizeAuditData`: chạy `gitnexus_impact({target: "sanitizeAuditData",
   direction: "upstream"})` trước; thêm test case cho từng pattern mới (cả positive
   lẫn negative — field hợp lệ chứa chuỗi tương tự KHÔNG bị strip).
5. Viết report bằng chứng quét vào `plans/reports/` (bảng: path, field, verdict,
   hành động). Nếu quét sạch → report vẫn phải tồn tại, ghi "no findings" kèm
   phương pháp — đây là deliverable chống-lặp-lại-sự-cố-OTP, không phải optional.
6. Thêm đệ quy vào `sanitizeAuditData` (Architecture) + test nested (field nhạy cảm
   trong array-of-objects bị strip; field hợp lệ nested không bị strip oan).
7. **Gate test: FULL suite `pnpm --filter @cmc/api test` + typecheck** — KHÔNG chỉ
   `-- audit` (red-team FMA-4: denylist/sanitize chạy trên MỌI mutation qua
   middleware `trpc.ts:162`; over-strip regression ở module khác chỉ lộ khi chạy đủ).
   LƯU Ý filter là `@cmc/api`, không phải `api` (AD-3).

## Success Criteria

- [x] Report quét tồn tại trong plans/reports/, liệt kê đủ mutation input fields
      (phương pháp 2-pass ghi rõ trong report)
- [x] Mọi field khả nghi có verdict + hành động; denylist/test cập nhật tương ứng
      (0 field mới cần denylist; 1 pre-existing over-strip quan sát được — `room.create.code`
      — ghi vào report như backlog candidate, không sửa vì Rollback cấm thu hẹp)
- [x] `sanitizeAuditData` đệ quy nested objects/arrays, có test nested 2 chiều
- [x] Test negative: field hợp lệ (vd `facilityCode`) không bị strip oan
- [x] FULL test suite `@cmc/api` (897/897) + typecheck xanh

## Rollback

Sửa đổi gói gọn trong `audit-helpers.ts` + tests (+ `trpc.ts` nếu thêm exclude-path).
Commit riêng cho phase → revert nguyên tử. Denylist chỉ mở rộng (thêm pattern), không
thu hẹp — revert đưa về mức bảo vệ hiện tại, không tạo lỗ hổng mới.

## Risk Assessment

- **Over-stripping (false positive)**: exact-match ưu tiên hơn regex substring cho
  tên ngắn; test negative bắt buộc ở bước 4.
- **Sweep sót do input schema đặt ở file riêng** (vd `schemas.ts` import vào router):
  bước 1 phải grep theo `.input(` chứ không chỉ theo tên file router.
- **Phạm vi nở**: nếu phát hiện field cần xử lý phức tạp hơn denylist (vd cần mã hoá
  cột theo QĐ 0026), ghi vào report + backlog, KHÔNG tự mở rộng phase.
