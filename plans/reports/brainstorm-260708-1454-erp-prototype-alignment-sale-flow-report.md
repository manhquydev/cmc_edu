# Brainstorm Report — ERP ↔ Prototype Alignment (Sale → Student Flow)

**Date:** 2026-07-08 14:54 | **Trigger:** user friction "luồng Sale → học sinh quá nhiều khâu, UI rườm rà"
**Prototype source:** `D:\Downloads\Thiết kế UIUX LMS và ERP\CMC EDU Prototype.dc.html` (2026-07-07)

---

## Problem Statement (problem-first)

User reported the Sale→student journey feels cumbersome. Scout revealed the real problem is NOT
missing design — it is **implementation drift from an already-approved prototype**. The prototype
(Jul 7) defines a streamlined UX; the shipped ERP diverged. The friction = the gap.

Secondary: user's memory of the role model ("chỉ sale, giáo viên, GĐKD, GĐĐT, IT") is **correct** —
`docs/14 §1` + prototype both encode "9 role trong enum (4 active + IT)"; 5 roles deferred (ADR-D).
The Phase-3 flow-audit over-scoped by treating deferred roles (cskh/ctv_mkt/hr) as active.

---

## Current Journey (6 steps, 3 modules)

```
[CRM]  1. opportunityCreate (O1_LEAD)      — sale enters name/phone/email
       2-4. opportunityAdvance ×3           — one stage per click (server enforces +1)
             O1→O2→O3→O4; "Tạo phiếu thu" button appears only at O4_TESTED
[FIN]  5. receiptCreate (blank form)         — RE-ENTERS name/phone/email/class/amount
       6. receiptApprove (different person)  — sets O5, provisions accounts, activates enrollment
```

## Prototype Design Principles (the intent)

1. **Money-gate = activation, transparent.** One "Duyệt & Kích hoạt" button → auto-creates
   student+parent accounts, enrollment→active, opportunity→O5, emails parent. On-screen plain-language
   box explains it. SoD preserved: "sale tạo ≠ bạn duyệt".
2. **Pipeline runs in background.** CRM Kanban is glance-only — "Phễu chạy ngầm/tự động — bạn chỉ vào
   đây khi thật sự cần quản lý." Stages advance as side-effects of real work, not manual clicking chores.
3. **Unified "+ Ghi danh" entry.** Enroll = create receipt from opportunity, prefilled (QĐ 0037),
   auto-linked opportunityId, framed in business language (not "tạo phiếu thu" accounting jargon).
4. **Role-tailored cockpit.** Each active role gets "Việc cần bạn xử" task queue + stats + pipeline/
   schedule side panel.
5. **4-group nav; deferred roles hidden** ("cskh tạm gác", "9 role... 4 active + IT").
6. **ADR-B second-eye surfaced in UI** — over-threshold receipts: "cần mắt thứ hai... GĐĐT đồng duyệt",
   reconciliation agent flags.
7. **Dedup as non-blocking warning** — "SĐT đã có hồ sơ... không chặn — dùng chung 1 tài khoản/SĐT".

---

## Gap Table (Prototype = target · Code = current)

| # | Prototype intent | Current impl | Gap | Effort |
|---|------------------|--------------|-----|--------|
| **G1** | 4-group nav; deferred roles hidden | 5 modules incl. "Nhân sự"(hr); students under "Quản trị" | Nav lệch + deferred exposed | M |
| **G2** | "+ Ghi danh" persistent CTA = receipt-from-opportunity, prefilled, business-framed | No CTA; manual CRM→advance×4→blank receipt | **Core friction** | M |
| **G3** | Receipt prefilled from opportunity (QĐ 0037), auto-link opportunityId | receipt-create blank; opportunityId passed but unused for prefill | Prefill missing | S |
| **G4** | Role cockpit: "Việc cần bạn xử" task queue per active role | Generic stat cards | Cockpit shallow | M-L |
| **G5** | "Duyệt & Kích hoạt" 1-action + automation box + dedup/over-threshold warnings surfaced | receipt-detail approve (framing unverified) | Transparency/framing | S-M |
| **G6** | CRM pipeline glance-only; stages advance as side-effects | Manual one-stage-at-a-time (server enforces +1) | Interaction model inverted | M (funnel semantics — needs care) |
| **G7** | ADR-B second-eye + reconciliation flag surfaced in approve UI | Backend enforces (finance/router.ts:214); UI surfacing unverified | Surface second-eye state | S |

---

## ⚠️ Field-Level Divergence — Prototype is Odoo-vision, NOT a schema-matching build-spec

User's instinct confirmed: the prototype's approve screen shows ~15 receipt fields; the actual
`Receipt` model has 6 meaningful ones. **~60% of prototype fields have NO backing.**

