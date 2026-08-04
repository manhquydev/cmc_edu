# Advise — UI smart cohesion upgrade

**Date:** 2026-08-04  
**Skill:** ak-advise (autonomous path: interview compressed via red-team + user “tự nâng cấp” intent)  
**Verified:** frame counts 2026-08-04, red team, design-system docs  
**Belief:** “đổi mới” = depth + sync, not new brand

---

## Understanding (input)

User wants: smarter working UI + synchronized interface; run brainstorm + research + advise to drive upgrade.

Implied problem: product *feels* uneven; lab offered many skins; real gap is **adoption depth** and **ops intelligence**, not missing Carbon.

---

## Reframed problem (confirmed by evidence)

**Problem:** CMC already has a coherent Soft Ops OS, but modules use it to different depths (List 24 vs Detail 8 vs Bulk 3). Lab mixed exploration with authority, overstating completeness. “Smart + sync” means **close adoption gaps and deepen work surfaces** under one grammar—not replace the design language.

### Exact requirements
1. Keep Soft Ops production tokens and 4 frames  
2. Raise structural sync: List/Detail/Form/Settings depth on high-traffic modules  
3. Raise smart ops: bulk, pager, cockpit queue CTAs, ⌘K already present—use it  
4. Keep lab honest (explore vs SoT)  
5. Prefer measurable rollout over new research theater  

### Goals
- Staff perceive one product across CRM/finance/teaching  
- Fewer “dead-end” empty states; more bulk/queue power  
- Agents cannot invent second layout language without friction  

### Non-goals
Re-skin, Tailwind/shadcn, BI, dark mode v1, kanban v1, LMS shell rewrite  

### Constraints
Stack lock, brand lock, solo+AI, YAGNI  

---

## 1. Verdict

**Do Option B now.**  

Re-skin (A) is the wrong “đổi mới”: high cost, red-team critical risk, mocks ≠ product. Smart widgets without enforce (C) makes sync worse.  

You already built the hard parts (frames, tokens, ControlBar, WorkInbox, ⌘K). The upgrade that staff will *feel* is: **every list behaves like list-ops, every record like Detail recipe, cockpit always tells next action, bulk on daily lists.**

---

## 2. What you should do

1. **Lock SoT** — production Soft Ops; skins lab-only (banner already)  
2. **Ship adoption matrix** — script + table on `/design` (module × frame × depth)  
3. **Bulk + pager rollout** — receipts, students, classes, users, pipeline (then aftersale/exercises)  
4. **Detail depth pass** — all `*-detail` use DetailPage + EntityHeader; zero dual h1  
5. **Cockpit smart pass** — role queues: EmptyState + primary deeplink; ≤1 primary CTA  
6. **SettingsShell** — remaining multi-tab admin config  
7. **Light gate** — `scripts/check-ui-frames.mjs` or lint: flag pages with neither frame nor exemption list  
8. **Only then** consider token pilot if user still wants denser ops (row 40 default)—as measured experiment  

---

## 3. What you shouldn't do

- Retoken production to Carbon/Ant/Airbnb from mock vote  
- Add more skins to lab before bulk rollout  
- Custom toolbars outside ListPage ControlBar  
- Dual titles on detail  
- AI sidebar “smart” chrome that ignores WorkInbox  
- Another 5-agent research without measured page audit  
- Invent FormPage alternatives for every create dialog (dialogs stay dialogs)  

---

## 4. Better / more efficient paths

| Path | Effort | Impact |
|------|--------|--------|
| Bulk on 5 lists only | Low–med | High daily power |
| Detail recipe audit 8 files | Low | High sync feel |
| Adoption matrix script | Low | Enforces honesty |
| Full re-skin | High | Low real sync |
| ⌘K content quality (actions list) | Low | Smart navigation |

---

## 5. My take / route

```text
Week 1: matrix + detail dual-title fix + inventory honesty
Week 2: bulk+pager on 5 lists
Week 3: cockpit empty/deeplink + SettingsShell 1–2 screens
Week 4: optional CI check; only if needed density pilot
```

Handoff: `ak:plan` phases under `plans/260804-ui-smart-cohesion-upgrade/` then `ak:cook` per phase.

---

## 6. Benefits
- True visual/structural **đồng bộ** users notice  
- **Thông minh** = faster bulk + clearer next work  
- Lower agent chaos (one grammar)  
- Avoids brand debt from skin tourism  
- Aligns red team remediation  

## 7. Trade-offs
- Less “new look” spectacle for stakeholders  
- Bulk needs careful permissions/confirm  
- SettingsShell migration is tedious  
- CI gate can false-positive exempt pages (maintain allowlist)  

---

## 8. Work checklist

- [ ] Keep production Soft Ops; no token rewrite without pilot
- [ ] Publish adoption matrix (script + Design Lab section)
- [ ] Fix remaining dual-title Detail pages (audit EntityHeader set)
- [ ] BulkActionBar + selection: receipt-list, students, classes, users, pipeline
- [ ] ListPagination consistent on those lists
- [ ] Cockpit: each role primary EmptyState + deeplink CTA
- [ ] SettingsShell: ≥2 admin config surfaces
- [ ] Inventory rows: bulk/settings/dark honest + dated
- [ ] Optional: `check-ui-frames` script in CI
- [ ] Do **not** expand style gallery until bulk done

## 9. Success metrics

| Metric | Target | How to verify |
|--------|--------|----------------|
| High-traffic lists with ListPage + pager | ≥5 named lists | manual + matrix |
| Lists with bulk selection | ≥5 | grep BulkActionBar / selectedIds |
| Entity details with EntityHeader, no PageHeader title | 100% of entity detail routes | audit script |
| DashboardPage roles with empty CTA | all active roles | cockpit test / manual |
| Inventory false miss | 0 known | ⌘K ok; date stamp |
| Design-lab skin count growth | 0 until bulk done | LOC/skin count |
| CI/script gate | optional ≥1 check | `pnpm` script exit 0 |

---

## Note on interview

ak-advise normally grills one question at a time. User requested autonomous pipeline after red team; reframing grounded in measured adoption + red team rather than open-ended interview. If product priority of bulk lists differs, override checklist order only—do not reopen re-skin without new decision.
