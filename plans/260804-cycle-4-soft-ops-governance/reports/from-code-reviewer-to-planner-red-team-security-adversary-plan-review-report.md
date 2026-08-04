# Red-Team Security Adversary — Plan Review

**Plan:** `plans/260804-cycle-4-soft-ops-governance/`  
**Reviewer posture:** Hostile security/privacy/auth adversary (read-only)  
**Stated intent:** Soft Ops governance residual — docs, `check-ui-frames` depth, a11y baseline lite; *no auth/payment changes*  
**Date:** 2026-08-04  

## Executive verdict

The plan is **not** a classic API/auth feature drop, but it is **not security-neutral**. It expands production-reachable lab content, freezes clipboard bulk as an accepted pattern without privacy controls, and treats gamable CI string metrics plus a docs-only a11y checklist as governance *authority*. Several residual product risks are explicitly deferred or labeled non-goals while success metrics continue to celebrate bulk adoption and red-team “fixed” status.

**Do not treat “no auth changes” as “no security work.”** The highest risks are **information disclosure via `/design`**, **PII bulk clipboard exfiltration**, and **destructive bulk mutation without safety rails** — all adjacent surfaces this plan touches or freezes.

---

## Findings (capped at 8)

### 1. Severity: High

**Title:** Production `/design` is auth-only (any staff); plan expands red-team recon content without access control

**Evidence:**
- `phase-02-a11y-baseline-lite.md:39` — Modify `apps/admin/src/pages/design-lab-redteam.tsx`
- `phase-03-governance-finalize.md:28` — Modify design-lab red-team if scores stale
- `plan.md:88` — lists `design-lab.tsx` · `design-lab-redteam.tsx` as related files
- Runtime (not gated by plan): `apps/admin/src/routes/index.tsx:27-31,47-66` — `/design` under `RequireAuth` only (any logged-in staff); no `PermissionGate`, no `import.meta.env.DEV` route strip
- Contrast: `apps/admin/src/shell/shell.tsx:62-69,134-142` — Design Lab nav/CTA is **DEV-only**, so production hides the entry but **does not remove the route**

**Attack or failure mode:**
Any authenticated low-privilege role (e.g. `sale`, `giao_vien`) who discovers `/design` (bookmark, history, shared link, XSS, or shoulder-surf) gets a live recon page: residual security/UX findings, remediation board, architecture honesty (“clipboard bulk”, thin payroll/HR detail, CI gate shape), plan folder IDs, and local maintainer paths already present in lab (`~/Downloads/design/*-DESIGN.md`, `plans/26080x-…`). Phases 2–3 **increase** the fidelity of this recon surface while the plan’s non-goals block authz hardening.

**Suggested fix:**
- Gate `/design` to `import.meta.env.DEV` **or** `super_admin` (route + lazy import), matching nav.
- Prefer dead-code elimination of design-lab chunks in production builds.
- Until gated: forbid shipping new red-team/remediation/scorecard text that maps residual product weaknesses; keep red-team in repo docs only, not the admin SPA.

---

### 2. Severity: High

**Title:** MS-5 clipboard bulk deferred with zero privacy / exfiltration controls; existing bulk already copies PII

**Evidence:**
- `plan.md:27-28` — MS-5 Clipboard bulk → **defer** (“honesty already partial”)
- `plan.md:43-46` — Non-goals include domain bulk multi-mutate; clipboard path left as accepted product behavior
- `phase-03-governance-finalize.md:36` — Confirms non-goals still rejected (includes domain bulk force) → freezes clipboard status quo
- Live product (what defer preserves):
  - `apps/admin/src/pages/admin/users.tsx:285-296` — bulk **Sao chép email** → `navigator.clipboard.writeText(emails…)`
  - `apps/admin/src/pages/students/index.tsx:92-102` — bulk **Sao chép tên** (student full names)
  - Multiple lists copy IDs/codes/names with no confirm, no audit, no max-selection cap

