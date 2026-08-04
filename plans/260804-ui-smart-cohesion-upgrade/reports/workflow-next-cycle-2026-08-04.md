# Luồng công việc tiếp tục — Soft Ops depth (Cycle 3+)

**Date:** 2026-08-04  
**Direction (locked):** Option B — cohesion + smart ops depth · **không** re-skin  
**Baseline (đo):** `pnpm check:ui-frames` — bulk **8** · dual-title **0** · SettingsShell **3** · CI gate on  

---

## 1. Workflow lặp (chuẩn pipeline)

```text
[0. Measure]  pnpm check:ui-frames (+ optional matrix note)
      ↓
[1. Brainstorm]  chỉ khi đổi hướng / mở non-goal (thường SKIP nếu vẫn Option B)
      ↓
[2. Research / xia]  chỉ khi cần bằng chứng mới (FilterBar patterns, bulk domain API)
      ↓
[3. Advise]  chốt 1 slice cook + metrics + non-goals
      ↓
[4. Cook]  1 slice product (≤ vài file list/detail) + test hẹp
      ↓
[5. Red-team]  claim vs evidence · reopen/fix/defer
      ↓
[6. Update]  work-definition · lab inventory · script if needed
      ↓
    loop until OPEN P1 clear hoặc defer có lý do
```

| Bước | Owner skill | Đầu ra |
|------|-------------|--------|
| Measure | script | bulk/dual/Settings counts |
| Brainstorm | ak-brainstorm | chỉ khi đổi contract |
| Research | ak-research / ak-xia | chỉ khi gap kiến thức |
| Advise | ak-advise | slice order + stop criteria |
| Cook | ak-cook | code + tests |
| Red-team | review | FIXED/OPEN/DEFER |
| Update | docs-manager nhẹ | work-def + lab honesty |

**Stop “xong Soft Ops depth phase” khi:**

1. High-traffic lists trong backlog Cycle 3 đều có **FilterBar hoặc filter trong ControlBar**  
2. High-traffic lists thiếu pager (trừ board/calendar/exempt) có **ListPagination** hoặc exempt list documented  
3. Inventory bulk ghi **honest** (`ok` = domain bulk, `partial` = clipboard-only)  
4. Red-team lab không stale so với product  
5. `pnpm check:ui-frames` + scoped tests xanh  

**Không stop vì:** “đẹp hơn Odoo” · re-skin · infinite research.

---

## 2. Đã xong (không làm lại)

| Gói | Trạng thái |
|-----|------------|
| Soft Ops tokens + 4 frames SoT | ✅ |
| Bulk ≥5 (hiện 8) + pager cohort | ✅ |
| dual-title 0 + CI strict dual+bulk | ✅ |
| SettingsShell ≥3 | ✅ |
| Cockpit empty CTA /hr/checkin | ✅ |
| student.get deep-link | ✅ |
| Odoo xia grammar + wireframes CP/form/chatter | ✅ |
| Lab red-team rebase | ✅ |

---

## 3. Phần việc tiếp theo (Cycle 3) — ưu tiên

### Slice A — FilterBar pass (H2) · **P1 · cook trước**

**Mục tiêu:** filter nằm trong ControlBar grammar, không ad-hoc rải.

| # | File / màn | Việc |
|---|------------|------|
| A1 | `students/index.tsx` | TextInput search → FilterBar `text` (hoặc filters slot chuẩn) |
| A2 | `crm/aftersale.tsx` | Selector status → FilterBar `select` |
| A3 | `admin/users.tsx` | optional text filter name/email nếu cần |
| A4 | `crm/pipeline.tsx` | lost visibility → FilterBar select nếu fit |
| A5 | Inventory | List ops note: FilterBar coverage partial→ok khi A1–A2 xong |

**Acceptance A**

- [x] ≥2 high-traffic lists chuyển sang FilterBar trong ListPage.filters  
- [x] Không FilterBar outside ListPage trên các màn đó  
- [x] Tests hẹp (students / aftersale / post-sale-meeting)  

**Không làm trong A:** redesign pipeline board · multi-select date range full.

---

### Slice B — Pager residual (H3) · **P1**

**Mục tiêu:** list dài không unbounded chrome.

