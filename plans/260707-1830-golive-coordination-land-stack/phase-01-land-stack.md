---
phase: 1
title: Land-Stack
status: completed
priority: P1
dependencies: []
---

# Phase 1: Land-Stack

## Overview
Đưa toàn bộ stack tuyến tính (pd1⊂pd2⊂env⊂uat) vào `main` bằng 1 lần merge PR #16,
sau khi push 2 fix để CI xanh; đóng 3 PR con, xoá nhánh. main xanh 1 nhịp.

## Requirements
- Functional: `main` chứa trọn nội dung 7 commit; #16 merged; #13/#14/#15 đóng; nhánh con xoá.
- Non-functional: không merge PR đỏ CI; không mất commit fix; lịch sử main không rối.

## Architecture
Topology hiện tại (đã verify):
```
main c444200
 └ 255c485 pd1  (#13)
   └ 252f4da pd2 (#14, sinh bug boot-check)
     └ 11175ed env (#15)
       └ 1ee7b66 uat
         └ 510193b fix pd1 review
           └ 1fa9fd2 fix e2e-green [chưa push]   ← chứa fix boot-check + FORCE-RLS migration
             └ 6994fc8 gkg mcp    [chưa push]   ← HEAD (#16)
```
Vì #16 chứa mọi thứ, merge #16 = land tất cả. Fix e2e (`1fa9fd2`) xanh hoá CI cho chính #16.

## Related Code Files
- Modify (git ops, không sửa code): push `feat/uat-session-injection`; PR #16 merge.
- Không tạo/xoá file nguồn trong phase này.

## Implementation Steps
1. `git push origin feat/uat-session-injection` (đẩy 1fa9fd2 + 6994fc8).
2. Chờ CI #16: typecheck+unit+e2e phải SUCCESS. Nếu e2e-CI vẫn đỏ → chẩn theo thứ tự:
   (a) migration `20260707190000_force_rls_on_rls_tables` có chạy trong job e2e không (job dùng `prisma migrate deploy`);
   (b) **[RT-B] job có tạo role `cmc_app` + set `APP_DATABASE_URL` + connect KHÔNG bằng superuser không** — pd2 thêm boot-check non-superuser + FORCE-RLS; nếu CI connect bằng postgres owner/superuser thì boot-check throw → e2e đỏ vì lý do này chứ không phải fix sai. Sửa CI provisioning trước khi merge (KHÔNG merge đỏ).
3. Xác nhận #16 base=main, mergeable, 0 Critical/High tồn đọng từ CodeRabbit.
4. Merge #16 vào main (merge-commit hoặc squash — chọn merge-commit để giữ 7 commit rành mạch; squash nếu muốn 1 commit gọn). Ghi rõ trong PR mô tả rằng #13/#14/#15 được cuốn theo.
5. Đóng #13/#14/#15 với comment "nội dung đã land qua #16 (stack tuyến tính)".
6. Xoá nhánh remote: `feat/pd1-real-integrations`, `feat/pd2-hardening`, `feat/env-prod-stack`; nhánh local tương ứng.
7. `git checkout main && git pull` → xác nhận `git rev-list --count origin/main..HEAD == 0`.

## Success Criteria
- [ ] #16 CI: typecheck+unit+e2e đều SUCCESS trước merge.
- [ ] #16 merged vào main; #13/#14/#15 CLOSED (không MERGED).
- [ ] 3 nhánh con xoá (remote + local); chỉ còn `main` (+ nhánh làm việc mới nếu cần).
- [ ] `main` local = origin/main; typecheck+test local xanh trên main.

## Risk Assessment
- R1 (merge PR đỏ): mitig存 — gate step 2 chặn merge tới khi e2e-CI xanh.
- R4 (mất fix chưa push): mitigate — step 1 push trước mọi thao tác merge.
- Rủi ro CI-e2e môi trường: migration mới phải nằm trong `prisma migrate deploy` path của CI; nếu CI e2e dùng DB seed khác → xác minh FORCE-RLS áp trước khi API boot. Stop-condition nếu e2e-CI đỏ vì lý do khác local.
- Rollback: nếu main đỏ sau merge và không fix trong 1 lượt → `git revert` merge-commit của #16.
