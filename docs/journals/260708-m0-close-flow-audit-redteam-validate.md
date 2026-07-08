# M0 Closure: Flow Audit Phase + Red-Team Pushback Applied

**Date**: 2026-07-08 09:30  
**Severity**: High  
**Component**: UAT Sprint Planning, Phase 3→4, Flow Audit Insertion  
**Status**: Resolved (plan updated, red-team feedback integrated)

## What Happened

Planning session chốt 5 quyết định để đóng M0 → GO live:

1. **Cloudflare R2 Credentials**: Cấp ngay cho restore drill (không hoãn)
2. **G7 Deployment Mode**: Dịch từ second-person sang G7-nhẹ (env-check + boot-checks + dev-seam grep ~15 phút)
3. **Mailbox Graph**: Đã licensed sẵn, dùng ngay
4. **Flow Audit Phase**: Chèn TRƯỚC UAT, mục tiêu trace 28 WF ↔ code, kiểm 9 role hồ sơ, ≥5 chuỗi vai trò liên tiếp, phát hiện mâu thuẫn tài liệu
5. **Plan Update**: UAT phase 3 → 4, thêm phase-03-flow-audit.md

## The Brutal Truth

Red-team session 2 phát hiện 3 vấn đề CRITICAL mà ban đầu bị bỏ sót:

1. **Stale Image Race**: E2E spawn server riêng → test xanh giả tín hiệu trong khi docker stack chạy image cũ thiếu fix. Phải thêm bước redeploy vào Phase 4.
2. **Audit Method Mù**: Trace xuôi từ PERMISSIONS key bị chứng minh bỏ lỡ gate inline (shift.cancel router.ts:267) VÀ grep chấm match 0 call-site vì requirePermission('module','action') 2 tham số. Phải đảo chiều: liệt kê mọi mutation/query thay vì theo permission key.
3. **PII Backup Unencrypted**: Dump backup R2 chứa dữ liệu trẻ em không mã hoá. Lệnh rm không chạy khi fail vì set -e. Fix: encrypt client-side + trap EXIT.

Tất cả 15 finding (sau dedup từ 20) đều được apply. Không có issue mở.

## Technical Details

- **Registry**: 9 role (cskh, ctv_mkt, hr...) có trong code nhưng user không nhớ
- **Test Coverage Claim vs Reality**: TL25 tuyên bố "không mồ côi" nhưng cột Test chỉ 6/28 file tồn tại — tuyên bố trên giấy chưa từng kiểm chứng ngược code
- **Audit Scope**: 4 hạng mục cụ thể, độc lập; 2 lượt whole-plan sweep đã khử 7 stale reference
- **L1 Roster**: Pre-resolved phiếu duyệt, code [GĐKD, GĐĐT, Kế toán] đúng, TL25 là doc lỗi thời

## Root Cause Analysis

Tại sao audit method ban đầu mù:

- Giả định trace từ PERMISSIONS data đủ → sai, bỏ lỡ gate được bảo vệ bằng inline check (router middleware, direct requirePermission call)
- Chưa liệt kê toàn bộ mutation/query point → không có cơ sở gọi audit đủ
- Stale image race: chưa kiểm kỹ sự khác biệt giữa e2e test spawn vs production docker stack deployment

## Lessons Learned

1. **Audit direction**: Luôn liệt kê toàn bộ call-site MỚI (mutations, queries, API endpoints) rồi mapping ngược PERMISSIONS, chứ không trace xuôi từ data structure
2. **PII Backup Hygiene**: Encrypt client-side TRƯỚC dump → trap EXIT để rm chắc chắn, không rely set -e
3. **Test Claims Need Reverse Check**: Khi TL25 hoặc doc nào tuyên bố coverage/completeness, phải verify code reality trước quyết định lên UAT
4. **E2E vs Production Parity**: Spawn server trong test ≠ docker stack production. Thêm redeploy step, hoặc snapshot image trước e2e

## Next Steps

1. Phase 4 deploy: redeploy docker stack trước start e2e (Phase 4 step 0)
2. Flow audit: liệt kê mọi mutation/query, mapping PERMISSIONS, trace 5+ role chain
3. R2 lifecycle + client encryption: implement trap EXIT, test rm success on fail
4. L1 roster: duyệt phiếu pre-filled, tránh stall giữa audit phase

---

**Status**: DONE  
**Summary**: 5 quyết định chốt M0, 15 red-team finding applied, 3 CRITICAL issues fixed; flow audit phase inserted trước UAT, whole-plan consistency verified.
