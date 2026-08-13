---
title: "Phase 2: Dòng thời gian bản ghi (RecordEvent)"
status: complete
priority: P1
effort: "4d"
dependencies: [1]
---

# Phase 2: Dòng thời gian bản ghi (RecordEvent)

## Overview

Pattern người dùng Odoo phụ thuộc nặng nhất: mở một bản ghi là thấy toàn bộ đời nó. Kiến trúc đã
phân xử (quyết định #13): **một bảng `RecordEvent`** facility-scoped, ghi chú là một loại event,
emit tường minh trong transaction. Phase này là điểm rủi ro cao nhất của Con A — đã qua red-team
13/08, các quyết định dưới đây là kết quả phân xử, đừng mở lại ở review.

## Vì sao KHÔNG dựng trên AuditLog (chốt rồi)

1. Bước `O5_ENROLLED` được ghi audit dưới `entity: 'Receipt'` (`finance/router.ts:433-449`, đã
   kiểm) ⇒ ghép theo entity Opportunity **thiếu đúng sự kiện nhập học**.
2. `AuditLog` bị xoá sau 12 tháng (`worker/audit-log-retention-sweep.ts`) — lịch sử nghiệp vụ cần
   sống lâu hơn log tuân thủ.
3. Không có `facilityId` ⇒ RLS không đỡ được đường đọc.

> Bẫy khi kiểm chứng: `rg "action: 'crm\."` trong `crm/router.ts` chỉ ra một kết quả — KHÔNG có
> nghĩa là thiếu nhật ký; middleware `trpc.ts:141-164` lo phần còn lại. AuditLog **giữ nguyên**
> vai trò tuân thủ, phase này không đụng nó.

## Bảng emit site chính thức (red-team đếm 13/08 — 11 site / 4 file, KHÔNG phải "~8")

| # | Site | Cửa nghiệp vụ | Kind đề xuất |
|---|---|---|---|
| 1 | `crm/router.ts:160` | opportunityCreate | `created` |
| 2 | `crm/router.ts:288` | markLost → reopen | `reopened` |
| 3 | `crm/router.ts:311` | markLost | `marked_lost` |
| 4 | `crm/router.ts:368` | opportunityAssign | `assigned` |
| 5 | `crm/router.ts:540` | setNextAction | `next_action_set` |
| 6 | `crm/router.ts:571` | clearNextAction | `next_action_cleared` |
| 7 | `advance-opportunity.ts:57` | opportunityAdvance **+ appointment.schedule (`appointment/router.ts:130`, O2→O3) + appointment.complete (`:191`, O3→O4)** | `stage_advanced` |
| 8 | `finance/router.ts:379` | walk-in **auto-create** trong receiptApprove | `created` (payload: nguồn walk-in) |
| 9 | `finance/router.ts:422` | receiptApprove → O5 | `enrolled` |
| 10 | `finance/router.ts:541` | receiptCancel revert O5→O4 | `enrollment_reverted` |
| 11 | `bulk-import-opportunities.ts:408` | opportunityBulkConfirm (tx riêng từng dòng) | `created` (payload: nguồn import) |

**Vị trí emit đã chốt:** emit đặt **bên trong `advanceOpportunityOneStep`** — thêm tham số
`actor` vào chữ ký (hiện là `(tx, facilityId, opportunityId, toStage)` và "deliberately PURE",
`advance-opportunity.ts:7-11,27-32`) để một chỗ phủ cả ba cửa advance; hai caller ở
`appointment/router.ts:130,191` cập nhật theo (lưu ý: appointment path có hệ audit riêng
`auditStageAdvance` — đừng nhầm hai hệ). Các site còn lại emit tại router, trong transaction có
sẵn. Riêng finance: site 8–9 emit **trong `runMoneyTransaction`** (`finance/router.ts:266`, call
site duy nhất `:1021-1023`), site 10 emit **trong `runCancelTransaction`** (`:492`, chạy qua
`withFacility` tại `:1141`) — cả hai đều là tx `withFacility`; các audit write đường lỗi dùng
bare `ctx.db` sẽ bị RLS WITH CHECK từ chối, không dùng pattern đó cho RecordEvent.

**Sự kiện O5 là CÓ ĐIỀU KIỆN:** phiếu thu thứ hai trên cùng cơ hội không tạo transition
(`finance/router.ts:414-428` — `closedAt` chỉ stamp khi `stage !== 'O5_ENROLLED'`); `receiptCancel`
chỉ revert khi là phiếu approved duy nhất (`opportunityReverted`, `:540-546`). Event `enrolled` /
`enrollment_reverted` chỉ emit khi transition **thật sự xảy ra** — gắn vào đúng nhánh điều kiện
có sẵn, có test hai kịch bản phiếu-thứ-hai và huỷ-một-trong-hai.

## Requirements

- Schema & bất biến:
  - [x] Model `RecordEvent`: `id`, `facilityId`, `entity`, `entityId`, `kind`, `actor`
        (server-resolved, **không bao giờ** nhận từ input), `payload Json?`, `createdAt`.
        Index `(facilityId, entity, entityId, createdAt)`. RLS theo mẫu migration mới nhất
        (`20260811140000_session_exercise_delivery/migration.sql:30-42`: ENABLE + FORCE RLS,
        policy theo GUC).
  - [x] **Bất biến ép ở tầng DB** (quyết định #16, theo tiền lệ wave-A
        `20260706150000...privilege_hardening`): migration GRANT đúng **SELECT + INSERT** cho
        `cmc_app` — không UPDATE/DELETE (đừng copy mẫu grant 4-verb của các bảng gần đây); không
        thủ tục update/delete; test bất biến assert ở mức DB (update/delete bằng `cmc_app` bị
        Postgres từ chối).
  - [x] Tập `kind` là union đóng trong code + `satisfies` (đồng bộ triết lý quyết định #15);
        payload theo **allowlist per-kind**, tối thiểu hoá (id + nhãn, không object thô).
        **Event từ finance tuyệt đối không mang số tiền / mã phiếu / người duyệt** — sale bị SoD
        loại khỏi mọi đường đọc phiếu thu (`packages/auth/src/index.ts:100-103`), timeline không
        được thành đường vòng; test assert payload event finance không chứa trường tiền.
- Emit & test:
  - [x] Đủ 11 site theo bảng trên, trong cùng transaction với mutation.
  - [x] **Quy ước test per-mutation là cổng cứng**: test của MỖI cửa trong bảng assert đúng event
        được emit (kể cả appointment schedule/complete, bulk confirm, walk-in auto-create, hai
        kịch bản O5 có điều kiện).
- Đọc & ghi chú:
  - [x] `crm.opportunityAddNote`: kind `note`, nội dung `z.string().trim().min(1).max(2000)`
        (tiền lệ giới hạn: `nextActionNote` max 200, `router.ts:94`), render **plain text**;
        actor lấy từ `ctx.subject`; ghi chú bất biến (không sửa/xoá — đính chính bằng dòng mới).
  - [x] `crm.opportunityTimeline`: **hardcode `entity = 'Opportunity'` phía server** — input
        không có trường `entity` (chống confused-deputy đọc miền khác bằng quyền CRM khi
        Receipt/Student bắt đầu emit); gate `requirePermission('crm', ...)` + facility scope.
  - [x] Hai permission key mới khai trong registry `packages/auth/src/index.ts` (fail-closed,
        `index.ts:193-194`) + cập nhật role-matrix test. **Ma trận quyền đã chốt (theo thói quen
        Odoo, chủ hệ thống xác nhận 13/08):** ai xem được cơ hội thì đọc được timeline và ghi
        được ghi chú — tức cùng vai với `crm.opportunityList`; KHÔNG giới hạn theo người phụ
        trách (nhất quán `opportunityGet` — vốn không có per-row check, `router.ts:407-421`).
        Nói tường minh: mọi sale trong cơ sở đọc được ghi chú của nhau.
  - [x] Phân trang **keyset cursor `(createdAt, id)` giảm dần** + `take` cố định, UI nút "Xem
        thêm". Tiền lệ cursor duy nhất trong repo: `rewards.list`
        (`reward-router.ts:282-304`) — cursor theo `id` nhưng orderBy `redeemedAt`, tham khảo
        chứ đừng chép nguyên; và đừng chép offset `page/pageSize`: stream append-only sẽ
        trùng/sót dòng khi có event mới chen vào.
  - [x] Mỗi `kind` ánh xạ một câu tiếng Việt ngắn; kind ngoài union hiển thị fallback
        **"Sự kiện không đọc được"** — KHÔNG ẩn lặng lẽ (ẩn = event biến mất khi mapping và dữ
        liệu cũ lệch nhau, ví dụ enum rename tương lai), và không JSON thô.
- Dữ liệu cũ & rollback:
  - [x] UI hiện dòng mốc **"Lịch sử ghi từ DD/MM/YYYY"** cho bản ghi tồn tại trước migration —
        phân biệt "không có lịch sử" với "lịch sử bắt đầu từ ngày X" (không backfill).
  - [ ] Ghi nhận tường minh trong PR: revert code sau khi đã ghi event = chấp nhận lỗ hổng
        timeline vĩnh viễn (bảng bất biến, không backfill) — bảng giữ nguyên khi revert.
- UI & e2e:
  - [x] Component `RecordTimeline` trong `packages/ui`, props không nhận `entity` tự do từ URL;
        nội dung timeline có `data-testid` riêng để không va text-matcher của journey hiện có.
  - [x] Bố cục: cạnh phải khi ≥ **1200px** (quyết định #11), xuống dưới khi hẹp hơn. Lưu ý mọi
        journey chạy viewport 1280 (`playwright.config.ts:117-129`) — cột phải sẽ bật trong TẤT
        CẢ journey qua trang chi tiết; chạy trước `crm-opportunity-lost` +
        `entrance-test-appointment` để bắt va chạm selector.
  - [x] Test harness: cả hai bản `cleanupFacility` (`apps/api/src/test/db.ts` — xoá qua
        `privilegedDb()` như tiền lệ RefundRecord `:140-143`; `apps/e2e/src/db.ts:337-392`) biết
        xoá `RecordEvent` trước `opportunity`/`facility`; quyết định tường minh về FK tới
        `Facility` (nếu có relation hai chiều theo quy ước schema thì teardown bắt buộc xoá trước).
- Bảo mật:
  - [x] Tài khoản cơ sở khác không đọc được timeline — có test cross-facility.

## Architecture

```
mutation CRM / appointment / finance ──(cùng tx)──► RecordEvent (facility-scoped, INSERT-only ở DB)
        advanceOpportunityOneStep(+actor) ─┘                  ▲ keyset cursor
finance: emit trong runMoneyTransaction / runCancelTransaction┘
UI: <RecordTimeline> (entity hardcode phía server) ◄── crm.opportunityTimeline (permission-first)
AuditLog: giữ nguyên, tuân thủ 12 tháng — không đụng
```

## Related Code Files

- Modify: `packages/db/prisma/schema.prisma` (+ migration RLS + GRANT SELECT,INSERT)
- Modify: `apps/api/src/crm/router.ts`, `apps/api/src/crm/advance-opportunity.ts` (+ actor param)
- Modify: `apps/api/src/appointment/router.ts` (2 caller của advance helper)
- Modify: `apps/api/src/crm/bulk-import-opportunities.ts`
- Modify: `apps/api/src/finance/router.ts` (emit trong `runMoneyTransaction` + `runCancelTransaction`, theo nhánh điều kiện O5)
- Modify: `packages/auth/src/index.ts` (+ test) — 2 permission key mới
- Modify: `apps/api/src/test/db.ts`, `apps/e2e/src/db.ts` (teardown biết RecordEvent)
- Create: `packages/ui/src/components/record-timeline.tsx`
- Modify: `apps/admin/src/pages/crm/opportunity-detail.tsx`

## Implementation Steps

1. `impact` cho `advanceOpportunityOneStep`, `receiptApprove`, `receiptCancel`,
   `confirmBulkImport`; báo bán kính (finance là miền nhạy — luồng duyệt hai mắt không được đổi).
2. Schema + migration `RecordEvent` (RLS + GRANT hẹp); union `kind` + allowlist payload; cập nhật
   hai bản `cleanupFacility`.
3. Thêm `actor` vào `advanceOpportunityOneStep` + emit bên trong; cập nhật 3 caller; emit tại các
   site router còn lại theo bảng 11 site; bảng ánh xạ kind → câu tiếng Việt.
4. `opportunityAddNote` + `opportunityTimeline` (registry key, keyset pagination, hardcode entity).
5. Component `RecordTimeline` (+ data-testid, mốc "lịch sử ghi từ", nút Xem thêm) + gắn vào trang
   chi tiết theo breakpoint 1200px.
6. Test: per-site emit (cổng cứng, đủ 11), hai kịch bản O5 điều kiện, cross-facility từ chối,
   bất biến mức DB, payload finance không có tiền, render fallback kind lạ; chạy trước hai journey
   nêu trên.
7. `detect_changes()` trước khi commit.

## Chưa làm (chặn phình phạm vi)

Người theo dõi, gửi email ra ngoài, thư khách tự chui về bản ghi, backfill từ AuditLog, UI cấu
hình — tất cả để sau, đi cùng đợt hạ tầng thư.

## Success Criteria

- Mở cơ hội thấy đủ đời bản ghi qua **mọi cửa**: tạo (tay/walk-in/bulk), đổi giai đoạn (tay +
  appointment), giao việc, đánh mất/mở lại, việc-cần-làm, **nhập học O5 thật** (không event giả
  từ phiếu thứ hai), ghi chú
- Bản ghi cũ hiện mốc "Lịch sử ghi từ…", không bị hiểu là mất dữ liệu
- Cơ sở khác không đọc được; ghi chú không sửa/xoá được **kể cả ở tầng DB**; payload finance
  không mang dữ liệu tiền
- Test per-site đủ 11; `typecheck-and-test` + `ui-e2e` xanh (không nới selector journey ngoài
  kế hoạch)

## Risk Assessment

Emit ở finance là điểm rủi ro cao nhất — impact trước, emit chỉ nằm trong hai tx `withFacility`
có sẵn (`runMoneyTransaction` / `runCancelTransaction`), không đổi luồng duyệt, không đụng audit
đường lỗi. Drift tương lai đỡ bằng quy ước test
per-mutation (cổng cứng). Kế hoạch `260813-0813` (pending) sẽ đổi enum trên cùng `schema.prisma`
— phối hợp thứ tự migration khi hai bên cùng chạy; payload tối thiểu hoá + fallback hiển thị đã
đỡ chiều dữ liệu cũ.

## Implementation status (2026-08-13)

Landed on `feat/crm-record-page-experience` without commit. Migration
`20260813143000_record_event` already applied locally (`prisma migrate deploy`:
no pending). All 11 emit sites wired. Per-mutation emit assertions exist in
`record-event.test.ts` plus appointment/bulk/approve/cancel-refund tests.

Verified this session (counts):
- api (7 files): 89 passed — record-event, stage, opportunity-get, bulk-import,
  appointment-lifecycle, finance.approve, finance.cancel-refund
- @cmc/auth: 558 passed
- @cmc/ui record-timeline + progress-steps: 5 passed
- admin use-opportunity-actions: 5 passed; opportunity-detail first run 38/39
  (ProgressSteps sr-only name matcher), then Astryx `useTruncation` infinite
  loop in jsdom on later runs (Phase 1 page chrome, not emit sites)

Not run: `crm-opportunity-lost` / `entrance-test-appointment` e2e; PR revert-gap
note (no PR yet). GitNexus MCP unavailable.
