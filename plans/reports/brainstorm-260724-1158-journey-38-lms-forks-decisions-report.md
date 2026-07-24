# Brainstorm Decisions: 4 forks — journey 38/38 ERP + LMS

**Date:** 2026-07-24 12:00 (+07) · **User chốt trực tiếp trong phiên (AskUserQuestion, real approvals — không phải ghi chú tự chế)**
**Input:** `research-260724-1153-journey-38-lms-acceptance-ledger-report.md` + advise 260724 (user-confirmed contract).
**Contract kế thừa từ advise (không mở lại):** per-flow expansion (không Ngày-0) · quét-hết-rồi-sửa · sổ 4-trạng thái · ERP→LMS xuyên suốt · không sửa `packages/auth` · Q5 giữ nguyên · phiên dừng ở plan sạch, KHÔNG cook.

## Quyết định

| Fork | Quyết định (user 2026-07-24) | Căn cứ | Trade-off chấp nhận |
|---|---|---|---|
| **F-A** Phiên LMS | **A2**: login UI thật (OTP đọc từ `EmailOutbox.payload`) CHỈ trong journey mà login/kích hoạt LÀ nghiệp vụ (OTP phụ huynh; kích hoạt học viên = journey 2 vai parent+student vì `mustChangePassword` chỉ mở khóa qua `resetChildPassword`); mọi journey LMS khác inject session qua **1 helper duy nhất** `mintLmsSession()` | Khớp tiền lệ staff `mintStaffCookie` (10 journey hiện có KHÔNG login UI); §4.2/§4.3 quản nav+data, không quản login; Playwright best practice | LMS token chưa ký (P0-debt HMAC) → khi signing land, sửa đúng 1 helper. Ghi rõ trong plan để không bị coi là "lách" |
| **F-B** Runtime | **Ngưỡng lỏng 60–90 phút**: đo local 17 specs (task đầu plan), ngoại suy 38+; ≤ ngưỡng → giữ serial `workers:1`; vượt → ưu tiên chuyển acceptance-run sang **nightly/schedule** trước, CI shard matrix chỉ khi nightly cũng không đủ; per-worker facility parallelism là phương án cuối (xâm lấn nhất) | Không có số đo CI (job ui-e2e chưa từng chạy trên main; 5 run main gần nhất fail ~2s — lỗi workflow, ngoài scope); user ưu tiên tránh refactor CI lâu nhất có thể | Feedback chậm hơn nếu job dài; chấp nhận vì không ép deadline |
| **F-C** Sự thật sổ | **C1 ingestion**: Playwright chạy JSON reporter → `verify.ts` map spec→flow, trạng thái `xanh` CHỈ từ kết quả máy; thiếu file kết quả → "declared, unproven". `statusReason{code,detail}` cho fixme/no-UI-path (kèm bằng chứng grep) | Đóng lỗ fabrication đã ghi án (verify.ts hiện WARN-only, badge tự thú "Có bài kiểm ≠ xanh"); enum FlowStatus đổi an toàn — không consumer ngoài | Sổ đầy đủ phụ thuộc một lần chạy test trước đó — đó là trung thực, không phải lỗi |
| **F-D** Gom đợt | **Tái dùng quyết định advise** (không hỏi lại): đợt theo `cluster` manifest, thứ tự ưu tiên nghiệp vụ tiền → ghi danh → vận hành lớp → HR/payroll → rewards/admin; role-chain amortize tự nhiên trong cluster | Đã quyết trong advise 260724; field `cluster` khớp sẵn | — |

## Ràng buộc bất biến cho plan (kế thừa + mới)

- Không sửa `packages/auth/src/index.ts`; không đổi hành vi app (trừ khi luồng đỏ được sửa Ở GIAI ĐOẠN SAU plan này — plan này chỉ ĐO).
- Giữ luật chống gắn-sai H2: chỉ gắn `journey:` khi giao procedure/route thật (flow-manifest.ts:52-85).
- Mọi claim "không có UI làm X" → bằng chứng grep + user duyệt với ngày thật (bài học fabricated-approvals).
- Đuôi spec `.journey.ui.spec.ts` (tránh H5 regex-collision với project api).
- Không email thật; OTP đọc từ outbox DB; không PII vào artifact.

## Handoff → `/ak-plan --tdd`

Plan cần các phase (gợi ý, planner tự tinh chỉnh): (0) đo runtime baseline + decision gate F-B; (1) triage 38 luồng + grep đường UI; (2) sổ 4-trạng thái + ingestion C1 (FlowStatus 6 giá trị, statusReason, vá verify.ts, 2 templates); (3) hạ tầng LMS (`mintLmsSession` + journey mẫu activation 2-vai + OTP-outbox login journey); (4+) các đợt journey theo cluster; mỗi phase có falsification test (TDD: đỏ trước, xanh sau).

## Unresolved

- Không còn fork thiết kế nào mở. Rủi ro theo dõi: CI main fail ~2s (ngoài scope, cần phiên riêng).
