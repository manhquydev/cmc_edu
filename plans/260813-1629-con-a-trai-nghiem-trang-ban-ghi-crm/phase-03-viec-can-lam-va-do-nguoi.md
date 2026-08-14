---
title: "Phase 3: Việc cần làm ba mức màu + độ nguội theo giai đoạn"
status: completed
priority: P1
effort: "2d"
dependencies: [1, 2]
---

# Phase 3: Việc cần làm ba mức màu + độ nguội theo giai đoạn

## Overview

Nhân viên mở máy buổi sáng phải trả lời được "hôm nay gọi ai" trong một cái liếc. Khớp thói quen
Odoo có sẵn từ bản 11: màu ba mức theo hạn + một chỗ gom đếm số **Quá hạn / Hôm nay / Sắp tới**.
Phần nguội nâng theo Odoo 19 (quyết định #12): hiện **số ngày**, ngưỡng **theo từng giai đoạn**.

## Sự thật đo được (13/08, đã red-team xác minh)

- `nextActionAt` + `nextActionNote` + `crm.opportunityDueFollowUps` đã có — nhưng hợp đồng hiện
  tại **không đếm nổi ba mức**: WHERE `nextActionAt <= now`, `take: 50`, chỉ việc của chính mình
  (`router.ts:583-618`) ⇒ mức "Sắp tới" không bao giờ được trả, đếm từ list bị cap 50 là số sai.
  Consumer duy nhất: `cockpit.tsx:154`.
- Độ nguội: `apps/api/src/crm/rotting.ts` — ngưỡng chung env `ROTTING_THRESHOLD_DAYS` mặc định 7
  (`:7`), loại trừ `nextActionAt` tương lai (`:41-43` — thông minh hơn Odoo, **giữ**). Caller:
  `crm/router.ts:17,510` (chỉ `opportunityList`), badge ở `pipeline.tsx:158-159,388-392`.
- Env này còn bị **gim trong test/journey**: `rotting.test.ts:16-22` (test parse env),
  `next-action.test.ts:151-152`, `stage-changed-at.test.ts:98-99,122-123`, và journey
  `crm-rotting.journey.ui.spec.ts:37,83` già hoá cơ hội O1 **10 ngày** rồi assert badge hiện ⇒
  ngưỡng O1 phải ≤ 10 hoặc journey phải sửa có chủ đích.
- Repo **đã có** nơi ở cho ranh giới ngày ICT: `packages/domain-time` (`ictDateOnlyOf`,
  `ictToUtc` — "stable UTC+7 boundary"). Không phát minh quy ước múi giờ thứ hai. `apps/api`
  không import được `@cmc/ui` (React) — hàm phân mức không được đặt ở đó.
- Chấm màu của Odoo CRM là **tự tính từ hạn**, người dùng không đặt tay — làm auto, không thêm
  thao tác.

## Requirements

- Functional:
  - [x] Hàm thuần phân mức hạn (quá hạn / hôm nay / sắp tới) đặt ở **`packages/domain-time`**,
        nhận `now` làm tham số, ranh giới ngày theo `Asia/Ho_Chi_Minh` — cả `apps/api` lẫn
        `apps/admin` import cùng một hàm; `packages/ui` chỉ giữ token màu theo mức
  - [x] Client tính mức từ `nextActionAt` **thô** trong cache + đồng hồ client (không cache mức
        đã phân từ server — snapshot sẽ thối khi ngày lăn qua nửa đêm ICT với tab mở qua đêm);
        chỗ gom đếm số thêm `refetchOnWindowFocus` + refetch interval
  - [x] Đếm ba mức bằng **count query riêng phía server** (không đếm từ list bị cap 50): mở rộng
        `opportunityDueFollowUps` trả `{ counts: { late, today, future }, items }` hoặc endpoint
        summary riêng — chốt một trong hai khi impact
  - [x] Đích điều hướng cụ thể: thêm filter theo hạn (`due: 'late' | 'today' | 'future'`) vào
        `opportunityListInput` (`router.ts:101-113` hiện chưa có) — "bấm ô đếm ra danh sách đã
        lọc" phải có đường đi thật
  - [x] Quy ước màu áp ở: danh sách cơ hội, trang chi tiết, cockpit — cùng nguồn phân mức
  - [x] Độ nguội: hiện **số ngày** ("nguội 12 ngày"); ngưỡng theo giai đoạn bằng hằng số code
        `Record<OpportunityStage, number>` + `satisfies` (quyết định #15); giữ loại trừ
        `nextActionAt` tương lai và O5/lost
  - [x] **Bảng ngưỡng khởi điểm (input của plan — chỉnh bằng PR sau UAT):** O1_LEAD 7 · 
        O2_CONTACTED 7 · O3_TEST_SCHEDULED 14 (chờ ngày test là bình thường) · O4_TESTED 7 ·
        O5_ENROLLED loại trừ. O1 = 7 ≤ 10 nên journey `crm-rotting` giữ nguyên được
- Non-functional:
  - [x] Nghỉ hưu env `ROTTING_THRESHOLD_DAYS` có chủ đích — đúng 3 file test: gỡ gim
        `process.env` ở `next-action.test.ts` + `stage-changed-at.test.ts`, sửa/xoá test parser
        ngưỡng trong `rotting.test.ts`. Journey `crm-rotting` KHÔNG thuộc nhóm env (nó gim mốc
        già hoá 10 ngày, không đọc env); ghi rõ trong PR env ngừng dùng
  - [x] Không thêm bảng cấu hình DB, không UI chỉnh ngưỡng (chỉ xét sau UAT khi có nhu cầu
        per-facility)

## Related Code Files

- Modify: `packages/domain-time/src/index.ts` (+ test) — hàm phân mức nhận `now`
- Modify: `apps/admin/package.json` — thêm dependency `@cmc/domain-time` (hiện chỉ `apps/api` và
  `apps/e2e` có; package thuần ESM không Node API nên browser-safe, đã kiểm 13/08)
- Modify: `apps/api/src/crm/rotting.ts` + `rotting.test.ts` (số ngày, ngưỡng theo stage, bỏ env)
- Modify: `apps/api/src/crm/router.ts` (counts + filter `due` + số ngày nguội trong list)
- Modify: `apps/api/src/crm/next-action.test.ts`, `apps/api/src/crm/stage-changed-at.test.ts` (bỏ gim env)
- Modify: `packages/ui/src/` token màu theo mức (theo design system hiện có)
- Modify: `apps/admin/src/pages/crm/pipeline.tsx`, `opportunity-detail.tsx`, `apps/admin/src/pages/cockpit.tsx`
- Rà (không đổi nếu ngưỡng O1=7): `apps/e2e/tests/journeys/crm-rotting.journey.ui.spec.ts`

## Implementation Steps

1. `impact` cho `isOpportunityRotting` và `opportunityDueFollowUps`; báo bán kính; chốt
   counts-trong-endpoint hay endpoint summary riêng.
2. Hàm phân mức trong `domain-time` (nhận `now`, ICT boundary) + test ranh giới ngày — test cố
   định `now`, không tin giờ máy CI (tiền lệ đau: xanh local ICT, đỏ runner UTC — journal 260726).
3. Nâng `rotting.ts`: trả số ngày; map ngưỡng theo `OpportunityStage` với `satisfies`; gỡ
   env/parser ở 3 file test nêu trên.
4. Counts + filter `due` phía server; áp màu + số ngày lên ba màn (client tự phân mức từ dữ liệu
   thô); chỗ gom đếm số, bấm vào điều hướng tới list đã lọc.
5. Test + `detect_changes()`.

## Todo

- [x] Impact hai symbol + chốt hình dạng endpoint đếm
- [x] Hàm phân mức trong domain-time + test múi giờ
- [x] Ngưỡng theo giai đoạn + số ngày + gỡ env (3 file test)
- [x] Counts + filter `due` + áp ba màn
- [x] `detect_changes()` + PR

## Implementation status

Completed 2026-08-13. Counts stay on `opportunityDueFollowUps` (additive `counts`; `items` unchanged). Env `ROTTING_THRESHOLD_DAYS` retired. GitNexus MCP/index not available in this session — blast radius taken from the phase brief (MEDIUM, additive). No commit.

## Success Criteria

- Việc quá hạn / hôm nay / sắp tới phân biệt bằng màu ở cả ba màn, cùng một hàm phân mức từ
  `domain-time`; tab mở qua đêm không hiển thị phân loại hôm qua
- Chỗ gom hiện đếm số ba mức từ count query (đúng cả khi >50 việc); bấm vào ra danh sách đã lọc
  bằng filter `due`
- Cơ hội nguội hiện số ngày; ngưỡng theo giai đoạn đúng bảng khởi điểm; thêm giá trị enum mới thì
  compile fail cho tới khi khai ngưỡng
- `typecheck-and-test` + `ui-e2e` xanh (journey `crm-rotting` không phải sửa để "cho xanh")

## Risk Assessment

Ranh giới "hôm nay" phụ thuộc múi giờ — mọi hàm nhận `now` tường minh, test cố định ICT.
`opportunityDueFollowUps` đổi hợp đồng semantic (thêm future) — consumer duy nhất là cockpit
nhưng vẫn impact trước khi đổi. Đổi ngữ nghĩa cờ nguội trên pipeline: kiểm caller của
`isOpportunityRotting` trước khi đổi chữ ký.
