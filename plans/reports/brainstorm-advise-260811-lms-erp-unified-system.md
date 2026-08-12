# Brainstorm + Advise — Hệ thống thống nhất CMC EDU (ERP + LMS ops)

**Date:** 2026-08-11  
**Method:** Brainstorm contract + 4 independent review lenses + kongming advisory  
**Evidence base:** deep scout `research-260811-deep-scout-lms-merge.md`, plan `260811-1025-…`, code/docs both repos  

| Lens | Agent | Verdict |
|------|-------|---------|
| Product / Ops | independent | **GO_WITH_CONDITIONS** — spine only Wave 1 |
| Domain / Architecture | independent | **GO with conditions** — dual gates sound; strangler-in-monorepo correct |
| Security / Data | independent | **CONDITIONAL REJECT until hard security gates written** |
| Delivery / WBS | independent | Strategy A− / sequencing C+ — spike first, re-order phases |
| Kongming advise | advisory | **Đúng hướng, cấm mega-merge dual-brain** |

**Consensus overall:** **GO_WITH_CONDITIONS** — chốt constitution + Wave 1 spine + security gates trước cook.

---

## 1. Brainstorm contract (accepted design target)

| Field | Content |
|-------|---------|
| **Outcome** | Một monorepo `cmc_edu`: **tiền/CRM/cơ sở/HR** do ERP; **dạy–học–ops lớp** đúng chuẩn live `cmc-lms` (unit-range, sequence bài, family, admin ops); phiếu thu cấp **quyền unit**; cutover teaching từ live LMS vào monorepo với **một SoT**. |
| **Constraints** | Solo+AI; teaching đang live trên `cmc-lms`; giữ ADR 0041 money-first; multi-facility schema sẵn có; không dual-write 2 prod lâu dài; CI typecheck-and-test + ui-e2e; child data + RLS. |
| **Non-goals Wave 1** | Dual model 0038+sequence; makeup session; gifts/badge/SSE redesign; multi-facility teaching day-1; rewrite full console design; HR/payroll scope; dual-prod > vài ngày; rewrite domain “sạch” thay vì port proven. |
| **Acceptance Wave 1** | (1) Domain unit/range/delivery tests green; (2) receiptApprove → identity + range idempotent, money never rolls back; (3) teacher day loop schedule→attendance→journal→1 exercise; (4) family login → homework when entitled; (5) import + 1 tuần ops không rollback; (6) 0 dual-write; (7) security negative tests (sibling, facility, consent). |

---

## 2. System definition (ngôn ngữ sản phẩm)

**CMC EDU sau hợp nhất** là một hệ trung tâm đào tạo trong đó:

1. **Kinh doanh / tài chính** (sale, GĐKD) chạy CRM → phiếu thu → duyệt tiền.  
2. **Duyệt tiền** tạo/gắn hồ sơ HS–PH và **cấp dãy unit đã bán** (không còn “active cả lớp = học hết khóa”).  
3. **Vận hành lớp** (GĐĐT/admin LMS) tạo lớp theo chương trình + unit bắt đầu + lịch tuần; ghi danh theo unit; cảnh báo sắp hết unit; hủy buổi làm lùi tiến độ unit.  
4. **Giảng dạy** (GV) lịch tuần → điểm danh (cửa sổ giờ) → nhật ký → chấm PDF; hệ **tự phát 1 bài/buổi** lúc hết giờ.  
5. **Gia đình** (PH/HS) một tài khoản SĐT+mật khẩu, chọn con, chỉ thấy/làm việc theo **quyền unit + roster buổi**.  
6. **Admin break-glass** tạo HS khi cần ops nhanh nhưng **không mở học** cho đến khi có range (tiền hoặc grant có audit).

```text
┌─────────────────────────────────────────────────────────────┐
│                    CMC EDU monorepo (1 DB)                  │
│  ┌──────────────────┐      receiptApprove      ┌──────────┐ │
│  │ ERP              │ ───────────────────────► │ Bridge   │ │
│  │ CRM · Finance    │   money first (0041)     │ Provision│ │
│  │ Facility · HR    │                          │ + Ranges │ │
│  └──────────────────┘                          └────┬─────┘ │
│                                                     │       │
│  ┌──────────────────────────────────────────────────▼─────┐ │
│  │ LMS teaching BC (constitution = cmc-lms class-unit)    │ │
│  │ Unit neo · EnrollmentUnitRange · Roster D1             │ │
│  │ Library → sequence → delivery · Attendance · Journal   │ │
│  │ Family auth · Admin class ops                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Access formula (hai cổng AND)

```text
HS trên roster buổi S  ⇔
  Enrollment.status = active          -- vỏ membership (tiền / admin audited)
  ∧ day_gate(archivedAt, S.date)      -- nghỉ lớp theo ngày
  ∧ lifecycle ∉ {on_hold, withdrawn, transferred}
  ∧ ∃ EnrollmentUnitRange phủ orderGlobal(unit stamp của S)

