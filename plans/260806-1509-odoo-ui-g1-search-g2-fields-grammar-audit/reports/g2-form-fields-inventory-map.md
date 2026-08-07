# G2 — Odoo form fields inventory → CMC map

**Pin:** Odoo **19.0** at `/home/manhquy/Downloads/odoo-src` @ `7de220c9`  
**Source:** `addons/web/static/src/views/fields/`  
**CMC:** `packages/ui` + `apps/admin` FormPage / DetailPage usage  
**Mode:** Catalog + map only — **do not port OWL field widgets**

---

## 1. Directory inventory

Actual tree under the pin: **68 widget folders** + **shared root modules** (not 92 discrete folders — the “~92” figure often mixes list/kanban registry variants, nested `properties/*` subcomponents, and root helpers). Every folder and every top-level shared file is listed below.

### 1.1 Shared root files (not field widgets)

| Entry | Role (1 line) |
|-------|----------------|
| `field.js` / `field.xml` | Field registry resolution, visual feedback (readonly/required/invalid), default empty field shell |
| `standard_field_props.js` | Shared OWL props contract for all field components |
| `formatters.js` | Display formatters (char/float/date/monetary/…) used by list & form |
| `parsers.js` | Input parsers (inverse of formatters) |
| `fields.scss` | Shared field chrome / invalid / readonly styles |
| `field_tooltip.js` / `.xml` | Developer / help tooltip for field labels |
| `file_handler.js` / `.xml` | Binary upload/download helper shared by binary/image/pdf |
| `input_field_hook.js` | Generic controlled input commit/blur behavior |
| `numpad_decimal_hook.js` | Decimal separator / numpad entry for float-like fields |
| `relational_utils.js` / `.xml` | Shared many2one/x2many open/create/autocomplete helpers |
| `dynamic_placeholder_hook.js` | Dynamic placeholder expression support |
| `dynamic_placeholder_popover.js` / `.xml` | Popover UI for inserting placeholders |
| `translation_button.js` / `.scss` / `.variables.scss` / `.xml` | Multilingual field translation entry affordance |
| `translation_dialog.js` / `.scss` / `.xml` | Dialog to edit per-language values |

### 1.2 Widget folders (alphabetical, one-line role)

| Folder | Role (1 line) |
|--------|----------------|
| `ace/` | Code editor (Ace) for text/code fields |
| `attachment_image/` | Thumbnail of an attachment many2one |
| `badge/` | Read-only badge presentation of a scalar |
| `badge_selection/` | Selection as clickable badge chips (+ list variant) |
| `badge_selection_with_filter/` | Badge selection filtered by domain/options |
| `binary/` | File upload/download for binary fields |
| `boolean/` | Classic checkbox boolean |
| `boolean_favorite/` | Star favorite toggle |
| `boolean_icon/` | Boolean as icon button |
| `boolean_toggle/` | Switch-style boolean (+ list variant) |
| `char/` | Single-line text (default for `char`) |
| `color/` | Hex/color char swatch input |
| `color_picker/` | Integer palette index color picker |
| `contact_image/` | Contact photo image widget |
| `contact_statistics/` | JSON contact stats strip |
| `copy_clipboard/` | Copy-to-clipboard char/URL/button widgets |
| `datetime/` | Date / datetime / date-range pickers (+ list) |
| `domain/` | Domain expression builder/editor |
| `email/` | Char with mailto link presentation |
| `field_selector/` | Technical field-path picker (studio/debug) |
| `float/` | Decimal number input |
| `float_factor/` | Float scaled by a factor (UoM-style) |
| `float_time/` | Float as hours:minutes time |
| `float_toggle/` | Float that cycles fixed values on click |
| `gauge/` | Gauge chart for a numeric KPI field |
| `google_slide_viewer/` | Embed Google Slides from URL/char |
| `handle/` | Drag handle for sequence/order integer |
| `html/` | HTML / rich-text field |
| `iframe_wrapper/` | Sandbox raw HTML/text inside iframe |
| `image/` | Binary image upload + preview |
| `image_url/` | Image displayed from URL char |
| `integer/` | Integer number input |
| `ir_ui_view_ace/` | Ace editor specialized for view arch/XML |
| `journal_dashboard_graph/` | Dashboard sparkline from text/json graph data |
| `json/` | Raw JSON field display/edit |
| `json_checkboxes/` | Multi-checkbox UI backed by JSON map |
| `kanban_color_picker/` | Kanban record color index picker |
| `label_selection/` | Selection as colored label badge (readonly-ish) |
| `many2many_binary/` | Attachments many2many as file chips |
| `many2many_checkboxes/` | M2M as full checkbox list |
| `many2many_tags/` | M2M as removable tags (+ kanban) |
| `many2many_tags_avatar/` | M2M tags with avatars |
| `many2one/` | FK autocomplete + open/create (core relational) |
| `many2one_avatar/` | M2O with avatar chip (+ kanban) |
| `many2one_barcode/` | M2O value via barcode scan |
| `many2one_reference/` | Polymorphic many2one_reference widget |
| `many2one_reference_integer/` | Integer-backed many2one_reference display |
| `monetary/` | Amount + currency symbol formatting |
| `password/` | Masked password char |
| `pdf_viewer/` | Inline PDF binary viewer |
| `percent_pie/` | Percent as small pie glyph |
| `percentage/` | Float as percentage input |
| `phone/` | Char with tel: link presentation |
| `priority/` | Star rating selection (priority) |
| `progress_bar/` | Progress bar for float/int (+ kanban) |
| `properties/` | Dynamic properties definition + values (Studio-like) |
| `radio/` | Selection as radio group |
| `reference/` | Polymorphic reference (model + res_id) |
| `remaining_days/` | Date shown as “in N days” / overdue |
| `selection/` | Dropdown selection (+ filterable variant) |
| `signature/` | Signature pad → binary |
| `stat_info/` | Stat button number/label pair (smart-button body) |
| `state_selection/` | State as colored bullet dropdown |
| `statusbar/` | Workflow stage path (clickable selection/m2o) |
| `text/` | Multiline text |
| `timezone_mismatch/` | Datetime warning when TZ differs |
| `url/` | Char as external link |
| `x2many/` | One2many/many2many list/kanban/form subview |

