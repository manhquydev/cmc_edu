# Analysis — ADR / journal (đã chốt) vs nghiệp vụ thực tế trong code

**Date:** 2026-08-12  
**Mode:** READ-ONLY advisory (`--advise`) — **không sửa code/ADR**  
**Branch tip verified:** `b273e3c` · `feat/lms-foundation-unit-range-spike`  
**Scope:** `docs/decisions/` (0038–0046 + harness 0001–0007) · TL16 ADR-A–D · journals · as-built docs · code `apps/api` · `apps/admin` · `apps/lms`

---

## 0) Tóm tắt điều hành

Sau sóng **resource-centric Console + LMS foundation (unit range / dual-gate)**, một số ADR **vẫn đúng lõi** nhưng **câu chữ “duyệt / IA / chấm công / LMS open” đã bị code vượt qua**. Ưu tiên cập nhật tài liệu (không reverse code):

| Ưu tiên | Mục | Vấn đề |
|--------|-----|--------|
| P0 | ADR **0039** (GPS “bị bỏ”) + **0040** (duyệt ca theo `managerId`) | Code đã OR-gate GPS (0044) và duyệt ca **theo track role**, không chuỗi managerId |
| P0 | `docs/system-architecture.md` bảng Deferred “**LMS Frontend Not started**” | Sai hoàn toàn so với `apps/lms` đã ship |
| P1 | ADR **0038** vs dual-gate LMS | Tier A/B còn sống; entitlement trên homework **mặc định OFF**; kill-switch mở đường SessionExercise delivery |
| P1 | TL16 **ADR-C** (5 nhóm IA) vs nav-registry | Nav ≈ 7 nhóm resource (HR/Engagement tách); resource-centric LOCKED bổ sung anti-“Duyệt app” |
| P1 | TL07 glossary dòng ShiftRegistration | Vẫn “managerId/HR” — lệch code track GĐ |
| P2 | ADR **0045** wording procedure | Code: `lmsOps.addWithUnits` + `grantUnitsFromReceipt`, không surface `enrollment.grantUnits` |
| P2 | Journals Astryx / M0 SSO-primary | Historical — không authority; Console + staff password là as-built |

---

## 1) ADR product — phân loại vs code

### 1.1 Vẫn khớp (giữ nguyên; chỉ patch phụ nếu cần)

| ADR | Lõi quyết định | Bằng chứng code |
|-----|----------------|-----------------|
| **0041** Provisioning atomic | Receipt approve → provision HS/PH/Enrollment active; lỗi provision không rollback tiền; idempotent | `apps/api/src/provisioning/idempotent.test.ts` · `provision-from-receipt.js` path |
| **0042** RLS defense-in-depth | `withFacility` + Postgres RLS | `docs/system-architecture.md` §RLS; model list 2026-08 |
| **0043** Daily in/out pairing | 1 cặp vào/ra/ngày; ngoài mạng → phiếu; **không** `manualPunch.create` | `apps/api/src/checkin/router.ts:411–415` comment REMOVED create; ticket auto từ punch |
| **0044** Geofence OR-gate | `withinNetwork = openMode \|\| ipMatch \|\| geoMatch` + `verification` labels | `apps/api/src/checkin/router.ts:229–278` · `punch-geo-gate.test.ts` |
| **0046** orderGlobal stability | Unique `(program, orderGlobal)`; entitlement identity | `apps/api/src/exercise/open-tier.ts:177` · seed/tests orderGlobal |
| **ADR-A** (TL16) reserved→active by Receipt | Enrollment money gate | Glossary TL07; provision tests active enrollment |
| **ADR-B** Cổng tiền GĐKD | SoD sale create / GĐKD approve | Finance permissions + receipt flows (as-built) |
| **ADR-D** 4 role + IT active | Registry still 9 roles; deferred roles not full UI | TL07 + nav permission filters |

### 1.2 Bị hiện thực **vượt qua / lệch** (ưu tiên — đề xuất cập nhật)

#### A) ADR **0039** — “không GPS” + duyệt manager (một phần đã note 0043)

| Claim ADR 0039 | Code hôm nay | Verdict |
|----------------|--------------|---------|
| Alternatives bỏ: **GPS/geofence** | ADR **0044** Accepted: GPS-in-radius là admission path thứ hai | **Superseded (partial)** by 0044 — ADR 0039 “Alternatives bỏ GPS” **không còn đúng** |
| IP match → `method: 'ip'` vs manual ticket | Vẫn đúng nhánh IP; thêm `verification` ∈ {network,geo,open,none}; method field secondary | **Extended** — IP core live |
| Duyệt manual: manager trực tiếp | 0039 body đã note 0043 track GĐ; code track-based | **Superseded for approval** (0043) |

**Evidence:**

