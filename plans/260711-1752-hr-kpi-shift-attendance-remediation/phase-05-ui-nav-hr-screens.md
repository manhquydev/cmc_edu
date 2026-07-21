---
phase: 5
title: "UI nav & HR screens"
status: pending
priority: P2
dependencies: [2, 3, 4]
effort: "18h"
---

# Phase 5: UI nav & HR screens

## Overview
Mở HR cho 5 role qua nav + build behavior trên các màn ĐÃ được premium plan migrate (plan này chạy SAU premium — blockedBy). Đã hấp thụ red-team #12/#22/#24: criterion route-guard viết lại trung thực, gộp trang "Của tôi", sửa inventory callers. Harness component-test admin ĐÃ TỒN TẠI (`apps/admin/vitest.config.ts`, `src/test/render-with-providers.tsx`, `mock-trpc.ts`) — dùng trực tiếp, không tạo mới.

## Requirements — ma trận nav (5 role)
| Nav item | giao_vien | sale | GĐĐT | GĐKD | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Chấm công | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đăng ký ca (+ tab duyệt cho GĐ) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Của tôi (KPI \| Lương — 1 trang 2 tab, red-team #22) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Duyệt KPI | | | ✓ | ✓ | ✓ |
| Chốt lương | | | ✓ | ✓ | ✓ |
| **Bậc lương** (route `/hr/salary-tiers` — R3-10) | | | ✓ | ✓ | ✓ |
| Shift-config (admin group) | | | | | ✓ |

Ghi chú "Của tôi" cho 2 GĐ (validate s4 — lương ngoài hệ thống): tab KPI + Lương render EmptyState "Không áp dụng cho vai trò Giám đốc"; tab chấm công/ca vẫn dùng bình thường.

## Related Code Files
- Modify: `apps/admin/src/shell/nav-registry.ts` + `nav-registry.test.ts` (contract change CÓ CHỦ ĐÍCH: bỏ assertion `not.toContain('hr')` :18,26,34-40 → assert ma trận trên)
- Modify: `apps/admin/src/routes/hr.routes.tsx` (routes: my — trang Của tôi, kpi-review), `admin.routes.tsx` (shift-config giữ path)
- Modify: `apps/admin/src/pages/attendance/check-in-out.tsx` — đọc **`err.data.appCode`** (`IP_NOT_ALLOWED`/`COOLDOWN` — errorFormatter phase 4; KHÔNG phải err.cause) thay string-match :157,160; phiếu của tôi (`manualPunch.list scope=mine`)
- Modify: `apps/admin/src/pages/attendance/shifts.tsx` — bỏ paste-UUID: dropdown `shift.listGroups`; "Đăng ký của tôi" (`myRegistrations` + rejectReason); tab GĐ inbox `pendingForApproval` + approve/reject modal (reason bắt buộc)
- Create: `apps/admin/src/pages/hr/my-hr.tsx` — 1 trang 2 tab: **KPI** (phiếu kỳ: %côngca `shiftActual/shiftRequired` + %chỉ-số `metricValue/quotaSnapshot` + `value` phần nhân, banner tierMissing, nút "Tính lại" = `kpi.refresh`, nút "Nộp" = `kpi.submitSlip` disabled + tooltip trước ngày 3 tháng sau) | **Lương** (`payslip.my` theo kỳ)
- Modify: `apps/admin/src/pages/hr/kpi.tsx` → màn "Duyệt KPI" (GĐ): inbox `kpi.list` (đã filter group-type server-side), confirm/override modal (reason), nút **"Đã trả lương kỳ X"** = `kpi.bulkApprove` + confirm dialog hiển thị count + danh sách tên bị ảnh hưởng + cảnh báo phiếu self bị loại. **Callers hiện tại của file này: `getForUser`(:79)/`confirm`(:84)/`approve`(:96) — KHÔNG có `kpi.submit` (bản plan cũ ghi sai — red-team #24). Migrate: getForUser→list, approve→bulkApprove, confirm giữ.**
- Modify: `apps/admin/src/pages/hr/payroll.tsx` — giữ flow GĐ (user.list → getForUser; `payslip.list` defer) NHƯNG **rewrite breakdown hiển thị (R3-2)**: bỏ hàng "Lương biến đổi", đổi nhãn "Thưởng KPI" → "Phần KPI (%côngca × %chỉ-số × đơn giá)"; **`payroll.test.tsx` vào danh sách rewrite** (thiếu ở R2 #M1)
- Create: route + page `/hr/salary-tiers` (màn "Bậc lương & gán bậc" — đã mô tả ở trên; hàng nav riêng, key `salaryTier.manage`)
- Modify: `apps/admin/src/pages/admin/shift-config.tsx` — thay EmptyState: CRUD ShiftGroup/ShiftTemplate (`listGroups`/`createGroup`/`createTemplate`) + form CompensationPolicy (`compensationPolicy.get/upsert`)
- Create: **màn nhận xét per-buổi** (R2 #C4, user chốt) — trong flow teaching (cạnh `session-evidence.tsx`): chọn buổi → roster HS `present` → nút AI draft (`assessment.draftComment` với `classSessionId`) → GV sửa/confirm từng em + **confirm-all (cho phép, kèm audit log ai/lúc nào — validate s3; GĐĐT hậu kiểm qua report-card tháng)**; hiển thị tiến độ điều kiện done (điểm danh ✓ / nhận xét x/y / ảnh ✓) trong cửa 24h (+3-4h)
- Create: **màn "Bậc lương & gán bậc"** (validate s3) — 2 GĐ: CRUD `SalaryTier` (tên, type, baseSalary, đơn giá, công ca yêu cầu, metric yêu cầu) + bảng nhân viên gán bậc (`compensation.assignTier`); đặt trong nhóm Chốt lương (+2h)
- Modify: `apps/admin/src/pages/classes/class-detail.tsx` — **teacher picker** (`classBatch.assignTeacher`, dropdown AppUser role giao_vien — R2 #C5); badge `done` cho SessionStatus mới + ẩn nút "Huỷ" với buổi done (R2 #H6, consumer :70-74,141,152,161)
- Modify: **premium co-located tests** (R2 #M1 — sẽ đỏ khi contract đổi, rewrite CÓ CHỦ ĐÍCH): `kpi.test.tsx` (lock getForUser/approve cũ), `shifts.test.tsx`, `check-in-out.test.tsx` do premium plan phase-05/06 tạo

## Route-access criterion (viết lại trung thực — red-team #12)
Admin KHÔNG có route guard theo quyền (chỉ login guard, routes/index.tsx:24). Bảo đảm của phase này: (1) nav ẩn item ngoài quyền; (2) server reject mọi call ngoài quyền (đã có); (3) màn GĐ render trạng thái "Không có quyền truy cập" (EmptyState) khi query đầu trả FORBIDDEN — KHÔNG claim tồn tại route guard. (Optional stretch: `RequirePermission` wrapper — chỉ làm nếu còn giờ, là item riêng.)

## Implementation Steps
1. Nav-registry + test trước (ma trận trên là spec).
2. Component tests bằng harness sẵn có (`render-with-providers` + `mock-trpc`): mỗi màn ít nhất render + action→mutation + error/empty state.
3. Thứ tự build: check-in-out (nhỏ) → my-hr → shifts → kpi-review → shift-config → nhận xét per-buổi + teacher picker + class-detail badge.
4. Import UI từ `@cmc/ui` single-door; premium template; không emoji; không style tự chế ngoài wrapper.
5. `pnpm --filter @cmc/admin typecheck && pnpm --filter @cmc/admin test && pnpm build`.

## Success Criteria
- [ ] 5 role thấy đúng nav ma trận; màn ngoài quyền hiển thị EmptyState không-có-quyền (không claim route guard).
- [ ] Không còn input UUID tay; không còn string-match err.message.
- [ ] nav-registry.test.ts phản ánh ma trận mới (diff ghi chú contract change).
- [ ] Component tests cho 5 màn xanh; typecheck + build 14/14.

## Residual EmptyState screens (rolled in 2026-07-12 from `260707-0915-ui-implementation` phase-06)

3 màn ERP còn coming-soon EmptyState vì "chưa có backend phù hợp" trong plan UI-implementation.
Vì HR-remediation đã đụng nav 5-role + các màn cùng cluster, tiện dọn luôn (chỉ premium EmptyState + LineIcon, KHÔNG build feature nếu backend chưa có):

- [ ] `apps/admin/src/pages/crm/post-sale-meeting.tsx` (họp PH sau bán) — nếu chưa tồn tại, đặt EmptyState + LineIcon `users` + note "backend chưa hỗ trợ".
- [ ] `apps/admin/src/pages/crm/aftersale.tsx` (after-sale case) — EmptyState + LineIcon `alert` + note; hoặc gộp cùng file với post-sale-meeting nếu product thấy trùng.
- [ ] `apps/admin/src/pages/finance/refund.tsx` (hoàn tiền) — LƯU Ý: đã có `finance.refundCreate` mutation (`apps/api/src/finance/router.ts`). Nếu chỉ đặt EmptyState (skip build), phải flag lý do (vd chưa có màn duyệt hoàn tiền, chưa có UX flow). Nếu build thật thì gate `canDo('finance','refund')` + bind mutation hiện có.

**Không mở rộng scope backend** — chỉ đặt UI EmptyState hoặc bind mutation đã có. Nếu product muốn build feature thật cần plan riêng.

## Risk Assessment
- Chạy SAU premium plan: các file trên đã ở premium template — rebase lên bản premium, KHÔNG revert presentation của họ.
- `kpi.tsx` đổi vai trò director-only — check route cũ không trỏ nhầm; `my-kpi`/`my-payslip` route riêng KHÔNG tồn tại (đã gộp my-hr).
- Nav thêm 4-6 item/role một đợt — đã gộp "Của tôi" để tôn trọng restraint + ADR-C 5-group IA.
