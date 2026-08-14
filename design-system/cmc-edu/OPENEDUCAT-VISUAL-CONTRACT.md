# OPENEDUCAT-VISUAL-CONTRACT — admin looks like the screenshot pack

> **Authority for admin visual clone.** Source of truth = PNG pack  
> `/home/manhquy/Downloads/openeducat-ui-pack` (Odoo 18 Community + OpenEduCat 18).  
> Analysis: `plans/reports/research-260813-openeducat-ui-pack-visual.md`  
> Implementation: `plans/260813-2038-openeducat-visual-clone/`  
> Runtime CSS: `packages/ui/src/console.css` under `.o_web_client` only. LMS stays `lms-*`.

This contract **supersedes** `MASTER.md` Apple-blue lock **inside `.o_web_client`**.  
Outside admin (LMS, marketing), MASTER still applies.

Do not port OWL, Bootstrap JS, or XML views. Port **layout grammar, density, tokens, slots**.

---

## 1. Product OS (locked)

```
ConsoleNavbar 46px
ControlPanel  ~58px   ← one row, three zones
Workspace     flex 1  ← list | kanban grid | form sheet | calendar | settings
```

Modules change **menu + fields**. They do not invent chrome.

Edition: **Community** `#71639E`. Do not switch navbar to Enterprise `#714B67` unless the owner changes edition.

---

## 2. Tokens (canonical)

Use these names in `console.css`. Hex = Odoo 18 Community + PNG measurement.

| Token | Value | Use |
|-------|-------|-----|
| `--console-brand-purple` | `#71639e` | Navbar, **primary button**, Send message, links, funnel, tab underline |
| `--console-brand-purple-dark` | `#5a4f7e` | Navbar bottom hairline, primary hover |
| `--console-success` | `#28a745` | Systray badge, status Done/Confirmed, PUBLISHED ribbon, Following |
| `--console-gray-100` | `#f8f9fa` | Canvas, table header, chatter bg |
| `--console-gray-200` | `#e9ecef` | Secondary button fill, Log note, Cancel |
| `--console-gray-300` | `#dee2e6` | Borders, search, card, sheet |
| `--console-gray-600` | `#6c757d` | Labels, pager, placeholder-strong, inactive statusbar |
| `--console-gray-900` | `#212529` | Titles, values, dropdown items |
| `--console-facet-bg` | `#eaebf0` | Search facet chip (not purple) |
| `--console-statusbar-current` | `#e0d9f1` | Active chevron fill |
| `--console-row-hover` | `#f2f2f2` | List hover |
| `--console-dropdown-hover` | `#ebebeb` | App switcher row |
| `--console-radius` | `4px` | Buttons, cards, sheet, facet chips, tags except capsules |
| `--console-radius-sm` | `3px` | Checkbox, view-switcher button |
| `--console-search-radius` | `999px` | Search bar only (pack 02/03/15 — pill, not 4px) |
| `--console-navbar-height` | `46px` | |
| `--console-cp-height` | `58px` | Control panel |
| `--console-btn-height` | `30px` | New / Save / Send message |
| `--console-search-height` | `35px` | |
| `--console-list-row-height` | `40px` | |
| `--console-font-size-base` | `14px` | |
| `--console-font-size-sm` | `13px` | Cells, pager, navbar menu |
| `--console-font-size-xs` | `12px` | Facet, meta, tooltip |
| `--console-shadow` | `none` | |

**Primary interactive color inside admin = purple.** `#0071E3` must not appear on buttons, links, focus rings, or tabs under `.o_web_client`.

Focus ring: 2px `var(--console-brand-purple)` offset 1px, not a blue halo.

Font: keep Inter for Vietnamese diacritics; **size/weight/density** follow the table, not MASTER 12/16/20 radius.

---

## 3. Control panel slots (P0)

Replace stacked `header / filters / footer` with **one flex row**:

```
LEFT     New | title or breadcrumb | gear
CENTER   SearchBar (list/kanban/settings/apps only)
RIGHT    pager | view switcher
```

Height 58px. White. Bottom hairline 1px `--console-gray-300`. Padding-x 16px. `align-items: center`.

### LEFT

- List: solid primary `New` (30× ~52px, radius 4, no icon) + model title 18px/700 + gear 14px muted.
- Form: **outline** `New` (white, purple border+text) + breadcrumb parent 13px muted / record 18px/700 + gear.
- Settings: `Save` solid + `Discard` secondary. No gear required.

### CENTER

Search 35px × ~32% width. **Pill** (`border-radius: 999px`). Magnifier left, caret right. Placeholder `Search...` `#adb5bd`.

Facet: gray chip + ×. Active-filter funnel uses purple, chip does not.

Form views: **omit** search.

### RIGHT

List pager: `{from}-{to} / {total}` 13px muted + ‹ ›.  
Form pager: `{index} / {total}`.  
View switcher: 28px icon buttons; active gray fill, not purple. Tooltip black/white below.

---

## 4. View grammars

### List

Full-bleed table. Thead `--console-gray-100`, 40px. No vertical rules. Checkbox column. Column configurator on thead right. Empty cell = blank.

Status pills: **solid capsules** ~20px, 12px/500, radius 999. Draft `#6c757d` / white (not pastel gray-200). Done-family `#28a745` / white. Many2many in cells: gray pills, wrap vertically, no ×.

### Kanban people (SIS students / faculties / similar)

CSS grid 3 columns at 1280, gutter 16px, outer 16px. Card: photo flush left, name, city, email, clock bottom-right. Not a pipeline board.

CRM pipeline keeps `KanbanBoard` columns. Do not force SIS cards into columns.

### Kanban course (eLearning)

Taller card: title, pastel tags, View course + stats, optional diagonal PUBLISHED, footer 4 metrics.

### Form

Canvas gray. Sheet white, 16px inset, radius 4, pad 24–32px. Two-column label/value. Image 90px square top-right when the model has one.

Notebook: purple 2px underline on active tab **or** boxed tab joining the sheet (one2many).

Smart buttons: top-right of form chrome, before pager.

Statusbar: **inside the white sheet**, right-aligned chevrons, height 33px. **Text only — no step numbers.** Current = lavender `#e0d9f1`. Inactive (past and future) = gray-100.

Chatter: below sheet on width < 1400. Send message / Log note / Follow. Do not put chatter in a right rail at 1280.

### Calendar

Week grid + mini month on the right. Today circle. Now line. View switcher includes calendar icon.

### Settings

CP Save/Discard + search. Left module rail. Section blocks with gray headers.

---

## 5. Buttons

| Kind | Fill | Text | Where |
|------|------|------|-------|
| Primary | `#71639e` | white | New (list), Save, Submit, Send message, Invite (settings) |
| Outline primary | white | purple + 1px purple | New (form) |
| Secondary | `#e9ecef` | `#212529` | Log note, Cancel, Discard, Invite (course) |
| Ghost / icon | transparent | `#6c757d` | pager, view switcher, gear |

Radius 4. Height 30. No pill. No shadow. No icon on New.

---

## 6. What not to clone from the pack

- Website builder (31–33) into admin.
- Overlay app-switcher leftovers on 04, 06, 16, 22, 33, 35.
- Catalog note that 04 is a student form — it is Settings.
- Enterprise home-menu icon grid.
- Chatter-as-right-column at 1280.

---

## 7. Proof

A screen matches this contract when a 1280 screenshot of CMC, cropped to chrome+CP+body, is indistinguishable from the matching pack file at arm’s length: purple bar 46px, white CP one row, **pill search**, 4px buttons/sheet, **solid status capsules**, **text-only chevrons**, no blue CTA, no stacked filter row.