```text
apps/api/src/checkin/router.ts:238–278  openMode / ipMatch / geoMatch / verification
docs/decisions/0044-geofence-gps-or-gate.md  Decision §1 OR gate
docs/decisions/0039-…md  Alternatives bỏ GPS (stale)
```

**Đề xuất (không sửa trong analysis):** Thêm Status banner trên 0039: “Location admission: see **0044**; approval gate: see **0043**. IP CIDR rule still authoritative.”

#### B) ADR **0040** — duyệt ca: managerId fallback

| Claim ADR 0040 | Code hôm nay | Verdict |
|----------------|--------------|---------|
| ShiftGroup + `selectionMode` SINGLE/MULTIPLE | Còn (resolveShiftGroup / group type) | **Live** |
| Duyệt: “managerId trực tiếp; hết chuỗi → GĐĐT/GĐKD theo nhóm” | `assertCanReview` chỉ check **role track** (`giam_doc_dao_tao` / `giam_doc_kinh_doanh`) + anti-self + super_admin; **không** đọc `managerId` | **Lệch / vượt** |

**Evidence:**

```text
apps/api/src/shift/router.ts:108–130  assertCanReview — roles only, no managerId chain
apps/api/src/shift/router.ts:11–13    header comment: GIAO_VIEN→GĐĐT, KINH_DOANH→GĐKD
apps/api/src/shift/get.test.ts:89–99  matching-track vs wrong-track
```

**Đề xuất:** Sửa Decision bullet “Duyệt” của 0040 (hoặc ADR superseding ngắn): **approve/reject = track director role**, không fallback managerId. Cập nhật **TL07** dòng ShiftRegistration (`docs/07-glossary-san-pham.md:63` vẫn “managerId/HR/giám đốc”).

#### C) ADR **0038** — open-tier homework vs LMS dual-gate / delivery

| Claim ADR 0038 | Code hôm nay | Verdict |
|----------------|--------------|---------|
| Tier A/B published + progress ICT | Implemented `open-tier.ts` + tests | **Live (default path)** |
| Single story “mở bài = Tier A/B” | Kill-switch `LMS_OPEN_TIER_ENABLED=0` → **SessionExercise delivery** only | **Extended** — second product path |
| Không nói unit entitlement | `LMS_ENTITLEMENT_GATE` default **`0`**: homework **không** AND range trừ khi bật flag | **Incomplete vs 0045** for homework |

**Evidence:**

```text
apps/api/src/exercise/open-tier.ts:80–88   isOpenTierEnabled default on; isEntitlementGateOnOpenTier default OFF
apps/api/src/exercise/open-tier.ts:102–111  kill-switch → deliveredExerciseIdsForStudent
apps/api/src/exercise/open-tier.ts:172–198  entitlement intersect only when flag on
apps/api/src/lms-ops/exercise-delivery.ts   class sequence delivery + onRoster
apps/api/src/lms-ops/on-roster.ts:28–33     dual-gate roster: active AND range cover
```

**Đề xuất:** ADR 0038 Status: “Still default homework gate; dual-gate homework optional via `LMS_ENTITLEMENT_GATE` (see 0045); alternate delivery path when open-tier off.”

#### D) ADR **0045** — dual gates unit entitlement (foundation)

| Claim ADR 0045 | Code hôm nay | Verdict |
|----------------|--------------|---------|
| Dual AND: active enrollment + unit range for teaching | Attendance mark + roster + delivery use `onRoster` / unitRanges | **Live (teaching path)** |
| `enrollment.grantUnits` / `addWithUnits` | Surface **`lmsOps.addWithUnits`** (`requirePermission('enrollment','grantUnits')`); money bridge `grantUnitsFromReceipt` | **Naming drift** (permission key ok, procedure tree `lmsOps`) |
| Fail-closed no unit stamp | `onRoster` null orderGlobal → false; attendance gate | **Live** |
| “Does not claim production dual-gate for exercises” | Correct: homework entitlement flag default off | **Honest gap still true** |

**Evidence:**

```text
apps/api/src/attendance/router.ts:153–195, 287–318
apps/api/src/lms-ops/router.ts:204–206  addWithUnits
apps/api/src/lms-ops/grant-units.ts:1–2, 213+  grantUnitsFromReceipt
apps/api/src/exercise/open-tier.ts:86–88  LMS_ENTITLEMENT_GATE default 0
```

**Đề xuất:** Patch ADR 0045 procedure freeze table → `lmsOps.*` + env flags; mark “production exercise dual-gate = deferred until flag default 1 + product OK”.

#### E) TL16 **ADR-C** — IA 5 nhóm chức năng

