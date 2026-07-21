---
phase: 3
title: Acceptance View (tab nghiem thu premium)
status: completed
priority: P2
dependencies:
  - 2
effort: 1 session
---

# Phase 3: Acceptance View (tab Nghiệm thu premium)

## Overview

Tab dành cho ban giám đốc CMC: thẻ per-flow ngôn ngữ nghiệp vụ thuần Việt, trạng thái 3 mức, click mở chuỗi screenshot dạng story (ảnh có từ Phase 4 — trước đó hiện "chưa có bằng chứng chạy"). Zero jargon.

## Requirements

- Functional: header tổng quan (% hoàn thiện, ngày, mã phiên bản viết dạng thân thiện); thẻ luồng nhóm theo cụm nghiệp vụ với tên Việt ("Tuyển sinh & ghi danh", "Vận hành lớp học", "Nhân sự & lương", "Đổi quà & chăm sóc PH", "Quản trị hệ thống"); trạng thái: ⬤ Đã chứng minh chạy / ◐ Đã xây, chưa chứng minh / ○ Chưa có; modal/section screenshot story khi có evidence.
- Non-functional: premium design language LOCKED baseline (light, Inter, monochrome line icons, restraint); **desktop-first v1** (R2-7 — buổi nghiệm thu diễn ra tại bàn/máy chiếu; mobile thêm khi Phase 4/`--inline` tạo workflow gửi file thật).

## Architecture

`templates/acceptance-tab.ts` nhận cùng `VerificationResult` + `EvidenceIndex` (optional, Phase 4). Ngôn ngữ hiển thị 100% từ `displayName`/`clusterLabel` trong manifest — renderer không được in raw symbol/route ở tab này (enforce bằng review checklist, không phải runtime check).

Mapping trạng thái (D7 — red-team #7: ngưỡng "gần đây" mờ = false green; strict match bắt buộc):
- evidence có `specStatus: pass` (test đạt **terminal assertion** của luồng — fixme/skip/pass-nửa-đường KHÔNG tính, R2-10) VÀ `evidence.commit === HEAD` (working tree sạch) → ⬤ Đã chứng minh chạy
- structural `built` + evidence cũ hơn HEAD → ◐ kèm nhãn "bằng chứng từ phiên bản cũ (dd/mm, mã phiên bản)" — trung thực, không giả xanh
- structural `built` + chưa có evidence hoặc `specStatus: fail` → ◐ (fail thì kèm cảnh báo, không lộ raw error — D9)
- structural `partial`/`missing` → ○ kèm ghi chú ngắn tiếng Việt ("đang xây dựng")

## Related Code Files

- Create: `scripts/acceptance-report/templates/acceptance-tab.ts`
- Modify: `scripts/acceptance-report/templates/layout.ts` (bỏ placeholder)
- Modify: `scripts/acceptance-report/flow-manifest.ts` (bổ sung `clusterLabel`, mô tả 1 câu per-flow nếu thiếu)

## Implementation Steps

1. Chốt copywriting tiếng Việt cho 3 trạng thái + 5 cụm + mô tả 1 câu per-flow (nguồn: TL07 glossary — dùng đúng thuật ngữ sản phẩm đã chuẩn hoá).
2. Dựng thẻ luồng + summary band; ảnh placeholder state khi chưa có evidence.
3. Screenshot story: `<dialog>` native hoặc section expand, ảnh lazy-load.
4. Review chéo với TL07: không từ nào ngoài glossary sản phẩm; không symbol/route lộ ra.
5. Test mobile viewport (Chrome devtools 390px).

## Success Criteria

- [x] Người không biết code đọc hiểu trạng thái từng luồng — self-review path: reviewer-v1 grep xác nhận zero jargon leak (không trpc/route/model raw string) trong tab Nghiệm thu
- [x] Desktop hiển thị chuẩn (mobile: deferred theo R2-7) — verified trực quan qua chrome-devtools 1440×900, layout đúng premium design language
- [x] Trạng thái 3 mức khớp đúng mapping từ verification + evidence — v1 không có evidence source nên mọi luồng built dừng ở ◐ (đúng D7, không giả ⬤)

## Risk Assessment

- **Ngôn ngữ vẫn lẫn jargon** → checklist review: grep output HTML tab này không chứa chuỗi `trpc`, `router`, `/admin/`, tên model PascalCase.
- **% tổng gây hiểu lầm** ("85% xong" khi 15% còn lại là phần khó nhất) → hiển thị đếm luồng theo trạng thái thay vì % đơn; % chỉ là phụ chú.