HS nhận bài mới buổi S  ⇔  on_roster ∧ SessionExercise đã deliver ∧ S không cancelled

HS xem lịch sử  ⇔  ownership ∧ artifact đã sinh  (không lọc lại theo range hiện tại)
```

**reserved** không vào roster. **active + zero range** = lỗi provision/reconcile, không phải trạng thái hợp lệ.

---

## 4. Decision matrix (khuyến nghị consensus)

| ID | Quyết định | Khuyến nghị chốt | Bắt buộc PO? |
|----|------------|------------------|--------------|
| **D1** | Tạo HS | Hybrid: receipt chuẩn; break-glass audited; **không LMS** tới khi có range | Có |
| **D2** | SoT quyền học | `EnrollmentUnitRange` teaching; `status` money shell | Có |
| **D2b** | Receipt → range | Wave 1: `unitCount` N unit liên tục từ unit hiện tại (hoặc start unit) trong course | **Có — chặn code** |
| **D3** | Mở bài | **Supersede ADR 0038** bằng sequence 1 bài/buổi | Có (default live) |
| **D4** | Auth | Family phone+password; Scenario B → family đã SoT; OTP dual ≤1 release | Có |
| **D5** | Makeup | **Không** buổi bù; cancel restamp | Default accept |
| **D6** | Facility | Schema+RLS mọi bảng port; Wave 1 ops **1 facility** map live | Có |
| **D7** | Roles | Map 9 role → teacher/admin LMS; sale không free-create HS | Default |
| **D8** | Gifts | Wave 1 star balance; redeem ERP nếu đã có, không redesign | Default |
| **D9** | Data cutover | **Scenario B** import live cmc-lms (khuyến nghị evidence) | **Có** |
| **D10** | Freeze window | 4–12h weekend freeze writes trên loser | **Có — NO-GO nếu không freeze** |
| **D11** | Refund | revokeFromNext only; không xóa lịch sử | Có |
| **D12** | Teaching constitution | `cmc-lms` class-unit-spec thắng monorepo tests cũ | Có |

---

## 5. Wave 1 — MUST SHIP (user outcomes)

- [ ] Duyệt phiếu → HS có identity + **dãy unit** đúng gói  
- [ ] Renewal **nối** range; history giữ  
- [ ] Admin tạo lớp (program + start unit + slots) + unit hiện tại  
- [ ] Admin ghi danh range / revoke from next / archive  
- [ ] Break-glass tạo HS **không** mở học  
- [ ] GV: lịch → điểm danh (window) → nhật ký → chấm  
- [ ] Hệ phát **1 bài/buổi** sau hết giờ  
- [ ] Family: login → chọn con → làm bài khi có quyền  
- [ ] Hủy buổi không tiêu unit/bài  
- [ ] Money không rollback nếu grant fail; reconcile retry  
- [ ] Cutover: **một** teaching SoT  

### Wave 1 — MUST NOT

Dual 0038+sequence · makeup · gift redesign · multi-site teaching UAT · full console redesign · HR · long dual-write · realignHistory daily · family+money+unit cùng “mega PR” nếu có thể tách (kongming: cấm 3 bom cùng lúc; delivery: family early nhưng cutover có thể staged)

**Hòa giải family timing:**  
- **Code early:** family principal + ownership (WP-09) sớm để sink đúng.  
- **Cutover auth:** nếu import Scenario B, family đã là login — port family day-1; **không** ép PH học OTP monorepo.

---

## 6. Security gates (nâng từ “open question” → merge blocker)

Security lens: **không cutover prod** nếu thiếu:

1. FORCE RLS + negative tests trên mọi bảng teaching port (trừ exemption identity đã ADR 0042)  
2. Mọi family sink bắt `studentId` + ownership server-side  
3. ParentAccount: `isActive` + `tokenVersion` + bump khi đổi mk/khóa  
4. photoConsent monorepo trên journal (không port “published = all photos”)  
5. Break-glass không auto range / không LMS login  
6. Import: không fuzzy name-merge; dry-run collision report  
7. Stars: append-only; không recompute earn sau import  
8. One write SoT; cấm dual-write tháng  
9. APP_DATABASE_URL non-owner (RLS thật)  
10. mustChangePassword / force reset khi default password  

---

## 7. Work packages triển khai (refined — thay phase order cũ)

### Critical path (delivery consensus)

```text
WP-01 Decisions → WP-02 ADR/ownership
  → WP-03 domain-lms → WP-04 schema+RLS → WP-05 curriculum seed
  → WP-06 SPIKE (class+range+roster+facility)     ★ first PR
  → WP-07 class engine ∥ WP-08 enroll ops ∥ WP-09 family principal
  → WP-10 attendance/journal ∥ WP-11 exercise delivery
  → WP-12 submit+stars
  → WP-13 receipt→range bridge (product map)
  → WP-18/19/20 UI spines
  → WP-22/23 import B + freeze
  → WP-25 e2e + WP-26 cutover
