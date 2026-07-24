---
phase: 5
title: "10 journey luồng lõi + coverage trong sổ nghiệm thu"
status: done
priority: P2
dependencies: [4]
---

# Phase 5: 10 journey luồng lõi + coverage trong sổ nghiệm thu

> **Sửa 2026-07-23 sau red-team (H2, M2).** Bảng bản đầu gắn journey #4 vào
> **sai flow ID** — P1-01 là *phễu CRM* (`flow-manifest.ts:22`), không phải "tạo
> học viên+ghi danh" (đó là P1-05). Journey phủ định (6/8/10) dùng
> `assertEntryAbsent`/`assertAbsent` của Phase 4, không phải helper fail-on-absence.

## Overview

Nhân khuôn Phase 4 lên bộ luồng rủi ro nhất, nối vào xương sống: manifest khai
`journey` cho từng luồng, `acceptance:report` hiện cột coverage. Không phủ 38/38
(nợ N1). Mọi journey tạo dữ liệu theo trình tự vai thật (Q5), chạy qua job
Phase 0, đuôi `.journey.ui.spec.ts`.

## Requirements

**Functional** — bộ journey đạt **10** (3 hồi quy Phase 4 + 7 mới). Flow ID +
displayName **đối chiếu `flow-manifest.ts`**, không theo tên nhớ:

| # | Flow (manifest) | Vai | Ghi chú |
|---|---|---|---|
| 1–3 | (Phase 4: F1 phiếu thu · F2 roster session-assessment · F4 payroll) | | hồi quy 3 luồng chết 16 ngày |
| 4 | **P1-05** Kích hoạt ghi danh khi đóng phí | sale (+GĐ duyệt) | ghi danh, `enrollment.enroll`, `/admin/students` |
| 5 | **P1-02** Tạo phiếu học phí từ cơ hội | sale | vào qua CRM, không `/finance` (ADR-B) |
| 6 | **P1-03** Duyệt phiếu kích hoạt học viên | sale tạo · GĐKD duyệt | **phủ định:** sale KHÔNG tự duyệt được (assertAbsent nút/hành động) |
| 7 | **P3-01** Chấm công cặp vào/ra | 1 vai nhân sự | `/hr/checkin` qua menu |
| 8 | **P3-02** Duyệt phiếu offsite theo track | sale chủ phiếu · GĐKD duyệt | **phủ định:** GĐĐT không thấy phiếu sale trong inbox (`assertAbsent` — `manualPunch.list` lọc theo track, `checkin/router.ts:417-436`) |
| 9 | **P4-01** Đổi quà bằng sao | sale qua `/admin/engagement/rewards` | đi qua nav group Gắn kết (đợt B) |
| 10 | **P4-02** Cấu hình quà đổi sao | GĐ | **phủ định:** sale KHÔNG thấy entry Quà tặng (`menuNav.assertEntryAbsent` — D5) |

- Manifest: trường tuỳ chọn `journey?: string` trong `flow-manifest.ts`; scanner verify spec file tồn tại **và có ≥1 `test(`**.
- `acceptance:report`: cột journey coverage per flow (**hiển thị**, không đổi built/partial). Badge ghi rõ "có bài kiểm" ≠ "xanh ở CI" — tránh đọc nhầm kiểu 38/38-built.

**Non-functional** — mỗi journey theo khuôn Phase 4 (menu-first, findInList, không id, tạo dữ liệu theo trình tự, 3-lần-xanh). Đo tổng thời lượng bộ 10.

## Architecture

`journey` là metadata manifest — cùng nguyên tắc D1 của `260717-1213` (manifest
khai, scanner kiểm). Verify chỉ kiểm **file tồn tại + có test**, KHÔNG chạy
Playwright trong `acceptance:report` (report phải rẻ). Hai tín hiệu tách bạch:
"có bài kiểm" (report) vs "bài kiểm xanh" (job Phase 0).

## Related Code Files

