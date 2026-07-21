---
phase: 3
title: "Docs Sync"
status: completed
priority: P2
dependencies: []
effort: "0.25 day"
---

# Phase 3: Docs Sync

## Overview

Sửa 2 chỗ docs nói sai so với code (đã xác minh trực tiếp trên migration SQL và
source), chốt quyết định RBAC vào tài liệu phân quyền chính thức, và ghi backlog note
cho MCP tool-audit. Docs là nguồn chân lý cho agent + PO trong dự án này — docs sai
là rủi ro "sửa code cho khớp docs sai" ở phiên sau.

## Requirements

- Functional: 4 edit đúng vị trí, khớp thực tế code đã xác minh.
- Non-functional: không đổi nội dung ngoài phạm vi; giữ ngôn ngữ/văn phong từng doc.

## Related Code Files

- Modify: `docs/project-changelog.md` (dòng ~568)
- Modify: `docs/system-architecture.md` (dòng ~189)
- Modify: `docs/14-danh-muc-vai-tro-phan-quyen.md`
- Modify: `docs/HARNESS_BACKLOG.md`

## Implementation Steps

1. **`project-changelog.md:568`** — hiện ghi "RLS policies on 6 tables (Opportunity,
   Student, Enrollment, Receipt, RefundRecord, AuditLog)". Bằng chứng sai: migration
   `packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:96-97`
   ghi rõ AuditLog thuộc nhóm "global identity/audit tables, never facility-scoped
   (TL10 §4 invariant #3)"; không có `ENABLE ROW LEVEL SECURITY` nào cho AuditLog.
   **QUY TRÌNH BẮT BUỘC (red-team R1 AD-1, tinh chỉnh R2 AD-F5):** KHÔNG hardcode
   danh sách thay thế, và PHẠM VI đính chính giới hạn vào chính wave-1 migration —
   KHÔNG đếm tổng số bảng RLS hiện tại (~35 bảng, gồm nhiều bảng thêm sau thời điểm
   dòng changelog này viết — đếm hiện tại sẽ mâu thuẫn nguyên tắc "không viết lại
   lịch sử"). Cách làm: grep `ENABLE ROW LEVEL SECURITY` trong CHÍNH file
   `...wave1_schema_rls/migration.sql` để liệt kê đúng các bảng wave-1 thật sự
   enable RLS (đã xác minh có Contact tại `:105`; AuditLog KHÔNG có). Đính chính
   nêu: (a) AuditLog chưa bao giờ có RLS — immutability là REVOKE (migration
   `20260706150000`), (b) danh sách wave-1 đúng theo grep, thay danh sách sai cũ.
   LƯU Ý: changelog lịch sử — đính chính bằng chú thích ngay tại dòng (pattern
   2026-07-17 sẵn có trong doc), không viết lại lịch sử.
2. **`system-architecture.md:189`** — hiện ghi "PrismaClient — configured with RLS +
   JSON logging". Bằng chứng sai: `packages/db/src/index.ts:26-29` không có `log:`
   option. Sửa: bỏ "+ JSON logging", giữ RLS (đúng).
3. **`docs/14-danh-muc-vai-tro-phan-quyen.md`** — đọc cấu trúc doc trước, thêm mục
   cho module `audit`: `audit.list` = super_admin-only (registry
   `packages/auth/src/index.ts:77` dùng empty-role-array + super_admin bypass trong
   `can()`), ghi rõ đây là quyết định chủ ý (nguồn: journal 260716 + PO xác nhận
   2026-07-19 qua brainstorm A+), để phiên sau không "sửa nhầm" mở quyền.
4. **`docs/HARNESS_BACKLOG.md`** — đọc format hiện có, thêm 2 item:
   a. "MCP tool-call audit: khi walk-phase wire `@modelcontextprotocol/sdk` vào
      `packages/mcp-server` (hiện là skeleton stub — `tools.ts:1-10`), mọi `callTool`
      phải ghi AuditLog (actor=agent principal, tool name, args đã sanitize) ngay từ
      thiết kế — yêu cầu TL13:114 / threat-model T8. Không chờ vá sau như bài học
      OTP-denylist."
   b. (red-team SA-5) "Log shipping trước go-live: rotation 30MB/service (phase 4 plan
      này) đủ chống đầy đĩa nhưng là anti-forensic — attacker có thể flood để cuộn
      trôi dấu vết chính mình; sự kiện bảo mật pre-session (failed login, OTP
      brute-force) chỉ nằm trong stdout logs, không vào AuditLog. Cần ship logs ra
      ngoài host (hoặc tăng trần + cân nhắc) như một hạng mục go-live checklist."
5. Đọc lại 4 doc sau khi sửa — xác minh line refs, ngày tháng, claim khớp thực tế
   (quy tắc documentation-management: verify dates/links/claims sau update).

## Success Criteria

- [x] Changelog đính chính RLS-claim, không viết lại lịch sử
- [x] system-architecture hết claim "JSON logging"
- [x] Doc 14 có mục audit.list = super_admin-only kèm nguồn quyết định
- [x] HARNESS_BACKLOG có item MCP tool-audit (+ log-shipping item)
- [x] Không diff ngoài 4 file trên trong phase này (verified via git status)

## Risk Assessment

- Rủi ro thấp — chỉ docs. Duy nhất cần cẩn trọng: doc 14 là danh mục phân quyền
  chính thức, viết sai role list ở đây tệ hơn không viết — bước 3 bắt buộc trích
  đúng registry source (`packages/auth/src/index.ts:77`) làm nguồn.
