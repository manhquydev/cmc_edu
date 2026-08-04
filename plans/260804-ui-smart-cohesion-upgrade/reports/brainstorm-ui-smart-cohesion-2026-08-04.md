# Brainstorm — UI “thông minh hơn · đồng bộ hơn”

**Date:** 2026-08-04  
**Skill:** ak-brainstorm  
**Mode:** autonomous (user: triển khai pipeline; evidence from red team + scout)

---

## 1. Contract

### Outcome
Staff ERP (sale, GV, GĐ, SA) làm việc trên **một OS giao diện**: cùng 4 page frames, cùng ControlBar/Detail recipe, cùng token Soft Ops; cockpit/list **thông minh hơn** (queue, bulk, deeplink, empty next-step) — **không** cảm giác mỗi module một skin.

### Constraints
- Stack lock: Vite React · Astryx · `@cmc/ui` · CSS tokens — **no** shadcn/Tailwind second DS
- Brand LOCKED: `#0071E3`, Inter, warm canvas, radius 12/16/20 (MASTER)
- Solo + AI: CI/typecheck gates > ceremony; YAGNI/KISS/DRY
- Red team: lab explore ≠ production; inventory must be honest
- Measured adoption (2026-08-04, pages excl design-lab/tests):  
  ListPage **24** · DetailPage **8** · FormPage **7** · DashboardPage **2** · SettingsShell **1** · BulkActionBar **3**

### Non-goals
- Full re-skin (Carbon/Ant/Airbnb as product identity)
- New design system package or Tailwind install
- BI charts / analytics product
- Dark mode v1 (miss allowed)
- Generic drag-kanban board
- Rewriting LMS shell in this pass (share tokens only)

### Acceptance criteria
1. **SoT clear:** production = tokens + PAGE-FRAMES; lab skins labeled exploration (done partial)
2. **Adoption matrix** published (module → frame → depth) and ≥ top-10 lists use ListPage+pager pattern
3. **Bulk** on ≥5 high-traffic lists (not only gifts)
4. **Detail recipe** on all entity detail routes (EntityHeader, no dual h1)
5. **Cockpit** every role: WorkInbox empty+deeplink CTA; no dual primary
6. **Inventory** dated; no false miss (⌘K fixed)
7. Optional but preferred: **1 automated check** (script or lint) for dual title / bare pages

---

## 2. Evidence gaps closed by scout

| Claim | Evidence |
|-------|----------|
| Frames “ok” everywhere | List strong; Detail/Form thin; SettingsShell almost unused |
| ControlBar rare | Correct — embedded in ListPage; not a bug |
| Smart UX incomplete | Bulk 3 screens; SettingsShell 1 |
| Lab oversells completeness | Red team R1–R6 |

---

## 3. Options (≤3)

### A — Re-skin / new visual language
Map Carbon or Cool SaaS tokens into production.  
**+** Perceived “đổi mới”  
**−** High risk, red team R2/R3/R10; no proof mocks = composites; breaks LMS/print/brand  

### B — Cohesion enforce + smart ops depth **(recommended)**
Keep Soft Ops. Close adoption gaps. Roll bulk/pager/settings. Deepen cockpit queues & deeplinks. Enforce with matrix + light gate.  
**+** Aligns red team P0–P1; YAGNI; real sync users feel  
**−** Less “wow skin”; needs disciplined rollout  

### C — Smart-only features without frame enforce
Add AI/⌘K/inbox widgets on ad-hoc pages.  
**+** Fast demos  
**−** Increases fragmentation (worse đồng bộ)  

---

## 4. Recommendation

**Choose B.**  
“Thông minh” = **work-aware surfaces** (queue, bulk, sticky control, deeplink, empty next-step) on **one grammar**.  
“Đồng bộ” = **same frames/tokens/depth**, not more skins on lab.

Hand off → research (patterns) → advise (ordered work) → later `ak:plan`/`ak:cook`.

## Unresolved
- Priority order of top-10 lists for bulk (product: finance vs CRM vs classes) — default: receipts, students, classes, users, pipeline  
- Whether lint gate lands in same sprint or next