| Prototype field (approve screen) | Backed? | Actual source |
|----------------------------------|---------|---------------|
| Khách hàng (name) | ✅ | `Receipt.studentName` |
| Cơ sở (facility) | ✅ | `Receipt.facilityId` |
| Phụ huynh SĐT | ✅ | `Receipt.parentPhone` |
| Tổng tiền | ✅ | `Receipt.netAmount` (single Decimal) |
| Cơ hội CRM | ✅ | `Receipt.opportunityId` |
| Loại bán (New/Cross Selling) | ⚠️ partial | `Receipt.kind` (new/renewal) — semantics differ |
| Ngày xác nhận | ⚠️ approx | `updatedAt` / approve timestamp |
| **Phụ huynh (TÊN)** | ❌ | `ParentAccount` has phone/email only — **no name field** |
| **Giới tính** | ❌ | `Student` has **no gender** |
| **Loại hồ sơ (B2C)** | ❌ | no `profileType` |
| **Phương thức TT (MPOS)** | ❌ | no `paymentMethod` |
| **Bảng giá (pricelist)** | ❌ | no pricelist model |
| **Hạng thành viên** | ❌ | no `memberRank` |
| **Order-lines (sản phẩm/batch/buổi/SL/đơn giá)** | ❌ | `Receipt` = 1 `netAmount` + 1 `classBatchId`; **no line-item model** |
| **Thuế / subtotal** | ❌ | no tax model |
| **Tabs: MPOS · Hóa đơn điện tử · Khuyến mãi** | ❌ | none exist |

**Verdict:** the prototype is an **Odoo-inspired vision artifact**. Naively "aligning UI to prototype"
would silently commit to a massive backend expansion (order-lines, pricelist/tax engine, MPOS payment
integration, e-invoice, promotions, member tiers, demographics) — a different, far larger scope than
"reduce sale-flow friction."

### Clean scope boundary this gives us

- **BACKED (safe to build now):** G3 prefill-from-opportunity, G2 "+ Ghi danh" framing, G5 "Duyệt &
  Kích hoạt" transparency (backend already does all of it), G7 second-eye surfacing, dedup warning
  (`duplicatePhoneWarning` already exists), G1/G6 nav consolidation, G4 role cockpit.
- **NOT BACKED — DEFER (separate product + schema decision):** order-lines, pricelist/tax, MPOS,
  e-invoice, promotions, gender/profile-type/member-rank demographics. Do NOT pull these into the
  friction-reduction plan.

---

## Visual Verification (live render, 2026-07-08 20:00)

Ran full dev stack (throwaway Postgres seeded · API :3000 dev-auth · Vite :5173 + dev proxy) and
screenshotted real screens. Confirms the gap table AND surfaces 2 new defects only visible at runtime.

| Screen | Current render | vs Prototype | Gap |
|--------|----------------|--------------|-----|
| Login | Simple card, 2 buttons ("Đăng nhập (Dev)" / "Microsoft (sắp có)") | n/a | — |
| Nav (sidebar) | 5 modules: Kinh doanh · Giảng dạy · **Nhân sự** · Điều hành · Quản trị | 4 groups, hr hidden | **G1/G6 confirmed** |
| Top bar | "CMC EDU ADMIN" + role badge + Dev switcher | + "Ghi danh" CTA + ERP/LMS toggle + search/notif | **G2 confirmed** |
| Cockpit (sale) | Empty "Không có nhiệm vụ nào chờ xử lý cho vai trò này" | Rich task queue + pipeline panel | **G4 confirmed** |
| Cockpit (GĐKD) | Single card "PHIẾU THU CHỜ DUYỆT: **0**" | Rich "Việc cần bạn xử" | **G4 + DEFECT** |
| Receipt list | 3 drafts (SO00180-182), button "**+ Tạo phiếu thu**" | "+ Tạo phiếu **từ cơ hội**" | **G3 confirmed** |
| Receipt approve | "**Duyệt & Kích hoạt**" ✓ + tiến trình Nháp→Đã duyệt→Đã gửi | same button + automation-box + warnings | **G5 partial + DEFECT** |

### New runtime defects (not in earlier code-only audit)

- **D-UI-1 — Cockpit "Phiếu thu chờ duyệt" counter always 0.** `cockpit.tsx` filters
  `status === 'pending'` but `ReceiptStatus` enum has no `pending` (draft/approved/sent/cancelled).
  3 seeded drafts → card shows 0. The GĐKD approval-queue counter is dead. Real bug.
- **D-UI-2 — Receipt detail "LỚP HỌC" shows raw uuid.** Approve screen renders `classBatchId`
  (`d54209ed-…`) instead of the class code/name. Needs a join/resolve. UX defect.

### Partial alignment already present (good)

- Receipt approve button IS "Duyệt & Kích hoạt" (matches prototype).
- Second-eye correctly NOT triggered on the 12.8M receipt (< 20M threshold) — ADR-B gate behaves.

---

## What MUST NOT Change (preserved controls)

- **ADR-B money-gate SoD** — sale creates draft ≠ director approves. Hard financial control.
- **Second-eye threshold** (20M VND, giam_doc_dao_tao + super_admin only) — `finance/router.ts:41,214`.
- **Money-gated enrollment** — O5 only via receiptApprove; no manual enroll bypass.
- **RLS / facility scoping** — every mutation stays scoped.
- **Funnel stage integrity** — stages still recorded; only the *trigger* for advancement changes (G6).

