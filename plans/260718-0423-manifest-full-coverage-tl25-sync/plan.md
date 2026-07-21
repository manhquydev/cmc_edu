---
title: Phu toan canh 33 luong + sync TL25
description: >-
  Mở rộng flow-manifest 9→~38 luồng (33 WF-code + 5 ADMIN) (P2/P3/P4/ADMIN) để
  dashboard Sổ Nghiệm Thu phủ toàn dự án; sync 4+ route lệch trong TL25; điều
  chỉnh whitelist orphan.
status: completed
priority: P2
branch: main
tags:
  - acceptance
  - manifest
  - docs-sync
blockedBy: []
blocks: []
created: '2026-07-17T21:27:39.989Z'
createdBy: 'ck:plan'
source: skill
---

# Phu toan canh 33 luong + sync TL25

## Overview

Đợt routine đã định sẵn trong plan gốc (260717-1213 phase-01 step 8): mở rộng `scripts/acceptance-report/flow-manifest.ts` từ 9 luồng P1 lên ~38 luồng (33 WF-code TL25 + 5 ADMIN) phủ P2 (8) + P3 (11) + P4 (5) + ADMIN (~5), để dashboard nói sự thật về toàn dự án thay vì 27%. Kèm: sync 4+ route lệch trong TL25 (docs/25) và rút whitelist orphan khi ADMIN flows nhận `user`/`audit`/`facilityNetwork`.

Engine KHÔNG đổi — verify.ts/scanners/renderer giữ nguyên (đã verified d8ba223). Đây là data-entry có đối chiếu: TL25 §2 (docs/25:30-53) có sẵn procedure + route + test per WF; nguồn sự thật cuối cùng luôn là code (pattern NOTE khi TL25 lệch, như đã làm với P1).

Nguồn: `plans/reports/brainstorm-260718-0423-manifest-full-coverage-tl25-sync-report.md` (user approved 2026-07-18).

## Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| E1 | Namespace/procedure theo **appRouter keys thật** (trpc-scanner), KHÔNG chép nguyên văn TL25. **Làm rõ (R1-A1):** flow được claim cả procedure PHỤ phục vụ đúng màn hình/queue của WF đó (vd `finance.receiptList/Get` = hàng đợi duyệt của P1-03; `submission.listForGrading` = màn chấm của P2-06) — kèm 1 dòng lý do khi không phải procedure TL25 nêu. KHÔNG staple procedure không liên quan chỉ để giảm orphan | TL25 chỉ nêu procedure chính; scanner là ground truth; residue thật ~55-60 nếu chỉ chép TL25 |
| E2 | Route = **full path sau compose** từ route-scanner. **Bổ sung (R1-S5):** remap PHẢI giữ đúng actor/guard — luồng ParentOnly map về `/parent/*`, StudentOnly về `/student/*` (P2-08 ảnh buổi học = `/parent/evidence/:studentId`, KHÔNG phải `/student/*` — mô hình parent-mediated TL08§7) | Pattern P1; ranh giới ai-xác-thực là nội dung an toàn dữ liệu trẻ, không được làm mờ khi sửa docs |
| E3 | Worker nội bộ không procedure (P3-10/11) → entry **models-only** như P1-04; không để cả 3 mảng rỗng (guard verify.ts:85-90 throw) | Guard vacuous-truth từ R2 plan gốc |
| E4 | Whitelist namespace rút về `health`, `lmsAuth`. `INFRA_PROCEDURE_WHITELIST` (nếu cần) CHỈ nhận procedure **chứng minh được là hạ tầng thuần** (vd `session.me` — KHÔNG phải `user.me`, không tồn tại); procedure thuộc namespace admin/auth-sensitive KHÔNG BAO GIỜ vào whitelist — hoặc thành flow, hoặc thành "documented gap". Whitelist procedure-level PHẢI có **liveness guard** như namespace (throw nếu entry không match procedure scan được — mirror verify.ts:75-79) (R1-S3/S4/A6a) | Orphan detector là cơ chế duy nhất lộ capability chưa văn bản hoá; whitelist không guard = che giấu vĩnh viễn |
| E5 | TL25 sửa CHỈ cột API/UI tại giá trị sai thực tế; KHÔNG đụng thiết kế/ADR refs/cột test/cột actor. Sync P1 = **5 điểm** (không phải 4): P1-02, P1-03, P1-05, P1-09 sửa giá trị; **P1-06 `/child/link-request` = XOÁ claim** (route không tồn tại ở LMS, không có giá trị đúng để thay) (R1-A6b) | Corpus đã chốt; sync sự thật không redesign |
| E6 | ADMIN cluster id `ADM-01…`, nguồn "code + plans/260716-1047-super-admin-completion". **Cả 5 flows ADMIN đặt `uiEvidenceSpec: undefined` vĩnh viễn** — tất cả là view cross-facility/super-admin (facilities list, AppUser CRUD, network IP, audit, shift-config), kế thừa Safety Gate 5 plan gốc cho TOÀN cụm, không riêng ADM-04 (R1-S2) | Phase 4 đọc manifest này; thiếu flag = evidence collector đủ điều kiện chụp PII cross-facility |
| E7 | **Orphan là chỉ số quan sát, KHÔNG phải gate pass/fail** (R1-S3/A1/A2). Sau phủ đủ, residue kỳ vọng thật ~30-50 (procedure phụ TL25 không nêu). Triage bắt buộc phân loại: (a) thuộc màn hình WF có sẵn → claim theo E1; (b) hạ tầng thuần chứng minh được → whitelist có guard; (c) capability thật chưa văn bản hoá → liệt kê "documented gaps" trong summary — ứng viên bổ sung TL25/flow tương lai, KHÔNG whitelist, KHÔNG ép claim | Con số <20 cũ sai số học; ép số = semantic pollution hoặc che luồng thật — phản bội mục đích tool |
| E8 | Builder tab (bản đồ API nội bộ đầy đủ sau mở rộng: payroll/KPI/admin) thêm **banner cố định "CHỈ DÙNG NỘI BỘ — chứa bản đồ API hệ thống"**; AC tái khẳng định index.html local-only (D4 kế thừa); KHÔNG kéo `--inline` về sớm (vẫn Phase 4 — YAGNI) (R1-S1) | File 38 luồng = full recon surface; banner là mitigation rẻ nhất không phình scope |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Manifest P2+P3+P4 + TL25 sync + whitelist](./phase-01-manifest-p2-p3-p4-tl25-sync-whitelist.md) | Completed |
| 2 | [ADMIN cluster + orphan triage + verify](./phase-02-admin-cluster-orphan-triage-verify.md) | Completed |

