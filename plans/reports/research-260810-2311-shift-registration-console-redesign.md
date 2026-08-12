---
title: "Research: Shift Registration Console Redesign"
date: 2026-08-10
scope: "/hr/shifts UI and UX"
status: complete
---

# Research: Shift Registration Console Redesign

## Summary

Redesign `/hr/shifts` as a task-first schedule form. The current page is functionally correct but makes staff type date strings and add one row at a time. A monthly registration can require tens of repetitive interactions.

The supplied legacy reference is useful for its operational hierarchy: control panel, record status, contextual summary, then a date-by-shift matrix. It must not be copied literally. CMC EDU Admin is governed by CMC Console, so the redesign keeps its 46px console chrome, blue interactive accent, dense form sheet, native controls, and Vietnamese business copy.

## Method

- Read current page, unit tests, UI journey, shift router, HR workflow and rules.
- Read CMC Console authority, component/token sources, page-specific attendance guidance, and prior HR UX audit.
- Inspect the supplied legacy work-schedule screenshot visually.
- Re-index GitNexus, query the shift flow, and run upstream impact on `SubmitTab`.

## Verified business and technical constraints

| Constraint | Evidence | UI consequence |
|---|---|---|
| Group type comes from server data and must match the staff track. | `shift.listGroups`, `shift.submit` | Show the selected group and its plain-language rule. Do not infer the role client-side. |
| `SINGLE` allows one shift/day; `MULTIPLE` permits several distinct templates/day. | `apps/api/src/shift/router.ts` | Grid must behave as a per-day radio group or independent checkboxes, respectively. |
| Start date must be future ICT; entries must stay in the inclusive period. | `shift.submit` | Use two native date controls, validate inline, derive visible days only from the valid range. |
| One submitted registration may exist at a time; submitted or approved periods may not overlap. | `shift.submit` | State the rule before submit; retain server error as the authority and recovery message. |
| Submit creates `submitted` directly. A user-visible draft does not exist. | `shift.submit` | Do not show a fake lifecycle status bar or fake "save draft". |
| A `leave` entry cannot be persisted by the current payload. | `submitInput` | Do not add a “Nghỉ” toggle merely to resemble the reference screenshot. |
| Approval and rejection stay role-scoped and server-enforced. | `shift.approve`, `shift.reject`, WF-P3-04 | Preserve current approval tab and confirmation/reason flows. |

## Current UI assessment

### What works

- Uses the established `@cmc/ui` one-door component system.
- Group/template data is selected instead of pasted UUIDs.
- Submit, approval, rejection, and cancellation all have server mutations and test coverage.
- Current submit result is visible rather than silent.

### Main usability problems

1. The employee must type `YYYY-MM-DD` multiple times and create one row per date.
2. The selected period does not create or explain a usable working surface.
3. The available selection rule is hidden. Users discover `SINGLE` vs `MULTIPLE` only through server errors.
4. The group selector exposes technical tracks without enough contextual help.
5. The page offers no in-context count of chosen shifts or selected days before submission.
6. The existing period validation does not prevent an end date before the start date in the UI.

The prior HR audit independently identified the date-entry burden as a high-severity issue. It recommended a date picker and a weekday quick-select pattern.

## Reference screenshot read

Visible reference traits:

- A dense ERP shell with title, action area, status strip and activity rail.
- A clear metadata block before the main work table.
- Daily rows against fixed shift columns, so the user scans one calendar day at a time.
- Totals remain visible near the operational grid.

Traits intentionally not carried forward:

- Legacy green/black shell, colored icon rail, and separate chatter panel.
- Technical emails, manager chain, and duplicated form controls in the primary workflow.
- “Draft” status semantics that do not exist in current CMC EDU shift submission.
- Checkbox affordance for a leave action that cannot be saved through `shift.submit`.

## Design decision

Reading this as: an operational registration page for staff, with a dense CMC Console language, leaning task-first ERP.

Seeded variation result: the generic design generator suggested a webinar-style visual system. It conflicts with the CMC Console authority and is rejected. The adjacent appropriate direction is industrial/utilitarian product UI: data-first, restrained, and keyboard-friendly.

Aesthetic thesis: CMC Console for staff scheduling: warm paper neutrals, CMC blue interaction, Inter data hierarchy, a responsive date-by-shift matrix as the memorable element. The form comes from the real domain object: one shift choice per person per calendar date.

## Target UX

```text
Nhân sự / Đăng ký ca
  └─ Đăng ký ca mới
       1. Chọn nhóm ca
       2. Chọn kỳ đăng ký
       3. Chọn ca trong lịch ngày × ca
       4. Xem tóm tắt và gửi duyệt
```

- Native date fields replace free-text date inputs.
- A valid period renders inclusive daily rows immediately.
- Each template exposes name and time in its own selection column.
- `SINGLE`: selecting one template clears any other selection for that day.
- `MULTIPLE`: each template may be toggled once per day.
- A lightweight summary shows group, rule, date range, days with a choice, and shift count.
- “Chọn T2–T6” is offered per template as a fast, explicit schedule action.
- Desktop uses table-like grid density. At 375px, each date becomes a stacked card; the page itself does not horizontally scroll.
- One primary action, “Gửi đăng ký”, remains sticky through the existing `FormPage`.

## CMC Console mapping

| Need | Existing system surface |
|---|---|
| Shell and page context | `PageHeader`, `CmcTabs`, CMC Console navbar |
| Form sheet and sticky action | `FormPage` |
| Date control | `DateField` |
| Group control | `Selector` |
| Feedback | `Banner`, mutation pending state |
| Existing history and approval | `DataTable`, `StatusBadge`, `ConfirmDialog`, `Dialog` |
| Styling | `--cmc-*` and `.console-*` tokens only |

## Impact and acceptance

GitNexus reports `SubmitTab` has LOW upstream risk: one direct caller, `ShiftsPage`, in the Attendance module. The implementation must keep the serialized `shift.submit` payload byte-compatible.

Acceptance:

- Staff can select a future period and shifts without manually adding date rows.
- Single/multiple selection behavior is visible and correct.
- Invalid date ranges and empty selections block submission before mutation.
- Existing submit success/error, history, approval, rejection and cancellation behaviors remain.
- Focused admin tests, typecheck, lint, responsive inspection and the affected journey remain green.

## Unresolved questions

- `shift.listGroups` currently returns all facility groups. Filtering to a staff-compatible group is a product/API decision and is not included in this UI-only change.
- Existing backend cancellation authorization is broader than approval authorization. This redesign must not alter it without a separate authorization decision.
