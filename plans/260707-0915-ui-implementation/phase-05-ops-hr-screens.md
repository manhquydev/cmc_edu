# Phase 05 — Màn Điều hành / HR

## Context links
- `docs/06` §3C (route hr/attendance/finance), `docs/12` §5, master roadmap (chấm công IP, phạt độc lập, recon rule-based + agent principal `ai:recon`).
- Router: `checkInOut`, `manualPunch`, `shift`, `compensation`, `payslip`, `kpi`, `finance` (revenue), `reconciliation`. Permission: `checkIn.punch` (mọi staff), `manualPunch.approve`/`shift.approve`/`kpi.approve` (GĐ), `reconciliation.review` (GĐ).

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: pending · Review gate: **reviewer 1 vòng** (đối soát/lương nhạy nhưng backend đã kiểm; UI hiển thị).
- 5 màn: Chấm công IP · Đăng ký ca (kanban duyệt) · Doanh thu · Đối soát HOTL · Lương/KPI (qua template generic phần lớn).

## Key insights
- **Chấm công IP** `/attendance/check-in-out`: banner IP-match (đang trong dải WiFi cơ sở → cho check-in), đồng hồ sống, nút check-in/out, form manual-punch fallback (QĐ 0027) khi ngoài dải. Backend đã validate IP (`checkIn.punch` + facility network); UI phản ánh trạng thái match từ response, KHÔNG tự quyết IP.
- **Đăng ký ca** `/attendance/shifts?view=kanban` → `/{id}`: 4 cột kanban duyệt (nháp/chờ/duyệt/từ chối), modal đăng ký (validate ngày tương lai ICT, selectionMode radio/checkbox, ticket-lock). `shift.submit` → `shift.approve`.
- **Đối soát HOTL** `/finance/reconciliation?term=`: banner agent HOTL (nêu rõ phạm vi read-only của `ai:recon` worker), flag card với deep-link `/finance/receipts/{id}?flag=...` (`docs/06` §6). Human review/dismiss/action = GĐ (`reconciliation.review`).
- **Doanh thu** `/finance/revenue-report?range=`: stat card + bar chart theo chương trình (CSS bar, đọc token — không cần lib chart nặng).
- **Lương/KPI**: chưa thiết kế riêng → dùng template generic List/Detail (phase 02) + vài widget. `/hr/payroll?month=` → `/hr/payroll/{payslipId}`, `/hr/kpi?period=`. **Phạt** hiển thị là dòng khấu trừ ĐỘC LẬP (không trộn base/variable/KPI) — khớp bất biến QĐ0025.

## Requirements
1. **Chấm công IP**: banner IP-match (from response), đồng hồ sống, check-in/out `checkIn.punch`, form manual-punch fallback `manualPunch.create`. Punch không có ca approved → hiện "ghi nhận, chờ review" (không phạt — bất biến).
2. **Đăng ký ca**: kanban 4 cột, modal đăng ký (future-date ICT validate client + server, selectionMode, ticket-lock), duyệt `shift.approve` (chỉ GĐ thấy nút).
3. **Đối soát HOTL**: banner phạm vi agent, flag card + deep-link, dismiss/action `reconciliation.review` (GĐ). Read-only rõ ràng cho role không phải GĐ.
4. **Doanh thu**: stat card + CSS bar chart theo chương trình, filter range → URL query.
5. **Lương/KPI**: qua template generic; payslip detail hiển thị các dòng lương với **phạt tách riêng**; KPI list + confirm/approve gate role.

## Architecture notes
- CSS bar chart: div width theo % từ token màu — YAGNI, không thêm lib chart.
- Đồng hồ sống: `setInterval` client, timestamptz ICT hiển thị đúng TZ.
- Manual-punch form: reuse Form pattern + ConfirmDialog. IP match trạng thái từ backend (context `ip` — `apps/api/src/context.ts:87` resolveIp), UI không tự tính.
- Lương/KPI dùng `generic-list`/`record-detail` template → ít code riêng, chỉ cấu hình cột + field.

## Related code files
- Đọc: `apps/api/src/checkin/router.ts`, `shift/router.ts`, `payroll/router.ts`, `kpi/router.ts`, `finance/router.ts` (revenue), `reconciliation/router.ts`.
- Thêm: `apps/admin/src/pages/attendance/{check-in-out,shifts}.tsx`, `pages/finance/{revenue-report,reconciliation}.tsx`, `pages/hr/{payroll,kpi}.tsx` (cấu hình template).
- File ownership: `apps/admin/src/pages/{attendance,hr}/*` + `pages/finance/{revenue-report,reconciliation}.tsx`. KHÔNG chạm `pages/finance/{receipt*,...}` (phase 03) — tách file rõ.

## Implementation steps
1. Chấm công IP + đồng hồ + manual-punch.
2. Đăng ký ca kanban + modal validate + duyệt.
3. Đối soát HOTL banner + flag deep-link + action.
4. Doanh thu stat + CSS bar.
5. Lương/KPI qua template + phạt tách dòng.
6. Verify: gate GĐ, IP-match từ backend, phạt độc lập, future-date validate.

## Todo list
- [x] Chấm công IP + manual-punch fallback
- [x] Đăng ký ca kanban + modal + duyệt
- [x] Đối soát HOTL + flag deep-link
- [x] Doanh thu + CSS bar
- [x] Lương/KPI template + phạt tách dòng
- [x] Verify gate + adversarial-lite

## Success criteria
- Check-in chỉ khi IP-match (theo backend); ngoài dải → manual-punch fallback.
- Punch không ca approved: hiển thị ghi-nhận + cờ review, KHÔNG hiện phạt.
- Đăng ký ca: future-date ICT bị chặn client+server; nút duyệt chỉ GĐ.
- Đối soát flag deep-link mở đúng phiếu `?flag=`.
- Payslip: phạt là dòng khấu trừ riêng, không trộn base/variable/KPI.
- **Verify**: build/typecheck xanh; test gate role + phạt-tách.
- **Review**: reviewer 1 vòng (spot adversarial trên đối soát/lương).

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| UI tự quyết IP-match (lệch backend) | TB×Cao | chỉ đọc trạng thái từ response |
| Phạt trộn vào thu nhập chịu thuế (méo QĐ0025) | Thấp×Cao | dòng độc lập; review chặn |
| Nút duyệt lộ cho non-GĐ | TB×TB | gate `session.me`; server chặn |
| Đối soát bị hiểu agent tự-hành-động | Thấp×TB | banner nêu rõ read-only + HITL |

## Security considerations
- Đối soát: agent `ai:recon` read-only per-facility (withFacility); UI banner nêu rõ, không cho agent tự action.
- Lương/KPI: dữ liệu tài chính nhạy — gate role chặt, không cache chéo facility.
- Manual-punch: audit actor, không cho tự duyệt (SoD server).

## Next steps
→ Phase 06 phủ nốt route quản trị + generic còn lại.