---

## 2. Families

### Scalar

| Widgets | Notes |
|---------|--------|
| `char`, `text`, `integer`, `float`, `monetary`, `percentage`, `float_factor`, `float_time`, `float_toggle`, `password`, `email`, `phone`, `url`, `json` | Default type widgets + typed presentation of `char`/`float` |
| `ace`, `ir_ui_view_ace` | Code editors over text |

### Boolean

| Widgets | Notes |
|---------|--------|
| `boolean`, `boolean_toggle`, `boolean_icon`, `boolean_favorite` | Same type, different chrome |

### Selection / status

| Widgets | Notes |
|---------|--------|
| `selection`, `radio`, `badge_selection`, `badge_selection_with_filter`, `label_selection`, `state_selection`, `priority`, `badge` | Enum / state presentation |
| `statusbar` | **Layout chrome** of selection/m2o stages (also listed under layout) |

### Relational (m2o / m2m / x2many)

| Widgets | Notes |
|---------|--------|
| `many2one`, `many2one_avatar`, `many2one_barcode`, `many2one_reference`, `many2one_reference_integer`, `reference` | FK / polymorphic |
| `many2many_tags`, `many2many_tags_avatar`, `many2many_checkboxes`, `many2many_binary` | M2M presentations |
| `x2many` | Nested list/kanban/form for o2m/m2m |
| `relational_utils` (shared) | Autocomplete / open / create |

### Binary / media

| Widgets | Notes |
|---------|--------|
| `binary`, `image`, `image_url`, `contact_image`, `attachment_image`, `pdf_viewer`, `signature`, `google_slide_viewer`, `iframe_wrapper` | File & media |
| `file_handler` (shared) | Upload plumbing |

### Layout / chrome

| Widgets | Notes |
|---------|--------|
| `statusbar` | Record workflow path in form header |
| `handle` | Row reorder in lists |
| `stat_info` | Smart-button count/label atom |
| `progress_bar`, `gauge`, `percent_pie`, `remaining_days` | Visual KPI presentation on form/kanban |
| `contact_statistics` | Contact header stats strip |
| `copy_clipboard` | Affordance next to scalar |
| `journal_dashboard_graph`, `kanban_color_picker`, `color`, `color_picker` | Decorative / kanban chrome |

### Special

| Widgets | Notes |
|---------|--------|
| `domain`, `field_selector` | Technical domain/field path editors |
| `properties` | Dynamic schema fields |
| `html` | Rich text / HTML |
| `signature` | Capture pad (also binary) |
| `timezone_mismatch` | Datetime UX edge case |

### SKIP (debug / Studio / non-product)

