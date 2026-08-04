# Research: Operational Cockpit Layout (multi-role staff)

**Date:** 2026-08-04  
**Scope:** Layout only — hierarchy, grid, role slots, empty/loading, anti-patterns, rules.  
**Authority:** `design-system/cmc-edu/PAGE-FRAMES.md` · `packages/ui` `DashboardPage` + `.tpl-dash-*` · `apps/admin/src/pages/cockpit.tsx`  
**Cross-refs:** `plans/260802-research-cockpit-workflow-ux/…`, `plans/260802-research-ui-ux-product-eval/…`, phase-04 role queues.

---

## Recommendation (ranked)

1. **Keep single `DashboardPage` frame** — slot content by role/permission (current as-built). Best fit: YAGNI, one chrome language, already shipped.  
2. **Do not** fork teacher/sale/director page components or add a 5th archetype.  
3. **Do not** convert cockpit to analytical BI (charts-first). Operational queue-first only.

Adoption risk of #1: low (mature in-repo). Risk of forking frames: high maintenance + visual drift.

---

## 1. Information hierarchy (F-pattern, top → work)

```text
1. Greeting     title "Tổng quan" + subtitle "Xin chào · {formatRoles}"
2. Shortcuts    3–5 ShortcutChip (role-default paths + live badges)
3. KPIs         0–4 MetricCard (glance + deep-link; omit strip if none)
4. Primary      WorkInbox — "Việc cần bạn xử lý" (queue, urgency sections)
5. Secondary    StageFunnel / schedule — context, not the main job
```

Rationale (NN/g operational dashboards + prior CMC research): home answers **“làm gì tiếp?”** in seconds. Shortcuts before metrics so zero-KPI days still operational. Primary left/top of body; secondary is rail.

| Role | Shortcuts | Metrics | Primary | Secondary |
|------|-----------|---------|---------|-----------|
| Giáo viên | Điểm danh, Chấm bài, Nhật ký, Chấm công | Bài chờ chấm | Chấm bài queue | Lớp/kỳ or sessions |
| Sale | CRM, Xếp lớp, Chấm công, Đổi thưởng | O4 sẵn sàng | Ghi danh O4 | Pipeline O1–O5 |
| GĐKD / GĐĐT / SA | Phiếu thu, CRM, Lớp, HR | Phiếu chờ + vượt ngưỡng (+ bài nếu GĐĐT) | Duyệt phiếu | Pipeline |
| Other | Chấm công, Của tôi | — | Generic empty | Schedule if `class.read` |

---

## 2. Grid breakpoints

| Zone | Rule | Source |
|------|------|--------|
| Body | `<1040px`: 1 col stack (primary → secondary) | `.tpl-dash-body` |
| Body | `≥1040px`: `1.4fr \| 1fr` primary \| secondary | PAGE-FRAMES + CSS |
| Metrics | `auto-fit minmax(220px, 1fr)`; `@1200px` → up to 4 cols | `.tpl-dash-metrics` |
| Max KPIs | **0–4** (not 5–7 wallpaper) | PAGE-FRAMES |

Shell (SideNav + Topbar) stays outside; only `tpl-wrap tpl-dash` owns page grid. Single metric must not full-bleed stretch (Sprint A lesson).

---

## 3. Role-variant without frame fork

**One frame, five slots:** `title | subtitle | shortcuts | metrics | primary | secondary`.

- Branch **data + which child fills slot**, not layout trees.  
- Gate queries with `canDo` before mount (no 403 noise).  
- Multi-role precedence (as-built): **director > sale > teacher** for primary/shortcuts (avoid dual inboxes).  
- Greeting always human labels (`formatRoles`), never raw keys.

Trade-off: multi-role users lose secondary queues (e.g. sale+teacher under director). Acceptable: topbar “Ghi danh” + nav cover secondary work; dual primary queues = anti-pattern.

---

## 4. Empty / loading placement

| State | Placement | Behavior |
|-------|-----------|----------|
| Session loading | Full `DashboardPage` skeleton (3 metric skeletons + body bar) | Replace entire page; no partial chrome flash |
| Metric load | Per-`MetricCard` `loading` | Strip stays; cards independent |
| Queue load | Inside `WorkInbox` (row skeletons) | Panel chrome + title stay |
| Queue empty | Primary panel body | `EmptyState`: title + description + **one secondary CTA** next-step |
| Secondary empty | Funnel/schedule panel body | Same EmptyState grammar; mute zero stages |
| Metric error | Value `—` + context “Không tải được” | Distinct from true zero |

Empty must never leave primary as dead white: always next path (CRM / finance / grading).

---

## 5. Anti-patterns

1. **Widget soup** — extra charts, weather, “tips”, multi-purpose cards with no deep-link.  
2. **Dual primary CTAs** — topbar Ghi danh + competing filled CTA in panel header; logout must stay ghost.  
3. **Frame fork per role** — teacher-only page layout; breaks PAGE-FRAMES contract.  
4. **Portal of links** — shortcuts without queue = catalog, not ops.  
5. **Analytical home** — revenue pie/gauge on first paint.  
6. **Zero wallpaper** — 5 gray zero funnel bars + no CTA.  
7. **Full-bleed single MetricCard** — breaks KPI strip weight.  
8. **UUID titles** in task rows — human names only.

---

## 6. Seven layout rules

1. **One archetype:** always `DashboardPage`; no page-local full layout CSS.  
2. **Order fixed:** greeting → shortcuts → metrics → primary → secondary.  
3. **One job column:** primary = actionable queue only; secondary = context.  
4. **≤4 metrics**, each linkable; omit strip if zero gates.  
5. **3–5 shortcuts** per role; badges only when count > 0.  
6. **One primary action weight** per chrome context (topbar); panel CTAs secondary.  
7. **Empty teaches next step;** loading skeletons preserve slot geometry.

---

## Trade-off matrix

| Option | Scan speed | Maint. | Role fit | Risk |
|--------|------------|--------|----------|------|
| **A. Single DashboardPage + slots (rec)** | High | Low | High if data deep | Low |
| B. Per-role page components | High | High | High | Drift, DS breach |
| C. Configurable widget grid | Med | High | Variable | Soup, abandon risk |

---

## Architectural fit

Matches CMC: Astryx + `@cmc/ui`, ops density, no second DS. As-built `cockpit.tsx` already implements hierarchy + role branching; remaining work is **content depth** (urgency sections, session-time schedule), not re-layout.

---

## Sources (credibility)

| Source | Weight |
|--------|--------|
| PAGE-FRAMES.md + premium.css + DashboardPage (in-repo authority) | Highest |
| cockpit.tsx as-built structure | Highest |
| NN/g operational vs analytical dashboards (via prior CMC research 2026-08-02) | High |
| plans research cockpit + product-eval (2026-08-02) | High (project-specific) |
| Phase-04 role-cockpit queues plan | Med (historical intent, largely landed) |

---

## Limitations

- No new external web crawl this pass; relies on prior research + code truth.  
- Does not redesign WorkInbox/StageFunnel visuals (component depth — separate report).  
- Teacher “today sessions” API still optional (PAGE-FRAMES roadmap).

## Unresolved

- Multi-role: keep hard precedence, or merge multi-section primary inbox?  
- Super-admin: reuse director slots vs distinct system-health secondary?

---

**File:** `plans/reports/research-260804-cockpit-operational-dashboard-layout.md`