- Create: 7 file `apps/e2e/tests/journeys/*.journey.ui.spec.ts`
- Modify: `scripts/acceptance-report/flow-manifest.ts` (thêm `journey`), `types.ts`, `verify.ts`, `render.ts`
- Đọc trước: khuôn Phase 4; `scripts/acceptance-report/flow-manifest.ts` (displayName + `expected` từng flow — đối chiếu route/procedure); `docs/25-ma-tran-truy-vet-p1.md`
- Không sửa: app code (ngoài `data-testid` nếu Phase 4 mở tiền lệ), auth

## Implementation Steps

1. Journey 4–10 theo thứ tự bảng (một-vai trước, đa-vai + phủ định sau); mỗi cái 3-lần-xanh trước khi sang cái kế.
2. **Trước khi ghi `journey` vào manifest:** với mỗi flow, xác nhận route/procedure journey chạm **giao** với block `expected` của flow đó trong manifest (chống gắn sai như H2).
3. Journey 6/8/10 dùng `assertAbsent`/`assertEntryAbsent` — phủ định là xanh hạng nhất, không phải `expect().rejects` bắt mọi lỗi.
4. Manifest thêm `journey`; verify kiểm tồn tại + có `test(`, thiếu ⇒ cảnh báo (không fail).
5. render.ts: badge coverage + "N/38 luồng có journey", ghi rõ ngữ nghĩa badge.
6. Đo tổng thời lượng bộ 10 → trả lời câu hỏi mở #2 (job riêng hay gộp job Phase 0).
7. `acceptance:report` giữ 37/1; typecheck + lint + full test.

## Success Criteria

- [x] 10 journey xanh 3 lần liên tiếp qua job Phase 0; đuôi `.journey.ui.spec.ts`
- [x] Flow ID trong bảng **khớp `flow-manifest.ts` displayName** (H2 đã sửa); mỗi `journey` giao với `expected` của flow
- [x] Journey 6/8/10 dùng `assertAbsent`/`assertEntryAbsent`, phủ định là green hạng nhất
- [x] Manifest khai `journey`; verify kiểm tồn tại+test; report hiện "N/38" với ngữ nghĩa badge rõ
- [x] `acceptance:report` giữ 37 built / 1 partial; thời lượng bộ journey ghi lại
- [x] typecheck · lint · test xanh

## Kết quả thật (2026-07-24)

Đạt **9/10** wiring vào manifest, không phải 10/10 — F1 (`finance-receipt.journey.ui.spec.ts`,
đã 3-lần-xanh từ Phase 4) không gắn được vào flow nào mà không tái phạm đúng lỗi
H2: hai procedure nó chạm (`finance.receiptCreate`, `finance.receiptApprove`)
chỉ khớp `expected.trpc` của đúng P1-02 và P1-03 — cả hai bảng của phase này đã
gán tường minh cho `crm-receipt`/`receipt-approve-negation`. Ép F1 vào một
trong hai là gắn sai flow. F1 vẫn chạy xanh qua job Phase 0, chỉ không có cột
coverage trong `acceptance:report`. Chấp nhận 9/38 là con số thật.

Toàn bộ 10 journey (kể cả F1) xanh cùng lúc qua `pnpm --filter @cmc/e2e test
--project=ui-chromium` (17/17 spec bao gồm safety-net + capture), 4 lần liên
tiếp tính cả run sau khi hoàn nguyên falsification. Cả 3 phủ định (P1-03,
P3-02, P4-02) đã chứng minh đỏ đúng chỗ rồi hoàn nguyên sạch. Thời lượng bộ 10
~1.3–1.5 phút — gộp vào job Phase 0 hiện có, không cần job riêng.

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Gắn sai flow↔journey (H2 tái diễn) | Cao | Bước 2 đối chiếu route/procedure với `expected` trước khi ghi |
| 10 journey quá chậm cho CI | TB | Bước 6 đo trước khi quyết wiring; đuôi riêng cho phép job riêng |
| Coverage đọc nhầm thành "đã chứng minh chạy" | TB | Badge ghi rõ hai nghĩa; bài học 38/38 ghi vào render |
| Journey phủ định thành phantom (pass on any failure) | TB | `assertAbsent` settled-wait, không `expect().rejects` bắt mọi lỗi |
| Đa-vai flaky dây chuyền | Cao | 3-lần-xanh từng cái; một-vai trước |