| Entry | Why SKIP for CMC product UI |
|-------|------------------------------|
| `domain`, `field_selector` | Studio/admin technical DSL |
| `ir_ui_view_ace`, `ace` (view arch) | View XML editing |
| `properties` (definition side) | Studio dynamic schema — not CMC model style |
| `translation_button` / `translation_dialog` | Odoo multi-lang field stack; CMC is vi-first, no ir.translation |
| `dynamic_placeholder_*` | Mail/template placeholder DSL |
| `google_slide_viewer` | Google integration-specific |
| `many2one_barcode` | Hardware barcode workflow not in CMC |
| `many2one_reference*`, `reference` | Odoo ORM polymorphic reference types — not in Prisma schema |
| `journal_dashboard_graph` | Accounting dashboard widget |
| `timezone_mismatch` | Odoo multi-TZ staff edge case |
| `float_factor`, `float_toggle` | Niche UoM/toggle floats |
| `kanban_color_picker` | Kanban color index is separate from CMC kanban stage |
| `contact_statistics` | Partner-app specific |
| `iframe_wrapper` | Rare sandbox; security cost high |
| Registry prefixes `list.*` / `kanban.*` / `form.*` | View-mode shells of the same widgets |

---

## 3. CMC / admin form patterns (scout)

### 3.1 `packages/ui` — form & detail grammar

| Component | Path | Role vs Odoo form |
|-----------|------|-------------------|
| **FormPage** | `packages/ui/src/components/form-page.tsx` | Create/edit sheet: header + `.o-form-sheet` body + sticky `.o-actions` |
| **DetailPage** | `packages/ui/src/components/detail-page.tsx` | Record form: PageHeader → summary → **statusbar** → sheet (entity + tabs + body) |
| **SectionBlock** | `packages/ui/src/components/section-block.tsx` | Group fields (≈ Odoo `<group>` / notebook page section) |
| **KeyValueList** | `packages/ui/src/components/key-value-list.tsx` | Readonly 1–2 col label/value grid (≈ form view mode) |
| **EntityHeader** | `packages/ui/src/components/entity-header.tsx` | Title · initials avatar · badges · actions (≈ form title + avatar) |
| **WorkflowStatusbar** | `packages/ui/src/components/workflow-statusbar.tsx` | Thin wrapper over ProgressSteps (≈ `statusbar` field) |
| **ProgressSteps** | `packages/ui/src/components/progress-steps.tsx` | Chevron step path (odoo.css skin under `.o_web_client`) |
| **StatActions** | `packages/ui/src/components/stat-actions.tsx` | Smart-button strip (≈ `stat_info` + button box) |
| **HighlightStrip** | `packages/ui/src/components/highlight-strip.tsx` | Summary metrics band above sheet |
| **StatusBadge** / **Badge** | status-badge / Astryx Badge | Selection/state chip |
| **DataTable** | data-table | Nested lines / related lists (partial x2many) |
| **CmcTabs** | cmc-tabs | Notebook pages |
| **Avatar** | avatar | Person chip (partial m2o_avatar) |
| **ActivityTimeline** | activity-timeline | Chatter-like history (not a field) |
| **PasswordInput** / **TextField** | auth-inputs | Password + typed input extras |
| **ResultPanel** | result-panel | Post-submit / loading states on FormPage |

**Astryx primitives re-exported via `@cmc/ui` (`primitives.ts`):**  
`TextInput`, `TextArea`, `Selector`, `MultiSelector`, `NumberInput`, `Button`, `Badge`, `Dialog`, `Banner`, `ProgressBar`, …  

**Not in Astryx barrel today:** dedicated Checkbox/Switch, DatePicker/DateTime, ColorPicker, FileInput, rich HTML editor, MonetaryInput, relational Autocomplete-with-create.

### 3.2 Sample admin pages (10) — field usage

