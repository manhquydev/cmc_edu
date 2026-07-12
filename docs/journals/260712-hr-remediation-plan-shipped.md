# HR Remediation Plan: 7-Phase Delivery + 3-Agent Audit + Ship to Main

**Date**: 2026-07-12  
**Severity**: High (multi-domain delivery: schema + payroll + KPI + shift + session-done + UI + docs)  
**Component**: `packages/db`, `apps/api` (kpi/payroll/shift/checkin/class/session-evidence/worker/scripts), `packages/domain-payroll`, `packages/domain-time`, `packages/auth`, `apps/admin` (nav + 8 HR screens), `apps/e2e`, `docs/*`  
**Status**: READY TO MERGE (10 commits, api 695/695, admin 229/229, build 14/14, audit 108/111 clean)

---

## Bối cảnh

Plan `260711-1752-hr-kpi-shift-attendance-remediation` (blockedBy premium ERP screen build-out, đã unblock từ 2026-07-11). Kế hoạch estimate ~58h công qua 9 quyết định gốc + 4 vòng red-team (79 findings, 0 rejected) + 4 vòng validation. Scope:

- Schema HR mở rộng: SalaryTier (bậc lương per-facility), CompensationPolicy, KpiScore snapshot cols, ShiftRegistration.rejectReason, SessionStatus.done + doneAt + makeupForSessionId, Receipt.approvedAt + createdByAppUserId backfill.
- Đổi mô hình lương từ tuyến tính kpiMax cũ → `base(tier) + %côngca × %chỉ-số × đơn giá − phạt(per-ca)`.
- KPI lifecycle 4 bước (draft→submitted→confirmed→approved) + anti-self toàn tuyến + bulkApprove chỉ phiếu payslip finalized + van super_admin-approved-khi-reopen.
- Session-done engine sweep-only (bỏ event hooks — R2 finding race crossed-tx), auto-cancel + tail-append makeup buổi bù.
- Shift reject + list procedures + errorFormatter AppCodeError.
- 5-role nav + rebuild 8 HR screens trên premium template.
- 2 E2E specs (cắt từ 5) + docs sync.

## Pipeline triển khai

Session tự động qua 3 mode chính:

1. **7 phase execution** — orchestrator delegate mỗi phase cho 1 fullstack-developer subagent với plan tự chứa, verify + commit lần lượt. Không mở lại phase đã ship.
2. **3-agent audit song song** — sau khi 7 phase committed, spawn 3 code-reviewer độc lập audit backend / UI / e2e-docs, mỗi agent verify against actual code (không tin claim).
3. **Ship pipeline** — fix gap còn sót → run full gate → commit → PR.

### Thứ tự phase thực tế (dependency graph)

```
Phase 1 (schema)  ─┬─► Phase 7 (session-done)
                   ├─► Phase 4 (shift reject) ─┐
                   └─► Phase 2 (payroll) ──────┼─► Phase 3 (KPI) ─► Phase 5 (UI) ─► Phase 6 (E2E + docs)
                                              ─┘
```

Thời gian thực tế: ~4 giờ orchestrator wall-clock (subagent chạy parallel + background), tổng effort đo bằng token subagent ≈ tương đương 58h estimate.

## Kết quả

**8 commit chính + 2 fix commit:**

```
edd374e fix(db): raise withFacility $transaction timeout 5s→15s (fix audit GAP 1 — full-suite flake)
3f7575d docs(06): fix stale URL routes (salary-structure → salary-tiers, my-payslip → my)
25384c2 chore(gitnexus): refresh symbol counts
5101f4d feat(e2e,docs): phase 6 — E2E specs + docs sync + ADR 0042
e6bf255 feat(admin,api): phase 5 — 5-role nav + HR screens rebuild
367d822 feat(api,auth,admin): phase 3 — KPI auto-score + 4-step lifecycle
5ed8616 feat(api,domain-payroll,auth): phase 2 — tier salary + per-shift penalty + policy
a8ce75c feat(api): phase 4 — shift reject + list + errorFormatter
3e1fc81 feat(api,domain-time): phase 7 — session-done + sweep + backfill
a72662f feat(db,api): phase 1 — schema + migration + writers + backfill
```

**Final gate:**
- `pnpm --filter @cmc/api test` → **695/695** (81 files, 3 phút)
- `pnpm --filter @cmc/admin test` → **229/229** (32 files)
- `pnpm build` → **14/14**
- `pnpm --filter @cmc/e2e test` → 19 pass + 1 skip (Mode-B secrets khi có)
- Typecheck: api + admin + lms sạch

## Audit findings

3 code-reviewer subagent độc lập verify **108/111 items** (97.3%):

