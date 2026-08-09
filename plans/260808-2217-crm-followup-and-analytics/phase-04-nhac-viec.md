---
phase: 4
title: "P4 — Nhắc việc theo cơ hội"
status: pending
priority: P2
effort: "2d"
dependencies: [2]
---

# Phase 04 — P4: Nhắc việc theo cơ hội

## Overview
Cho phép tư vấn viên đặt "việc cần làm tiếp theo + ngày hẹn" trên từng cơ hội; đến hạn hiện ở màn hình đầu ca của đúng người phụ trách. Hiển thị trong ứng dụng (không email).

## Giá trị nghiệp vụ (cho người nghiệm thu)
- Không quên gọi lại / quên bước tiếp theo → giảm mất lead vì "không phản hồi".
- Bổ sung cho P2: P2 cảnh báo tự động cái bị bỏ quên; P4 là cam kết chủ động của tư vấn viên. Hai cái phối hợp: cơ hội đã hẹn việc-kế-tiếp tương lai thì P2 không coi là nguội.

## Nghiệm thu tính năng (điều kiện chấp nhận — demo được ngay)
- [ ] Trên một cơ hội, đặt được "việc cần làm + ngày hẹn".
- [ ] Đến hạn/quá hạn → hiện ở màn hình đầu ca (WorkInbox) của **đúng người phụ trách**.
- [ ] Cơ hội đã nhập học/đã mất **không** hiện nhắc.
- [ ] Đánh dấu xong → nhắc biến mất.
- [ ] Cơ hội có việc-kế-tiếp hẹn tương lai → **không còn bị gắn nhãn "đang nguội"** (cập nhật định nghĩa của P2).

## Chỉ số kết quả nghiệp vụ (theo dõi, KHÔNG chặn sign-off)
- Sau ~4 tuần (mục tiêu định hướng, hiệu chỉnh sau tuần 1): phần lớn cơ hội hoạt động (O2–O4) có việc-kế-tiếp; tỷ lệ mất vì "không phản hồi" **giảm so với baseline P1** (khối lý-do-mất của P1); số việc quá hạn tồn đọng tiến về 0.

## Requirements
- Functional:
  - Thêm "việc cần làm tiếp theo" (ngày hẹn + ghi chú ngắn) cho mỗi cơ hội. Một cơ hội có một việc-kế-tiếp tại một thời điểm.
  - Danh sách "đến hạn/quá hạn của tôi" ở màn hình đầu ca, **chỉ gồm cơ hội còn hoạt động** và thuộc người đang đăng nhập.
  - Đặt/sửa/xoá (đánh dấu xong = xoá việc-kế-tiếp).
  - **Cập nhật định nghĩa "nguội" của P2:** thêm điều kiện loại cơ hội có `nextActionAt > now` khỏi danh sách nguội.
- Non-functional:
  - Chỉ hiển thị trong ứng dụng (không email).
  - Quyền CRM hiện có; `sale` chỉ thấy nhắc của mình.
  - **Không dựng khung tác vụ/thông báo tổng quát** — chỉ 2 cột + 1 truy vấn.

## Architecture
- Thêm `nextActionAt DateTime?` + `nextActionNote String?` (giới hạn độ dài) vào `Opportunity`. Người phụ trách = `assignedToId` sẵn có (không thêm trường giao-việc mới).
- Backend: procedure set/clear + query "due follow-ups của tôi".
  - **"Active" phải tự định nghĩa, KHÔNG dùng lại `NOT_LOST_WHERE`** (nó bao gồm O5 — sẽ lọt cơ hội đã nhập học vào WorkInbox). Điều kiện đúng: `nextActionAt <= now AND closedAt IS NULL AND stage <> 'O5_ENROLLED' AND assignedToId = currentUser`.
- Frontend: ô đặt việc ở `opportunity-detail.tsx`; 1 section trong WorkInbox ở `cockpit.tsx`. **Không thêm badge trên phễu** (cắt theo red-team M2 — trùng WorkInbox và dễ đá nhau với badge "nguội").

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma` (`Opportunity` + 2 cột) + migration RIÊNG (không gộp với P2); `apps/api/src/crm/router.ts` (set/clear + due query; **cập nhật điều kiện nguội của P2**; tự ghi AuditLog qua middleware); `apps/admin/src/pages/crm/opportunity-detail.tsx` + `use-opportunity-actions.ts`; `apps/admin/src/pages/cockpit.tsx` (+ section WorkInbox).
- Create: journey `apps/e2e/.../crm-next-action.journey.ui.spec.ts` + seed lùi ngày cho "đến hạn".

## Implementation Steps
1. `impact({target:"opportunityGet"/"opportunityList"})` nếu chỉnh output kèm next-action (giữ backward-compatible: field optional).
2. Thêm 2 cột + migration riêng; regenerate client.
3. Procedure set/clear + due query (điều kiện active đúng ở trên); cập nhật điều kiện nguội P2; unit test (đặc biệt: KHÔNG hiện cho O5/đã mất; loại nguội khi có next-action tương lai).
4. UI: ô đặt việc + section WorkInbox (data-testid riêng).
5. Journey: `nextActionAt` lùi ngày (cho phép có chủ đích ở validate, comment lý do); `pnpm acceptance:report`; `detect_changes`; PR.

## Success Criteria
- [ ] Due query đúng: chỉ owner + active (loại O5 + đã mất) + đến hạn (unit).
- [ ] Cơ hội có next-action tương lai không hiện "nguội" (test phối hợp P2/P4).
- [ ] CI xanh; journey WorkInbox proven; không hồi quy CRM cũ.

## Risk Assessment
- Nếu chỉnh output `opportunityGet/List` → giữ tương thích (field optional).
- WorkInbox là component trình bày nuôi bằng query dẫn xuất → thêm 1 section là additive, thấp rủi ro.
- Rollback: drop 2 cột (migration down); gỡ procedure/section; hoàn nguyên điều kiện nguội P2. Cột nullable an toàn.

## Phụ lục kỹ thuật
- Không có trường next-action nào tồn tại (đã grep). WorkInbox = `packages/ui/src/components/work-inbox.tsx`, nuôi bằng query ở `cockpit.tsx:132+`. Tiền lệ cột `remindedAt` trên `ParentMeeting` từng bị DROP vì không đọc/ghi (`meeting/router.ts:38`) → chỉ thêm cột khi có query đọc thật.
- `NOT_LOST_WHERE` (`crm/router.ts:92-94`) = `closedAt null OR stage=O5` → KHÔNG phù hợp cho due query (lọt O5).
- Nâng lên bảng `FollowUp` riêng CHỈ khi sau này cần nhiều lần follow-up có lịch sử — chưa cần ở quy mô hiện tại.
