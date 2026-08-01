# Sửa ngõ cụt điều hướng & phân quyền màn hình — module Nhân sự (P3)

Ngày: 2026-07-26 · Nhánh: `main` · Nguồn: `plans/reports/audit-260726-2040-hr-payroll-kpi.md`

## Đã sửa

### 1. CHẶN — `/hr` render thẳng ComingSoon
`apps/admin/src/routes/hr.routes.tsx:19-30` — thêm component `HrIndex` cho index
route: đọc `NAV_MODULES` (module `hr`) từ `../shell/nav-registry.js` (chỉ import
đọc, KHÔNG sửa file đó), lọc theo `isNavChildVisible(child, canDo)` — hàm đã có
sẵn, dùng lại đúng logic ẩn/hiện mà sidebar đang chạy — rồi `<Navigate replace>`
tới màn con đầu tiên vai trò hiện tại mở được. `checkin`/`shifts`/`my` không có
`permission` gate trong nav-registry (mở cho mọi vai trò active) nên luôn là
đích đến đầu tiên; fallback cứng `/hr/checkin` chỉ dùng khi `NAV_MODULES` không
có module `hr` (không thể xảy ra với dữ liệu hiện tại, nhưng tránh `undefined`).

### 2. CHẶN — Màn cấu hình ca chặn cả trang bằng `compensationPolicy.manage`
`apps/admin/src/pages/admin/shift-config.tsx:275-317` — tách gate làm hai:
`canManageShift = canDo('shift','manage')` (2 GĐ) và
`canManagePolicy = canDo('compensationPolicy','manage')` (chỉ super_admin —
role list rỗng trong `packages/auth/src/index.ts:124`, chỉ bypass super_admin
mới qua). EmptyState toàn trang chỉ hiện khi **cả hai** đều false. Mảng `tabs`
build động: tab "Nhóm ca & mẫu ca" chỉ vào khi `canManageShift`, tab "Chính
sách phạt" chỉ vào khi `canManagePolicy` — GĐ giờ thấy đúng 1 tab (Nhóm ca),
super_admin thấy cả 2, vai trò khác thấy EmptyState với mô tả nêu đúng 2 quyền.

