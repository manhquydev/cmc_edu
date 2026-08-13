# Brainstorm — quy trình verify trạng thái thật toàn hệ thống

**Date:** 2026-08-13 11:56 +07
**HEAD measured:** `develop@bc3f473`
**Kind:** brainstorm (không implement)
**Evidence class:** filesystem + GitHub branch protection + existing scripts. Không dùng `plans/reports/audit-*` hay INDEX làm nguồn sự thật.

---

## Contract

### Outcome

Người vận hành chạy **một lệnh** và nhận scorecard gắn SHA + timestamp: trạng thái thật của compile, test, journey, nghiệp vụ, bảo mật, và **design system**. Markdown, báo cáo session, và điểm “10/20” không được xuất hiện như bằng chứng.

### Constraints

- Một người vận hành; CI hiện tại (`typecheck-and-test`, `ui-e2e` — confirmed required trên `main` qua GitHub branch protection) không bị hạ.
- Astryx (`@astryxdesign/core@0.2.0`) giữ vai trò primitive vendor; không thay stack trong delivery này.
- `plans/reports/*` và docs corpus là **tuyên bố**, không phải đo.
- Không rewrite toàn bộ admin UI trong một wave.
- Scorecard phải regenerate từ HEAD; artifact gitignored hoặc ghi đè, không chỉnh tay.

### Non-goals

- Viết lại corpus TL00–TL31 hay “dọn” lịch sử `plans/`.
- Tin / chấm điểm lại các audit 260813-0052.
- Thay Astryx, bỏ console ERP, hoặc redesign từng trang.
- UAT người thật (vẫn ngoài phạm vi máy).
- Biến markdown thành nguồn status.

### Acceptance

1. `pnpm verify:system` (tên có thể đổi) in JSON + HTML từ **lệnh đã chạy trong lần đó**, mỗi dòng có: claim, command, SHA, proof class, blocking/advisory.
2. Proof class bắt buộc: `behavior` | `source-string` | `ci-artifact` | `unmeasured`. Cấm class `docs`.
3. Lane design system gồm: (a) inventory composite (vai trò, CSS owner, dùng ở admin/LMS), (b) pin computed token-owner trên descendant thật, (c) gallery sống của shared components — không phải trang datetime còn sót.
4. Scorecard nêu thẳng mismatch CI: job `continue-on-error` vs required check.
5. Không có điểm thẩm mỹ không kèm screenshot/gallery artifact.

---

## Evidence (đo lại, không chép báo cáo)

### Hệ thống đo đã có — và chúng chứng minh gì

Đo trên `develop@bc3f473`. GitHub `main` required checks: **`typecheck-and-test`**, **`ui-e2e`**.

| Signal | Where | What it actually proves | Proof class |
|---|---|---|---|
| `pnpm typecheck` + `pnpm test` | CI blocking | Types + unit/integration | behavior |
| `pnpm lint` | CI blocking | Import/style rules | source-string |
| `check:ui-frames --strict` | CI blocking | Substring `ListPage` etc. in page files. 78 pages; ListPage 26. **Không** chứng minh layout đúng | source-string |
| `check:ui-ratchet` | CI blocking | Literal `style={{}}` không tăng vs baseline. Nợ cũ grandfather | source-string |
| `check:ui-a11y-roles` | CI blocking | 8 file còn chứa chuỗi `role=` / `aria-`. **Không** phải WCAG hay keyboard | source-string |
| `check:doc-authority` | CI blocking | Allowlist docs không chứa chrome đã retire. **Không** chứng minh docs khớp code | source-string |
| `ui-e2e` | required, push-only workflow | Journey Playwright trên build preview | behavior (smoke) |
| `acceptance:report` | CI **continue-on-error** | Ledger flow vs manifest vs journeys.json | ci-artifact, **không chặn merge** |
| `e2e` job trong `ci.yml` | **continue-on-error** | API e2e | behavior, **không chặn merge** |
| screen-role matrix | **continue-on-error** | JSON drift vs generator | source-string, advisory |
| Trivy | **continue-on-error** | IaC misconfig | advisory |
| `business:verify` | local script, không thấy trong required CI | Journey có `assertBusinessInvariant` | unmeasured-in-CI |
| `measure-ui-fingerprint.mjs` | manual, cần dev server | getComputedStyle font/radius | unmeasured-in-CI |
| UAT người thật | — | — | unmeasured |