Dependency: 1 → 2.

## Acceptance Criteria

- [x] `pnpm acceptance:report` sạch < vài giây; cả 5 cụm hiện trên cả 2 tab
- [x] Manifest 38 luồng: 9 P1 + 8 P2 + 11 P3 + 5 P4 + 5 ADMIN — 38/38 built, 0 partial/missing
- [x] Orphan 114→2 (observational); 100% phân loại: 2 documented gap (course.create, parentAccount.updateEmail), 0 chưa phân loại, session.me→whitelist; zero admin/sensitive trong whitelist
- [x] Không false-red: 38/38 built; P4-03 claim route thật + NOTE gap UI chưa wired
- [x] TL25 sync: 5 điểm P1 + P1-07 (lệch mới reviewer) + 10 drift P2-P4; chỉ cột API/UI (reviewer xác nhận ADR/test/actor/oversight nguyên vẹn)
- [x] Builder tab banner "CHỈ DÙNG NỘI BỘ" (verify browser); tab Nghiệm thu zero-jargon 38 thẻ (a11y snapshot sạch)
- [x] `INFRA_PROCEDURE_WHITELIST` + `DOCUMENTED_GAPS` đều có liveness guard throw-on-dead-entry (test verify pass)
- [x] Drift test pass (rename kpi.refresh → P3-09 partial, revert sạch)

## Red Team Review

