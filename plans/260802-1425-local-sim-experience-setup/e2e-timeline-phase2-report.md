# Timeline phase 2 + expert realism review

**Date:** 2026-08-02  
**Actors (only):** `*.tbhvnx7@timeline.local` (SA-created in phase 1)  
**Stack:** local-sim `https://erp.localhost`  
**Screenshots:** `e2e-screenshots/timeline-p2/`

---

## 1. What phase 2 set out to prove

```text
GĐĐT: course/class + assign GV timeline
Sale: opportunity → receipt on that class
GĐĐT: approve → provision HS
GV: attendance on session
GĐĐT/GV: exercise → submission → grade
```

All with **password auth**, **no** seed `sale@` / `gv@`.

---

## 2. Results (honest)

| Step | Path used | Result | Notes |
|------|-----------|--------|-------|
| Create class + assign `gv.tbhvnx7` | **API** `classBatch.create` | **PASS** | Class `CMCDEVEL-UCREA-2026-002`, 13 sessions, teacherId = timeline GV |
| Create class via **UI** form | `/admin/classes` dialog | **FAIL** | Course+teacher selected, dates/slots incomplete → **Tạo lớp disabled** |
| Course create via UI | `/admin/courses` | **IMPOSSIBLE** | List-only page; API `course.create` works |
| CRM lead O1→O4 | UI as sale timeline | **PASS** | `PH Timeline P2 p2tbhvnx7` |
| CRM "Ghi danh" → receipt form | UI | **FAIL / flaky** | Click stayed on `/crm`; no navigation to receipt form |
| Receipt create | **API** as sale | **PASS** | `SO00002` · 5.000.000đ · draft · `canApprove: false` |
| Receipt approve + provision | **API** as gddt | **PASS** | `approved` · `O5_ENROLLED` · `provisioning: ok` · enrollment **active** |
| Attendance mark | **API** as gv | **PASS** | Session 2026-08-02 · status **present** · markedBy `gv.tbhvnx7@…` |
| Attendance via UI | `/teaching/attendance` | **FAIL / misroute** | Automation landed on **Nhật ký buổi học** (session-evidence), not attendance roster |
| GĐĐT sees receipt list | UI finance | **PASS** | SO00002 **Đã duyệt** visible |
| Sale sees receipt list | UI + API | **FORBIDDEN** | `finance.receiptList` not granted to sale |
| Grading | UI queue | **BLOCKED** | Empty CurriculumUnit table → cannot create exercise → no submissions |

### Data artifacts created

| Entity | Id / code |
|--------|-----------|
| Class | `CMCDEVEL-UCREA-2026-002` (`6c32af2e-…`) |
| Opportunity | `538abb6a-…` → O5 after approve |
| Receipt | `SO00002` |
| Student | `HS Timeline P2 p2tbhvnx7` |
| Enrollment | `afda4b00-…` active |
| Attendance | present on session `7f9e5aa9-…` |

---

## 3. Expert realism review — bottlenecks

Severity: **C** critical for day-one ops · **H** high friction · **M** medium · **L** low.

### C1 — CurriculumUnit catalog empty on local-sim

- `CurriculumUnit` has **0 rows** in `cmc_prod` after local-sim seed.
- Exercise UI **requires** unit + PDF. GĐĐT cannot publish homework.
- Grading chain is dead until someone seeds units (DB/test helper only — no admin UI to author units).
- **Impact:** Pilot facility cannot run “học → nộp bài → chấm” from clean UI. CI journeys hide this by seeding units in tests.

### C2 — Course authoring is API-only

- `course.create` allowed for `giam_doc_dao_tao`.
- `/admin/courses` is **read-only list** (no “Tạo khoá”).
- Class form depends on existing courses → chicken-and-egg for a brand-new facility without seed.

### H1 — Class create UI vs API skew