Kết luận vận hành: **merge-green ≠ hệ thống đã verify**. Docs (`AGENTS.md`, INDEX) nói “done = hai check xanh” — đúng với branch protection, **sai** nếu đọc thành “toàn bộ acceptance/business/design đã đo”.

`check-ui-frames` vừa chạy: 78 page files, ListPage=26, FilterBar=21, BulkActionBar=7. Gate `bulkListsOk=true` vì target ≥5 — đó là ngưỡng adoption, không phải chất lượng.

### Design system — trạng thái thật của shared layer

Ba stylesheet chồng, không phải một hệ:

| Sheet | Role in code | Visual language |
|---|---|---|
| `packages/ui/src/tokens.css` | 90 custom props, `:root` | Warm Apple/Notion: canvas `#f5f3ee`, radius 12/16/20, Inter Variable, one blue `#0071e3` |
| `packages/ui/src/astryx-theme-cmc.css` | 59 props; maps `--cmc-*` → Astryx `--color-*` / `--font-size-*` | Astryx primitives (Button, Text, Table) |
| `packages/ui/src/console.css` | **2498 lines / 93kB**; 196 props on `.o_web_client` | Odoo 19 density: radius **4/3/6**, Bootstrap `#28a745` / `#dc3545`, gray-100, font `'Inter'` (không Variable) |

Admin `main.tsx` load: reset → Inter Variable → tokens → astryx-theme-cmc → **console** → app.css.
LMS `main.tsx` load: reset → Inter Variable → tokens → astryx-theme-cmc → app.css. **Không load console.css.**

Va chạm tên biến `--font-size-*` (12 bước) + `--color-text-*` + `--font-family-*` = **17 tên trùng** giữa astryx-theme và console. Giá trị **không trùng**: ví dụ `--font-size-4xl` Astryx/CMC = 32px, console = 22px. Test `console-precedence.test.ts` có `getComputedStyle` nhưng **jsdom drop `@import` node_modules** (ghi rõ trong file). Phần lớn CSS test khác là `readFileSync` một file (9/42 test file).

`@cmc/ui` export: 46 composite + 2 console TSX + barrel Astryx primitives. Không phải một họ:

| Vai trò | Implementations | Craft issue |
|---|---|---|
| Metric / KPI card | `StatCard` (Astryx Card + `fontSize: 24` + hex `color?`) vs `MetricCard` (`.console-mc` + Link + LineIcon) | Hai ngôn ngữ cho một vai trò. StatCard dùng ở revenue/CRM report; MetricCard ở cockpit |
| Badge | Astryx `Badge`, `StatusBadge` (soft CSS + solid Astryx + `fontSize: 1.15em` hack), `CountBadge` (`.console-count`) | Ba chip, không có size/tone scale chung |
| Empty | `EmptyState` = wrapper Astryx | ListPage fallback tiếng Việt hardcoded |
| Page chrome | `ListPage`/`DetailPage`/`FormPage` yêu cầu `.console-*` | LMS **0 import** các frame này |
| Filter | `FilterBar`: Astryx Selector/TextInput nhét `style={{ width: 160 }}` | Không phải control density thiết kế; là layout hack |
| Table | `DataTable`: Astryx Table + native `<input type="checkbox">` + `.console-list` | Checkbox không cùng family với control Astryx |

LMS chỉ dùng primitive Astryx (Button, Text, Stack, Badge, Banner) + CSS local (`.lms-star-hero` font-size `2.5rem` — ngoài cả hai type scale). Shared composites **không shared** giữa hai app.

Design showcase `apps/admin/src/pages/design-showcase.tsx` tự ghi: bản đủ ~23 section **không vào git**; trang hiện tại chỉ DateTime + WorkflowStatusbar. Không có gallery để mắt người soi family.

### Vì sao cảm giác “không chuyên nghiệp” khớp code

Bar sản phẩm (Linear/Figma-fluent) cần: **một** type scale, **một** radius, **một** elevation, một card, một badge, states đủ (empty/loading/error/disabled/focus), mật độ ổn định.

Code đang có:

