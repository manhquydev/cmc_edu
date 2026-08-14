# Brainstorm — NEXT UI wave after browser audit

**Date:** 2026-08-14  
**Mode:** Operate (admin ERP) · ak:brainstorm after live prod-sim audit  
**Inputs:** Browser audit of real app; `design-lab/system/BRIDGE.md`; prior contract in `brainstorm-260814-ui-bridge-implement-direction.md` (CRM E2E + courses recipe — plan `260814-1656` marked completed / in CI as PR #143)  
**Index:** Program enum authority = `apps/api/src/class/program.ts` (`UCREA` | `BRIGHT_IG` | `BLACK_HOLE`)

---

## 1. Contract (proposed)

| Field | Content |
|-------|---------|
| **Outcome** | ListPage grammar đã ship (sort, bulk scope, empty kinds, StatusBadge brand, CategoryChip, FilterBar facets) **nhìn được và chứng minh được** trên prod-sim với seed thật; sau đó **một** list traffic cao ngoài courses (Students) adopt recipe mà không kéo theo archetype khác (attendance matrix / kanban depth). Staff thấy: cột nào sort được + chiều sort; filter đã áp là chip; có ít nhất một hàng brand-tone và một CategoryChip thật; bulk “chọn tất cả khớp lọc” hiện khi `totalMatching > page`. |
| **Constraints** | OPENEDUCAT-VISUAL-CONTRACT vẫn giữ chrome; production values thắng gallery radii; Wave 9 / Q-shell đóng; solo + CI (`typecheck-and-test` + `ui-e2e`) là review; Playwright `getByRole` substring — không nhân đôi accessible name; **no invented maps** — program → CategoryChip chỉ từ `PROGRAM_VALUES`; sort / select-all-matching chỉ khi API (hoặc list client đã materialize đủ ID) trung thực; một concern chính / PR. |
| **Non-goals** | Mass-sweep ~30 ListPage; Teaching attendance matrix / gradebook; CRM API sort + kanban redesign sâu; Wave 4B (button/tabs) trừ khi rẻ trong cùng PR polish atoms; shell rail; gallery palette/radius repaint; invent map cho chuỗi không phải `Program` enum (vd. mã lớp `LỚP:E.A`); port lab DnD. |
| **Acceptance (observable)** | (1) Screenshot finance/receipts: header sort **inactive** chevron rõ + **active** ascending/descending. (2) Screenshot filter facet: chip nền + nút × (không chỉ text link). (3) Prod-sim seed: ≥1 phiếu chưa duyệt / waiting → `StatusBadge` tone `brand` nhìn thấy; ≥1 course `program=UCREA|BRIGHT_IG|BLACK_HOLE` → `CategoryChip` render. (4) Seed hoặc fixture: `totalMatching > pageSize` trên receipts → copy select-all-matching xuất hiện + click chọn đủ ID (unit hoặc journey). (5) Students list: empty first-run **hoặc** filtered theo recipe + test; không fake sort nếu API thiếu. (6) `pnpm` package UI tests + admin page tests xanh; không regression ui-e2e name collision. |

---

## 2. Evidence corrections (challenge audit claims)

| Audit claim | Repo / code reality | Implication |
|-------------|---------------------|-------------|
| Sort indicator missing | `SortHeader` + `.console-list-sort svg` **đã có**; inactive `opacity: 0.35` | Gap = **contrast/affordance**, không phải thiếu feature |
| CategoryChip never renders (`LỚP:E.A`) | Canonical programs = `UCREA` / `BRIGHT_IG` / `BLACK_HOLE` only; seed demo tạo `UCREA`; `LỚP:E.A` **không** thuộc enum | Đừng mở rộng map; **re-verify** cột đang đọc (program vs class code/name) |
| Brand tone never visible | Seed `seed-local-sim-demo.ts` luôn `receiptApprove` | Gap = **seed/demo**, không thiếu atom |
| No CRM aging | Pipeline đã có `isRotting` + `Badge` warning + `rottingDays` | Gap = seed chưa vượt threshold / audit nhìn card non-rotting; “NS” = initials owner, không phải status |
| Select-all-matching missing | 7 rows ≤ 1 page → đúng hành vi | Cần seed/fixture > pageSize để chứng |
| Filter chips weak | Facets đã là `.console-search-facet` (nền `#eaebf0`); clear = `×` với `aria-label="Xóa …"` | Có thể vẫn dưới lab `.chip[data-applied]`; polish visual, không rewrite FilterBar API |

---

## 3. Option comparison

### A — Polish the shipped grammar (+ demo evidence)

**Scope:** `@cmc/ui` sort/filter affordance; seed/fixtures cho brand + multi-page bulk; re-verify CategoryChip trên program thật; optional EmptyState icon consistency cho kinds đã ship.

| Dimension | Score |
|-----------|-------|
| Complexity | Low–medium (CSS + seed + tests) |
| Cost (solo) | ~0.5–1.5d |
| Latency to value | Immediate — mọi trang đã adopt hưởng lợi |
| Maintainability | High — sửa một lần ở shared layer |
| Risk to CI / a11y names | Low nếu không đổi label CTA |

**Pros:** Sửa đúng chỗ grammar đang “nửa chứng”; fan-out sau không nhân bản defect.  
**Cons:** Ít surface module mới; stakeholder có thể cảm giác “không ship feature”.  
**Second-order:** Nếu bỏ qua A, mỗi PR fan-out sẽ bị audit lại cùng 4 gap (sort/filter/brand/bulk).

### B — Fan-out breadth (students / classes / teaching)

**Scope:** Apply BRIDGE recipe to 2–3 high-traffic modules.

| Dimension | Score |
|-----------|-------|
| Complexity | Medium–high (students/classes partial already; attendance = khác archetype) |
| Cost | ~2–4d nếu gồm attendance |
| Latency | Visible module coverage |
| Maintainability | Medium — recipe reuse; semantic empty/bulk dễ sai |
| Risk | **High** nếu gộp attendance matrix; medium trên students list only |

**Pros:** Khớp roadmap cũ (PR C fan-out sau CRM). Students đã có `StatusBadge` + `BulkActionBar` — chi phí thấp hơn classes/teaching.  
**Cons:** Nhân bản grammar chưa polish; teaching attendance **không** phải ListPage recipe.  
**Second-order:** Empty-kind sai trên students = silent product lie; ui-e2e name collision lặp lại.

### C — CRM kanban depth (+ table sort API)

**Scope:** Lab card grammar (status badges, aging always-on, density); API sort cho table view; stage → StatusBadge.

| Dimension | Score |
|-----------|-------|
| Complexity | High (API + UI + seed aging) |
| Cost | ~3–5d |
| Latency | CRM-only polish |
| Maintainability | Medium — module-specific |
| Risk | High — prior plan **forbid** invent CRM sort; rotting đã có |

**Pros:** CRM là mặt traffic cao; table sort là gap thật.  
**Cons:** Không sửa shared affordance; overlap với code rotting đã ship; dễ scope-creep DnD/lab.  
**Second-order:** API sort contract phải versioned; mọi client CRM phụ thuộc field list mới.

### Hybrid (recommended) — A then thin B′

**A (PR1) → Students list recipe only (PR2).** Không classes batch, không attendance, không CRM API sort trong wave này.

---

## 4. Recommendation

**Chọn Hybrid = A → B′ (Students only).**

**Vì sao nhỏ nhất mà đủ contract:** Outcome đòi grammar **chứng minh được** trước khi mở rộng. A đóng evidence gaps với blast radius nhỏ nhất (`packages/ui` + seed). B′ một list chứng fan-out recipe vẫn sống sau courses — đúng lời hứa plan trước — mà không mở archetype mới.

**Không chọn A alone** nếu owner cần “module mới trên develop” trong cùng wave — khi đó B′ là PR2 bắt buộc.  
**Không chọn C** trong wave này: rotting đã có; sort API là project riêng; không sửa sort chevron toàn cục.

### Phase list (PR-sized)

| Phase | PR | Work | Evidence required |
|-------|-----|------|-------------------|
| **P0** | — (done 2026-08-14) | Courses program column re-verified live: CategoryChip on `UCREA` renders correctly; `LỚP:E.A` claim closed | Screenshot `/tmp/cursor/screenshots/courses-table-ucrea-program-chip.png`; CDP: `console-category-chip--a` |
| **P1** | `fix(ui): list grammar affordances + demo seed` | Sort chevron contrast (inactive ≥~0.55 hoặc dual-state glyph); facet chip vs lab applied chip (token alias, không đổi a11y name pattern `Xóa ${label}`); seed: 1 receipt non-approved; receipts count > pageSize **or** pageSize-lowering test harness; optional 1 rotting opp via old `stageChangedAt` | Screenshots (1)(2)(3); unit test sort `data-sort` + visible SVG; bulk widen test; seed script idempotent |
| **P2** | `feat(admin): students list adopt ListPage recipe` | Empty kinds theo evidence; StatusBadge lifecycle giữ; **không** sortable trừ API/client sort đã thật; bulk-widen chỉ nếu IDs đã materialize (students hiện slice client-side — được widen trong-memory nếu `allRows` đủ) | Page tests empty; manual/mobile 390; no duplicate role names |
| **P3** | (optional follow-up, **out of this wave contract**) | Classes empty kinds **or** CRM table sort API spike | Riêng plan |

### Top 3 risks

1. **Semantic lie khi fan-out** — empty `filtered` / bulk-widen không có baseline hoặc ID → mitigation: BRIDGE checklist + under-claim; P2 review bắt buộc.  
2. **ui-e2e accessible-name collision** — CTA/empty copy mới → mitigation: unique Vietnamese labels; chạy journey đụng students/finance.  
3. **Seed drift / non-idempotent demo** — brand + multi-page data làm vỡ assumption test khác → mitigation: seed flags rõ; prefer test fixture over forever-dirty demo DB.

---

## 5. Owner answers (2026-08-14, decided)

| # | Question | Owner decision | Consequence for scope |
|---|----------|----------------|-----------------------|
| 1 | Cột `LỚP:E.A` là gì? | **Closed (browser re-verify 2026-08-14)** — DB: one `Course` (`UCREA Sáng tạo 1` / `UCREA`). Live DOM on `/admin/courses`: `<span class="console-category-chip console-category-chip--a …" data-category="a">UCREA</span>` with tinted bg. Prior audit "LỚP:E.A" plain text was a misread. | No map change. CategoryChip proof already landed; no P0 re-verify work left. |
| 2 | Receipt state → tone `brand` | **`draft`** (phiếu chưa duyệt) reads as waiting. Enum is `draft \| approved \| sent \| cancelled`; `draft` is the only waiting state. | See #2b — scope of the `draft` repaint. |
| 2b | `draft` appears in ~8 features, not just receipts (payroll, KPI, shifts, teacher-authored exercises, report cards, assessments) | **Approval-gated surfaces only**: receipts, payroll, KPI, report cards → `brand`. Teacher-authored drafts (exercises, assessments) and shifts stay `neutral` — nobody is waiting on them. | Do **not** flip the global `STATUS_SOFT['draft']`. Pass `tone="brand"` explicitly at the approval-gated call sites, or key off an approval-aware status value. Each call site needs a test. |
| 3 | Brand tone on CRM stages too? | **Yes, same wave** (owner chose both, over the recommended finance-first). | See #3b. |
| 3b | Which CRM stages are "waiting"? | **`O3_TEST_SCHEDULED` + `O4_TESTED`** → `brand` (waiting on the customer). `O5_ENROLLED` → `success`. `O1_LEAD` + `O2_CONTACTED` → `neutral`. | Replaces the current 5-colour `color: 1\|3\|4\|5\|6` stage ramp with meaning-based tones; stage is plain text in table view today, so the table gains a badge. Check the kanban stage bars still read as a sequence after the repaint. |
| 4 | Students fan-out in this wave? | **Yes — hybrid** (polish + Students list). | As recommended. |
| 5 | Empty-state icons | **Standardize now** in `@cmc/ui` per kind. | Adds a shared-layer change touching every adopted EmptyState. |
| 6 | Demo data vs tests | **Both** — seed demo rows *and* automated tests. | Seed must stay idempotent; tests carry the real guarantee. |
| 7 | CRM table sort | **Do it now**, including the backend work. | Departs from the recommendation (was deferred as a separate project). Largest single item in the wave; needs an `orderBy` whitelist and its own PR. |

**Scope note (honest):** answers 3, 5 and 7 pull in work the recommendation had deferred. The wave is now roughly 2–3× the recommended Hybrid and carries four independent concerns, so it must ship as a PR sequence (one concern per PR), not one branch.

---

## 6. Superseded — original open questions

1. **Cột `LỚP:E.A` trong audit** — đó là `course.program`, `classBatch.code`, hay tên hiển thị? Nếu không phải `PROGRAM_VALUES`, **không** map CategoryChip.  
2. **Receipt states nào map → StatusBadge `brand`?** (pending / submitted / processing / queued — cần enum tài chính chính thức, không đoán.)  
3. **Có cần brand tone trên CRM stage không**, hay chỉ finance waiting?  
4. **Students fan-out có phải P2 trong cùng wave không**, hay chỉ polish (A) đủ cho sprint này?  
5. **Empty-state iconography** — chuẩn hóa một set LineIcon trong `@cmc/ui` EmptyState kinds, hay để module tự chọn thêm 1 wave?  
6. **CRM table sort** — có owner chấp nhận API `orderBy` whitelist trong wave sau không, hay giữ “no sort” trung thực?

---

## 7. Decision log

| Decision | Status |
|----------|--------|
| Next wave = Hybrid A → Students B′ | **Confirmed by owner** |
| Plus: `draft` receipts → brand tone; brand tone on CRM stages | **Confirmed (expands scope)** |
| Plus: standardize EmptyState icons in `@cmc/ui` | **Confirmed (expands scope)** |
| Plus: CRM table sort incl. backend `orderBy` | **Confirmed — was deferred; now in wave, own PR** |
| Demo seed **and** automated tests as evidence | **Confirmed** |
| Defer attendance matrix / kanban card redesign / mass fan-out | Still deferred |
| Do not invent `LỚP:E.A` → category map (does not exist in data) | Hard rule, unchanged |
| Prior CRM E2E contract remains closed; this is successor wave | Noted |

**Next:** `/ak:plan` với report này làm context; plan phải chia PR theo concern (affordance+icons / brand tone / Students / CRM sort backend).
