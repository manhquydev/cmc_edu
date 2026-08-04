# Synthesis — AI design sources · modern admin · completeness → implement

**Date:** 2026-08-02  
**Agents:** research-ai-agent-design-sources · research-modern-admin-ui-patterns-2026 · audit-design-system-completeness  
**Surface:** `/design`

---

## 1. Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Design system đủ nhìn toàn diện cho ERP admin; agent có nguồn đọc; lab inventory đầy đủ; gap P1 được ship |
| **Constraints** | No second Tailwind/shadcn stack; brand #0071E3; Inter; Astryx + @cmc/ui |
| **Non-goals** | Storybook monorepo; BI charts; command palette; dark mode |
| **Acceptance** | Inventory matrix on `/design`; P1 composites live; tests green; llms.txt for agents |

---

## 2. Research findings (condensed)

### Agent-readable DS sources (priority)
1. **Atlassian Design** — llms.txt + closed tokens (do not invent values)
2. **IBM Carbon** — ERP density, tables, shell
3. **Ant Design** — enterprise admin principles
4. **Polaris** — settings layout, admin patterns
5. **Radix / shadcn docs** — a11y concepts only (map → Astryx, don’t install)
6. **Linear / Stripe Dashboard** — modern bulk, quiet chrome, focus actions
7. **Spectrum** — token alias architecture

### Modern admin (not dated)
- Soft status chips, not filled loud badges only
- Bulk selection bar + table footer pagination
- Dashboard: ≤4 metrics + focus action + inbox/pipeline
- Form: section groups + sticky actions
- Elevation by role; warm neutrals

### Audit gaps filled this session
| Gap | Solution |
|-----|----------|
| Pagination | `ListPagination` |
| Bulk actions | `BulkActionBar` |
| Settings layout | `SettingsSection` + `SettingsRow` |
| Entity chrome | `EntityHeader` |
| Detail KV | `KeyValueList` |
| Form sections | `SectionBlock` |
| Wizard | `ProgressSteps` |
| Lab incomplete | Inventory + feedback + primitives + detail + settings + wizard + auth + sources |
| Agent docs | `packages/ui/llms.txt` |

### Residual (accepted)
- FilterBar date/multi — partial
- DataTable native select/sort — Astryx limits
- Charts / ⌘K — YAGNI

---

## 3. Validation

- Unit tests: pagination, bulk, steps, entity-header, funnel
- `pnpm --filter @cmc/ui build`
- Admin `tsc` clean
- Visual: `/design` sections Inventory → Feedback → Detail → Settings → Wizard → Table → Sources

---

## 4. Files

- New composites under `packages/ui/src/components/*`
- `packages/ui/src/premium.css` completeness pack
- `packages/ui/llms.txt`
- `apps/admin/src/pages/design-lab.tsx` expanded