**Attack or failure mode:**
Clipboard is a **shared OS sink**. Bulk copy of staff emails / student names / entity IDs enables:
- silent exfil via clipboard-monitoring malware or browser extensions;
- accidental paste into chat, tickets, or public docs;
- insider bulk harvest without server-side audit trail (client-only write).
Treating this as “inventory honesty” only is a **privacy classification error**. Deferring MS-5 without a privacy residual register leaves PII export as the *default* bulk power on most lists.

**Suggested fix:**
- Do **not** close Cycle 4 governance without a written residual: “clipboard bulk = unauthenticated client-side PII export; no audit.”
- Minimum controls before further bulk celebration: confirm dialog naming data class (email/name/id); cap selection size; never copy emails/names without explicit sensitivity label; prefer server-side export with audit for staff email lists.
- Track MS-5 as **privacy residual**, not cosmetic inventory honesty.

---

### 3. Severity: High

**Title:** Only real domain bulk (gifts multi-hide) and planned P2 receipt bulk lack destructive-action safety in governance scope

**Evidence:**
- `plan.md:45` / `phase-03-governance-finalize.md:36` — “no domain bulk force” but bulk metrics still success criteria (`plan.md:62` `bulkListsOk = true`)
- Red-team content the plan will re-sync: `design-lab-redteam.tsx` H1 + remediation P2 “Optional domain bulk mutation on receipts” (mirrored in plan-related lab)
- Live gifts bulk: `apps/admin/src/pages/engagement/gifts.tsx:137-155` — loop `upsertMut.mutate({… isActive: false})` with **no confirm dialog**, toast success **before** mutation settlement, N parallel client calls

**Attack or failure mode:**
- Mis-click / shared workstation → mass hide of gift catalog with weak recovery UX.
- Partial failure still shows success toast → operator believes mutation applied (integrity).
- Governance plan **measures** bulk presence (`BulkActionBar+selectedIds` string gate) but never requires confirm / permission re-check / server batch procedure / audit event for multi-mutate.
- When someone later lands “domain bulk on receipts” from the remediation board, the plan leaves **no security acceptance criteria** for money-adjacent bulk.

**Suggested fix:**
- Any multi-mutate bulk (existing gifts or future receipts) must require: ConfirmDialog with count + irreversible language; server batch RPC with authz once; audit log; no optimistic success before results.
- Split success metric: `bulkClipboardOk` vs `bulkMutateOk` with different bars; do not let clipboard lists inflate mutate confidence.
- If domain bulk stays out of scope, **remove** P2 receipt bulk from lab remediation or mark “blocked until authz/audit design.”

---

### 4. Severity: Medium

**Title:** A11y “fixed-lite” can manufacture false compliance assurance without verification

**Evidence:**
- `phase-02-a11y-baseline-lite.md:14` — lite checklist, not axe/WCAG certification
- `phase-02-a11y-baseline-lite.md:20-21` — red-team MS-3 status may become **fixed-lite**; **zero** new CI fail gates
- `phase-02-a11y-baseline-lite.md:50-55` — success = file exists + links + lab wording; no keyboard path executed
- `phase-02-a11y-baseline-lite.md:60` — risk “over-claiming WCAG” noted, but criteria still allow positive status flip
- Prior multi-scope: MS-3 severity **High**, recommended axe *or* periodic manual pass (`research-redteam-ds-multi-scope` corpus referenced by `plan.md:31-32`)

**Attack or failure mode:**
Stakeholders, auditors, or future agents read lab “MS-3 fixed-lite” / “a11y baseline exists” as accessibility readiness. Keyboard traps, missing names on bulk checkboxes, or focus loss on destructive dialogs remain unproven. For a staff ERP this is lower than public WCAG legal risk, but **false assurance is still a governance integrity failure** — especially when scorecards are shown inside the product.