```

### WP catalog (implement)

| WP | Goal | Deps | Effort | Risk |
|----|------|------|--------|------|
| **WP-01** | Freeze D1–D12 + Wave1 boundary | — | S | Blocker product |
| **WP-02** | ADR pack: supersede 0038; amend 0041/A; dual-gate; no-makeup; orderGlobal stability; RBAC map; procedure catalog | 01 | M | Med |
| **WP-03** | Port `@cmc/domain-lms` + tests | 02 | S–M | Low |
| **WP-04** | Additive schema: ranges, neo, library, cancelReason, archivedAt, facility+RLS; deprecate makeup writes | 02–03 | L | **High** |
| **WP-05** | CSV curriculum seed + orderGlobal gate | 04 | M | Med |
| **WP-06** | **Spike PR:** create class + sessions + enroll range + roster D1 + facility isolation tests | 03–05 | L | **High — de-risk** |
| **WP-07** | Class engine full (cancel restamp, slots, close/discard, realign repair) | 06 | L | High |
| **WP-08** | Enrollment ops (grantPast/revoke/archive/expiring) | 06 | L | High |
| **WP-09** | Family principal + ownsStudent all sinks + tokenVersion | 02,04 | M–L | High |
| **WP-10** | Attendance window + journal + photoConsent | 07,09 | L | Med |
| **WP-11** | Exercise library + sequence + delivery cron; kill open-tier server flag | 04,07 | XL | High |
| **WP-12** | Submission grade publish + stars | 11,09 | L | Med |
| **WP-13** | `grantUnitsFromReceipt` + provision audit + reconciler ranges | 01 map, 08 | L | **High** |
| **WP-14** | Refund/cancel ↔ revokeFromNext policy | 13 | M | High product |
| **WP-15** | Break-glass intake (no entitlement) | 08,09 | M | High |
| **WP-16** | Staff RBAC map teacher/admin LMS | 02 | M | Med |
| **WP-17** | Worker cron locks (materialize + delivery) | 07,11 | M | Med |
| **WP-18** | Teacher UI spine | 10–12 | L–XL | Med |
| **WP-19** | Admin ops UI (class/enroll/library) | 07,08,11,15 | XL | Med |
| **WP-20** | Family LMS UI | 09–12 | L–XL | Med–High |
| **WP-21** | Legacy open-tier + OTP kill-switch server | 11,20 | M | Med |
| **WP-22** | Import design Scenario B | 01,04 | M | High if late |
| **WP-23** | Import execute + integrity reports | 18–22,13 | L–XL | **Critical** |
| **WP-24** | Password seed / force reset campaign | 09,23 | M | High lockout |
| **WP-25** | E2E journeys rewrite + acceptance remeasure | 18–21,13 | L | Med |
| **WP-26** | Cutover runbook + DNS + 48h monitor + archive cmc-lms SoR | 23–25 | M | High ops |
| **WP-27** | Wave 2: gifts align, multi-facility teaching, polish | after 26 | — | Scope |

**Estimate realistic solo+AI:** **8–12 tuần** Wave 1; spike WP-06 trong **1.5–2.5 tuần** sau decision freeze.

---

## 8. Ownership matrix (entity → writer)

| Entity | Writer | Note |
|--------|--------|------|
| Receipt / CRM / money | ERP finance | Never writes LMS domain except via bridge service |
| Enrollment.status | Bridge + admin audited enroll | Amend ADR-A |
| EnrollmentUnitRange | **Only** grant service (receipt + admin enroll/grantPast/revoke) | Single-writer rule |
| ClassBatch / sessions / stamps | LMS class engine + cron | facilityId |
| Exercise library / SessionExercise | LMS exercise + delivery | Decoupled curriculum |
| Student / Parent / Guardian | Bridge + break-glass | createdByReceiptId when money |
| photoConsent | Guardian (ERP privacy) | Keep monorepo |
| Stars earn | Grade publish | Append-only |
| Gifts redeem | ERP engagement | Wave 1 optional |

---

## 9. Approaches compared (final)

| Approach | Verdict |
|----------|---------|
| **A. Monorepo + port LMS domain + money→range + cutover B** | **CHỌN** |
| B. Dual product ETL | REJECT — dual ops kills solo |
| C. UI-only monorepo LMS | REJECT — missing engine |
| D. Keep 0038 + add ranges | REJECT — dual brain |
| E. Grow ERP into cmc-lms only | Only if monorepo infra unusable (D4 flip) |
| F. Greenfield rewrite | REJECT |

---

## 10. Independent review synthesis (conflicts resolved)

| Conflict | Resolution |
|----------|------------|
| Bridge before teaching API (old plan) vs teaching first (scout/delivery) | **Spike teaching first (WP-06)**; bridge **parallel** once ranges exist; bridge required before monorepo money trusted for teaching rights |
| Security “reject” vs product “go” | **GO_WITH_CONDITIONS** — security checklist = hard gates in WP-02/04/09/23, not optional |
| Family late (old plan) vs early (delivery) vs Wave2 (kongming) | **Principal early (WP-09)**; if Scenario B, family UX is day-1 login; no OTP reintroduction |
| Full 9 phases Wave 1 | **NO** — spine only; WP-27 deferred |
| Multi-facility full day-1 | Schema ready; **ops 1 facility** Wave 1 |

---

## 11. Human decisions (owner answered 2026-08-11)

Full product log: `plans/reports/decisions-owner-260811-cau-1-5.md`

| Q | Owner decision |
|---|----------------|
| 1 | **Khóa học > Unit**; cấp quyền theo **unit của khóa học** |
| 2 | **Scenario B** — dữ liệu dạy–học từ LMS live |
| 3 | `cmc_edu` đang xây: merge + hoàn thiện chất lượng **trước**; **đóng LMS cũ sau** khi đạt; không ép freeze ngay |
| 4 | **A** — break-glass GĐĐT/admin tối cao; chưa học tới khi có unit |
| 5 | **A** — hoàn tiền cắt unit chưa học, giữ lịch sử |

**Unblocked for cook:** WP-02 ADR + WP-03…06 spike.  
**Still later (not blocking model):** exact “gói bán = mấy unit” on receipt UI; cutover weekend clock when quality gate passes.

---

## 12. Success metrics Wave 1

| Metric | Pass |
|--------|------|
| Teaching | 1 tuần GV ops không rollback cmc-lms |
| Entitlement | 100% test receipts → đúng range; hết range → khỏi roster |
| Money | 0 active teaching access without range (trừ break-glass audit) |
| Security | Sibling + facility negative tests green |
| Ops | 1 prod, 1 DB, 0 dual-write |
| Scope | Không merge HR/gift redesign/0038 song song |

---

## 13. Handoff

| Next | Action |
|------|--------|
| User | Ký D1–D12 (đặc biệt D2b, D9, D10) |
| Then | Update plan phases → WP catalog; write ADR drafts (WP-02) |
| Then | **Cook WP-03 → WP-06 spike PR** first |
| Not yet | Full UI port, import prod, kill cmc-lms |

**Files:**  
- This report: `plans/reports/brainstorm-advise-260811-lms-erp-unified-system.md`  
- Deep scout: `plans/reports/research-260811-deep-scout-lms-merge.md`  
- Plan (to resequence): `plans/260811-1025-hop-nhat-lms-cmc-lms-vao-cmc-edu-erp/`

```
Status: DONE
Consensus: GO_WITH_CONDITIONS — unified monorepo, LMS constitution from live cmc-lms, money grants unit ranges, spike-first delivery, security as hard gates.
```