### Session 1 — 2026-07-18
**Reviewers:** Security Adversary (5 findings) + Assumption Destroyer (6 findings, Contract Verifier: 20 procedure spot-checks 19✓/1✗, route tree verified đầy đủ).
**Disposition:** 11 Accept (1 accept-một-phần), 0 Reject — tất cả có file:line evidence.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| S1 | Builder tab thành full API recon map (payroll/KPI/admin) trong 1 file, share-safe export vẫn gated | High | Accept phương án (b): banner LOCAL-ONLY + AC; reject phương án (a) kéo --inline về sớm (YAGNI) | E8, AC, Phase 2 |
| S2 | Chỉ ADM-04 được gắn cấm-evidence; ADM-01/02/03/05 cũng là cross-facility | High | Accept — cả 5 ADMIN `uiEvidenceSpec: undefined` | E6, Phase 2 |
| S3 | Gate "<20" + procedure-whitelist tạo động cơ che procedure sensitive chưa manifest | Med-High | Accept — orphan observational; whitelist cấm admin/sensitive; gap → documented | E4, E7, AC |
| S4 | Procedure-whitelist thiếu liveness guard (bất đối xứng với namespace guard verify.ts:75-79) | Medium | Accept — mirror guard, throw on dead entry | E4, Phase 2 |
| S5 | Route remap phải giữ actor guard; P2-08 (ảnh trẻ) là `/parent/evidence/:studentId` ParentOnly | Medium | Accept — rule vào E2 | E2, Phase 1 |
| A1 | "<20" sai số học — residue thật ~55-60 nếu chỉ chép TL25 (procedure phụ không có nhà) | Critical | Accept — E7 observational + E1 clarified (claim procedure phụ đúng màn hình WF) | E1, E7, AC |
| A2 | Whitelist shrink không giúp con số (user/audit/facilityNetwork ~10 procs được ADM absorb, net ~0) | High | Accept — gộp vào A1 resolution | E7 |
| A3 | Route drift lớn hơn dự kiến: P2-04→`/teaching/exercises`, P2-07→`/admin/report-cards` (không :id), P4-01/02→`/admin/engagement/rewards`, P4-03 `/parent-meetings` không tồn tại | High | Accept — enumerate trước trong AC + Phase 1 | AC, Phase 1 |
| A4 | P4-03 unwired: page `/crm/post-sale-meeting` là EmptyState chưa gọi API | Medium | Accept — P4-03 dùng route `/crm/post-sale-meeting` + NOTE "UI residual chưa wired — structural pass, luồng chưa dùng được, gap thật" (giới hạn structural verifier đã biết: ◐ ≠ ⬤) | Phase 1 |
| A5 | ADM-05 resolved: shift.createGroup/createTemplate/listGroups + compensationPolicy.get/upsert; fallback route+model là sai | Medium | Accept — chốt expected 5 procedures, bỏ fallback | Phase 2 |
| A6 | Nits: `user.me` không tồn tại (đúng là `session.me`); "4 điểm P1" thật ra 5 (P1-06 xoá claim); `gift.archive` không tồn tại | Medium | Accept cả 3 | E4, E5, AC, Phase 1-2 |

**Held up under attack:** giả định "procedure drift nhỏ" ĐÚNG (19/20 spot-check khớp, chỉ `gift.archive` lệch); E3 guard verify.ts:85-90 có thật; models ADMIN đều tồn tại; HR routes khớp toàn bộ.

### Whole-Plan Consistency Sweep (session 1)
- Files reread: plan.md + 2 phase files sau khi áp 11 findings
- Decision deltas checked: 8 (E1 clarify, E2 actor-rule, E4 rewrite, E5 5-điểm, E6 all-ADMIN, E7 mới, E8 mới, ADM-05 chốt)
- Reconciled stale references: "<20" (AC, phase-02), "4 điểm" (phase-01), `user.me` (phase-02), `/engagement/rewards` (phase-02), ADM-05 fallback (phase-02), ADM-04-only flag (phase-02)
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-07-18 (autonomous, theo pipeline user ủy quyền)

| # | Câu hỏi (từ R1 unresolved) | Quyết định | Căn cứ |
|---|---|---|---|
| V1 | E1 đọc thế nào: full procedure set per namespace hay chỉ TL25-named? | Trung dung có nguyên tắc: TL25-primary + procedure phụ phục vụ đúng màn hình/queue của WF (1 dòng lý do mỗi lần); KHÔNG full-namespace (semantic pollution), KHÔNG TL25-only (residue giả cao) | R1-A1; bản chất procedure list/get là surface của flow đó |
| V2 | P4-03 route: omit hay claim `/crm/post-sale-meeting`? | Claim route thật + NOTE gap "UI EmptyState chưa gọi API" — structural built là đúng định nghĩa tầng structural; gap ghi vào documented-gaps summary | R1-A4; giới hạn structural-vs-behavioral đã là thiết kế chấp nhận (◐) |
| V3 | Banner Builder tab đặt đâu? | `templates/builder-tab.ts` — băng cảnh báo đầu tab, text tĩnh; không đổi layout.ts shell | E8; thay đổi nhỏ nhất đủ dùng |

### Whole-Plan Consistency Sweep (validation session 1)
- Files reread: plan.md + 2 phase files
- Reconciled: 0 thêm (V1-V3 đã nằm trong edits R1)
- Unresolved contradictions: 0

