# Brainstorm · Research · Advise — Design Lab & cảm giác “thô cứng”

**Ngày:** 2026-08-02  
**Skills:** ak-brainstorm · ak-research · ak-advise  
**Bối cảnh:** UI admin đã có frame (Dashboard/List), toast, cockpit modules — nhưng cảm nhận vẫn **cứng / thô / ERP skeleton**.

---

## 1. Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Có **một trang nhìn bằng mắt** toàn bộ design system (token, type, spacing, icon, atom, composite, page frame) + panel so sánh hướng style **softer**. Từ đó quyết định phase refactor visual (không đoán mò). |
| **Constraints** | Không shadcn/Tailwind thứ hai; map Astryx + `@cmc/ui`; giữ brand `#0071E3` trừ khi lab chứng minh đổi; page lab dev-friendly (không chặn prod auth nếu đã login). |
| **Non-goals** | Storybook monorepo; redesign toàn app trong một PR; đổi brand radical; LMS mobile frame. |
| **Acceptance** | `/design` render đủ swatch/type/components; sticky TOC; theme experiment “Current vs Softer”; browser screenshot; report advise hướng triển khai. |

---

## 2. Research — vì sao cảm giác thô cứng?

### 2.1 Evidence trong repo (as-built)

| Signal | Token / code | Hiệu ứng UX |
|--------|--------------|-------------|
| Flat extreme | Cards **không** border/shadow rest; chỉ surface contrast canvas `#F7F6F3` | “Giấy dán phẳng”, ít chiều sâu → cứng |
| Radius lệch | Input `4px` (xs) vs card `12px` | Form trông kỹ thuật; card trông khác thế hệ |
| Type Inter thuần | Một face, 2 weight, metric 34px | Chuyên nghiệp nhưng **thiếu personality** nếu spacing/hierarchy lỏng |
| Hairline divider dày cảm xúc | `--cmc-border` `#d2d2d7` còn dùng nhiều chỗ Astryx | Cạnh “bảng tính” thay vì “sản phẩm premium” |
| PageHeader sticky block | Background solid + borderBottom full-bleed | Cắt layout thô, không “soft card header” |
| Density ops | padding 20/24 | Tốt ops nhưng tăng cảm giác chật nếu type không bù |
| Astryx primitives | Button/Input defaults generic | Composite `.ck-*` đã soft hơn shell/list thô hơn |

### 2.2 Pattern ngành (living design system)

| Approach | Pros | Cons | Fit CMC |
|----------|------|------|---------|
| **Storybook** | Isolated, a11y addons | Setup/CI/build riêng, chậm solo | Overkill |
| **Chromatic / Ladle** | Visual review | Extra stack | No |
| **In-app Design Lab** (`/design`) | Dùng **đúng** tokens + Astryx runtime; 1 route | Không isolated pure unit | **Recommend** |
| **Static HTML export** | Share dễ | Drift khỏi code | Secondary |

Industry pattern: “Design system as product surface” — Linear/Notion internal galleries, Shopify Polaris website, Mantine docs. Cho monorepo solo: **in-app lab** = highest signal/cost.

### 2.3 Hướng style “mềm” (không đổi stack)

| Lever | Current | Softer proposal (lab only) |
|-------|---------|----------------------------|
| Card depth | flat | whisper border `1px solid border-subtle` + optional 1px shadow rest |
| Radius cards | 12 | 16–18 |
| Radius inputs | 4 | 8 |
| Header | sticky bar full | soft card header, rounded, gap from canvas |
| Section rhythm | gap 28 | gap 32–36 + clearer section titles |
| Row hover | canvas tint | sunken soft + 2px inset feel |
| Type | Inter all | Keep Inter; tighten metric tracking; slightly larger body lh |
| Icon stroke | 1.75 | 1.5 on dense chrome |
| Color | one blue | keep blue; status softer pastels for badges |

**Anti-pattern:** pastel rainbow metrics, glassmorphism heavy, second brand orange CTA, Fira/Geist switch without lab proof.

---

## 3. Advise (khuyến nghị)

### Approach đã chọn: **B — Living Design Lab in admin**

1. Ship `/design` (auth required) with full visual inventory + **Current | Softer** CSS variable scope.  
2. Review mắt → chốt 3–5 lever (radius, header, card border, input radius, section type).  
3. Sprint visual D: promote soft levers into `tokens.css` / `premium.css` / PageHeader — **không** rewrite pages.  
4. Only then re-skin cockpit/list if residual stiffness.

### Why not A (Storybook) or C (full redesign now)

- A: tooling tax, still not “real shell”.  
- C: high risk, no shared visual source of truth.

### Success metrics for later visual sprint

- [ ] Design lab is the source of truth for token review  
- [ ] Softer levers promote without layout break on ops density  
- [ ] User no longer reports “thô cứng” on cockpit + 2 list pages  

---

## 4. Deliverable this session

- Plan folder + this report  
- `apps/admin` page Design Lab + route + DEV topbar link  
- Browser open for visual review  

**Unresolved:** có promote Softer default sau lab review không? → hỏi user sau khi xem `/design`.