| Page | Frame | Fields / patterns in practice |
|------|-------|-------------------------------|
| `finance/receipt-create.tsx` | **FormPage** | `TextInput` (name, phone, email), `Selector` (class batch), `NumberInput` (amount VND — no thousand sep / currency chrome) |
| `finance/receipt-detail.tsx` | **DetailPage** | EntityHeader, WorkflowStatusbar, HighlightStrip, StatActions, KeyValueList, SectionBlock, CmcTabs, StatusBadge — **readonly sheet grammar** |
| `crm/opportunity-detail.tsx` | **DetailPage** | Full design3 stack; `Selector` for owner assign; KeyValueList + Stage WorkflowStatusbar; dialogs for side actions |
| `students/student-detail.tsx` | **DetailPage** | EntityHeader, KeyValueList, `Selector` lifecycle + ConfirmDialog |
| `classes/class-detail.tsx` | **DetailPage** | EntityHeader, HighlightStrip, CmcTabs; **DataTable** students/sessions (o2m-like); `Selector` teacher & curriculum unit; makeup dialog uses **plain TextInput** + `YYYY-MM-DD` / `HH:mm` regex (no date widget) |
| `teaching/session-detail.tsx` | **DetailPage** | Tabs → panels (attendance/assessment/evidence); StatusBadge in header |
| `teaching/session-assessment.tsx` | **FormPage** | `Selector` class/session, `TextArea` notes, structured scores |
| `teaching/session-evidence.tsx` | **FormPage** | `Selector` + `TextArea` + **raw `<input type="file">`** (no binary field widget) |
| `teaching/report-cards.tsx` | **FormPage** | TextInput search + DataTable pick student + TextArea comments |
| `admin/users.tsx` | ListPage + **Dialog form** | TextInput, MultiSelector roles, Selector manager, PasswordInput — modal create, not FormPage |
| `admin/shift-config.tsx` | **DetailPage** | Nested TextInput / Selector for shift groups; time as free TextInput `HH:mm` |
| `teaching/grading.tsx` | ListPage + MasterDetail | `NumberInput` score (min=0); no monetary |

**Pattern summary**

- **Detail (view):** design3 frames are real — DetailPage + EntityHeader + WorkflowStatusbar + SectionBlock + KeyValueList + StatActions.
- **Edit/create:** FormPage + Astryx inputs; often Dialog forms for small creates.
- **Relational:** always **preloaded options into `Selector` / `MultiSelector`** — not Odoo-style live m2o autocomplete + create + open form.
- **Lines / o2m:** **DataTable** (or panel lists), not inline editable x2many list with handle reorder.
- **Money:** integer VND via NumberInput + `toLocaleString` display — no currency field.
- **Date/time:** free text + regex or `toLocaleDateString` display — no date picker field.
- **Boolean:** rare; custom toggles (e.g. attendance row buttons) rather than checkbox field.
- **Binary:** ad-hoc `type="file"` in evidence/exercises.

---

## 4. Map table — Odoo family → CMC/Astryx

Status legend: **SHIPPED** | **PARTIAL** | **MISSING** | **SKIP** | **N/A**

