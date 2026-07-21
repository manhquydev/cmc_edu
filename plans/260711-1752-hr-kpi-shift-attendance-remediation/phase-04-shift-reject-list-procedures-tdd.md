---
phase: 4
title: "Shift reject & list procedures (TDD)"
status: pending
priority: P1
dependencies: [1]
effort: "4h"
---

# Phase 4: Shift reject & list procedures (TDD)

## Overview
Khép kín vòng đăng ký ca + list procedures cho UI. Đã hấp thụ red-team #5/#7/#14/#19/#20: errorFormatter thay cause.code, cắt history/payslip.list, inbox khớp gate approve, self-read không cần key mới, ticket-lock premise sửa đúng.

## Requirements
- `shift.reject({registrationId, reason})`: key `shift.approve` + group-type gate + anti-self (tái dùng logic approve); submitted→rejected; reason min 3 ký tự; ticket-lock tự giải phóng (idx WHERE `status='submitted'` — rejected ∉ WHERE; **KHÔNG sửa idx**).
- `shift.submit` validation mới: (a) mọi `entries[].date` ∈ `[fromDate, toDate]`; (b) overlap — user có registration `submitted|approved` giao cắt khoảng ngày → CONFLICT (cancelled/rejected không tính; bất kể shift group — 1 người 1 khoảng active, ghi QĐ docs/20); (c) **MULTIPLE: trùng (date, shiftTemplateId) trong cùng registration → BAD_REQUEST** (R3-8 — chặn thổi công bằng entry lặp; SINGLE dedup đã có).
- **errorFormatter (red-team #5, siết R2 #H1)**: thêm vào `apps/api/src/trpc.ts` — **BẮT BUỘC qua class `AppCodeError` riêng (instanceof check) hoặc const allowlist** (`IP_NOT_ALLOWED`, `COOLDOWN`, …); **KHÔNG copy `cause.code` generic** — payroll router rethrow raw Prisma errors (router.ts:259), copy generic sẽ leak `P2xxx` ra client. Negative test bắt buộc: raw Prisma/unknown cause → `data.appCode === undefined`. Additive vào `shape.data`, typecheck admin + lms sau khi sửa.
- checkin router: IP-mismatch → `appCode: 'IP_NOT_ALLOWED'`, cooldown → `'COOLDOWN'`; message cũ GIỮ nguyên (backward-compat log + UI cũ chưa migrate vẫn chạy).
- List/read procedures (CẮT so bản cũ — red-team #19/#20):

| Procedure | Guard | Trả về |
|---|---|---|
| `shift.listGroups` | protected (mọi role active) | groups + templates lồng (dropdown; unblock shift-config) |
| `shift.myRegistrations` | protected self — KHÔNG key mới | registrations + entries + status + rejectReason |
| `shift.pendingForApproval` | key `shift.approve` | submitted theo group-type GĐ (super_admin cả hai) + tên người nộp |
| `manualPunch.list` | inbox: `owner.managerId === caller` (khớp gate approve — red-team #14) + super_admin; mine: protected self | `{scope:'inbox'\|'mine', status?}` |

- **Gate `manualPunch.approve/reject` PHẢI sửa cùng lúc (R2 #H2)**: hiện chỉ direct-manager, KHÔNG có super_admin bypass (checkin/router.ts:143-152,183-186) → super_admin thấy inbox mà không duyệt được; ticket của 2 GĐ (managerId null) không ai duyệt được → phạt vĩnh viễn cho GĐ, phá AC miễn-phạt. Fix: gate = `owner.managerId === reviewer.id` **HOẶC caller là super_admin**; test: super_admin duyệt ticket GĐ OK, sale duyệt ticket người khác FORBIDDEN.
| `payslip.my` | protected self | `{period}` → payslip của tôi (null nếu chưa assemble) |

- **ĐÃ CẮT**: `checkInOut.history` (feature mới ngoài remediation scope), `payslip.list` (flow GĐ hiện có user.list→getForUser hoạt động; nâng cấp UX để sau). `kpi.myScore`/`kpi.list` thuộc phase 3.

## Related Code Files
- Modify: `apps/api/src/trpc.ts` (errorFormatter — additive)
- Modify: `apps/api/src/shift/router.ts` (reject + validation + 3 procedures)
- Modify: `apps/api/src/shift/register-approve.test.ts` (mở rộng)
- Create: `apps/api/src/shift/reject-validate.test.ts`
- Modify: `apps/api/src/payroll/router.ts` (payslip.my)
- Modify: `apps/api/src/checkin/router.ts` (manualPunch.list + appCode)
- Modify: `packages/auth/src/index.ts` + test (CHỈ thêm `shift.reject` nếu tách key; mặc định tái dùng `shift.approve` — KHÔNG key mới cho self-reads)

## Implementation Steps (TDD)
1. Tests reject: đúng người/sai group/anti-self/reason rỗng/approved-không-reject-được; ticket-lock free sau reject (submit mới OK).
2. Tests validation: entry ngoài range → BAD_REQUEST; overlap → CONFLICT; cancelled/rejected không block.
3. Tests list: scoping self vs GĐ vs cross-facility (RLS); pendingForApproval đúng group-type; manualPunch inbox chỉ thấy ticket của cấp dưới trực tiếp.
4. Tests errorFormatter: client-shape chứa `data.appCode` cho IP/cooldown; message không đổi; **negative: Prisma/unknown error → appCode undefined**. Tests approve gate: super_admin bypass + ticket GĐ.
5. Implement. `gitnexus_impact` cho `submit`/`approve`/`punch` + trpc.ts trước khi sửa.
6. `pnpm --filter @cmc/api test` + admin typecheck (+ lms typecheck vì error shape chung).

## Success Criteria
- [ ] Reject + validation + 5 procedures xanh, RLS-scoped.
- [ ] `err.data.appCode` xuất hiện ở client shape (test qua createCaller/e2e client, không chỉ server-side).
- [ ] Không thêm permission key nào cho self-read.

## Risk Assessment
- errorFormatter đụng shape toàn cục — additive-only, có test snapshot shape cũ không đổi field.
- Overlap rule "bất kể group" là QĐ mới → docs/20 phase 6; nếu nghiệp vụ sau cần đăng ký 2 nhóm ca song song, nới sau bằng QĐ.