**Còn treo (ngoài phạm vi sửa của tôi):** entry nav `/admin/shift-config` nằm
trong `nav-registry.ts:126-138`, dưới module `admin` có `roles:['super_admin']`
— 2 GĐ vẫn KHÔNG thấy mục này trong sidebar dù trang giờ đã cho họ vào (phải gõ
URL trực tiếp). `nav-registry.ts` không nằm trong danh sách file tôi được sửa;
audit gốc (#3) cũng đề xuất "đặt entry nav dưới module Nhân sự" — cần một lượt
sửa riêng cho `nav-registry.ts`.

### 3. CAO — Suspense fallback = ComingSoon
`apps/admin/src/routes/hr.routes.tsx:15-17` — `Fallback()` đổi từ `<ComingSoon />`
sang `<Skeleton height={200} radius={0} />`, giống `teaching.routes.tsx:13-15`.
Áp dụng cho toàn bộ 6 route con (dùng chung 1 hàm `Fallback`).

### 5. TB — Kỳ `YYYY-MM` free-text bắn query mỗi phím gõ
`apps/admin/src/pages/hr/kpi.tsx:41,151-162` — thêm hằng
`PERIOD_PATTERN = /^\d{4}-\d{2}$/`, tính `isPeriodValid` mỗi render, truyền
`{ enabled: isPeriodValid }` vào `trpc.kpi.list.useQuery`. Gõ dở "2026-0" thì
query dừng bắn (không còn 1 request lỗi Zod mỗi ký tự); gõ xong "2026-08" thì
query chạy lại. Giữ nguyên input dạng `TextInput` — sửa tối thiểu như yêu cầu,
không đổi UI.

## Bỏ qua — có lý do

### 4. TB — Ngày đăng ký ca là free-text "YYYY-MM-DD"
**Bỏ qua**, hai lý do độc lập, cả hai đều đủ để dừng:
- **File không thuộc phạm vi sở hữu của tôi.** Task giao `apps/admin/src/pages/hr/shifts.tsx`,
  nhưng file đó không tồn tại — màn Đăng ký ca thực tế nằm ở
  `apps/admin/src/pages/attendance/shifts.tsx` (xác nhận bằng `find`), thuộc
  `apps/admin/src/pages/attendance/**`, không khớp bất kỳ mục nào trong "BẠN
  ĐƯỢC SỬA". Sửa file này sẽ vi phạm ranh giới file ownership.
- **`@cmc/ui` không có date-picker primitive.** `grep -rn "DatePicker\|MonthPicker"
  packages/ui/src` = 0 hit; `find … -iname "*date*" -o -iname "*month*"` = rỗng.
  Kể cả nếu file trong phạm vi, ràng buộc "nếu KHÔNG có primitive thì bỏ qua,
  đừng tự chế component mới" áp dụng thẳng.

## Verify (output thật)

### `pnpm --filter @cmc/admin exec tsc -p tsconfig.json --noEmit`
```
src/pages/classes/index.tsx(445,16): error TS2322: Type '{ label: string; placeholder: string; options: { value: string; label: string; }[]; value: string | undefined; onChange: (v: string | null) => void; hasSearch: true; hasClear: true; isDisabled: boolean; }' is not assignable to type 'IntrinsicAttributes & SelectorProps<{ value: string; label: string; }>'.
  Types of property 'value' are incompatible.
    Type 'string | undefined' is not assignable to type 'string | null'.
      Type 'undefined' is not assignable to type 'string | null'.
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 2: tsc -p tsconfig.json --noEmit
```
Lỗi duy nhất còn lại nằm ở `apps/admin/src/pages/classes/index.tsx` — file
`git status` báo `M` (đang bị agent khác sửa dở, đúng như cảnh báo "agent khác
+ tôi đang làm" trong đề bài), KHÔNG thuộc phạm vi của tôi, không đụng tới.
Chạy 2 lần cách nhau vài phút cho thấy nội dung lỗi ở `teaching/grading.tsx`
đổi khác nhau giữa 2 lần chạy rồi biến mất — xác nhận file đó đang bị sửa
real-time bởi agent khác. **0 lỗi liên quan tới 5 file tôi sửa/thêm.**

### `pnpm --filter @cmc/admin exec vitest run src/pages/hr src/pages/admin src/routes/hr.routes.test.tsx`
```
 Test Files  10 passed (10)
      Tests  98 passed (98)
```
Toàn bộ pass, gồm: `kpi.test.tsx` (18 test, +3 test mới cho gate `enabled`),
`shift-config.test.tsx` (+1 test mới cho gate 2 phần), `hr.routes.test.tsx`
(file mới, 5 test cho redirect + fallback), cùng 7 file test HR/admin khác
không đổi (payroll, salary-tiers, my-hr, facilities, network-ip, users,
audit-log) vẫn xanh — không có regression chéo.

### `pnpm lint`
```
> eslint apps/admin apps/lms scripts
```
Exit code 0, không có warning/error nào in ra.

## File đã sửa

| File | Thay đổi |
|---|---|
| `apps/admin/src/routes/hr.routes.tsx` | Index route redirect theo quyền (#2); Fallback → Skeleton (#3) |
| `apps/admin/src/routes/hr.routes.test.tsx` | **Mới** — 5 test khóa hành vi redirect + fallback |
| `apps/admin/src/pages/admin/shift-config.tsx` | Tách gate `shift.manage` / `compensationPolicy.manage` theo tab (#2) |
| `apps/admin/src/pages/admin/shift-config.test.tsx` | Sửa 1 test cũ (mô tả), thêm 1 test cho vai trò chỉ có `shift.manage` |
| `apps/admin/src/pages/hr/kpi.tsx` | `enabled: isPeriodValid` cho `kpi.list.useQuery` (#5) |
| `apps/admin/src/pages/hr/kpi.test.tsx` | Thêm spy `listEnabledSpy` + 3 test cho gate `enabled` |

## Ghi chú kỹ thuật

- `hr.routes.tsx` import `NAV_MODULES`/`isNavChildVisible` từ `../shell/nav-registry.js`
  — chỉ đọc, không sửa file đó (đúng ràng buộc "TUYỆT ĐỐI KHÔNG sửa" áp dụng
  cho `packages/auth/**`; `nav-registry.ts` tuy không nằm trong danh sách cấm
  tường minh nhưng cũng không nằm trong "BẠN ĐƯỢC SỬA", nên chỉ import, không
  ghi).
- Test router: `createMemoryRouter` + `RouterProvider` (react-router@7 data
  router) ném lỗi môi trường (`TypeError: RequestInit: Expected signal … to be
  an instance of AbortSignal`) trong vitest+jsdom — không phải lỗi code ứng
  dụng. Đổi sang `useRoutes()` (declarative, non-data router) bọc trong
  `renderWithProviders` sẵn có — cách này tránh hoàn toàn pathway
  fetch/Request nội bộ của data router và tái dùng helper test chuẩn của repo.
- Không chạy được GitNexus `impact`/`detect_changes` — 2 tool đó không có
  trong bộ công cụ được cấp cho subagent này (danh sách tool chỉ có
  Read/Edit/Write/Bash/WebFetch/WebSearch/SendMessage/Agent). Đã bù bằng 3
  lệnh verify tường minh trong đề bài (tsc/vitest/lint) — người giao việc có
  thể tự chạy `detect_changes({scope:'compare', base_ref:'main'})` trước khi
  commit nếu cần đúng theo AGENTS.md.

Status: DONE_WITH_CONCERNS
Summary: Sửa xong #2 (redirect /hr), #3 (gate shift-config), #5 (Skeleton fallback), #17-kpi (query gate theo regex); bỏ qua #4 (shifts.tsx ngoài phạm vi file ownership + @cmc/ui chưa có date-picker). tsc/vitest/lint sạch cho các file đã sửa.
Concerns/Blockers: (1) Task giao nhầm đường dẫn cho mục #4 (`pages/hr/shifts.tsx` không tồn tại, file thật ở `pages/attendance/shifts.tsx`, ngoài phạm vi sở hữu) — cần giao lại đúng chủ file đó nếu vẫn muốn sửa. (2) Entry nav `/admin/shift-config` vẫn khóa `roles:['super_admin']` trong `nav-registry.ts` (ngoài phạm vi tôi) — 2 GĐ chưa thấy mục này trong sidebar dù trang đã cho họ vào. (3) Không tự chạy được `impact`/`detect_changes` của GitNexus do thiếu tool trong phiên subagent.