- UI form: free-text `YYYY-MM-DD`, multi-slot weekday/time, Astryx Selectors.
- In this run, UI left **Tạo lớp disabled** despite course+teacher selected (slots/dates not bound reliably).
- Same session: **API create succeeded** (13 sessions, teacher assigned).
- **Impact:** Staff training on UI can fail while backend is fine; ops/agents drift to API bypass.

### H2 — CRM “Ghi danh” navigation fragile

- Card shows **Ghi danh** at O4, but automated click did not leave `/crm`.
- Formal journeys depend on exact button scoping inside card.
- **Impact:** Conversion step (lead → receipt) is the money path; UI reliability matters more than any other form.

### H3 — Sale cannot see own receipts after create

- Auth: `finance.receiptList` = GĐ only.
- Sale creates via CRM; cannot open `/finance` list (403).
- **Impact:** Sale cannot answer “phiếu em đã tạo duyệt chưa?” without GĐ or CRM-only state. Realistic centers often want sale self-service receipt status.

### H4 — Attendance UX chain still operationally long

- API path with teacher ownership works (proven).
- UI automation hit **wrong teaching page** (evidence vs attendance) — suggests nav/label/route confusion risk for users too (“Điểm danh” vs “Nhật ký buổi học” both under Giảng dạy).
- Sessions start as `planned` only — no “today’s class” smart default.

### H5 — Deep routes vs nav

- `/classes` → Coming Soon; real page is `/admin/classes`.
- Menu is correct; typed URL / bookmarks / old docs are wrong.

### M1 — Password / parent-mediated student activation

- After provision, student still on default password; change is parent-mediated (product design for children).
- Blocks pure-student LMS homework path until parent OTP email works (Brevo off locally).

### M2 — CI journeys overstate UI completeness

- `ui-chromium` 40/40 uses cookie mint + DB seed for class/exercise/submission.
- That is valid contract testing; it is **not** proof a center can open Monday morning with only SPA clicks.

### L1 — Second-eye / dual control on receipts

- Sale `canApprove: false` even at 5M; GĐ must approve.
- This is **good** for control (and matches ADR). Keep it; just pair with sale visibility (H3).

---

## 4. What *is* solid (do not over-fix)

1. **RBAC spine** — sale cannot approve; GĐ can; only SA creates users.
2. **Receipt → O5 → provision → active enrollment** works end-to-end on real stack.
3. **Teacher-scoped attendance write** works when class.teacherId is set.
4. **Facility isolation** and production-like nginx/auth path hold under local-sim.

---

## 5. Priority recommendations (product)

| Priority | Change | Why |
|----------|--------|-----|
| P0 | Seed **CurriculumUnit** (or UI to manage units) in local-sim / pilot bootstrap | Unblocks exercises/grading |
| P0 | **Course create** button on `/admin/courses` | Closes API/UI gap |
| P1 | Harden class create form (date picker, default slot, enable rules visible) | Stop “API works, UI dead” |
| P1 | Sale **read** own receipts (narrow list) | Day-to-day sales ops |
| P1 | CRM Ghi danh → `/finance/new?opportunityId=` reliability + empty-state if blocked | Revenue path |
| P2 | Teaching IA: clearer labels; deep-link Lịch dạy → Điểm danh with session | Reduce wrong-screen |
| P2 | Redirect `/classes` → `/admin/classes` | Kill Coming Soon trap |
| P3 | Document honest “day-one timeline” vs “CI journey” separately | Expectation management |

---

## 6. Phase 2 scorecard

| Capability | Timeline-only proof |
|------------|---------------------|
| Org bootstrap (phase 1) | Strong (UI) |
| Class + teacher assign | Strong (API); weak (UI) |
| CRM lead | Strong (UI) |
| Receipt + approve + provision | Strong (API); weak (CRM→form UI) |
| Attendance | Strong (API); weak (UI nav) |
| Grading | **Not achievable** without curriculum seed |

**Bottom line:** Backend domain model for enrollment + attendance is real and coherent. **Authoring surfaces (course, curriculum unit, class form, CRM→receipt handoff)** are the bottleneck for production-like “chỉ bấm UI” operations — and CI green journeys currently mask that gap.
