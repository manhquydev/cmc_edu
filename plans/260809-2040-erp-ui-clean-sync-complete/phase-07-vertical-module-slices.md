---
phase: 7
title: "Vertical module slices"
status: pending
priority: P2
effort: "L — nhiều phiên"
dependencies: [3, 6]
---

# Phase 7: Slice dọc theo module

## Overview

Token hoá inline style tầng app + phủ component còn thiếu, **theo từng module**, sau khi nền
móng đã thẳng (Phase 4-6). Đây là nguồn lệch **nhỏ nhất** trong ba nguồn — làm sau cùng là có
chủ đích.

## Tại sao dọc chứ không ngang

Người duyệt thị giác duy nhất là mắt operator, mà mắt kiểm được **theo màn hình**. Diff spacing
50 file thì máy đọc được nhưng **mắt không verify nổi và không bisect được** khi vỡ.

**Scout đã xác nhận tiền đề:** 98.4% vi phạm là module-private; **rủi ro test = 0**.

## Architecture

**Việc phải làm TRƯỚC mọi slice:** sửa 2 file dùng chung (`apps/admin/src/lib/student-picker.tsx`, `lib/enroll-picker.tsx` — 8 vi phạm). Chúng cắt ngang mọi module nên không thuộc slice nào.

**Thứ tự slice đã được operator chốt** (theo số vi phạm — bug tiền đã xử riêng ở Phase 3):
teaching (173) → CRM (81) → finance (46) → hr/attendance/admin → còn lại

**Phủ component — có điều kiện:** chỉ áp ở nơi nó **thay thế markup tự chế sẵn có**. Không bịa UI mới để component có chỗ dùng (làm vậy đi ngược "sạch"). Ứng viên scout tìm được: `CountBadge` 28 file, `MetaRow` 34 file, `Avatar` 2 file (`teaching/session-evidence.tsx`, `teaching/panels/evidence-panel.tsx`). `InsightMetric`/`FocusCard` **chưa tìm được chỗ thay thế** → dự kiến xoá ở Phase 8.

## Related Code Files

- Modify: `apps/admin/src/lib/{student-picker,enroll-picker}.tsx` (trước mọi slice)
- Modify: theo từng module dưới `apps/admin/src/pages/{teaching,crm,finance,hr,admin}/`

## Implementation Steps

Mỗi slice:
1. Token hoá inline style **token hoá được** (bỏ qua nhóm miễn trừ ở Phase 6).
2. Thay `fontSize={13}` thô → `var(--cmc-font-size-data)` (token **đã tồn tại**, 29 chỗ dùng sai toàn repo).
3. Phủ component nơi thay thế được markup tự chế.
4. Không xây S2/S3 trong plan này; chúng là feature work đã được tách phạm vi.
5. Chạy `ui-fingerprint-sweep.mjs` cho route của module; ảnh trước/sau.
6. **Hạ baseline ratchet** cho file đã dọn.

## Success Criteria

- [ ] 2 file dùng chung sửa xong **trước** slice đầu tiên.
- [ ] Mỗi module: 0 cỡ chữ lệch thang, radius theo đúng component family trên route của nó.
- [ ] Baseline ratchet **giảm đơn điệu** sau mỗi slice.
- [ ] Mỗi slice có ảnh trước/sau + CI xanh.
- [ ] Không có UI mới được bịa ra chỉ để dùng component.

## Risk Assessment

- **UAT người thật chưa chạy** — phản hồi UAT sẽ đảo ưu tiên. Mitigation: **dừng đánh giá lại** nếu UAT bắt đầu giữa chừng.
- **Trôi phạm vi** — slice dễ biến thành refactor. Mitigation: chỉ đụng styling + phủ component; logic nghiệp vụ bất biến.
- Rollback: từng slice revert độc lập.