- **Backend (P1,2,3,4,7):** 58/58 verified, 0 blocker
- **UI (P5):** 27/28 verified, 0 blocker  
- **E2E + Docs (P6):** 23/25 verified, 2 gap (1 MED test flake + 1 LOW doc drift)

**2 gap thực đã fix ngay trong session:**
1. **GAP 1 (MED)** — `kpi/lifecycle.test.ts` flaky full-suite: audit verified 693-694 pass (không phải 695 claim) do Prisma 5000ms tx timeout dưới Vitest parallel DB load. Isolated 25/25 clean 4.3s. Fix: raise `withFacility` timeout 5s→15s. Prod tx complete in ms, cost 0. Verify sau fix: 695/695 xanh clean.
2. **GAP 2 (LOW)** — `docs/06-kien-truc-url-routing.md:99-100` bảng URL còn `/hr/salary-structure` + `/hr/my-payslip` (đã bỏ). Fix: đổi thành `/hr/salary-tiers` + `/hr/my`.

**5 low observation** (không blocking, không thuộc AC gốc) ghi vào backlog:
- `kpi.override` không siết branch-type cross-branch (chỉ anti-self)
- `compensation.assignTier` không siết caller-vs-tier branch-type
- Migration `ALTER TYPE ADD VALUE` cùng file DDL khác (an toàn PG12+, tôn trọng invariant)
- `payroll.tsx:210` còn `error.message.includes('not found')` cho friendly-vs-raw display (không phải control-flow)
- `session-assessment` progress chỉ show count nhận xét, không đủ tri-state (điểm danh/nhận xét/ảnh)

## Bài học

**Điều đã đúng:**

1. **Plan tự chứa từng phase** — mỗi phase-XX.md có đủ acceptance criteria + file:line evidence + red-team disposition. Subagent hoàn thành 1-shot không hỏi lại. Effort planning trả về effort execution 1:1.
2. **File-ownership sequencing** — orchestrator kiểm ownership giữa các phase để chạy parallel an toàn. Phase 7 background + Phase 4 foreground → 0 conflict do file surface tách rời.
3. **Verify với hard evidence** — không tin claim subagent. Audit backend chỉ ra 693-694 vs 695 do infra flake, không phải logic. Fix ngay tại nguồn (Prisma timeout) chứ không mask.
4. **Sweep-only marking** (R2 finding) — bỏ event hook attendance/assessment/evidence tránh race crossed-tx. Sweep 1 nguồn chân lý duy nhất.
5. **Anti-self toàn tuyến** — anti-self ở confirm + override + bulkApprove; loại "chuỗi GĐ tự trả thưởng" (R#1 Critical) trước lúc code chạm production.

**Điều học được:**

1. **Prisma 5000ms default tx timeout** không đủ cho Vitest full-suite parallel DB load. Ở prod tx complete in ms nhưng test env load cao chớm timeout. Raise thành 15s là defensive change zero-cost.
2. **AppUser lookup optional** cho caller (super_admin không có AppUser row facility) — cần treat "no AppUser" thành "không thể là owner" chứ không throw FORBIDDEN. Bug subagent tự phát hiện qua TDD loop trong phase 3.
3. **Compiled dist stale** — `@cmc/auth` build dist vẫn giữ permission cũ khi source đã update. E2e call FORBIDDEN dù permission đúng. Cần `pnpm build` package thay đổi permission trước khi dev/e2e.
4. **Gap-midpoint clamp** cho GV back-to-back shifts — spec "±2h window" naive gây trùng cửa sổ giữa 2 ca liền kề. Fix: clamp mỗi window ở midpoint của gap. Cases 0-gap ca2/ca3 verified.

## Non-goals đã ghi rõ

- Route guard admin (chỉ login guard tồn tại) — không fake claim (red-team #12)
- Boundary tests mock clock KHÔNG thuộc e2e (là unit test phase 3) — không claim cover
- 3 EmptyState screens (post-sale-meeting, aftersale, refund) — UI wire only, feature build sau khi có backend
- `/hr/salary-structure` legacy route bỏ hẳn — không backward-compat shim (greenfield)

## Ship decision

Merge branch `feat/hr-remediation` → main sau khi PR review. GAP đã fix, low observation vào backlog.

## Câu hỏi mở

1. CI có config Prisma tx timeout khác local không? Nếu cùng → fix 5s→15s đảm bảo CI không flake.
2. Có muốn siết branch-type cho `kpi.override` + `compensation.assignTier` không?
3. Session-assessment tri-state progress display: count nhận xét đủ chưa hay cần đủ 3 chỉ báo?