| Claim ADR-C | Code hôm nay | Verdict |
|-------------|----------------|---------|
| 5 nhóm: Giảng dạy · Lớp&HS · Kinh doanh · Tài chính&ĐH · Quản trị | `nav-registry.ts`: **Tổng quan**, Giảng dạy, Lớp&HS, **Tài chính&ĐH (gộp CRM)**, **Gắn kết**, **Nhân sự**, Quản trị | **Lệch cấu trúc** (7 top-level-ish; CRM không còn nhóm “Kinh doanh” riêng; HR/Engagement tách) |
| Không đặt tên nhóm theo vai trò | OK — resource/function labels | Live |
| (ngầm) có thể còn “Duyệt *” product pages | LOCKED `docs/ux-resource-centric-structure.md` **cấm** “Duyệt *” app; form-depth wave | **Superseded by resource-centric** for workflow chrome |

**Evidence:**

```text
apps/admin/src/shell/nav-registry.ts:8–167  section ids
docs/ux-resource-centric-structure.md:1–20 LOCKED 2026-08-11
```

**Đề xuất:** ADR-C giữ “≤7 nhóm + filter role” nhưng **bảng 5 nhóm** đánh dấu superseded by nav-registry + resource-centric authority; hoặc re-publish IA snapshot từ `nav-registry`.

#### F) Auth as-built vs “SSO-first” narrative

| Source | Claim | Code | Verdict |
|--------|-------|------|---------|
| Older deferred / M0 notes | Entra SSO production path | `password-routes.ts` mounted unconditionally; SSO behind flags | **Password = production**; SSO dormant |
| system-architecture Auth § | Correctly documents password + SSO off | Live | **Doc good** |
| system-architecture Deferred table | “Real OAuth2/SSO Stub” | Accurate enough | OK |
| Known SSO RLS | `sso-routes` plain `appUser.findFirst` | `apps/api/src/auth/sso-routes.ts` ~220 area (line moved slightly; still unscoped client) | **Still open before re-enable** |

### 1.3 ADR harness 0001–0007

Harness process ADRs (SQLite durable, prebuilt CLI, proposal rules) — **out of product business scope**. No conflict with ERP/LMS code paths. Keep as tooling authority.

---

## 2) Journals / quyết định lệch nghiệp vụ hiện tại

| Journal / doc | Nội dung | Lệch? | Ghi chú |
|---------------|----------|-------|---------|
| `docs/journals/260726-staff-password-auth-m365-off.md` | Password staff; M365 off | **Still accurate** | Operational truth |
| `docs/journals/260710-astryx-*.md` | Admin/LMS 100% Astryx AppShell | **Partially historical** | Admin chrome → **CMC Console** 2026-08 (`design-system-console.md`); Astryx primitives may remain under `@cmc/ui` |
| `docs/journals/2026-08-03-ui-structure-depth-*.md` | Tier frames rollout | Self-marked historical | Prefer resource-centric + Console docs |
| `docs/journals/260802-day-one-authoring-ui-gaps.md` | Course create missing, empty units | May be partially fixed later | Re-verify before treating as open bugs |
| `docs/journals/260709-phase4-uat-e2e-modeb-gap-lmsauth-stub.md` | LMS auth stub gaps | Stale snapshot | Parent OTP still comms-blocked; student password live |
| `docs/system-architecture.md` Deferred **LMS Frontend Not started** (`:475`) | Contradicts entire `apps/lms` | **Stale P0** | Must supersede row |
| `docs/system-architecture.md` CI “only typecheck-and-test blocks” (`:460`) | vs AGENTS: **typecheck-and-test + ui-e2e** required | **Stale** | Prefer AGENTS / current workflows |
| Header test counts 2026-07-11 | Snapshot only | Already bannered | Keep as historical |
| TL12 `docs/12-design-system-ui.md` | Admin design | **Already superseded for admin** by Console doc (header states) | Good pattern — replicate for other ADRs |

Journals correctly act as **session memory**, not product law — drift is expected. Problem is when **as-built architecture / ADR Status** still reads like law.

---

## 3) LMS mới vs ADR + “LMS thực tế độc lập”

### 3.1 Đã sát (foundation spike direction)

| Area | Evidence |
|------|----------|
| Program → ordered units (`orderGlobal`) | ADR 0046 + seed/tests + class session stamp `curriculumUnitId` |
| Teaching dual-gate (attendance / roster) | `onRoster` + attendance gate unitRanges |
| Money vs teaching writers | enroll reserved only; ranges via lmsOps / grantFromReceipt |
| Fail-closed unstamped session | roster empty without unit stamp |
| Exercise delivery path (class sequence) | `lms-ops/exercise-delivery.ts` — closer to independent LMS “deliver after session” |

### 3.2 Chưa khớp / gap

