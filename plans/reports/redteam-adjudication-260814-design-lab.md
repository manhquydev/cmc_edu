# Phân xử red-team — design-lab gallery (pre-implement)

**Date:** 2026-08-14  
**Target:** `design-lab/system/` + `DESIGN.md` / `BRIDGE.md` / cockpit-roles  
**Prior soft gate:** `plans/reports/review-260814-design-lab-gate.md`  
**Lenses (independent, read-only):**

| Lens | Agent | Verdict |
|------|-------|---------|
| Assumption-destroyer | [Assumption-destroyer](323a1039-2c66-43a9-98e2-54f280d4b464) | **DESTROYED** |
| Failure-mode | [Failure-mode](471098bb-edf5-4063-a044-c33072dad9ac) | **BRITTLE** |
| Scope-critic | [Scope-critic](18765cac-48cf-4b36-97b7-1afecad35bd4) | **OVERBUILT** |
| Fact-checker | [Fact-checker](bcfbb472-9788-4879-93c0-2b7b761e3976) | **MIXED** |
| Harden + Distill | [Harden/Distill](9514ad45-e9d4-4dac-a2ce-57576a90e846) | Not implement-ready |

**Kết quả tổng: gallery chưa được coi là SoT freeze / chưa authorize bridge.** Ruled Ledger vẫn là hướng thị giác đáng giữ — nhưng một số giả định load-bearing đã bị phá bằng bằng chứng đo được.

**Không implement production trong báo cáo này.** Output = hướng cải thiện design + thứ tự làm.

---

## Điều quan trọng nhất (đảo / siết so với gate mềm)

### 1. Focus ring — gate A11y “FAIL / không có ring” bị đảo một phần

**Bằng chứng:** `:focus-visible` + `--focus-ring` đã có (`system.css:41–44`, `tokens.css:167`). `.btn`/`.input` không ghi đè `box-shadow`.

**Nhưng ring vẫn hỏng ở ngữ cảnh thật:** `overflow:hidden` / `overflow:auto` cắt box-shadow; không có `forced-colors` fallback; production dùng `outline` (`console.css`).

**Phán:** Nhận fact-checker + assumption-destroyer. **Không** plan “thêm focus ring từ đầu”. Plan = sửa cơ chế (outline hoặc outline+shadow, đừng clip, forced-colors) + xác nhận Tab trên trình duyệt thật.

### 2. Gallery không ổn định — `--space-5` đo được = 0 padding

Failure-mode + assumption-destroyer đo live: `.metric` và `.sheet` → `padding: 0px` vì shorthand có `var(--space-5)` không fallback. Ảnh `.impeccable/screenshots/system-v2/` không được tin làm comp of record cho đến khi fix + chụp lại.

**Phán:** Nhận CRITICAL. Lab chưa freeze-ready.

### 3. “Alias tokens sạch vào console.css” — DESTROYED

Cùng tên `--radius-container`: lab **8px** vs prod **4px**. Palette neutrals/success cũng lệch. Alias “giữ giá trị production” ⇒ gallery không bao giờ ship; đẩy giá trị lab ⇒ repaint (cần owner).

**Phán:** Trước mọi PR alias — conflict ledger + quyết định owner: (A) lab palette/radii thành truth, hoặc (B) giữ OpenEduCat values và hạ gallery xuống “direction, không phải production visual”. Đổi tên token lab nếu trùng tên khác giá trị.

### 4. Shell topology — 240px rail vs OpenEduCat 46/58 top OS

Shared-Chrome Rule chỉ đúng **trong lab**. BRIDGE wave 9 ngầm đổi Product OS đã khóa — chưa có authority.

**Phán:** Dừng mọi wave shell cho đến khi owner chọn: giữ Odoo top-nav **hoặc** adopt Linear rail.

### 5. “Fix all P0 rồi bridge everything” — sai chuỗi

Scope-critic: ~7.9k LOC / 10 HTML, 8 module sâu trong khi production đã có archetypes + kanban + statusbar. Đường đúng: P0 lab integrity → freeze token MVP → alias (sau conflict ledger) → ListPage only → một domain spike.

---

## Bảng phân xử

