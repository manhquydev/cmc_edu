# Full e2e report — ui-chromium (synth) + MCP timeline (local-sim)

**Date:** 2026-08-02  
**Request:** Full `ui-chromium` on synth DB + expanded MCP e2e with **honest timeline** (no pre-seeded sale/GV as starting actors).

---

## A. Product model (must understand before testing)

| Claim | Verified source | Implication for timeline tests |
|-------|-----------------|--------------------------------|
| Only **super_admin** can create staff | `user.manage` roster is `[]`; SA bypass only (`packages/auth`) | **Giám đốc không tạo được nhân sự** trong product hiện tại |
| Staff bootstrap password forces rotation | `user.create` + `tempPassword` → `mustChangePassword: true` | Every new account: login → `/change-password` → ops |
| CRM funnel is sale-owned | journeys P1-01/P1-02 | After SA creates sale, sale owns opportunity |
| Class/session/attendance need assignment | attendance UI “Chọn lớp” | New GV without class assignment cannot mark student attendance yet |
| Formal journeys mint signed cookies | `mintStaffCookie` | **ui-chromium is real UI + real API, but auth is not password-timeline** |

### Honest timeline (what product actually allows)

```text
T0  Super admin (bootstrap password / existing SA)
T1  SA creates GĐKD, then GĐĐT          ← directors first
T2  SA creates Sale, then Giáo viên     ← staff under org (not “director creates staff”)
T3  Each person activates (change password)
T4  Sale creates opportunity → advance stages
T5  (optional) GĐĐT/GĐKD approve receipts, configure class
T6  GV chấm công (HR) / điểm danh (teaching) when class assigned
T7  GV chấm bài when submissions exist
```

**Not honest:** opening as pre-seeded `sale@` / `gv@` from demo seed and calling that “day one”.

---

## B. Full ui-chromium on synth DB

### Setup

```bash
SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh --fresh
export APP_DATABASE_URL="postgresql://cmc_app:synth@localhost:55432/cmc_synth"
export DATABASE_URL="postgresql://postgres:synth@localhost:55432/cmc_synth"
export PLAYWRIGHT_UI=1
pnpm --filter @cmc/e2e test --project=ui-chromium
```

### Result

| Metric | Value |
|--------|-------|
| **Status** | **40 passed / 40** |
| Duration | ~5.0 minutes |
| Exit code | 0 |
| DB | throwaway `cmc_synth` on `cmc-synth-pg:55432` (not `cmc_prod`) |
| Log | `/tmp/ui-chromium-full.log` |

Includes 33 journey specs + admin-shell + lms-login + screen-role-capture.

### Honesty caveat (ui-chromium)

These journeys **drive real admin/LMS UI** against a real API + facility bootstrap, but nearly all staff actors enter via **`mintStaffCookie`** (signed session), not email/password provisioning.  
That is correct for CI speed and isolation; it is **not** a day-zero org bootstrap simulation.

Exceptions that *do* use admin UI create-user: e.g. ADM-02 `user-admin-roles`, `createStaffViaAdminUi` helper in some journeys.

---

## C. MCP Playwright timeline e2e (local-sim, password auth)

**Target:** `https://erp.localhost` (production-like stack)  
**Run id:** `tbhvnx7`  
**Screenshots:** `plans/260802-1425-local-sim-experience-setup/e2e-screenshots/timeline/`

### Actors created (no reuse of seed sale/gv)

| Order | Role | Email (created by SA) | Activate |
|-------|------|------------------------|----------|
| 1 | GĐ Kinh doanh | `gdkd.tbhvnx7@timeline.local` | PASS → cockpit |
| 2 | GĐ Đào tạo | `gddt.tbhvnx7@timeline.local` | PASS → cockpit |
| 3 | Sale | `sale.tbhvnx7@timeline.local` | PASS → cockpit |
| 4 | Giáo viên | `gv.tbhvnx7@timeline.local` | PASS → cockpit |

Temp password at create → forced change → final rotated password (local only, not committed).

### Step results

| Step | Action | Result |
|------|--------|--------|
| T0 | SA login → `/admin/users` | **PASS** |
| T1 | Create GĐKD + GĐĐT first | **PASS** (rows visible) |
| T2 | Create Sale + GV | **PASS** |
| T3 | Password activate all four | **PASS** (correct role badges) |
| T4 | Sale: Thêm cơ hội `Lead Timeline tbhvnx7`, advance stages | **PASS** (pipeline shows new O4 + prior seed O5) |
| T5 | GV: `/hr/checkin` → Chấm công | **PASS** (punched) |
| T6 | GV: `/teaching/attendance` | **PARTIAL** — UI opens “Chọn lớp”, no class bound to *this* new GV |
| T7 | GĐĐT `/finance` | **PASS** |
| T7b | GĐĐT `/classes` | **GAP** — SPA shows “Đang phát triển” at that path (class UI lives elsewhere / routing) |
| T8 | Full grading path on new GV | **NOT RUN** — needs exercise + submission + class assignment (timeline-complete work) |

### Why T6/T8 incomplete is *correct* honesty

A brand-new teacher account has no ClassBatch assignment and no student submissions.  
Claiming “chấm bài PASS” without that setup would be time-travel. Full path requires:

1. GĐĐT creates course + class, assigns teacher  
2. Sale completes receipt → enrollment  
3. Session exists for attendance  
4. Exercise published + student submission  
5. Then GV grades  

That is a longer multi-session story; MCP proved the **org bootstrap + CRM lead + HR punch** chain without impersonating seed roles.

---

## D. Comparison

| Dimension | ui-chromium (synth) | MCP timeline (local-sim) |
|-----------|---------------------|---------------------------|
| Auth realism | Cookie mint (mostly) | Email/password + forced change |
| Org bootstrap | Facility auto in globalSetup | SA creates people in order |
| Flow breadth | 40 automated journeys | Focused timeline slice |
| Data safety | Throwaway `cmc_synth` | Live local-sim `cmc_prod` DB |
| Pass rate | 40/40 | Bootstrap+CRM+checkin PASS; attendance/grade deferred honestly |

---

## E. Recommendations

1. **Treat ui-chromium as regression proof of UI/API contracts**, not as “day one school opening”.  
2. **Treat MCP timeline as onboarding realism** for password auth + SA-provisioned org.  
3. If product intent is “GĐ creates staff”, that is a **feature gap** today (`user.manage` SA-only) — do not test a flow the RBAC forbids.  
4. Next MCP extension (when wanted): GĐĐT create course/class (correct route), assign new GV, sale receipt under 20M self-path or GĐ approve, then attendance + grading for *that* class only.
