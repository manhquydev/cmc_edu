# Công việc đã xác định rõ — UI smart cohesion (Option B)

**Pipeline:** ak-brainstorm → ak-research → ak-advise → cook → red-team  
**Date:** 2026-08-04  
**Direction (locked):** **Option B** — đồng bộ frame/token + độ sâu ops; **không** re-skin production.

---

## 1. Ba skill làm gì (phân vai)

| Skill | Đầu ra bắt buộc | Không làm |
|-------|-----------------|-----------|
| **ak-brainstorm** | Outcome · Constraints · Non-goals · Acceptance; chọn 1 trong ≤3 hướng | Không code |
| **ak-research** | Bằng chứng (adoption, DS, pattern ops); so sánh A/B/C | Không code |
| **ak-advise** | Verdict + nên/không + checklist + metrics đo được | Không code |
| **ak-cook** | Đổi product UI theo checklist | Không đổi brand/token SoT |
| **red-team** | Score P0/P1 pass/defer | Không “mơ” perfect forever |

**Hướng đã chọn (brainstorm+advise):**  
A Re-skin ❌ · **B Cohesion + smart ops ✅** · C Widget smart rời ❌

---

## 2. Outcome (user-visible)

Staff thấy **một OS giao diện Soft Ops**:
- Cùng 4 frames: Dashboard · List · Detail · Form  
- List: ControlBar + pager + bulk khi có selection  
- Detail: **một** h1 (EntityHeader), breadcrumbs không dual title  
- Cockpit: queue rỗng vẫn có **next-step CTA**  
- Lab: Soft Ops = production SoT; skins = explore only  

---

## 3. Constraints (không đàm phán)

1. Stack: Vite React · Astryx · `@cmc/ui` · CSS tokens — **cấm** shadcn/Tailwind DS thứ hai  
2. Brand LOCKED: `#0071E3`, Inter, warm canvas, radius 12/16/20  
3. Solo+AI: đo bằng script/test, không infinite research  
4. YAGNI/KISS/DRY  

## 4. Non-goals

- Re-skin Carbon/Ant/Airbnb/Night production  
- Dark mode v1, BI charts, drag-kanban, rewrite LMS shell  
- Thêm skin lab trước khi bulk depth đạt  
- “UI đẹp nhất tuyệt đối” không metric  

---

## 5. Work packages (công việc rõ)

### WP0 — SoT & honesty (P0)
| ID | Việc | Done? |
|----|------|-------|
| W0.1 | Production Soft Ops không rewrite token | ✅ |
| W0.2 | Banner lab: explore skins ≠ SoT | ✅ |
| W0.3 | Inventory: ⌘K ok; bulk honest; dark/settings partial | ✅ |

### WP1 — Smart list-ops depth (P0/P1)
| ID | Việc | Done? |
|----|------|-------|
| W1.1 | Bulk+selection ≥5 high-traffic lists | ✅ **8 lists** |
| W1.2 | ListPagination trên các list đó | ✅ |
| W1.3 | Pattern: copy bulk (mã/email/tên) + toast — không fake API bulk destructive | ✅ |

**Lists bulk (đo `check-ui-frames`):**  
receipts · students · classes · users · facilities · aftersale · exercises · gifts

### WP2 — Detail single identity (P0)
| ID | Việc | Done? |
|----|------|-------|
| W2.1 | Entity detail: PageHeader breadcrumbs-only khi có EntityHeader | ✅ dualTitle=0 |
| W2.2 | Loading/error/deny paths không dual h1 | ✅ |

### WP3 — Cockpit smart empty (P1)
| ID | Việc | Done? |
|----|------|-------|
| W3.1 | Director/Sale/Teacher inbox: empty + deeplink CTA | ✅ (pre-existing + kept) |
| W3.2 | Role generic: empty CTA (chấm công / HR) | ✅ |

### WP4 — Enforcement (P1)
| ID | Việc | Done? |
|----|------|-------|
| W4.1 | `scripts/check-ui-frames.mjs` + node:test | ✅ |
| W4.2 | Wire script vào CI package.json / workflow | ✅ `pnpm check:ui-frames` + CI step |