| # | Finding | Lens | Mức | Phán |
|---|---------|------|-----|------|
| 1 | `--space-5` undefined → padding metrics/sheet = 0 (đo live) | F-mode, Assume, Fact | CRITICAL | **Nhận** → fix Layer 2 / call sites + re-screenshot |
| 2 | `--radius-container` / palette name collision lab vs prod | Assume | CRITICAL | **Nhận** → conflict ledger + owner decide A/B trước alias |
| 3 | Shell 240px rail vs OpenEduCat 46/58 — chưa có authority | Assume, Scope | CRITICAL | **Nhận** → Q-shell owner trước bridge wave shell |
| 4 | “No focus ring” sai; ring tồn tại nhưng clip + no forced-colors | Fact, Assume | HIGH | **Nhận** → sửa cơ chế, không rewrite từ đầu |
| 5 | Flat-By-Default: palette shadow + sticky gradient | Gate, Harden, F-mode | HIGH | **Nhận** → toast-only; sticky flat |
| 6 | Layer 3 đọc `--_p-*`; print raw hex | Fact, Gate | HIGH | **Nhận** |
| 7 | Status tone pollution + seventh tones (`positive`/`critical`/`high`…) | All UX lenses | HIGH | **Nhận** → categorical palette; ban sprawl hoặc mở rộng vocab có chủ đích |
| 8 | SoD chủ yếu prose; cockpit có data absence nhưng system gallery chưa twin | Fact, Harden, F-mode, Scope | HIGH | **Nhận** → SoD twin trên Patterns/Finance |
| 9 | Empty ×3 chỉ Foundations; prod vẫn `"Không có dữ liệu"` | Harden, Scope, F-mode | HIGH | **Nhận** → ListPage grammar + 1 empty/module critical |
| 10 | Density LS ghi đè Audit compact | Fact, F-mode | HIGH | **Nhận** |
| 11 | comp-c funnel ép mọi role; bar width positional ≠ data | Assume | HIGH | **Nhận** → rail role-conditional + data-driven |
| 12 | Gallery JS (DnD, sort, select-all, gradebook publish) không phải contract | Assume, Scope | MEDIUM | **Nhận** → label lab-only; không port |
| 13 | Inter 550 trong token/DESIGN, HTML load thiếu | Fact | MEDIUM | **Nhận** → load 550 hoặc bỏ 550 |
| 14 | Breakpoints DESIGN ≠ CSS; 1366 board overflow | F-mode, Scope | MEDIUM | **Nhận** → align + board “peek” grammar |
| 15 | Attendance C/V vs Audit C/V/`late` overload | Harden, F-mode | MEDIUM | **Nhận** → tách mark alphabet |
| 16 | Missing: ConfirmGate, deny ×3, retry strip, form validation contract | Harden | HIGH | **Nhận** → edge-state grammar trước bridge components |
| 17 | OpenEduCat statusbar/funnel/kanban — không port geometry lab | Scope, Gate | HIGH | **Nhận** → alias/restyle existing only |
| 18 | 40px row = OpenEduCat — HOLDS | Fact, Assume | — | **Giữ** |
| 19 | Brand purple `#71639e` khớp prod — HOLDS | Fact | — | **Giữ** |
| 20 | Density không đụng type ramp — HOLDS | Fact | — | **Giữ** |
| 21 | WT chưa đụng `packages/ui` / `apps/admin` — HOLDS | Fact | — | **Giữ** |

**Bác / không để điều hướng plan:**
- “Không có CSS focus ring” (sai)
- “Density remaps type” (sai)
- “Modules never invent seventh tone” như đã-true (sai — đã invent)
- “Exactly one toast shadow” (palette cũng shadow)
- “Gallery đã freeze-ready / alias sạch” (sai)

---

## Hướng cải thiện design (north star)

Trước khi implement toàn diện / bridge `@cmc/ui`:

1. **Lab integrity freeze** — `--space-5`, CSS tail hỏng, Flat-By-Default, Layer-3/print purity, Inter 550, density page-scope. Re-screenshot. Không tin ảnh cũ.
2. **Owner decisions (blocking)**  
   - **Q-radius/palette:** lab values = production truth **hay** giữ OpenEduCat 4px + palette cũ?  
   - **Q-shell:** Linear 240 rail **hay** giữ OpenEduCat top OS?
3. **Edge-state + SoD grammar** trên Patterns (không thêm module HTML sâu): empty ×3, deny ×3, ConfirmGate, retry, loading; SoD twin Sale↔GĐKD.
4. **Tone purity** — 6 status + categorical axis riêng; tách C/M/V attendance vs RBAC.
5. **Thin bridge path** — conflict ledger → token alias (sau Q) → ListPage only → một spike Finance gate **hoặc** CRM restyle against live components. Dừng polish 8 module ngang bằng. Không port DnD/clip-path/funnel lab.

---

## Phased improvement path (design-direction only)

| Phase | Việc | Không làm |
|-------|------|-----------|
| **D0** | Fix lab integrity P0 + re-shot | Không bridge |
| **D1** | Conflict ledger + Q-radius + Q-shell (owner) | Không alias mù |
| **D2** | Patterns: edge states + SoD twin + tone purge | Không thêm module page |
| **D3** | Token alias vào `console.css` theo quyết định D1 | Không thay statusbar/funnel geometry |
| **D4** | ListPage grammar (density DataTable, empty ×3, bulk across-filter) | Không 8 module PRs |
| **D5** | Một domain spike (Finance SoD/gate **ưu tiên**) | Defer Eng/HR/Audit/Print depth |

---

## Cut list (ngừng polish)

- Equal-depth 8 `modules/*.html` (đặc biệt Eng/HR/Audit/Print)
- Kanban DnD / attendance cycle / gradebook draft như “product behavior”
- Lab statusbar clip-path / funnel trapezoid như ứng viên thay OpenEduCat
- Mobile/390 như mục tiêu gallery hàng đầu (ERP desktop-first)
- Dark mode / EN i18n scaffolding

## Must-add (thiết kế còn thiếu)

- Conflict ledger lab↔prod tokens  
- SoD twin views  
- Empty ×3 + Deny ×3 + ConfirmGate + retry  
- Categorical palette (role/subject/action-type)  
- FormPage validation contract  
- Breakpoint authority (desktop-only vs DESIGN set)  
- Funnel/rail role-conditional (không ép comp-c lên giáo viên)

---

## Gate cập nhật

| Câu hỏi | Trả lời |
|---------|---------|
| Freeze gallery làm SoT production? | **Không** — đến hết D0 + re-shot |
| Authorize `@cmc/ui` bridge wave? | **Không** — đến hết D1 (owner Q) + D2 tối thiểu |
| Ruled Ledger còn đúng hướng? | **Có** — giữ world; siết grammar + authority |
| Implement toàn diện ngay? | **Không** — làm theo D0→D5 |

---

## Liên kết

- Soft gate trước: `plans/reports/review-260814-design-lab-gate.md`  
- Research depth: `plans/reports/research-260814-design-system-depth.md`  
- Adjudication mẫu: `plans/reports/redteam-adjudication-260813-0139-design-system.md`
