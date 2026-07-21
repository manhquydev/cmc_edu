---
phase: 4
title: "M4 Multi-facility rollout"
status: pending
priority: P1
dependencies: [3]
detail: structural
---

# Phase 4 (M4) — Multi-facility rollout (structural)

> **Structural plan** — phase file chi tiết tạo just-in-time khi M3 gần xong. Lý do: cần **danh sách +
> số cơ sở CMC thật** (user: "tất cả cơ sở CMC hiện có" — con số cụ thể chưa chốt). Dưới đây khung + ràng buộc.

## Overview
Onboard toàn bộ cơ sở CMC còn lại lên cùng stack (sau khi pilot 1 cơ sở ổn định M1). Chứng minh
**cross-facility RLS isolation** trên vận hành thật — không chỉ test âm tính. Đây là milestone đóng
Definition of Final Done điểm 4.

## Scout hiện trạng (2026-07-08)
- RLS `withFacility` + `cmc_app` + FORCE-RLS boot-check đã có (PD-2); test âm tính cross-facility có
  (`finance/rls-negative.test.ts`, `security/rls-enforcement.test.ts`).
- `facility.create` (super_admin bypass requireValidFacility) + `scripts/seed-super-admin.ts` (upsert facility) đã có.
- Thiếu: runbook onboard per-facility; audit isolation trên data thật đa cơ sở.

## Ràng buộc bất biến
- Mỗi cơ sở = 1 `Facility` + AppUser scoped; RLS `withFacility` chặn chéo (ADR 0042).
- Không tenant tách DB — cùng DB, RLS phân tách (kiến trúc hiện tại). SaaS multi-tenant ngoài CMC = OUT (roadmap §1).
- Seed super_admin per-facility qua bootstrap script; role assignment chỉ super_admin (RT-γ).

## Khung bước (chi tiết hoá khi tới milestone)
1. **Chốt danh sách cơ sở** (số lượng, tên, mã) — stop-condition, cần user.
2. **Runbook onboard per-facility:** seed Facility + AppUser + FacilityNetwork (IP chấm công) + super_admin;
   idempotent; ghi checklist per-facility.
3. **Onboard tuần tự** từng cơ sở; smoke mỗi cơ sở (login staff + RLS scope đúng).
4. **Isolation audit vận hành thật:** verify staff cơ sở A không thấy data cơ sở B qua UI/API thật
   (không chỉ unit test) — sample mỗi domain chạm tiền/HS.
5. **Harness:** cook (runbook + seed) → code-review → test → scenario (cross-facility leak edge) → docs.

## Success Criteria (sơ bộ — chốt tại phase detail)
- [ ] Tất cả cơ sở CMC live trên stack.
- [ ] Runbook onboard per-facility idempotent, dùng thật.
- [ ] Cross-facility isolation audit pass trên vận hành thật (sample mỗi domain nhạy cảm).
- [ ] roadmap doc cập nhật M4 completed → Definition of Final Done đóng.

## Risk Assessment
- Danh sách cơ sở chưa chốt → stop-condition bước 1.
- RLS leak khi scale đa cơ sở → audit thật bắt buộc (test âm tính không đủ bằng chứng vận hành).
- Onboard big-bang nhiều cơ sở cùng lúc → tuần tự, mỗi cơ sở smoke trước cơ sở kế (không big-bang).
- IP chấm công (FacilityNetwork CIDR) sai per-facility → chấm công lỗi; verify mỗi cơ sở.