### WP5 — Settings & deeper sync (P2)
| ID | Việc | Done? |
|----|------|-------|
| W5.1 | SettingsShell ≥2 admin multi-tab screens | ✅ shift-config · network-ip · salary-tiers |
| W5.2 | FormPage depth pass remaining create flows | ⬜ deferred |
| W5.3 | Pipeline list bulk (card UI, not DataTable) | ⬜ deferred / design later |
| W5.4 | Cap design-lab LOC / no new skins until WP1 | ✅ (no new skins) |

### WP6 — Out of scope until WP1–4 stable
| ID | Việc |
|----|------|
| W6.1 | Token density pilot (row 40 default) |
| W6.2 | Re-skin production |
| W6.3 | ⌘K action catalog quality pass |

---

## 6. Success metrics (cách biết xong)

| Metric | Target | Hiện tại |
|--------|--------|----------|
| Bulk lists | ≥5 | **8** ✅ |
| dual PageHeader title + EntityHeader | 0 | **0** ✅ |
| SoT banners / inventory false miss known | 0 | ✅ |
| check-ui-frames test | pass | ✅ |
| SettingsShell ≥2 | ≥2 | **3** ✅ (shift · network-ip · salary-tiers) |
| CI wires check-ui-frames | wired | ✅ `pnpm check:ui-frames` + CI step |

---

## 7. Cycle 3 — Soft Ops depth (done 2026-08-04)

| Slice | Việc | Done? |
|-------|------|-------|
| **A** FilterBar | students · aftersale · post-sale-meeting (+ receipts·schedule·rewards pre) | ✅ |
| **B** Pager residual | courses · rewards · post-sale-meeting | ✅ ListPagination **11** |
| **C** Bulk honesty | Lab Bulk rollout = **partial** (clipboard; gifts = only domain bulk) | ✅ |
| **D** Detail depth tiers | full/standard/settings/thin + check-ui-frames depth report | ✅ cycle 4a |
| **E** Re-skin / OWL / Kanban | | ❌ cấm |

Red-team: [`redteam-cycle-3-2026-08-04.md`](./redteam-cycle-3-2026-08-04.md)

---

## 8. Cycle 4 — Soft Ops governance residual (done 2026-08-04)

Plan: `plans/260804-cycle-4-soft-ops-governance/` · cook report: [`../260804-cycle-4-soft-ops-governance/reports/cook-complete-2026-08-04.md`](../../260804-cycle-4-soft-ops-governance/reports/cook-complete-2026-08-04.md)

| Row | Việc | Done? | Evidence |
|-----|------|-------|----------|
| **4a tiers** | Detail tiers full/standard/settings/thin documented + measured | ✅ | PAGE-FRAMES §C · `detailTiers` **2/2/3/2** · dualTitle **0** · bulk **8** |
| **4a depth report** | FilterBar / ListPagination / EntityHeader / tiers in `check-ui-frames` | ✅ | FilterBar **6** · ListPagination **11** · EH **4** · report-only (not strict depth) |
| **4b a11y baseline lite** | Written baseline + role smoke | ✅ **partial** | `A11Y-BASELINE.md` · `scripts/check-ui-a11y-roles.mjs` **8/8** · **not** WCAG cert · **no** human keyboard pass log |
| **MS-1** EntityHeader under-adopted | settings/thin intentional | ✅ documented | settings exempt · thin = payroll · my-hr residual named |
| **MS-2** depth matrix | report present | ✅ report fixed | not a `--strict` gate |
| **MS-4** two-tier recipe | named tiers | ✅ fixed | full \| standard \| settings \| thin |
| **MS-3** a11y | baseline lite only | ✅ **partial** | role smoke only; keyboard pass still open |
| **MS-5** domain bulk | multi-mutate residual | ⬜ **deferred** | clipboard honesty already partial; gifts only domain bulk |
| **Non-goals** | re-skin · axe CI · force EH · domain bulk force | ❌ rejected | still rejected |

**Authority for numbers:** re-run `node scripts/check-ui-frames.mjs --json` / `pnpm check:ui-frames` — docs are snapshots.

---

## 9. Một câu tóm

> **Nền + Cycle 3–4 xong:** Soft Ops frames · bulk 8 · dual-title 0 · SettingsShell 3 · CI · FilterBar · pager · detail tiers 2/2/3/2 · a11y baseline **partial** (role smoke).  
> **Residual / optional next:** human keyboard pass log · clipboard privacy note · MS-5 domain bulk — **không** re-skin · **không** axe CI full.