| # | Màn (ListPage, chưa ListPagination) | Ưu tiên |
|---|--------------------------------------|---------|
| B1 | `courses/index` | cao |
| B2 | `engagement/rewards` | cao |
| B3 | `hr/kpi` (nếu list dài) | TB |
| B4 | `finance/reconciliation` | TB |
| B5 | `crm/post-sale-meeting` | TB |
| — | Exempt (document): pipeline cards, schedule calendar body, grading master-detail, class-placement wizard, coming-soon | — |

**Acceptance B**

- [x] ≥3 màn có ListPagination (courses · rewards · post-sale-meeting)  
- [x] Exempt list ghi trong redteam H3 + work-def (pipeline · schedule calendar · grading MD · class-placement)  

---

### Slice C — Bulk honesty (H1) · **P1 docs + optional cook**

| # | Việc | Loại |
|---|------|------|
| C1 | Inventory: Bulk rollout = **partial** + note “clipboard-only trừ gifts” | docs/lab |
| C2 | (Optional) 1 domain bulk thật: ví dụ export CSV receipts **hoặc** bulk status draft filter only | cook |
| C3 | Không fake multi-`mutate` loop toast success | rule |

**Acceptance C**

- [x] Lab inventory không oversell bulk domain  
- [ ] C2 deferred P2: domain bulk mutation  


---

### Slice D — Detail depth (H6) · **P2**

| # | Việc |
|---|------|
| D1 | Document tiers: full (receipt/opportunity) · standard (class/student) · settings hybrid |
| D2 | Optional: thêm HighlightStrip hoặc StatActions cho 1 entity còn mỏng |
| D3 | Không force WorkflowStatusbar mọi detail |

---

### Slice E — cấm / defer

| Việc | Lý do |
|------|--------|
| Re-skin Odoo/Carbon/Ant | Non-goal |
| Thêm skin lab | R4 residual |
| OWL / top-nav Odoo | xia skip |
| Generic KanbanBoard | YAGNI |
| FormPage mọi dialog create | YAGNI |
| Pipeline bulk selection | card UI — design later |

---

## 4. Thứ tự cook đề xuất (1 vòng = 1 slice)

```text
Cycle 3a  →  Slice A (FilterBar)  → tests → red-team note
Cycle 3b  →  Slice B (pager)      → tests → red-team note
Cycle 3c  →  Slice C (bulk honesty [+ optional domain bulk])
Cycle 4   →  Slice D only if still needed
```

Mỗi cycle:

1. `pnpm check:ui-frames` (baseline)  
2. Cook slice  
3. Scoped vitest  
4. `pnpm check:ui-frames` + update lab inventory nếu status đổi  
5. Red-team 5–10 dòng: claim / pass / open  

---

## 5. Metrics Cycle 3

| Metric | Target Cycle 3 |
|--------|----------------|
| FilterBar product pages (excl lab) | ≥5 (hiện 3) |
| ListPage + ListPagination (excl exempt) | tăng ≥3 màn so baseline |
| Bulk inventory honesty | partial hoặc 1 domain bulk + ok |
| dual-title / bulkListsOk | giữ 0 / true |
| Open red-team H1–H3 | closed or documented defer |

---

## 6. Cycle 4 closed — optional next only

Cycle 3 depth + Cycle 4 governance residual **done** (2026-08-04). See:

- `plans/260804-cycle-4-soft-ops-governance/reports/cook-complete-2026-08-04.md`
- work-definition §8 Cycle 4 rows

**Không mở lại:** re-skin · axe CI full · force EntityHeader · domain bulk force.

| Optional next | Priority | Note |
|---------------|----------|------|
| Human keyboard pass log (MS-3 → beyond partial) | P2 | Log date/who/pass per A11Y-BASELINE paths |
| Clipboard privacy note / confirm on bulk copy | P2 | Residual risk only; not re-skin |
| Domain bulk mutation (MS-5) e.g. gifts-pattern on receipts | P2 | Deferred; inventory stays partial until then |
| Promote thin detail (payroll · my-hr) | P3 | Optional; tiers already honest |

**Measure before any next cook:** `pnpm check:ui-frames` · `node scripts/check-ui-a11y-roles.mjs`.

---

## 7. Một câu

> **Đã xong:** frames · bulk 8 · dual-title · SettingsShell · CI · FilterBar · pager · detail tiers · a11y baseline **partial**.  
> **Tiếp theo (optional):** human keyboard pass · privacy note · MS-5 domain bulk — **không** re-skin.
