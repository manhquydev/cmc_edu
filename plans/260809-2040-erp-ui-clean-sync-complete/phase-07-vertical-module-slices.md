---
phase: 7
title: "Vertical module slices"
status: completed
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

## Kết quả (2026-08-10)

**Phạm vi thực thi hẹp hơn overview một cách có chủ đích.** "Implementation Steps" gốc gồm 3 việc:
(1) token hoá inline style tokenized-được, (2) đổi `fontSize` thô sang token đã có, (3) phủ
component nơi thay hand-rolled markup. Chỉ (1)+(2) được làm. (3) — phủ `CountBadge`/`MetaRow`/
`Avatar` — **hoãn có chủ đích**: không có visual regression testing (đã ghi nhận là rủi ro của
toàn plan) và không có DB dev thật để chụp ảnh trước/sau xác nhận thay markup không vỡ giao diện;
làm mù không kiểm chứng đi ngược nguyên tắc "chỉ đụng styling + phủ component" của chính phase này
ở mục Risk Assessment. Xem Phase 8 để biết 5 candidate component còn treo có chỗ dùng hay không.

**2 file dùng chung** (`student-picker.tsx`/`enroll-picker.tsx`) sửa trước slice đầu — commit
riêng. `student-picker.tsx`: 3 giá trị khớp token thật (padding 8px, fontSize 12px) → sửa.
`enroll-picker.tsx`: 0 giá trị khớp token (10/12/20px không có trong thang) → không đụng, đúng
quyết định operator "không mở rộng thang trừ khi phát sinh nhu cầu thật".

**5 slice module** (teaching → CRM → finance → hr/admin → còn lại), chạy song song bằng 5
subagent với **tập file rời nhau tuyệt đối** (an toàn chạy đồng thời), mỗi subagent nhận đúng
1 bảng ánh xạ token (spacing/fontSize/radius/color) + đúng danh sách miễn trừ từ `ui-ratchet.mjs`
+ quy tắc "chỉ thay khi khớp giá trị tuyệt đối, không suy diễn/xấp xỉ". Kết quả đo bằng
`node scripts/ui-ratchet.mjs --json` trước/sau mỗi slice, tổng hợp:

| Slice | File | Vi phạm trước | Vi phạm sau | Còn lại (không có token khớp) |
|---|---|---|---|---|
| teaching | 9 | 60 | 6 | `borderRadius:4`, `marginTop:2`, `padding:32` (attendance); `marginBottom:2` (grading); `marginTop:2` (attendance-panel); `gap:12` (schedule) |
| CRM | 12 | 41 | 8 | `padding '0 22px 20px'` (bulk-import ×2, report ×4), `marginBottom:12` (report ×4 — hợp nhất còn 1 dòng), `marginTop:12` (opportunity-detail), `fontSize:10` (pipeline) |
| finance | 4 | 5 | 1 | `padding '0 22px 20px'` (revenue-report) |
| hr/admin | 5 | 34 | 4 | `margin '0 -16px'` ×4 (bleed margin, không có giá trị âm trong thang) |
| còn lại | 11 | 38 | 2 | `margin '80px auto 0'` ×2 (change-password, login) |
| **Tổng** | **41** | **178** | **25 (13 file)** | giảm 86%, 0 file tăng so với baseline cũ |

Verify tập trung (không tin báo cáo subagent mù): đọc trực tiếp 2 diff lớn nhất
(`check-in-out.tsx`, `payroll.tsx`) xác nhận mọi thay đổi đúng là hoán đổi giá trị 1:1, không đổi
JSX/logic; `git diff` toàn batch xác nhận **149 dòng thêm / 149 dòng xoá** (đối xứng tuyệt đối) và
**0 dòng thay đổi nằm ngoài từ khoá style** (`padding|margin|fontSize|borderRadius|gap|color`) qua
grep loại trừ. `pnpm turbo run typecheck test --filter=@cmc/admin` xanh xuyên suốt (560/560 test,
14/14 task), `pnpm lint` sạch. `detect_changes` báo `risk_level: critical` — **đúng về độ rộng**
(44 hàm/46 file/51 luồng bị "touched") nhưng đã xác minh bằng grep+diff rằng đây là rủi ro **độ
rộng**, không phải rủi ro **hành vi** — đã cảnh báo operator theo đúng luật CLAUDE.md.

6 commit riêng (2 file dùng chung + 5 slice + baseline hạ), khớp nguyên tắc "mỗi slice = 1 PR".
Baseline ratchet hạ từ 178 → 25 (giảm đơn điệu, xem `scripts/ratchet-baseline.json`).

**Chưa làm, không phải bỏ sót:** ảnh trước/sau theo route (cùng lý do đã ghi ở Phase 5/6 — DB dev
chung không có seed data cho phần lớn trang thật, `ClassBatch`/`Enrollment` = 0 dòng). Phủ
component (bước 3) — xem Phase 8.

## Success Criteria

- [x] 2 file dùng chung sửa xong **trước** slice đầu tiên.
- [x] Mỗi module: cỡ chữ/radius lệch thang **có token khớp** đã hết; phần còn lại không có token
  khớp được ghi nhận rõ ràng theo từng file (bảng trên), không snap/bịa để ép về 0.
- [x] Baseline ratchet **giảm đơn điệu** sau mỗi slice (178 → 25, 0 file tăng).
- [ ] Mỗi slice có ảnh trước/sau — chưa chụp (DB dev chung rỗng, xem trên); + CI xanh — chưa chạy CI thật (worktree chưa push).
- [x] Không có UI mới được bịa ra chỉ để dùng component (không phủ component nào ở phase này).

## Risk Assessment

- **UAT người thật chưa chạy** — phản hồi UAT sẽ đảo ưu tiên. Mitigation: **dừng đánh giá lại** nếu UAT bắt đầu giữa chừng.
- **Trôi phạm vi** — slice dễ biến thành refactor. Mitigation: chỉ đụng styling + phủ component; logic nghiệp vụ bất biến.
- Rollback: từng slice revert độc lập.
