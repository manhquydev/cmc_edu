# Worklist D2 — sinh bằng máy (không viết tay)

Ngày: 2026-08-05 · Sinh bằng `no-restricted-syntax` với 12 token đích danh.
Loại trừ: design-lab.tsx, design-lab-wireframes.tsx (bảng trưng bày nội bộ).

## A. Lint BẮT ĐƯỢC (16) — JSXAttribute > Literal

- `apps/admin/src/pages/admin/shift-config.tsx:323`
- `apps/admin/src/pages/admin/users.tsx:346`
- `apps/admin/src/pages/crm/opportunity-detail.tsx:500`
- `apps/admin/src/pages/finance/receipt-detail.tsx:230`
- `apps/admin/src/pages/finance/reconciliation.tsx:254`
- `apps/admin/src/pages/finance/refund.tsx:29`
- `apps/admin/src/pages/go-resolver.tsx:20`
- `apps/admin/src/pages/hr/my-hr.tsx:284`
- `apps/admin/src/pages/hr/my-hr.tsx:294`
- `apps/admin/src/pages/students/student-detail.tsx:182`
- `apps/admin/src/pages/students/student-detail.tsx:195`
- `apps/admin/src/pages/students/student-detail.tsx:208`
- `apps/admin/src/pages/students/student-detail.tsx:221`
- `apps/admin/src/pages/teaching/schedule.tsx:212`
- `apps/admin/src/pages/teaching/schedule.tsx:298`
- `apps/lms/src/pages/login.tsx:83`

## B. Lint MÙ (checklist tay) — JSXText / template literal / object literal

- `apps/admin/src/pages/finance/receipt-detail.tsx:231` — super_admin (template)
- `apps/admin/src/pages/finance/receipt-detail.tsx:310` — SoD (JSXText)
- `apps/admin/src/pages/finance/revenue-report.tsx:215` — server-side (template)
- `apps/admin/src/pages/finance/reconciliation.tsx:58` — super_admin (mảng)
- `apps/admin/src/pages/finance/reconciliation.tsx:259` — ai:recon (JSXText)
- `apps/admin/src/pages/hr/my-hr.tsx:257` — Net (JSXText)
- `apps/admin/src/pages/hr/payroll.tsx:386` — Net (JSXText)
- `apps/admin/src/pages/hr/salary-tiers.tsx:410` — CRUD (object literal)
- `apps/admin/src/pages/admin/network-ip.tsx:353` — CRUD (object literal)

## C. Coupled — lint không bắt nhưng trong phạm vi (đổi nhãn nút)
- `apps/admin/src/pages/hr/payroll.tsx:182` `Tính lương (assemble)`
- `apps/admin/src/pages/hr/payroll.tsx:201` `Mở lại (reopen)`

## D. NGOÀI pattern 12 token — thêm tay có chủ đích (R3)

Rule không thể bắt các mục này vì token không nằm trong pattern. Ghi ở đây để luật
"artifact thắng" không khiến chúng bị bỏ qua.

- `apps/admin/src/pages/crm/opportunity-detail.tsx:551` — `Tiến độ giai đoạn O1–O5.`
  (token `O1–O5` ngoài pattern; enum thật ở `:555-559`, không đổi)

## Luật ưu tiên (đính chính R3)

Artifact thắng bảng viết tay **trong phạm vi 12 token**. Mục ngoài pattern phải
nằm ở mục D này — nếu không sẽ bị bỏ sót một cách im lặng.

## Lệnh tái lập

```
npx eslint --config eslint.copy-audit.config.js apps/admin apps/lms -f json
```

Config audit BẮT BUỘC có `plugins` (tránh "rule not found") VÀ
`linterOptions: { reportUnusedDisableDirectives: 'off' }` — thiếu cái sau thì ra
30 problem (16 thật + 14 "Unused eslint-disable directive"), làm tiêu chí
"0 vi phạm" không đọc được.