1. Hai radius language (12–20 vs 4–6) trên cùng admin shell.
2. Hai status green (`--cmc-success #2e7d32` vs `--console-success #28a745`).
3. Composite “Xia port” / “premium cockpit” / “Odoo console” / “Astryx wrapper” sống cạnh nhau, không có owner family.
4. Gate hiện tại đếm chữ trong source — không nhìn computed style, không nhìn screenshot, không bắt được “trông nghiệp dư”.
5. Wave migration (Mantine→Astryx, premium tokens, Odoo console, Xia) để lại địa tầng, chưa có pass “một họ”.

Đây là đánh giá craft từ source, không phải điểm 10/20. Điểm số trong audit cũ **không falsifiable** nếu không có gallery.

---

## Approaches

### A — Truth ledger (nhỏ nhất, đúng nỗi tin)

Một orchestrator bọc lệnh đã có + phân loại proof. Thêm 3 đo DS còn thiếu: inventory composite, pin computed (không chỉ `readFileSync`), gallery sống (mọi export `@cmc/ui` một trang, screenshot CI optional sau).

- Ưu: giải đúng “tôi không tin docs”; YAGNI; CI hiện tại giữ.
- Nhược: chưa làm UI đẹp hơn.

### B — Gỡ va chạm token rồi mới đo

Chọn một winner (console trong `.o_web_client`, CMC/Astryx ngoài). Rename `--font-size-*` trùng, một radius, một status palette. Sau đó mới scorecard.

- Ưu: hết cascade ẩn.
- Nhược: lớn, dễ regress; **không** giải distrust nếu vẫn báo cáo bằng markdown.

### C — Visual regression + critique trước

Playwright screenshot primitives, so baseline, kèm review mắt.

- Ưu: bắt được “trông rẻ”.
- Nhược: flake; chưa có gallery ổn; không cover API/RLS/business; dễ thành gallery của hệ đang lệch.

### Recommendation

**A rồi mới đụng B/C.** Thứ tự:

1. Meter (`verify:system`) — tin được số.
2. Gallery sống — mắt soi family.
3. Gộp 4 vai trò trùng: card, badge, empty, filter/table chrome — **một** ngôn ngữ trên admin; LMS giữ primitive + token, không giả vờ dùng console composite.
4. Screenshot baseline **sau** khi family ổn, không trước.

Không mở plan “design-system-hardening” tiếp cho đến khi meter chạy được một lần trên HEAD.

---

## Proposed `verify:system` shape

```
pnpm verify:system
  L0 compile     typecheck, lint                         BLOCK
  L1 unit        pnpm test (trừ e2e)                     BLOCK
  L2 source gate frames, ratchet, a11y, doc-authority    BLOCK, labeled source-string
  L3 journey     ui-e2e artifact + acceptance:report     BLOCK only if required; else ADVISORY + honest
  L4 business    business:verify                         ADVISORY until invariant coverage có chủ
  L5 design      inventory + computed token owner + gallery ADVISORY until gallery green
  L6 security    trivy / existing scans                  ADVISORY
```

Mỗi lần chạy ghi `acceptance-report/system-verification.json` (hoặc path mới gitignored). HTML đọc file đó — **cấm** nhúng số từ markdown.

Lane L5 inventory cột: `export`, `role`, `cssOwner` (astryx|console|hybrid|inline), `adminUsages`, `lmsUsages`, `duplicateOf`.

---

## Handoff

- Next: plan skill rồi `/ak:cook` **chỉ** meter + gallery + inventory — không sửa visual language trong cook đầu.
- Bug path: không áp dụng (không có failure cụ thể; đây là distrust + craft).
- Unresolved (đổi hướng plan): sau khi meter chạy, **đóng băng** ngôn ngữ hiện tại hay **gộp family** (một card / một badge / một radius)? Khuyến nghị: gộp 4 vai trò sau gallery, không freeze-as-ugly.

## Unresolved questions

1. Sau scorecard xanh lần đầu: freeze drift, hay rebuild shared family? (đổi scope cook #2)
2. Gallery có vào `ui-e2e` required không, hay advisory cho đến khi screenshot ổn định?
3. `acceptance:report` / `business:verify` promote lên required khi nào — cần chủ triage false-alarm, không phải quyết định thiết kế.