**Suggested fix:**
- Status vocabulary hard-lock: `open | documented-unverified` — ban `fixed` / `fixed-lite` without a dated manual pass log (who/when/paths).
- A11Y-BASELINE.md must open with: “Not WCAG certification; not CI-enforced; residual risk accepted.”
- Optional cheap proof: one Playwright keyboard smoke (tab to filter → row → dialog Escape) later; not required this phase if honesty is explicit.

---

### 5. Severity: Medium

**Title:** `check-ui-frames` strict gates are string-substring theater — agents can game “security of governance”

**Evidence:**
- `phase-01-close-4a-depth-report.md:18-19,31-35` — verify JSON tiers / dual-title / bulk; trust heuristics
- `plan.md:59-68` — success metrics bind to script output as authority
- Implementation: `scripts/check-ui-frames.mjs:76-92,181-191` — `src.includes('BulkActionBar') && src.includes('selectedIds')`; tier = substring presence of `SettingsShell` / `EntityHeader` / `WorkflowStatusbar`

**Attack or failure mode:**
A careless or adversarial AI cook can satisfy CI by:
- commenting or dead-importing frame names;
- placing `BulkActionBar` + `selectedIds` without real selection/authz;
- mis-tiering sensitive HR/payroll pages as “settings/thin intentional” via token presence.
Plan Phase 1 “verify only” and Phase 3 “metrics snapshot” then **launder** that output into cook-complete truth. Governance integrity ≠ product safety, but this plan *sells* enforceability.

**Suggested fix:**
- Document explicitly in PAGE-FRAMES / cook-complete: “report is adoption signal, not security control.”
- Prefer AST import + JSX usage checks over bare `includes` for strict gates (follow-up).
- Never use `bulkListsOk` alone as evidence of safe multi-mutate capability.

---

### 6. Severity: Medium

**Title:** Phase 3 rewrites historical advise/work-definition reports — audit-trail integrity risk

**Evidence:**
- `phase-03-governance-finalize.md:25-26` — Modify prior plan reports:
  - `…/work-definition-clear-2026-08-04.md`
  - `…/advise-ms-p1-detail-governance-2026-08-04.md` (checklist ✓)
- `phase-03-governance-finalize.md:33-35` — mark advise checklist complete; write cook-complete with measured numbers
- `phase-03-governance-finalize.md:41` — “Advise checklist all [x] for 4a items”

**Attack or failure mode:**
Mutating dated advice/work-definition files blurs **decision record** vs **completion evidence**. Future audits cannot distinguish “advised on date D” from “completed later and backfilled.” For solo+AI ops, this is how false “done” propagates across sessions. Not remote code exec — **process integrity** failure that enables silent scope fraud.

**Suggested fix:**
- Leave historical advise reports immutable; append a new `completion-evidence-2026-08-04.md` with command output hashes / paste.
- work-definition may gain a “Cycle 4 status” section dated now, without rewriting earlier acceptance rows in place.
- cook-complete owns the [x] checklist, not the original advise file.

---

### 7. Severity: Medium

**Title:** Plan freezes “no auth changes” while editing production-shipped admin pages that sit outside permission model

**Evidence:**
- User/context: “No auth/payment changes intended”
- `plan.md:73` — “No code blocks on API/DB migrations” (implies FE-only) without route authz review
- `phase-02-a11y-baseline-lite.md:39` + `phase-03-governance-finalize.md:28` — FE page edits
- Product pattern: module routes use `PermissionGate` (e.g. finance/admin); `/design` does not (`routes/index.tsx:59-65`)

**Attack or failure mode:**
Cook implements lab updates “in scope,” never asks whether the page should exist for all roles. Residual: every future Soft Ops cycle that patches red-team/inventory **widens** unscoped surface. Authorization drift is a classic ERP footgun (nav hide ≠ access deny).

**Suggested fix:**
- Add an explicit security non-goal **or** security requirement: “`/design` access policy decided: DEV-only | super_admin | all-staff.”
- If all-staff: threat-model the content (no internal paths, no residual exploit board).
- If DEV-only: implement before further lab content growth (blocks Finding 1).