| Gap | Detail |
|-----|--------|
| **Homework dual-gate default OFF** | `LMS_ENTITLEMENT_GATE` default `0` — student can see Tier-A-open exercises outside sold range unless flag on |
| **Two open models coexist** | ADR 0038 Tier A/B **and** SessionExercise delivery; product single-source story chưa chốt trong ADR |
| **LMS SPA thin** | `apps/lms` still: login, home, exercise/:id, gifts, parent evidence/report — **no** parent/student UI for unit ranges, package progress, entitlement explain |
| **Admin teaching exercises list HITL** | Scout residual GAP #3: list publish/close still on list (not form UUID) — resource-centric incomplete |
| **Independent LMS parity** | Code comments cite “port from cmc-lms”; monorepo has foundation, not full parity (sequences, grant UX, refund revoke unlearned units = later per 0045) |
| **Comms** | Parent OTP email still env/Brevo operational risk (architecture notes) |

### 3.3 Resource-centric ERP vs LMS

Admin wave (PR #110 lineage): form-depth shifts/KPI/aftersale/receipt/rewards/**check-in ticket** (`hr/checkin/:ticketId` present in tree). LMS portal **not** following Console resource grammar — correct by design (TL12 remains LMS chrome authority).

---

## 4) Đề xuất cập nhật (CHỈ PROPOSAL — không sửa trong task này)

### 4.1 ADR / design docs

| Doc | Action đề xuất |
|-----|----------------|
| `docs/decisions/0039-…` | Banner: GPS rejection **superseded by 0044**; approval **see 0043**; keep IP CIDR |
| `docs/decisions/0040-…` | Rewrite approve gate → track director roles only; drop managerId chain claim |
| `docs/decisions/0038-…` | Document kill-switch + optional entitlement flag; link 0045 |
| `docs/decisions/0045-…` | Procedure names `lmsOps.*`; production homework flag status |
| `docs/16-…` ADR-C | Mark 5-group table superseded; point to `nav-registry` + `ux-resource-centric-structure.md` |
| `docs/07-glossary…` ShiftRegistration | Align approve wording with track GĐ (0040 fix) |
| `docs/system-architecture.md` | Fix Deferred LMS Frontend; refresh CI required checks; optional router/route counts |

### 4.2 Journals

| Action | Note |
|--------|------|
| **Không rewrite** historical journals | Keep as evidence trail |
| Optional index banner | “Prefer INDEX-live + ADR Status for current law” (already partially in WORKSPACE-LEAN) |

### 4.3 Product follow-ups (not docs)

1. Chốt default `LMS_ENTITLEMENT_GATE=1` when ops ready (ADR 0045 complete for homework).  
2. Single story: open-tier **or** delivery-primary — avoid dual silent paths in prod.  
3. LMS UX: surface remaining units / package (parity with independent LMS).  
4. Exercises admin form-depth (GAP #3).  
5. Fix SSO lookup RLS before any SSO re-enable.

---

## 5) Ma trận nhanh ADR ↔ code

| ADR | Status text | Code alignment | Supersede? |
|-----|-------------|----------------|------------|
| 0038 | Accepted | Live + extended flags | Patch only |
| 0039 | Accepted | IP live; GPS reject **dead**; approve note ok | **Partial supersede → 0044/0043** |
| 0040 | Accepted | Groups live; approve **managerId stale** | **Patch Decision** |
| 0041 | Accepted | Live + unit grant bridge | Additive note |
| 0042 | Accepted | Live | No |
| 0043 | Accepted IMPLEMENTED | Live | No |
| 0044 | Accepted | Live | No |
| 0045 | Accepted | Teaching live; homework flag off | Patch honesty |
| 0046 | Accepted | Live | No |
| TL16 A/B/D | Chốt | Mostly live | No |
| TL16 C | Chốt | Nav drifted + resource-centric | **Supersede table** |

---

## 6) Nguồn đã đọc (không exhaustive)

- `docs/decisions/0038`–`0046`, README  
- `docs/16-brief-quyet-dinh-thiet-ke-adr.md`  
- `docs/system-architecture.md` (Auth, RLS, Deferred, punch)  
- `docs/07-glossary-san-pham.md`  
- `docs/ux-resource-centric-structure.md`  
- `docs/design-system-console.md` · TL12 supersede header  
- Journals: staff-password, Astryx, day-one authoring, UI structure  
- Code: `checkin/router.ts`, `shift/router.ts`, `exercise/open-tier.ts`, `lms-ops/*`, `nav-registry.ts`, `apps/lms/src/routes`, admin form routes  

---

## Status

**DONE_WITH_CONCERNS**

- **Done:** cross-read ADR/journal/as-built vs code; ranked supersede candidates with file evidence.  
- **Concerns:** working tree is feature branch mid-LMS-foundation — some dual-gate paths are intentionally incomplete; independent `cmc-lms` not mounted in this monorepo for side-by-side runtime compare.  
- **Non-actions honored:** no code/ADR edits in this task.