All proposals change **presentation + data reuse + nav only** — the control model is untouched.

---

## Recommended Phasing

| Phase | Scope | Risk | Value |
|-------|-------|------|-------|
| **P0** | G3 receipt prefill from opportunity + business framing | Low | Immediate — kills the most-hated friction (re-typing) |
| **P1** | G2 "+ Ghi danh" CTA/flow + G5 approve transparency + G7 second-eye surfacing | Med | Core money-flow UX aligned to prototype |
| **P2** | G1/G6 nav consolidation (4 groups) + hide deferred roles + G4 role cockpit task queues | Med | Full nav/role alignment; resolves Thread-1 at UI layer |

**G6 interaction note (needs plan-time design decision):** switching manual one-stage-at-a-time advance
to side-effect advancement touches funnel semantics/metrics. Recommend: keep manual advance available
but de-emphasize it (Kanban glance-only), let real actions (schedule test → O3, record test → O4,
approve receipt → O5) drive stages. Decide exact wiring in plan.

---

## Role-Model Reconciliation (Thread 1)

- `docs/14 §1` + prototype both confirm: **4 active (GĐKD, GĐĐT, sale, giáo viên) + IT (super_admin)**.
- 5 deferred (ke_toan, cskh, ctv_mkt, hr) — kept in enum/registry, **no UI/UAT** per ADR-D.
- **Action:** trim UAT Section 2 (commit `8a68ae1`) — remove cskh/ctv_mkt/hr scenarios, mark deferred.
  The D3 "ctv_mkt manualPunch.create" question is moot — ctv_mkt is not active in v2.
- G1/G6 (hide deferred nav surfaces) enforces this at the UI layer.

---

## Environment / Outstanding (from prior scout)

- **A1 WSL2: RESOLVED** — WSL 2.6.2.0 + aws-cli 2.35.17, psql/pg_restore/pg_dump 16.14, openssl, GNU grep 3.11 all present. Phase 2 exec env ready.
- **A2 R2 keypair, A3 Entra email:** still hard-blocked on user (cloud creds).
- **D2 lms-auth-two-tier:** 13 stub tests — approved to write, independent of this UI work.

---

## Success Criteria

- [ ] Sale creates a student from an opportunity WITHOUT re-typing contact data (G3)
- [ ] A single "+ Ghi danh" entry launches the prefilled flow (G2)
- [ ] Approve screen shows what activation does + SoD + over-threshold state in plain language (G5/G7)
- [ ] Nav matches prototype's 4 groups; deferred-role surfaces hidden (G1/G6)
- [ ] Zero change to ADR-B gate, second-eye, RLS, money-gated enrollment (regression-checked)

## FINAL SCOPE DECISION (user, 2026-07-08)

**Defer ALL non-backed Odoo fields.** Plan aligns ONLY backed fields. The prototype's order-lines,
pricelist/tax, MPOS, e-invoice, promotions, gender/profile/member-rank demographics are recorded as
**future vision — separate product + schema decision after go-live**. This keeps the plan on
"reduce sale-flow friction" and off a silent Odoo migration.

**In-scope for the plan (all backed):**
- G3 receipt prefill from opportunity (contact name/phone/email → receipt form)
- G2 "+ Ghi danh" unified entry (relabel + launch receipt-from-opportunity flow)
- G5 approve-screen transparency ("Duyệt & Kích hoạt" + automation box, backend already does it)
- G7 second-eye / dedup warnings surfaced (backend already enforces)
- G1/G6 nav consolidation to 4 groups + hide deferred-role surfaces (ADR-D)
- G4 role-tailored cockpit task queues
- **D-UI-1 (fold into G4):** fix cockpit "Phiếu thu chờ duyệt" filter — count `status === 'draft'`
  (or the real pending-approval state), not the non-existent `'pending'`. Currently always 0.
- **D-UI-2 (fold into G5):** resolve `classBatchId` → class code/name on receipt detail instead
  of rendering the raw uuid.

**Plan-time decisions (my recommendation, confirm in plan validate/red-team):**
- **P2 nav restructure timing:** land P0/P1 first (low risk, immediate relief); do nav (G1/G6) +
  cockpit (G4) as a later phase since nav change touches every route.
- **G6 stage-advance model:** KEEP manual advance as fallback, de-emphasize CRM to glance-only Kanban,
  ADD side-effect advancement on real actions (schedule test → O3, approve receipt → O5). Do NOT
  remove manual advance — protects funnel metrics.

---

## Unresolved Questions

- P2 scope: full nav restructure now, or after go-live? (nav change touches every screen route)
- G6: keep manual advance as fallback, or fully side-effect-driven? (funnel metric impact)
- Does receipt already support order-lines (prototype shows product/batch/sessions table) or is that future scope?