---

### 8. Severity: Medium

**Title:** A11Y-BASELINE operator paths will document privileged keyboard attack surface without access-control section

**Evidence:**
- `phase-02-a11y-baseline-lite.md:26-30` — Shell: SideNav, ⌘K, focus; List: bulk toolbar + table checkboxes; Detail; Toast
- `phase-02-a11y-baseline-lite.md:18` — “operator keyboard paths”
- Shell already exposes privileged actions via palette when permitted (`shell.tsx` enroll CTA / command items) — documenting full paths in DS docs is fine; **mirroring into design-lab** (phase 2 step 4) republishes them to Finding 1 audience

**Attack or failure mode:**
Low-skill insider uses published keyboard recipes to reach bulk selection + clipboard copy faster (efficiency for attackers too). More importantly, checklist-as-lab-content increases recon density. Secondary: focusing a11y on role=search/nav without **name accessible strings for destructive bulk** leaves “accessible” mass-hide buttons that are easier to trigger by mistake (gifts).

**Suggested fix:**
- A11Y-BASELINE.md section: “Sensitive paths — only document; do not weaken confirmations for a11y.”
- Require accessible **name** + confirm for any bulk mutate; clipboard copy should announce data class to SR users (“Copy N staff emails”).
- Keep detailed operator recipes out of production SPA.

---

## What is *not* a finding (explicit non-issues)

| Claim | Why not raised |
|--------|----------------|
| `x-dev-user` / RoleSwitcher privilege escalation in prod | Client strips header in `PROD` (`trpc.ts:38`); RoleSwitcher returns null in prod — out of this plan’s mutate set |
| Full axe CI missing | Explicit non-goal; residual is honesty (Finding 4), not “must add axe now” |
| Re-skin / second DS / OWL | Non-security |
| Phase 1 verify-only depth tiers | Low direct security impact if string report stays non-strict for tiers |

---

## Residual risk (if plan ships as written)

Even with perfect docs execution:
1. Any staff can open `/design` in production builds and read residual weakness maps.
2. Bulk clipboard remains an unaudited PII export path on users/students/lists.
3. Gifts multi-hide remains confirm-less multi-mutate.
4. Governance metrics remain gameable substrings + checkbox theater.
5. Historical advise files may be rewritten, weakening forensic value.

**Overall risk if unmitigated:** **High** for info-disclosure + privacy; **Medium** for integrity/governance fraud; **Low** for remote unauthenticated exploit *from this plan alone*.

---

## Recommended plan amendments (priority)

1. **P0:** Gate or strip `/design` in production (or super_admin-only) before expanding red-team copy.
2. **P0:** Register clipboard bulk as privacy residual with data-class inventory (email, student name, ids).
3. **P1:** Ban `fixed`/`fixed-lite` a11y status without manual pass evidence; force “documented-unverified.”
4. **P1:** Stop mutating historical advise reports; append completion evidence only.
5. **P2:** Split bulk metrics clipboard vs mutate; require confirm+audit design before any receipt domain bulk.

---

## Scope honesty check

| Area | Plan claim | Adversary view |
|------|------------|----------------|
| Auth | unchanged | Leaves broken authz on `/design` while editing it |
| Privacy | out of scope | Freezes clipboard PII export as accepted |
| A11y | lite baseline | OK if honest; dangerous if status-washed |
| CI enforceability | depth report + dual-title/bulk strict | Adoption signal ≠ security control |

---

Status: DONE_WITH_CONCERNS  
Summary: Plan is docs-heavy but freezes real privacy/bulk hazards and expands an unscoped production design-lab recon surface; amend access policy + privacy residual before cook treats governance as closed.  
Concerns/Blockers: Findings 1–3 should block “governance complete” claims until access/privacy residuals are written or fixed.
