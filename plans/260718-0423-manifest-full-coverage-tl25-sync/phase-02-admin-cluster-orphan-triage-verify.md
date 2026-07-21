---
phase: 2
title: ADMIN cluster + orphan triage + verify
status: completed
priority: P2
dependencies:
  - 1
effort: 0.5-1 session
---

# Phase 2: ADMIN cluster + orphan triage + verify

## Overview

Khai cụm ADMIN (5 luồng, nguồn: code + plans/260716-1047-super-admin-completion — E6), rút whitelist (E4), triage orphan còn lại có phân loại đầy đủ (observational — E7, không target số), verify cuối (drift test + visual).

## Requirements

- Functional: ~5 FlowEntry ADMIN (id `ADM-01…`, cluster 'ADMIN'); whitelist còn `health`, `lmsAuth` (+ procedure-level nếu cần); orphan summary phân loại tường minh.
- Non-functional: giữ zero-jargon tab Nghiệm thu cho cluster ADMIN (displayName tiếng Việt: "Quản trị cơ sở", "Quản trị tài khoản nhân sự", "Cấu hình mạng chấm công", "Nhật ký hệ thống", "Cấu hình ca làm").

## Architecture

ADMIN flows đã chốt (verify bằng red-team R1 — routes apps/admin/src/routes/admin.routes.tsx:72-76, procedure counts đã grep):
- ADM-01 Quản trị cơ sở: `facility.*` (3 procs) + `/admin/facilities` + `Facility`
- ADM-02 Quản trị tài khoản nhân sự: `user.create/list/update/updateRoles` (user/router.ts:84,129,141,186) + `/admin/users` + `AppUser`
- ADM-03 Cấu hình mạng chấm công (IP): `facilityNetwork.*` (5 procs, network-router.ts:34-115) + `/admin/network-ip` + `FacilityNetwork`
- ADM-04 Nhật ký hệ thống: `audit.list` + `/admin/audit-log` + `AuditLog`
- ADM-05 Cấu hình ca làm: **`shift.createGroup`, `shift.createTemplate`, `shift.listGroups`, `compensationPolicy.get`, `compensationPolicy.upsert`** (R1-A5 — grep shift-config.tsx xác nhận page gọi đúng 5 procedure này; KHÔNG dùng fallback route+model, sẽ bỏ sót 4 orphan) + `/admin/shift-config` + `ShiftGroup`/`ShiftTemplate`/`CompensationPolicy`

**CẢ 5 flows ADMIN đặt `uiEvidenceSpec: undefined` vĩnh viễn** (E6, R1-S2) — tất cả là view cross-facility/super-admin (facilities list toàn mạng, AppUser CRUD toàn nhân sự, network IP, audit, shift-config), kế thừa Safety Gate 5 plan gốc cho toàn cụm.

Whitelist sau phase này: `INFRA_NAMESPACE_WHITELIST = ['health', 'lmsAuth']`. Orphan dư hạ tầng thuần chứng minh được (vd `session.me` — R1-A6a: `user.me` KHÔNG tồn tại) → `INFRA_PROCEDURE_WHITELIST` (Set<string> exact-match) **kèm liveness guard mirror verify.ts:75-79: throw nếu entry không match procedure scan được** (R1-S4). Procedure thuộc namespace admin/auth-sensitive KHÔNG BAO GIỜ vào whitelist (E4).

## Related Code Files

- Modify: `scripts/acceptance-report/flow-manifest.ts` (+~5 ADMIN entries)
- Modify: `scripts/acceptance-report/verify.ts` (whitelist namespace→2 entries; thêm `INFRA_PROCEDURE_WHITELIST` nếu cần)

## Implementation Steps

1. Đối chiếu code chốt danh sách ADMIN flows (routes admin.routes.tsx + scanner output cho facility/user/facilityNetwork/audit/shift namespaces).
2. Thêm ~5 entries; chạy `pnpm acceptance:report`.
3. Rút whitelist namespace về `health`, `lmsAuth`; chạy lại — orphan lộ thêm từ 3 namespace cũ.
4. Triage orphan cuối (E7 — observational, KHÔNG có target số): mỗi procedure còn lại → (a) phục vụ màn hình WF có sẵn → claim theo E1 kèm lý do; (b) hạ tầng thuần chứng minh được → INFRA_PROCEDURE_WHITELIST (có guard); (c) capability thật chưa văn bản hoá → "documented gaps" trong summary (ứng viên flow/TL25 addendum tương lai). 100% residue phải nằm trong đúng 1 category; procedure admin/sensitive cấm vào (b).
5. Drift test: rename tạm 1 procedure P3 (vd `kpi.refresh`) → flow P3-09 partial → revert, diff sạch.
6. Thêm banner "CHỈ DÙNG NỘI BỘ — chứa bản đồ API hệ thống" đầu Builder tab (`templates/builder-tab.ts`, text tĩnh — E8/V3; không đổi layout.ts shell).
7. Visual check nhanh (chrome-devtools): 5 cụm hiện đúng 2 tab, zero-jargon tab Nghiệm thu, banner Builder hiện, không vỡ layout với 38 thẻ.
8. Cập nhật summary band nếu số lượng thẻ lớn làm layout xấu (chỉ CSS nhỏ, không đổi cấu trúc).

## Success Criteria

- [ ] 38 luồng tổng (33 WF-code + 5 ADMIN), 5 cụm hiện đủ trên 2 tab; banner LOCAL-ONLY trên Builder tab
- [ ] Whitelist namespace = 2 entries; procedure-level whitelist (nếu có): exact-match + liveness guard throw-on-dead + lý do 1 dòng + zero procedure admin/sensitive
- [ ] 100% orphan residue phân loại a/b/c; documented gaps liệt kê tường minh (E7 — không target số)
- [ ] Drift test P3 pass; visual check pass; typecheck sạch
- [ ] CẢ 5 luồng ADMIN uiEvidenceSpec: undefined (kế thừa Safety Gate 5 toàn cụm)

## Risk Assessment

- **`user`/`audit` lộ nhiều orphan hạ tầng** → procedure-level whitelist có kiểm soát (mỗi entry 1 dòng lý do), không nuốt cả namespace.
- **Layout 38 thẻ xấu** → grid auto-fill đã responsive; chỉ chỉnh CSS nếu thật sự vỡ, không redesign.
- **Shift-config không rõ namespace** → scanner output là nguồn đóng; nếu procedures thuộc `shift.*` đã bị P3 claim thì ADM-05 dùng route+model làm expected chính, NOTE rõ.