### Session 2 — 2026-07-18 (convergence check, Failure Mode Analyst)
**Verify:** 5/5 factual claim mới của revision đều ĐÚNG (facility 3 procs, session.me tồn tại, P1-06 NOTE khớp, crm EmptyState comment thật, CompensationPolicy/ShiftGroup/ShiftTemplate models thật); P1-06 deletion khả thi (ô UI còn `/parents/:id` coherent); banner không xung đột D4 predecessor.

| # | Finding | Severity | Disposition | Applied |
|---|---------|----------|-------------|---------|
| R2-1 | "<20" còn sống ở phase-02 Overview — sweep session 1 claim reconciled nhưng sót | High | Accept — xoá, thay bằng "observational E7" | phase-02:14 |
| R2-2 | "~34" tự mâu thuẫn số học: 9+8+11+5+5 = **38** | Medium | Accept — sửa toàn bộ thành 38 (33 WF-code + 5 ADMIN) | plan.md ×5, phase-02 ×3 |
| R2-nit | NOTE P1-06 trong manifest stale sau khi TL25 sync | Low | Accept — step 1 cập nhật NOTE dạng quá khứ | phase-01 step 1 |

### Whole-Plan Consistency Sweep (session 2 — FINAL)
- Files reread: plan.md + 2 phase files sau fix R2
- Grep verify: 0 occurrence "<20"/"~34" còn sống; "38 luồng (33 WF-code + 5 ADMIN)" nhất quán cả 3 files
- Unresolved contradictions: 0
- **CONVERGED** (tiêu chí: 0 finding Critical/High mới sống sót — R2 chỉ ra 1 High là stale-reference của chính vòng 1, đã fix + verify; không finding mới về nội dung thiết kế)

## Implementation Log

### 2026-07-18 — DONE (implement → review → fix)

**Files:** flow-manifest.ts (9→38 luồng), verify.ts (whitelist shrink [health,lmsAuth] + INFRA_PROCEDURE_WHITELIST[session.me] + DOCUMENTED_GAPS + 3 liveness guard), templates/builder-tab.ts (banner LOCAL-ONLY + split orphan section documented/untriaged), types.ts (OrphanResult.documented/untriaged), docs/25 (16 cell API/UI sync).

**Kết quả:** `pnpm acceptance:report` → 38/38 built, 0 partial/missing, **orphan 114→2** (2 documented gap, 0 chưa phân loại), 0 unresolved. Coverage 27%→100% (5 cụm).

**Cách đạt orphan thấp (E1 aggressive-but-justified):** claim procedure phụ phục vụ đúng màn hình/queue của WF (mỗi lần kèm lý do 1 dòng) — VD finance.receiptList/Get→P1-03 queue, classSession.*→P2-01, reconciliation.*→P1-09. Residue thật chỉ còn 2 capability không có WF (course catalog create, parent email backfill) = documented gaps; session.me = infra whitelist. KHÔNG staple procedure vô nghĩa để ép số (E7 đã bỏ target số).

**Verify:** tester-path — drift test 2 lần (finance.receiptCreate + kpi.refresh) đều degrade+revert sạch; liveness guard test (dead whitelist entry → throw) pass; chrome-devtools visual cả 2 tab 1440×900 sạch (banner hiện, zero-jargon 38 thẻ, 0 console error); tsc --strict exit 0. Code-review độc lập (reviewer-v2) 9/10 no blocker: grep ~18 procedure + 14 model + route guard đều thật, gift.archive đã xoá đúng, guardian.setPhotoConsent thật (mergeRouters), E2 actor-guard P2-08 ParentOnly đúng, docs/25 chỉ cột API/UI. 2 item reviewer đã áp: (W1) P1-07 UI cell sync; (suggestion) documented-gaps rendering trong tool.

**Sự cố nhỏ trong lúc làm:** guard-test dùng `git checkout` lỡ revert verify.ts về bản commit → phát hiện qua orphan tăng bất thường, re-apply 3 edit ngay. Bài học: không dùng `git checkout <file>` khi file có edit chưa commit.

**Scope:** 5 file (docs/25, flow-manifest, verify, builder-tab, types); apps/packages CLEAN (drift test revert sạch); output acceptance-report/ gitignored.

## Dependencies

Predecessor: 260717-1213-so-nghiem-thu-song (v1 engine — completed 3/4, Phase 4 GATED, không xung đột: đợt này chạm flow-manifest.ts + verify.ts whitelist + builder-tab.ts banner + docs/25).
