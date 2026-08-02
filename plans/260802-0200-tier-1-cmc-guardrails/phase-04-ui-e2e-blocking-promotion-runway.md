---
title: "Phase 4: ui-e2e required-check — resolve M1 trigger"
status: todo
priority: P2
effort: "3h"
dependencies: [5]
---

# Phase 4: ui-e2e required-check — resolve M1 trigger

## DECISION (user 2026-08-02): giải M1 luôn trong Tier 1.
Mục tiêu: làm cho `ui-e2e` CÓ THỂ trở thành required PR check, KHÔNG phá acceptance
ledger. Vẫn tôn trọng tiêu chí promotion (đủ runs mới bật required) — phase này dựng
*khả năng*, việc bật required là bước cuối sau khi đủ bằng chứng.

## Overview

Scope Tier 1 muốn `ui-e2e` thành blocking gate. **NHƯNG** team đã có tiêu chí
promotion có bằng chứng (quyết 2026-07-26, trong `ci.yml`) — và tiêu chí đó **chưa đạt**.
Phase này KHÔNG lật flag mù; nó ghi rõ quyết định và dựng đường băng promote.

## ⚠️ RED-TEAM đã chứng minh: promote hiện BẤT KHẢ THI (2 lý do độc lập)
- **C2/H1 (gh api):** `main` KHÔNG có branch protection ⇒ bỏ `continue-on-error` cũng chẳng chặn được gì. "Blocking" chỉ có nghĩa khi Phase 5 bật branch-protection require-check. ⇒ **Phase 4 phụ thuộc Phase 5.**
- **M1:** `ui-e2e` là `if: github.event_name == 'push'` (push-only) ⇒ **không bao giờ xuất hiện như required PR check được** (required checks đánh giá trên PR/merge commit). Muốn nó thành required PR check phải đổi trigger (thêm `pull_request`) — mà đổi trigger lại vướng lý do ledger gitSha đã ghi trong comment ci.yml (PR event = synthetic merge SHA). ⇒ mâu thuẫn thiết kế cần giải trước khi bàn promote.
Kết luận: tranh luận A/B (lật hay hoãn) **là thứ yếu** — trước hết phải giải M1 (trigger) + Phase 5 (branch protection). Nếu không, "promote to blocking" là mục tiêu không đạt tới được.

## Bằng chứng — tại sao chưa lật (từ `.github/workflows/ci.yml`)
Tiêu chí bỏ `continue-on-error` khỏi `ui-e2e` yêu cầu ĐỦ CẢ:
1. ≥ 20 runs của job trên nhánh nó sẽ gate, trải ≥ 14 ngày.
2. 0 run đỏ trong cửa sổ (trừ regression UI thật; flake pass-on-retry phải log).
3. Runner không đổi trong cửa sổ.
4. Runtime còn dư dưới ngân sách 60–90 phút (đo được 6.1 phút).

Đồng hồ bắt đầu **2026-07-26**. Hôm nay **2026-08-02** = ~7 ngày (< 14). Actions còn
gián đoạn billing tới khi repo public ⇒ **chưa đủ 20 runs**. Thêm: 7 flow `no-ui-path`
(trần phương pháp journey). ⇒ Lật ngay dễ CI đỏ vì flake/thiếu path, và **đảo ngược
một quyết định có bằng chứng của team** — vi phạm nguyên tắc "không promote theo hunch".

## M1 root cause + giải pháp
- **Nguyên nhân:** `ui-e2e` chạy `if: github.event_name == 'push'` vì trên `pull_request` event, `github.sha` = merge SHA tổng hợp (không tồn tại trong clone nào) → acceptance ledger từ chối artifact ("bản mã cũ").
- **Giải pháp (tách 2 vai):**
  1. **Vai ledger (source-of-record):** GIỮ nguyên trên `push` (dùng HEAD SHA thật). Không đổi.
  2. **Vai PR gate:** thêm trigger `pull_request`, nhưng **checkout `github.event.pull_request.head.sha`** (commit head thật, có trong clone) để test chạy đúng mã; **guard bước upload ledger artifact chỉ chạy trên `push`** (PR run không ghi ledger). ⇒ ui-e2e xuất hiện như check trên PR head SHA → đủ điều kiện làm required check.
- **Cần verify thực nghiệm (H/M):** có thể run push-triggered đã tạo check-run trên head SHA khi push lên nhánh PR, tự thoả required check mà không cần đổi gì. Kiểm bằng 1 PR thử trước khi thêm `pull_request` trigger — nếu đã đủ thì KHÔNG thêm trigger (KISS).

## Requirements
- `ui-e2e` có khả năng thành required PR check mà không phá ledger.
- Không bật required cho tới khi đủ tiêu chí promotion (≥20 runs/≥14 ngày).

## Related Code Files
- Modify (CHỈ khi override hoặc khi tiêu chí đạt): `.github/workflows/ci.yml` — bỏ `continue-on-error: true` ở job `ui-e2e` (dòng ~231) + cập nhật comment PROMOTION CRITERIA với bằng chứng.
- Không tạo file mới.

## Implementation Steps (theo lựa chọn của user — xem Open Question #1)
- **Nhánh A — Tôn trọng tiêu chí (khuyến nghị):** không đổi code. Đảm bảo `ui-e2e` chạy mỗi push để tích runs. Đặt mốc tái đánh giá sớm nhất **2026-08-09** (14 ngày) VÀ khi đủ 20 runs xanh. Khi đạt: lật flag + ghi bằng chứng run IDs vào commit.
- **Nhánh B — Override:** user chấp nhận rủi ro → bỏ `continue-on-error` ngay, cập nhật comment nêu rõ đây là quyết định override sớm và rủi ro (flake/no-ui-path có thể chặn merge).

## Success Criteria
- [ ] Quyết định (A hay B) được user chốt và ghi lại
- [ ] Nếu A: mốc tái đánh giá + điều kiện được ghi; flag giữ nguyên
- [ ] Nếu B: flag lật, comment cập nhật lý do override, team được thông báo

## Risk Assessment
- **Lật sớm (B):** merge bị chặn bởi flake hoặc 7 flow no-ui-path → làm chậm team, xói mòn niềm tin vào gate. Đúng thứ tiêu chí muốn tránh.
- **Hoãn (A):** guardrail UI chưa "cứng" thêm ~1 tuần — chấp nhận được vì job vẫn chạy & báo cáo, chỉ chưa chặn.