| Odoo field / widget family | CMC / Astryx analogue | Status | Notes |
|----------------------------|----------------------|--------|-------|
| **char** | `TextInput` / `TextField` | SHIPPED | Widely used |
| **text** | `TextArea` | SHIPPED | |
| **integer** | `NumberInput` | SHIPPED | |
| **float** | `NumberInput` | PARTIAL | No decimal-policy / numpad parity; OK for scores |
| **monetary** | `NumberInput` + manual `toLocaleString` + “đ” | PARTIAL | No currency symbol slot, thousand separators weak (TODO in receipt-create) |
| **percentage** | NumberInput + “%” label DIY | MISSING | Low traffic in admin |
| **password** | `PasswordInput` | SHIPPED | Auth + user create |
| **email** (widget) | `TextInput type="email"` | PARTIAL | Input type only; no mailto readonly chrome |
| **phone** | `TextInput` + `formatContactPhone` | PARTIAL | No tel: link field chrome |
| **url** | plain Text / Link DIY | PARTIAL | CopyLinkButton is app helper, not field |
| **boolean** checkbox | — / custom buttons | MISSING | No Astryx Checkbox export |
| **boolean_toggle** | — | MISSING | |
| **boolean_favorite / icon** | — | SKIP | Decorative; not product-critical |
| **selection** | `Selector` | SHIPPED | Static options |
| **radio** | Selector / button groups DIY | PARTIAL | No Radio field primitive in barrel |
| **badge_selection / label_selection / badge** | `Badge` / `StatusBadge` | PARTIAL | Display strong; edit-as-badges rare |
| **state_selection** | StatusBadge + Selector | PARTIAL | No bullet-dropdown chrome |
| **priority** (stars) | — | MISSING | Not used in CMC domains yet |
| **statusbar** | `WorkflowStatusbar` / `ProgressSteps` | SHIPPED | Click-to-advance only where page wires it (receipt/opp) |
| **many2one** | `Selector` + tRPC pickList | PARTIAL | No typeahead RPC, create-edit, open-record button |
| **many2one_avatar** | `Avatar` + Selector DIY | PARTIAL | EntityHeader initials only |
| **many2many_tags** | `MultiSelector` | PARTIAL | Tags UX differs; no color tags / create-on-type |
| **many2many_checkboxes** | MultiSelector | PARTIAL | |
| **x2many** (list/form) | `DataTable` + Dialogs + tabs | PARTIAL | No inline editable lines, no handle, no nested form view |
| **many2many_binary** | raw file input + list DIY | PARTIAL | Evidence upload only |
| **binary** | `<input type="file">` ad-hoc | MISSING | No shared BinaryField |
| **image / image_url / contact_image** | — | MISSING | Avatar is initials mark, not upload image field |
| **pdf_viewer** | teaching `pdf-annotator` (special) | PARTIAL | Domain-specific, not a form field |
| **signature** | — | SKIP | No product requirement |
| **html** | TextArea plain | MISSING | No rich text widget |
| **datetime / date / daterange** | **`DateField`** (date only, FilterBar + forms) / datetime still free text | PARTIAL | Date primitive SHIPPED 2026-08-06; datetime + form adoption still open |
| **float_time** | TextInput `HH:mm` | PARTIAL | shift-config / makeup session |
| **remaining_days** | manual date format | MISSING | Nice-to-have on deadlines |
| **progress_bar** | Astryx `ProgressBar` | PARTIAL | Exists primitive; not form-field bound |
| **gauge / percent_pie** | MetricCard / InsightMetric | N/A | Dashboard, not form field |
| **stat_info** + button box | `StatActions` | SHIPPED | |
| **handle** (sequence) | — | MISSING | No drag-reorder lines |
| **copy_clipboard** | `CopyLinkButton` (app) | PARTIAL | Not a field widget; deep-link only |
| **color / color_picker** | — | SKIP | Kanban color not product |
| **domain / field_selector / properties / ace** | — | SKIP | Studio/debug |
| **reference / m2o_reference** | — | N/A | No polymorphic ORM type |
| **json / json_checkboxes** | custom forms | SKIP | Rare |
| **timezone_mismatch / barcode / google_slide** | — | SKIP | |
| Form **label / required / invalid** chrome | Astryx label/isRequired + page error text | PARTIAL | No unified field visual feedback layer like Odoo `fieldVisualFeedback` |
| Form **sheet / group / notebook** | FormPage, SectionBlock, CmcTabs | SHIPPED | Grammar exists; adoption uneven (audit phase) |

---

## 5. Top 10 gaps (impact on “feels like Odoo form”)

Ranked for **staff ERP feel** on create/edit sheets and dense detail forms — not Studio fidelity.

| # | Gap | Why it hurts | Suggested direction (no implement) |
|---|-----|--------------|-------------------------------------|
| 1 | **Datetime + form-wide DateField adoption** | `DateField` exists for filters; many forms still free text / raw ISO | Migrate makeup/appointment dialogs; optional DateTimeField |
| 2 | **many2one = static Selector only** | Owner, teacher, class, unit pickers feel like filters, not “open related record / type to search / create” | Relational combobox pattern: async search + optional “Mở” link; still no OWL |
| 3 | **x2many not inline** | Class students/sessions, receipt lines, payroll lines are separate tables/dialogs — Odoo power is editable embedded list | Line editor: DataTable + inline cells + add row for 1–2 high-traffic models |
| 4 | **monetary half-baked** | Receipt amount is the money moment of the product; missing separators/currency chrome | MonetaryInput (VND-first): format on blur, integer minor units |
| 5 | **No boolean field primitive** | Settings/flags and list toggles reinvent buttons | Export/wrap Checkbox + Switch from design system |
| 6 | **Binary/image field missing** | Evidence/exercise file UX is bare `<input type=file>` | Shared FileField + ImageField (preview, size, clear) |
| 7 | **statusbar not bound as field** | WorkflowStatusbar is display + page-owned advance; Odoo field is the stage itself | Recipe: statusbar steps from domain enum + single mutation on click (document pattern, don’t invent OWL) |
| 8 | **email/phone/url presentation** | Detail sheets show plain text; Odoo form gives click-to-mail/call | Readonly presentation helpers inside KeyValueList values |
| 9 | **No handle / sequence** | Reorder curriculum, shift templates, pipeline — can’t drag | List handle only if a product sortOrder field exists |
| 10 | **html / long rich notes** | Assessments/comments are plain TextArea | Defer rich HTML; optional markdown later — lower than date/m2o |

