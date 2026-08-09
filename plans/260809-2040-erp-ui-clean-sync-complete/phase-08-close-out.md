---
phase: 8
title: "Close out"
status: pending
priority: P3
effort: "0.5d"
dependencies: [7]
---

# Phase 8: Đóng sổ

## Overview

Chốt trạng thái cuối: xoá component vẫn không tìm được chỗ dùng, đưa baseline về 0, bật rào
chặn thành cấm cứng.

## Requirements

- Functional: baseline ratchet = 0; ratchet chuyển từ "không được tăng" sang "cấm tuyệt đối".
- Non-functional: quyết định xoá phải dựa trên **bằng chứng đã đi hết Phase 7**, không phải phán đoán sớm.

## Related Code Files

- Delete (nếu vẫn không có chỗ dùng): `packages/ui/src/components/{insight-metric,focus-card}.tsx` + test + export + CSS
- Modify: `scripts/ratchet-baseline.json` → 0; `scripts/ui-ratchet.mjs` → chế độ cấm cứng
- Modify: `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md` (đồng bộ trạng thái cuối)

## Implementation Steps

1. Rà lại 5 component "chưa phủ": cái nào Phase 7 đã áp được → giữ; cái nào đi hết mọi module vẫn không có chỗ thay thế markup tự chế → xoá (git giữ lịch sử).
2. Hạ baseline về 0, đổi ratchet sang cấm cứng.
3. Chạy `ui-fingerprint-sweep.mjs` toàn bộ route lần cuối, lưu kết quả làm mốc.
4. Cập nhật `CONSOLE-COMPONENT-MAP.md` + `docs/system-architecture.md` nếu kiến trúc đổi.
5. Viết báo cáo nghiệm thu vào `plans/reports/`.

## Success Criteria

- [ ] Baseline = 0; ratchet cấm cứng; CI xanh.
- [ ] Toàn bộ 33 route: 0 cỡ chữ lệch thang, radius theo đúng component family.
- [ ] Không còn component export mà 0 consumer (trừ building block nội bộ có ghi lý do).
- [ ] Tài liệu design khớp code (không còn doc drift đã biết).
- [ ] Báo cáo nghiệm thu kèm số đo trước/sau.

## Risk Assessment

- **Xoá sớm** component thật ra hữu ích. Mitigation: chỉ xoá sau khi đi hết Phase 7; git giữ lịch sử nên khôi phục rẻ.
- **Cấm cứng gây ma sát** cho việc sau. Mitigation: danh sách miễn trừ Phase 6 phải đúng trước khi bật.
