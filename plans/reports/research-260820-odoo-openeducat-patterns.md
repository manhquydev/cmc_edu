# Research: Odoo 17/18 + OpenEduCat patterns for CMC EDU v2

- Date: 2026-08-20
- Scope: portable technical patterns only. Not a port. Not marketing.
- Sources: Odoo 18.0 source (`odoo/odoo`), OpenEduCat 18.0 (`openeducat/openeducat_erp`), official/docs URLs cited inline, CMC as-built listed in Mapping.
- Prior CMC decision this report does **not** reopen: path-based URLs stay (`docs/06-kien-truc-url-routing.md`); dual ledger `RecordEvent` vs `AuditLog` stays (`plans/reports/brainstorm-advise-260817-resource-detail-audit-depth.md`).

## Contents

1. [Detail / form views + stable URL + breadcrumbs](#1-detailform-views)
2. [Relational navigation](#2-relational-navigation)
3. [Chatter (`mail.thread` + `mail.activity.mixin`)](#3-chatter)
4. [Access control](#4-access-control)
5. [OpenEduCat core models and wiring](#5-openeducat)
6. [Mapping → CMC EDU today → lesson](#6-mapping)
7. [Do not adopt](#7-do-not-adopt)
8. [Unresolved](#8-unresolved)

---

## 1. Detail/form views

### What Odoo actually does

Every persisted model that has an `ir.actions.act_window` with `view_mode` including `form` gets a record form for free. Opening a row is not a custom page — it is the same form view bound to `(model, res_id)`.

**v17 / `/web#` (what the user cited, still accepted in v18):**

```
/web#id=<int>&model=<dotted.model>&view_type=form[&action=<id>][&menu_id=<id>]
```

Example: `/web#id=42&model=op.student&view_type=form`.

**v18 canonical URL** (router rewrite, retrocompat on `/web`):

- Path keys: `resId`, `action`, `active_id`, `model` (`PATH_KEYS` in `addons/web/static/src/core/browser/router.js`).
- `/web#id=42&view_type=form` is remapped: `id → resId`, `view_type` dropped. Form-without-id becomes `resId="new"`.
- Canonical emit: `/odoo/<action-or-model>/<resId>` e.g. `/odoo/students/42` when the window action sets `<field name="path">students</field>`.
- Fallback when no `path`: `/odoo/op.student/42` or `/odoo/action-1486/42`.

Source: [router.js 18.0](https://github.com/odoo/odoo/blob/18.0/addons/web/static/src/core/browser/router.js) (`parseHash`, `stateToUrl`, `urlToState`). OpenEduCat student action uses `path=students`: [student_view.xml](https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/views/student_view.xml).

Cold-start rule: the URL **is** the controller stack. F5 / share / back reconstructs the form from `action`/`model`/`resId` via `action_service._controllersFromState()` — [action_service.js](https://github.com/odoo/odoo/blob/18.0/addons/web/static/src/webclient/actions/action_service.js).

### Breadcrumbs

Not a static nav trail. The action manager keeps a `controllerStack`. Each hop (list → form, or form → related form) pushes a controller. Breadcrumb labels come from `display_name` (`_rec_name` / `_compute_display_name`). Missing name → UI shows `False`.

On reload, `_loadBreadcrumbs` POSTs `/web/action/load_breadcrumbs` with `{action, model, resId}` per stack entry. Inaccessible or deleted records are **dropped from the crumb and the URL**, with a console warning — they are not left as 404 crumbs.

Clicking a crumb pops the stack to that controller (list or prior form). This is why “session → student → back” feels native: it is stack, not `history.back()` guessing.

### Form chrome (the portable layout)

Standard form arch (Odoo 17/18, OpenEduCat student/session):

```xml
<form>
  <header>          <!-- workflow buttons + statusbar -->
  <sheet>
    <div name="button_box" class="oe_button_box"/>  <!-- smart buttons -->
    <div class="oe_title">…</div>
    <group>/<notebook>…</notebook>
  </sheet>
  <chatter/>
</form>
```

CMC already copied this into `DetailPage` (`packages/ui/src/components/detail-page.tsx`): PageHeader crumbs → sheet-bg → statusbar → EntityHeader → tabs → body. That chrome is done. The missing piece is **universal record identity + related-record hops**, not another layout.

### Portable lesson

| Keep | Drop |
|---|---|
| Every first-class record has a URL that cold-starts the form | Hash (`#id=&model=&view_type=`) |
| Breadcrumb = navigation stack of records/lists, labeled by display name | `menu_id` / numeric `action` in the URL |
| List is an index; row click + create-success land on the form | Generic `/web` action machine |

CMC already chose path-based grammar in TL06. Odoo 18 independently moved toward `/odoo/students/42` — same invariant, better URL.

---

## 2. Relational navigation

Three mechanisms. All resolve to “open that record’s form (or a filtered list of forms)”.

### 2.1 Many2one click → form

Default widget for `fields.Many2one` is a clickable badge. Click returns `ir.actions.act_window` with `res_model=<comodel>`, `res_id=<id>`, `view_mode=form`. That pushes a breadcrumb.

Opt-out is explicit:

```xml
<field name="faculty_id" options='{"no_open": True}'/>
```

OpenEduCat session form **opts out** on `faculty_id`, `course_id`, `batch_id` and leaves `subject_id` / `classroom_id` open ([timetable_view.xml](https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_timetable/views/timetable_view.xml)). So even OpenEduCat is not “everything clickable” — they disable hops that would dump a teacher into a catalog editor mid-session. The rule is: **click opens the related *work* record, not every FK**.

Student form does the same for address: `state_id` / `country_id` use `no_open`. `emergency_contact` stays open.

### 2.2 Smart buttons (`oe_stat_button`)

Empty `button_box` on the form is the extension point. Another module injects a count + action.

OpenEduCat timetable → faculty:

```xml
<xpath expr="//div[@name='button_box']" position="inside">
  <button class="btn oe_stat_button" type="object"
          name="count_sessions_details" icon="fa-calendar"
          groups="openeducat_timetable.group_op_timetable_manager,...">
    <field string="Sessions" name="session_count" widget="statinfo"/>
  </button>
</xpath>
```

Python ([faculty.py](https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_timetable/models/faculty.py)):

```python
def count_sessions_details(self):
    return {
        'type': 'ir.actions.act_window',
        'name': 'Sessions',
        'view_mode': 'list,form',
        'res_model': 'op.session',
        'domain': [('faculty_id', '=', self.id)],
        'target': 'current',
    }
```

Attendance does the same from student → attendance lines: `get_attendance()` sets `action['domain'] = [('student_id', 'in', self.ids)]` ([student.py](https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_attendance/models/student.py)).

Pattern: **stat tile on the parent form = count + filtered list of the child model**, not an in-page dump. Clicking a row in that list then uses (2.1).

### 2.3 One2many / many2many lines

Embedded list (`<field name="course_detail_ids">`) — each line’s many2one cells are themselves clickable unless `no_open`. Opening a line can also be `type="object"` opening the comodel form.

### Map onto “session → class / student / teacher”

| Hop | OpenEduCat | Mechanism |
|---|---|---|
| Session → Faculty | Present as many2one; **`no_open`** on the session form | They chose not to leave the session |
| Session → Course / Batch | many2one; **`no_open`** | Same |
| Session → Subject / Classroom | many2one; **open** | Catalog-ish but they allow it |
| Faculty → Sessions | smart button `session_count` | filtered `op.session` list |
| Student → Attendance lines | `get_attendance()` | filtered `op.attendance.line` list |
| Attendance line → Student | `student_id` many2one, tracking=True | default open |

Portable rule for CMC: **work records hop; config FKs may stay text**. Class, student, teacher, receipt, opportunity are work records. Program name, room code, blood group are not.

---

## 3. Chatter

### Attachment model

`mail.thread` is an **abstract mixin**, not a side table you join by convention. Inherit it and the record *is* a thread:

```python
_inherit = ['mail.thread', 'mail.activity.mixin']
```

Messages live in `mail.message` keyed by `(model, res_id)` — `message_ids = One2many('mail.message', 'res_id', domain=[('message_type','!=','user_notification')])`. Followers in `mail.followers`. No per-model history table.

Source: [mail_thread.py](https://github.com/odoo/odoo/blob/18.0/addons/mail/models/mail_thread.py). Docs: [Mixins 18.0](https://www.odoo.com/documentation/18.0/developer/reference/backend/mixins.html) (403 from this environment; URL is canonical).

UI is one tag after `</sheet>`: `<chatter/>`. That is why “every model has a log” — the form arch is mechanical, not a product decision per screen.

### Three streams in one widget

1. **Messages** — `message_post(...)`. Also inbound email if an alias exists. Subtypes (`mail.message.subtype`) filter follower notifications.
2. **Field-change tracking** — `tracking=True` on a field. `create`/`write` emit a tracking message unless context has `mail_notrack` / `tracking_disable`. `_track_subtype()` can escalate a change to a notify subtype.
3. **Activities** — `mail.activity.mixin` adds `activity_ids` One2many to `mail.activity` via `(res_model, res_id)`. Schedule / mark done / overdue state. Kanban widget `kanban_activity`. Source: [mail_activity_mixin.py](https://github.com/odoo/odoo/blob/18.0/addons/mail/models/mail_activity_mixin.py).

Create also auto-posts “Record created” and auto-subscribes `uid` unless `mail_create_nolog` / `mail_create_nosubscribe`.

### OpenEduCat usage (not theoretical)

| Model | Mixins | Tracking |
|---|---|---|
| `op.student` | `mail.thread` + `mail.activity.mixin` | `course_detail_ids` |
| `op.faculty` | both | `faculty_subject_ids` |
| `op.course` / `op.batch` / `op.subject` | `mail.thread` only | `program_id` on course |
| `op.student.course` | `mail.thread` | student/course/batch/roll |
| `op.session` | `mail.thread` | timing/start/end |
| `op.attendance.sheet` / `.line` / `.register` | `mail.thread` | register, date, present/absent/late, student |

Session `create()` also manually adds faculty + enrolled students as `mail.followers` so timetable changes email them (`notify_user` / `write`). That is followers-as-ACL-adjacent, not just a log.

### What is *not* portable

- One generic `(entity, entityId)` router the client can query. Odoo’s mixin is server-side: `self._name` is the model. The client never supplies the model string to a shared “timeline” RPC for arbitrary entities.
- Using chatter as the **compliance** ledger. Tracking messages are best-effort, context-disableable, and visible to anyone who can read the record.
- Auto-email on every field change (OpenEduCat session `write` already shows the cost).

---

## 4. Access control

Three layers. All three must pass. Docs: [Security in Odoo 18](https://www.odoo.com/documentation/18.0/developer/reference/backend/security.html) (403 here; confirmed in source below).

### 4.1 `res.groups` — who you are

A group is a named set of users, optionally implying other groups (`implied_ids`). OpenEduCat:

- `group_op_faculty` (“User”) implies `base.group_user`
- `group_op_back_office_admin` (“Manger” [sic]) implies `group_system` + faculty + `group_partner_manager`

Source: [op_security.xml](https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/security/op_security.xml).

Implication is the inheritance tree. Admin = faculty + more, not a parallel role.

### 4.2 `ir.model.access` — CRUD on the model

CSV, one row per (model, group): `perm_read, perm_write, perm_create, perm_unlink`.

OpenEduCat student:

| Group | R | W | C | U |
|---|---|---|---|---|
| back_office_admin | 1 | 1 | 1 | 1 |
| faculty | 1 | 1 | 0 | 0 |

No matching row ⇒ no access, even for Settings users (except implicit superuser / `ir.rule` su). Union across the user’s groups.

Source: [ir.model.access.csv](https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/security/ir.model.access.csv). Engine sample: [base ir.model.access.csv](https://github.com/odoo/odoo/blob/18.0/odoo/addons/base/security/ir.model.access.csv).

This is **model-shaped**, not `module.action`-shaped. “Can write `op.student`” is one bit, not `student.setLifecycle` vs `student.lookup`.

### 4.3 `ir.rule` — which rows

Record rules add a domain. Evaluation context: `user`, `time`, `company_id`, `company_ids`.

Combination ([ir_rule.py](https://github.com/odoo/odoo/blob/18.0/odoo/addons/base/models/ir_rule.py) `_compute_domain`):

- **Global** rules (no `groups`) are **AND**ed.
- **Group** rules that match the user are **OR**ed, then AND with globals.
- `perm_read/write/create/unlink` on the rule select which CRUD mode it applies to.

OpenEduCat examples:

```xml
<!-- faculty sees all students -->
<domain_force>[(1,'=',1)]</domain_force>  <!-- group_op_faculty -->

<!-- student login sees only self (attached to admin group — see Unresolved) -->
<domain_force>[('user_id','=',user.id)]</domain_force>

<!-- faculty record: self or linked HR employee -->
<domain_force>['|',('user_id','=',user.id),('emp_id.user_id','=',user.id)]</domain_force>

<!-- multi-company on academic year (global) -->
<domain_force>['|','|',('company_id','=',False), ...]</domain_force>
```

Company scoping is the closest analogue to CMC facility RLS.

### 4.4 UI reflection

| Surface | How group hides it |
|---|---|
| Menu | `groups_id` on `ir.ui.menu` (OpenEduCat removes Apps menu from faculty: `groups_id` `(3, group_op_faculty)`) |
| Form button | `groups="openeducat_timetable.group_op_timetable_user"` + `invisible="state != 'draft'"` |
| Smart button | `groups=` on the `oe_stat_button` |
| Field | `groups="base.group_user"` on chatter internals; `invisible=` for state |
| View | entire view can be group-restricted |

Server still enforces 4.2 + 4.3. Hidden button ≠ authorized RPC. Same split CMC already has (`canDo` vs `requirePermission`).

### 4.5 Access-rights management UI

Odoo ships the editor:

- **Settings → Users & Companies → Users** — `res.users` form, Access Rights page, checkboxes per application category (`res.groups` with `category_id`).
- **Settings → Users & Companies → Groups** — implied groups, users, menus, views.
- **Settings → Technical → Security → Access Rights / Record Rules** — raw `ir.model.access` / `ir.rule` (needs `group_erp_manager` / debug).

This is why Odoo can add a model and immediately grant it from the UI. The CSV is the default; the UI mutates the same tables.

CMC has **no** equivalent. Roles are a closed TypeScript enum; `PERMISSIONS` is a code table. Staff `/hr/staff/:id/access` assigns roles, it does not edit the matrix.

---

## 5. OpenEduCat

Repo: [openeducat/openeducat_erp @ 18.0](https://github.com/openeducat/openeducat_erp). Docs: [doc.openeducat.org](https://doc.openeducat.org/), [attendance](https://newdocs.openeducat.org/attendance/).

### Core graph

```
op.program
    └── op.course  (parent_id tree, subject_ids M2M, department_id)
            └── op.batch  (course_id, start/end)
                    └── op.student.course  (student_id, course_id, batch_id, subject_ids, roll)
op.student  _inherits res.partner
op.faculty  _inherits res.partner   (emp_id → hr.employee, faculty_subject_ids)
op.subject
op.session  (course, batch, faculty, subject, classroom, start/end, state)
op.attendance.register  (course, batch, subject?)
    └── op.attendance.sheet  (register, session?, faculty, date, state)
            └── op.attendance.line  (sheet, student, present/absent/excused/late)
```

`_inherits res.partner` = student/faculty **are** partners (email, address, image, user). Not a FK you hop to — the partner columns sit on the same form.

### How detail + links are wired

| Record | Window action `path` | Form | Chatter | Notable links |
|---|---|---|---|---|
| Student | `students` / `student` | `view_op_student_form` | `<chatter/>` + activity view | `button_box` empty in core; attendance module adds hop |
| Faculty | (core form) | inherited | yes | timetable injects Sessions smart button |
| Course / Batch / Subject | standard act_window | form+list | thread only | course→subjects M2M; batch→course M2one |
| Session | `session` | header statusbar + sheet | `<chatter/>` | many2one to faculty/course/batch **no_open**; subject/classroom open |
| Attendance sheet | docs: Attendance → Sheets | state machine draft→start→done | thread + tracking | register/session/faculty many2one |

Session lifecycle buttons are group-gated (`group_op_timetable_user`) and state-gated (`invisible="state != 'draft'"`). Same shape as CMC HITL on the form, not a side “Duyệt” app.

Attendance workflow (docs): Create sheet → add students from batch → mark P/A/E/L → Confirm. Modes: subject-wise (college) vs generic daily (K-12). Roles: Attendance User vs Manager.

### Education-center translation

OpenEduCat is a **school/university SIS** (program → course → batch → subject). CMC is a **center ERP+LMS** (facility → course catalog → `ClassBatch` → `ClassSession`). Closest pairs:

| OpenEduCat | CMC |
|---|---|
| `op.student` | `Student` |
| `op.faculty` | `AppUser` / staff (`giao_vien`) |
| `op.course` | `Course` (catalog; deferred as non-record) |
| `op.batch` | `ClassBatch` |
| `op.session` | `ClassSession` |
| `op.subject` | curriculum unit / program string |
| `op.attendance.sheet` + lines | session attendance workspace (not its own first-class form today) |
| `res.company` + `ir.rule` company domain | `Facility` + Postgres RLS |

Do not import program/term/department trees. The hop graph (session↔batch↔student↔faculty) is the transferable bit.

---

## 6. Mapping

Each row: Odoo/OpenEduCat pattern → CMC today → concrete lesson. Lessons are scoped to existing primitives. No Odoo port.

### 6.1 Detail URL + breadcrumbs

| | |
|---|---|
| **Theirs** | `(model, id)` form is addressable. v17 hash; v18 `/odoo/<path>/<id>`. Crumbs = controller stack + `display_name`. |
| **Ours** | Path grammar in `docs/06-kien-truc-url-routing.md`. `@cmc/links` entity map + `/go/:entity/:id` (`packages/links/src/index.ts`). `DetailPage` + `PageHeader.breadcrumbs`. UUID ids, not business codes (TL06 wanted codes; as-built is UUID). Session tabs are `?tab=` not subpath (`session-detail.tsx`) — class/student/receipt already use `/:id/:section`. |
| **Adopt** | Keep path URLs. Treat `@cmc/links` as the action `path` registry: if it is a work record it has a builder; if not, do not invent a detail route. Breadcrumbs must be **clickable parent records**, not only area labels. Session crumb today is `Giảng dạy / Lịch dạy / <8-char uuid>` — replace the last crumb with class code and make the class crumb `classSectionPath(id,'overview')`. Cold-start already works; do not add hash. |

### 6.2 Relational hops (session → class / student / teacher)

| | |
|---|---|
| **Theirs** | Many2one click = open form (unless `no_open`). Smart button = filtered list action. |
| **Ours** | Class roster already links students (`class-detail.test.tsx` asserts `<a>`). Session overview prints class as `KeyValueList` text (`title = session.batchCode`). No `links.classBatch` / `links.staff` / `links.student` on the session page (grep: none). Teacher is not even a field on the overview KV. Attendance panel is embedded, not a hop to student detail. |
| **Adopt** | 1) Add a tiny `RecordLink` (or reuse `resolveGo`) that renders `<a href={links[entity](id)}>` only when `canDo` + id present; otherwise plain text. 2) Session overview: class → `/admin/classes/:id/overview`, teacher → `/hr/staff/:id` if `staff.pickList`/`user.manage` (else text), each attendance row name → `/admin/students/:id`. 3) Smart-button analogue: `HighlightStrip` / EntityHeader actions that `navigate(links.X)` or filtered list (`/admin/classes/:id/sessions`), not a new widget framework. 4) Follow OpenEduCat’s `no_open` for config FKs (program string, room). |

### 6.3 Per-record history

| | |
|---|---|
| **Theirs** | Inherit mixin → `<chatter/>`. Messages + tracking + activities on `(model, res_id)`. |
| **Ours** | Dual ledger (locked): `RecordEvent` = operational timeline, facility + RLS + append-only + domain kind allowlist + **no generic entity router** (`apps/api/src/record-event/store.ts`). `AuditLog` = compliance, `audit.list` empty roster ⇒ super_admin only, global page `/admin/audit-log`. UI: `RecordTimeline` (`packages/ui`). Emit helpers per domain (class, student, CRM, receipt, parent, meeting, staff). Session itself has **no** `RecordEvent` entity — session mutations emit on `ClassBatch`. |
| **Adopt** | Keep the dual ledger. Steal three chatter *behaviors*, not the mixin: (a) **note** is already a kind — put `RecordTimeline` on every record detail that already emits; (b) **field-change** = add closed kinds (`teacher_changed` already exists on class) rather than auto-diff every column; (c) **activities** = HITL buttons already on the form (Duyệt/Từ chối). Do **not** attach `AuditLog` to director detail. Do **not** backfill. Do **not** add a client-supplied `entity` query. Optional later: `ClassSession` as its own timeline entity if session-local notes matter more than class-level ones. |

### 6.4 Access control

| | |
|---|---|
| **Theirs** | `res.groups` → `ir.model.access` (model CRUD) → `ir.rule` (row domain). UI `groups=` + Settings Users/Groups editor. |
| **Ours** | `ROLES` / `ACTIVE_ROLES` + `PERMISSIONS[module.action]` + `can()` (`packages/auth/src/index.ts`). `super_admin` bypass. tRPC `requirePermission` is the real gate; `canDo` hides chrome. Row layer = Postgres RLS on `facilityId` + procedure ownership (sale-own leads, teacher-own session). Staff access section assigns roles. Matrix is code, tested (`index.test.ts` roster exhaustiveness). SoD encoded as *absent* roles on a key (`finance.receiptApprove` has no `sale`). |
| **Adopt** | Keep `module.action` — it is finer than Odoo model CRUD and already encodes SoD. Map mentally: `PERMISSIONS` ≈ `ir.model.access`, RLS+ownership ≈ `ir.rule`, `ACTIVE_ROLES` ≈ `res.groups`. Lessons: (1) **same key on nav, route, and procedure** (already a CMC rule; session page already uses `canDo('schedule','generate')` / `canDo('exercise','manage')`). (2) Implication tree: Odoo admin implies faculty; CMC directors do **not** imply teacher — keep it explicit, do not add implied_ids. (3) Field/button visibility: use `canDo` next to the control (Odoo `groups=`). (4) Do **not** build a Groups editor that mutates `PERMISSIONS` at runtime — the registry-as-code is the access-rights UI for a solo+AI shop. (5) Company-rule shape is already RLS; do not add a second domain language. |

### 6.5 OpenEduCat education objects

| | |
|---|---|
| **Theirs** | Student/faculty inherit partner; session is the teaching atom with 5 many2ones; attendance is sheet+lines under a register. |
| **Ours** | `Student`, `AppUser`/staff, `ClassBatch`, `ClassSession`, attendance as session workspace tabs. Course is catalog, not a detail record (brainstorm 260817). |
| **Adopt** | Session is the hub (already RCWS). Make its FKs navigable (6.2). Do not split attendance into `AttendanceSheet` + `AttendanceLine` forms unless product asks — CMC’s tab-on-session is the better center UX. Do not `_inherits` student onto a partner table; CMC already has `ParentAccount` + `Student` split. |

---

## 7. Do not adopt

- Odoo hash URLs, `menu_id`, numeric `action` ids, `model=` in the location bar (TL06 already forbids; v18 itself abandoned this as canonical).
- A generic record engine / OWL / `ir.actions.act_window`.
- `mail.thread` as a single table readable by anyone with record read — that collapses the AuditLog/RecordEvent split.
- Runtime group editor.
- Smart-button XML inheritance. Use `HighlightStrip` / header actions.
- Opening catalog FKs (program, room) just to mimic many2one.

---

## 8. Unresolved

- OpenEduCat `student_login_rule` is attached to `group_op_back_office_admin` with `user_id = user.id`. That looks inverted (admin would only see themselves). Not used as a CMC template; flag only.
- Session form `no_open` on faculty/batch vs CMC’s explicit ask to hop session → teacher/class. Product choice: CMC should hop (center ops), OpenEduCat chose not to. Report recommends hop.
- Whether `ClassSession` gets its own `RecordEvent` entity or keeps piggybacking `ClassBatch`. Not decided here.
- TL06 still prefers business codes in URLs; as-built is UUID + `/go`. Out of scope.

---

## Sources

Odoo 18.0 source:

- https://github.com/odoo/odoo/blob/18.0/addons/web/static/src/core/browser/router.js
- https://github.com/odoo/odoo/blob/18.0/addons/web/static/src/webclient/actions/action_service.js
- https://github.com/odoo/odoo/blob/18.0/addons/mail/models/mail_thread.py
- https://github.com/odoo/odoo/blob/18.0/addons/mail/models/mail_activity_mixin.py
- https://github.com/odoo/odoo/blob/18.0/odoo/addons/base/models/ir_rule.py
- https://github.com/odoo/odoo/blob/18.0/odoo/addons/base/security/ir.model.access.csv
- https://www.odoo.com/documentation/18.0/developer/reference/backend/security.html
- https://www.odoo.com/documentation/18.0/developer/reference/backend/mixins.html
- https://www.odoo.com/documentation/17.0/developer/reference/backend/actions.html

OpenEduCat 18.0:

- https://github.com/openeducat/openeducat_erp
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/models/student.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/models/faculty.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/models/course.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/models/batch.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/models/subject.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/views/student_view.xml
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/security/ir.model.access.csv
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_core/security/op_security.xml
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_timetable/models/timetable.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_timetable/models/faculty.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_timetable/views/timetable_view.xml
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_timetable/views/faculty_view.xml
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_attendance/models/attendance_sheet.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_attendance/models/attendance_line.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_attendance/models/attendance_register.py
- https://github.com/openeducat/openeducat_erp/blob/18.0/openeducat_attendance/models/student.py
- https://doc.openeducat.org/
- https://newdocs.openeducat.org/attendance/

CMC (as-built cited):

- `docs/06-kien-truc-url-routing.md`
- `packages/ui/src/components/detail-page.tsx`
- `packages/ui/src/components/record-timeline.tsx`
- `packages/links/src/index.ts`
- `packages/auth/src/index.ts`
- `packages/db/prisma/schema.prisma` (`RecordEvent`, `AuditLog`)
- `apps/api/src/record-event/store.ts`
- `apps/admin/src/pages/teaching/session-detail.tsx`
- `apps/admin/src/pages/classes/class-detail.tsx`
- `plans/reports/brainstorm-advise-260817-resource-detail-audit-depth.md`