---

## 6. Explicit non-port list

Do **not** port or reimplement as OWL clones:

1. Entire OWL field registry / `field.js` resolver stack  
2. `domain` field + DomainSelector engine  
3. `properties` dynamic schema (definition + value runtime)  
4. `field_selector`, Studio view editors (`ir_ui_view_ace`)  
5. Translation button/dialog multi-lang field stack  
6. Dynamic placeholder mail merge fields  
7. `reference` / `many2one_reference` polymorphic ORM widgets  
8. `many2one_barcode`, hardware scanners  
9. `google_slide_viewer`, `iframe_wrapper`  
10. `journal_dashboard_graph`, accounting-only gauges as fields  
11. `timezone_mismatch`  
12. `signature` pad (unless a signed-consent product story appears)  
13. `float_factor` / `float_toggle` niche numerics  
14. Kanban color picker index system as a form field  
15. Odoo `list.*` / `kanban.*` field shell variants  
16. Ace code editor as a general form field  
17. Full x2many subview architecture (nested ArchParser list/form controllers)

**Principle:** CMC stays React + Astryx + `@cmc/ui` page recipes. Match **grammar and UX affordances**, not registry names.

---

## 7. Recommended future cook slices (smallest first)

Ordered for incremental delivery; each slice should ship with one consuming admin page.

| Slice | Size | Deliverable | First consumer candidates |
|-------|------|-------------|---------------------------|
| **S1 — Date / time helpers** | XS | `DateField` + optional `TimeField` (native or thin wrapper) + parse/format vi-VN | class makeup dialog, shift-config, schedule-test dialog |
| **S2 — MonetaryInput (VND)** | XS | Format on blur, integer VND, `đ` suffix, error state | `receipt-create` |
| **S3 — Boolean / Switch** | XS | Re-export or thin Checkbox + Switch; form label alignment | admin settings rows, feature flags |
| **S4 — Contact presentation** | XS | Readonly email/phone/url helpers for KeyValueList | opportunity-detail, student-detail, receipt-detail |
| **S5 — FileField** | S | Shared file pick + name/size + clear; optional multi | session-evidence, exercises upload |
| **S6 — Async M2O combobox recipe** | S | Documented pattern + small `RelationSelect` (search query prop, open link slot) — still page-owned tRPC | teacher assign, owner assign, class batch |
| **S7 — Statusbar binding recipe** | S | Docs + helper: enum → steps + `onAdvance` | unify receipt + opportunity + future session lifecycle |
| **S8 — Line editor (mini x2many)** | M | Editable DataTable rows + add/remove for one model | class sessions makeup lines **or** future receipt fee lines |
| **S9 — ImageField** | M | Preview + upload binary | user/staff avatar, facility photo (if product asks) |
| **S10 — MultiSelector tags skin** | M | Closer to many2many_tags chrome (chips, colors optional) | user roles, later tags domains |
| **S11 — Rich text (only if needed)** | L | HTML/markdown for long pedagogy notes | report-cards / assessment comments — **defer** |

**Non-slices (park):** properties, domain builder, signature, barcode, Ace, translation UI.

---

## 8. Coverage check

| Bucket | Count in inventory | Mapped |
|--------|-------------------|--------|
| Widget folders | 68 | 100% named in §1.2 |
| Shared root modules | 14 logical groups | §1.1 |
| Family map rows (§4) | 40+ family rows | ≥90% of product-relevant widgets |
| SKIP/N/A | Explicit in §2 + §6 | Debug/Studio/ORM-specific |

---

## 9. Sources

| Source | Use |
|--------|-----|
| `/home/manhquy/Downloads/odoo-src/addons/web/static/src/views/fields/*` | Widget inventory, `displayName`, `supportedTypes` |
| `packages/ui/src/components/{form,detail}-page.tsx` + section/kv/statusbar/entity/stat-* | CMC form grammar |
| `packages/ui/src/primitives.ts` + `auth-inputs.tsx` | Astryx field surface |
| `apps/admin/src/pages/**` samples in §3.2 | Real field usage |
| Plan pin | `plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/plan.md` — odoo-src @ 19.0 `7de220c9` |

---

Status: **DONE**  
Summary: Catalogued 68 Odoo 19 field folders + shared roots; mapped families to CMC FormPage/DetailPage/Astryx with SHIPPED/PARTIAL/MISSING/SKIP; top gaps are date, m2o async, x2many lines, monetary, boolean, and file fields — not OWL ports.
