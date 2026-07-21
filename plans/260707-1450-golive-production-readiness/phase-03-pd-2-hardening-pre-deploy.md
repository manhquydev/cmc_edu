---
phase: 3
title: "PD-2 — Hardening pre-deploy"
status: pending
priority: P1
dependencies: [1]
effort: "3-4 ngày"
---

# Phase 3: PD-2 — Hardening pre-deploy

## Overview
Trả các món nợ hardening tự làm được (không cần creds mới) từ PD checklist: RLS thật với `cmc_app`, worker runtime riêng, trusted-proxy, rate-limit HTTP, CI-hardening, threat-checklist TL30. Chạy được song song PD-1 ở các mục không đụng auth.

## Requirements
- Functional: boot-check xác nhận RLS áp thật (ADR 0042 — RLS im lặng vô hiệu nếu connect bằng owner); worker (reconcile+relay) chạy process/container riêng có healthcheck; `x-forwarded-for` chỉ tin từ trusted proxy (ADR 0039 — chống giả IP chấm công); rate-limit tầng HTTP.
- Non-functional: CI thêm lint + e2e critical; branch protection bắt buộc CI xanh; mỗi threat CAO trong TL30 có test âm tính được trỏ tên.

## Architecture
- **RLS boot-check (RT-7):** mở rộng `apps/api/src/boot-checks.ts` (hiện CHỈ check `usesuper`, dòng 13-24 — bỏ sót owner). Owner bảng cũng bypass RLS trừ khi bảng đặt `FORCE ROW LEVEL SECURITY`. Khi start: assert current_user là `cmc_app` (không owner/superuser) + assert `relforcerowsecurity`/`rowsecurity` trên bảng RLS. **Probe KHÔNG dùng "cross-facility → 0 rows"** (vô nghĩa trên DB rỗng — Phase 4 deploy DB rỗng): thay bằng chèn 2 sentinel row ở 2 facility khác nhau (transaction rollback-able hoặc bảng probe riêng) rồi assert đúng 1 row hiển thị qua `cmc_app`. Fail → refuse start (prod).
- **Worker runtime (RT-9):** `apps/api/src/worker/index.ts` hiện KHÔNG gọi boot-check nào (chỉ `server.ts:73` gọi `assertCmcAppNotSuperuser`) — worker GHI dữ liệu (reconcile + outbox), sai URL owner = bypass RLS âm thầm. Entrypoint worker PHẢI chạy TOÀN BỘ boot-check suite trước loop. Container riêng ở phase ENV. Heartbeat chỉ advance khi drain **thành công**; healthcheck fail sau N drain lỗi liên tiếp (không đo liveness suông — loop hiện swallow mọi lỗi `worker/index.ts:37-44`).
- **Trusted-proxy (RT-5):** code spoofable thật là `resolveIp` tại `apps/api/src/context.ts:89-96` (lấy leftmost `x-forwarded-for` vô điều kiện; `checkin/router.ts:52,85` dùng `ctx.ip`). `server.ts` là raw `node:http` KHÔNG có tầng middleware. Sửa TRỰC TIẾP `resolveIp`: chỉ tin XFF khi remote addr thuộc trusted-proxy CIDR list, lấy hop phải-nhất-không-tin-cậy (không phải leftmost client-controlled). **File này đụng Phase 2 — làm SAU khi PD-1 merge hoặc cùng nhánh (RT-5).**
- **Rate-limit:** app-level đã có cho OTP (`lms-auth/router.ts` cooldown + lockout); thêm tầng HTTP (nginx `limit_req` trong stack ENV; route auth qua context factory, KHÔNG giả định middleware chain vì server.ts không có).

## Related Code Files
- Modify: `apps/api/src/boot-checks.ts` (owner + FORCE RLS + sentinel probe), `apps/api/src/worker/index.ts` (boot-check suite trước loop + heartbeat-on-success), `apps/api/src/context.ts` (RT-5 `resolveIp` trusted-proxy — SAU PD-1), `apps/api/src/server.ts` (rate-limit qua context factory), `apps/api/src/checkin/*`
- Modify: `.github/workflows/ci.yml` — **[RT-14] KHÔNG thêm job e2e mới.** Job `e2e` đã tồn tại (`ci.yml:80-126`) với `continue-on-error` (non-blocking, cố ý). Việc thật: gỡ `continue-on-error` (hoặc tách subset "e2e critical" ổn định) + thêm lint job; liệt kê ĐÍCH DANH required check cho branch protection SAU 2-3 run ổn định (job e2e đang flaky/chậm — bắt required ngay = brick main).
- Update: `docs/threat-checklist.md` — mỗi threat CAO (T4/T19/T9/T13/T16/T12/T2/T18) trỏ owner + test path âm tính cụ thể

## Tests first (TDD)
1. **RLS probe (RT-7):** connect role owner (không super) → boot-check FAIL (không chỉ super); bằng `cmc_app` → PASS; sentinel 2-facility → đúng 1 row hiển thị qua `cmc_app` (không dùng đếm 0-row trên bảng rỗng); bảng RLS thiếu FORCE RLS → FAIL.
2. **Trusted-proxy (RT-5):** test đi qua `createContext`/`resolveIp` (KHÔNG qua wrapper): `x-forwarded-for` giả từ remote addr NGOÀI trusted CIDR → IP = remote addr; từ trusted proxy → hop phải-nhất-không-tin. Test âm tính check-in giả IP.
3. **Worker (RT-9):** worker start với URL owner → boot-check FAIL không vào loop; drain thành công → heartbeat advance; N drain lỗi liên tiếp (DB unreachable) → healthcheck FAIL (không báo healthy suông).
4. **Rate-limit:** vượt ngưỡng route auth → 429; dưới ngưỡng → pass.
5. **TL30 mapping:** mỗi threat CAO trỏ ≥1 test âm tính tồn tại (grep-able tên test) — thiếu → viết bổ sung.

## Implementation Steps
1. Branch `feat/pd2-hardening`; harness story per mục.
2. Viết test (đỏ) → implement → xanh, theo thứ tự: trusted-proxy → RLS boot-check → worker healthcheck → rate-limit → CI-hardening → TL30 mapping.
3. CI: thêm lint job + e2e critical (postgres service); bật branch protection trên GitHub (required checks).
4. Gates → reviewer 1 vòng → PR → merge → changelog.

## Success Criteria
- [ ] Boot-check từ chối start khi connect bằng owner (không chỉ super) + thiếu FORCE RLS; pass với `cmc_app` (RT-7)
- [ ] Sentinel probe phân biệt được RLS-chặn vs bảng-rỗng (RT-7)
- [ ] Worker chạy full boot-check trước loop; heartbeat chỉ advance khi drain thành công (RT-9)
- [ ] Giả `x-forwarded-for` qua `resolveIp` không đổi được IP chấm công (RT-5, test qua createContext)
- [ ] CI: job e2e cũ chuyển blocking (hoặc tách critical subset) + lint job; required check liệt kê đích danh sau 2-3 run ổn định (RT-14)
- [ ] Mỗi threat CAO TL30 trỏ được test âm tính cụ thể

## Risk Assessment
- Branch protection bắt job e2e flaky = brick main (RT-14) → chỉ đưa vào required check sau 2-3 run ổn định; ưu tiên tách "e2e critical" subset ổn định.
- `context.ts` đụng Phase 2 (RT-5) → làm sau PD-1 merge hoặc cùng nhánh, không song song.
- RLS probe cần role owner để test negative → chỉ trong test env, không cấp owner cho app prod.
