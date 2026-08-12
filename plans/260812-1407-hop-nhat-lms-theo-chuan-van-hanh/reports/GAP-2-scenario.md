# GAP-2 — Scenario matrix: unit progression with `order_global` holes

**Mode:** `/ak:scenario` one-shot + axes from BRIEF-GAP (read-only)  
**Repo:** `/home/manhquy/Downloads/cmc_edu` · branch `feat/lms-curriculum-axis-and-makeup-removal`  
**Date:** 2026-08-12  
**Audience:** agent implementing gap-aware unit math (`packages/domain-lms` + call sites)

---

## 0. Evidence base (do not re-guess)

### 0.1 Real CSV (`packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv`)

| Program (CSV label) | Prisma enum | Real units | `order_global` span | Gaps **inside** program span |
|---------------------|-------------|------------|---------------------|------------------------------|
| UCREA | `UCREA` | 36 | 1–36 | **none** |
| Bright I.G | `BRIGHT_IG` | **18** | 37–59 | **40, 44, 48, 52, 56** |
| Black Hole | `BLACK_HOLE` | 42 | 61–102 | **none** |

Bright I.G true axis (sorted):

```text
37, 38, 39, 41, 42, 43, 45, 46, 47, 49, 50, 51, 53, 54, 55, 57, 58, 59
```

Pattern: each level band is **3 units** (J1–J3, T1–T3, C/W/Q/U), then numbering skips one integer (legacy 4th slot / removed REVIEW). Holes are **labels**, not “empty lessons.”

Global integers missing in 1..102: `40, 44, 48, 52, 56, **60**`.  
`60` sits **between** Bright max (59) and Black min (61) — not inside any program axis.

### 0.2 Cross-program `order_global` overlap — axis (11)

| Pair | Intersection of real orders |
|------|-----------------------------|
| UCREA ∩ Bright I.G | **empty** |
| UCREA ∩ Black Hole | **empty** |
| Bright I.G ∩ Black Hole | **empty** |
| Same integer used by >1 program | **none** |

**Conclusion for implementers:** labels are globally disjoint **today**, but product uniqueness is still `(program, orderGlobal)`. Never “slide” into the next program’s numbers (e.g. Bright `59 + 1 → 60/61`) as if it were the next unit. Black Hole starts at **61**, not 60.

### 0.3 Broken pure functions (BRIEF)

| Function | Arithmetic sin |
|----------|----------------|
| `deriveSessionUnits` | `anchor + floor(k/4)` |
| `remainingUnits` | `for (o = from; o <= to; o++)` counts **holes as units** |
| `resolvePackageGrantRange` | `to = from + unitCount - 1` |
| `resolveReferenceAnchor` | back-solves with integer unit steps + min/max bounds |

### 0.4 Silent failure already in API wiring

`restampBatchSessions` (`stamp-sessions.ts`):

1. Calls arithmetic `deriveSessionUnits`.
2. `unitIdByOrder.get(stamp.order)` → missing on hole → **`continue` (no stamp)**.
3. Dual-gate / roster then sees **no unit** → empty entitlement for that session.

`grantRangeOnEnrollment` loops **every integer** in `[from..to]` and rejects if any missing → arithmetic package of 4 from 37 yields `to=40` → **grant fails after money** (or admin path hard-errors).

### 0.5 Dimensions used / skipped

| Dimension | Use |
|-----------|-----|
| Business Logic | Primary — money ↔ unit count, package renewal |
| Data Integrity | Axis holes, stamp skip, range endpoints on holes |
| State Transitions | neo, cancel restamp, mid-class join, setCurrentUnit |
| Scale | 0 / 1 / full-frame units; package size 1..N |
| Timing | concurrent grant / cancel race (brief) |
| User Types | parent display, teacher roster, GĐĐT grant/revoke, sale receipt |
| Authorization | only as gate surface (dual-gate), not RBAC redesign |
| Input Extremes | from/to on hole; unitCount past frame end |
| Integration | receipt approve → grant bridge |
| Error Cascades | silent skip vs throw |
| Environment / Compliance | **skipped** — not gap-specific |

---

## Severity legend

| Tag | Meaning for this feature |
|-----|---------------------------|
| **P0-MONEY** | Wrong units sold/granted/revoked relative to cash (over/under entitlement) |
| **P0-LEARN** | Student loses classroom access / homework / attendance path despite paid rights or valid schedule |
| **P1** | Wrong ops UX, wrong warning, recoverable with admin care |
| **P2** | Rare / empty catalog / migrate edge |

---

## 1. Axis — neo sits next to a hole

### S1.1 Bright class neo = 37 (J1); ≥13 non-cancelled sessions  
**Broken today:** session k=12 gets order **40** → no `CurriculumUnit` → stamp skipped → sessions 13–16 unitless.  
**Correct:** k∈[12..15] stamp **41** (T1); k∈[16..19] → 42; never emit 40.  
**Verify:** pure test with Bright axis fixture; int test: create BRIGHT_IG batch + 16 sessions + restamp → every session has non-null `curriculumUnitId`; order sequence groups of 4: 37×4,38×4,39×4,41×4.  
**Sev:** **P0-LEARN** (roster/dual-gate empty).

### S1.2 Neo = 39 (last J unit), next block must jump 39→41  
**Correct:** after 4 valid sessions on 39, next unit is **41**, not 40.  
**Verify:** `deriveSessionUnits` with axis, anchor index of 39, k=4 → order 41.  
**Sev:** **P0-LEARN**.

### S1.3 Neo = 41 (first unit *after* hole 40)  
Arithmetic still works for first block (41+0) but later hits 44.  
**Correct:** progression indices on true list only; never “assume continuous from neo.”  
**Verify:** 16 sessions from 41 → 41,42,43,45 (not 41..44).  
**Sev:** **P0-LEARN**.

### S1.4 Neo order not in program list (orphan / wrong program unit id)  
**Correct:** refuse restamp / setCurrentUnit with explicit BAD_REQUEST; do not clamp to min silently.  
**Verify:** point `currentUnitId` at UCREA unit on Bright batch → error, zero partial writes.  
**Sev:** **P1** (data integrity).

### S1.5 Anchor date mid-history: freeze done, restamp only future — future block lands on hole  
**Correct:** future stamps use list-index progression from neo; past `done` unchanged even if historically wrong.  
**Verify:** mix done@37 and planned after hole; only planned rows update; done keep old unit.  
**Sev:** **P1**.

---

## 2. Axis — neo at last unit; surplus sessions (ceiling)

### S2.1 Neo = 59 (U3, last Bright unit); >4 non-cancelled sessions  
**Broken:** `anchor+floor(k/4)` eventually exceeds 59; clamp to `maxOrder=59` with `capped=true` (today max is max integer label — coincidentally last real).  
**Correct:** clamp to **last real unit in program list** (still 59); all surplus sessions stay on 59 with `capped=true`; API policy for cancel/close surplus is separate.  
**Verify:** 12 sessions anchor 59 → all order 59, `capped` true from session 5 onward (or define: first 4 uncapped, rest capped — document one rule and test it).  
**Sev:** **P1** ops / **P0-LEARN** if surplus sessions get **null** unit instead of clamp.

### S2.2 Neo = 57; 12 sessions → need 57,58,59 then clamp — not 57..60  
Arithmetic after 59 invents 60 (global hole) / 61 (Black Hole).  
**Correct:** third unit block = 59; fourth block capped at 59, **never** 60/61.  
**Verify:** assert no stamp order ∉ Bright set; never resolve Black Hole unit id.  
**Sev:** **P0-LEARN** + cross-program leak risk.

### S2.3 `capped` sessions and dual-gate / delivery  
**Correct:** still stamped with last unit (entitlement if purchased); or product freezes enrollment — pick one, test both teacher roster and open-tier/delivery.  
**Verify:** student entitled to 59; capped session still allows attendance if dual-gate on.  
**Sev:** **P0-LEARN**.

### S2.4 Entire remaining frame shorter than session plan (18 units × 4 = 72 sessions max teaching bandwidth)  
**Correct:** after exhausting axis, restamp does not invent units; class-close / admin alert.  
**Verify:** batch with start 37 and 100 slots → last units 59 + capped tail.  
**Sev:** **P1**.

---

## 3. Axis — sold range spans holes (count + parent display)

### S3.1 Receipt / package: “12 units from current 37”  
| Model | `to` | True units | Arithmetic integers |
|-------|------|------------|---------------------|
| Broken `from+N-1` | 48 | **9** | 12 |
| Correct list-advance | **51** | **12** | n/a |

**P0-MONEY:** student pays 12, only 9 real units if stored as `[37..48]`.  
**Also:** grant validator today **rejects** `[37..40]` for N=4 (40 missing) → **pay 4, grant 0**.

**Correct:**

1. `toOrderGlobal = axis[index(from) + unitCount - 1]` (or error if not enough units left in frame).  
2. `remainingUnits` counts **only orders present in axis ∩ entitled set**, or counts axis positions covered by ranges — **never** hole integers.  
3. Parent UI: show **true remaining count** and ideally unit codes (J1…), not “order 37–48 = 12”.

**Verify:**

- Pure: `resolvePackageGrantRange` + Bright axis: from 37, N=12 → to **51**.  
- Pure: `remainingUnits` with axis: range [37,51], current 37 → 12.  
- Int: approve receipt unitCount=4 on Bright neo 37 → range `[37,41]`, length 4 on axis.  
- Parent/list “sắp hết unit”: after finishing 11 true units, remaining=1 not inflated.

### S3.2 Range endpoints that are real, holes in middle: stored `[37,41]`  
Integers 37..41 = {37,38,39,**40**,41}; true = 4.  
`isEntitled(40)` must be **false** for dual-gate (no session should stamp 40).  
`remainingUnits` must be **4**, not 5.  
**Verify:** pure remaining; isEntitled(40)=false even if 40∈[from,to] numerically.  
**Note:** long-term, either forbid storing ranges that “cover” holes in count semantics, or define range as **closed label interval over real units only**. Document which; tests lock it.

### S3.3 Parent display of multi-range with intentional holes between packages  
Ranges `[37,39]` + `[45,47]` (skipped middle by admin) → remaining from 37 = 6 true units, **not** merge to [37..47].  
Existing comment already forbids merge across intentional gaps between ranges — keep that; only fix **intra-range** hole counting.  
**Verify:** unit-progression tests already have [1–2]+[5–6]=4; add Bright-shaped [37–39]+[45–47]=6 with axis.  
**Sev:** **P0-MONEY** if merge/count wrong.

### S3.4 Overlapping ranges + holes  
Still dedupe by Set of **real** orders only.  
**Verify:** two overlapping Bright ranges spanning 40 → unique true count.  
**Sev:** **P1**.

---

## 4. Axis — cancel session rewinds progression across a hole

### S4.1 12 non-cancelled sessions stamped …39×4,41×4; cancel one session in first block  
**Correct:** restamp from neo recounts **remaining non-cancelled** only; unit of later sessions **moves earlier on the true axis** (cancel rewinds). After cancel in early block, former “41” sessions may become 39/41 correctly — never invent 40.  
**Verify:** before/after cancel restamp order lists on Bright fixture.  
**Sev:** **P0-LEARN** if restamp leaves nulls.

### S4.2 Cancel the only sessions that “used up” unit 39 so next block should still be 41  
**Correct:** still 41 after 4 sessions of 39, independent of cancelled future.  
**Verify:** 4 sessions @39 + cancelled noise + 4 planned → planned get 41.  
**Sev:** **P0-LEARN**.

### S4.3 Auto cancel-sweep + restamp (`session-done-sweep`) with Bright gaps  
Same as manual cancel: must call gap-aware restamp.  
**Verify:** worker test with Bright program + neo near hole (not only UCREA).  
**Sev:** **P0-LEARN**.

### S4.4 Cancel after class already past hole; neo still 37  
Full recount from neo over all non-cancelled from anchorDate.  
**Verify:** large session set; stable deterministic sort (date, startTime).  
**Sev:** **P1**.

---

## 5. Axis — mid-class join at a hole

### S5.1 Class current unit is 41; student addWithUnits “from current” for 4 units  
**Correct:** range starts **41**, not 40; to = list-advance 4 → **45** (41,42,43,45).  
**Broken arith:** to=44 (hole) → grant reject or under-deliver.  
**Verify:** addWithUnits / grantUnitsFromReceipt on Bright currentOrder=41, N=4 → [41,45].  
**Sev:** **P0-MONEY**.

### S5.2 Admin types fromOrderGlobal = **40** (hole)  
**Correct:** BAD_REQUEST “not in program”; do not snap silently to 39 or 41 without explicit product rule.  
**Verify:** grantPast/addWithUnits 40→41 rejected.  
**Sev:** **P1** (ops safety).

### S5.3 Student joins when class neo is 39, buys from “next month” 41  
`validateNewRange` allows from ≥ current; from=41, to=list.  
**Verify:** allowed; sessions stamped 39 still not roster for this student until class reaches 41.  
**Sev:** **P0-LEARN** if dual-gate wrong.

### S5.4 Join with unitCount larger than remaining frame from join point  
e.g. current 55, N=12 → only 55,57,58,59 left (4 true) if on 55…  
From 55: axis tail = [55,57,58,59] (4 units).  
**Correct:** either refuse oversell or grant only remaining with explicit partial — **must not** invent 60–66.  
**Verify:** grant N=12 from 55 → error or to=59 + returned actualCount=4; receipt reconciliation path defined.  
**Sev:** **P0-MONEY**.

---

## 6. Axis — renewal after existing range; joint lands in hole

### S6.1 First package ends at 39; renew +4  
**Broken:** `from = maxExisting+1 = 40` (hole) → validator fails all of [40..43] or grants wrong.  
**Correct:** `from = next real unit after maxExisting on axis` = **41**; to = 41+3steps = **45**.  
**Verify:** `resolvePackageGrantRange` with axis + existing [37,39], N=4 → [41,45].  
**Sev:** **P0-MONEY** (renewal after first Bright trio — **very common**).

### S6.2 First package stored as broken [37,40] from old code  
Migration/repair: detect toOrder on hole or interior holes; repair to true endpoint before renew.  
**Verify:** data audit script / grant idempotent repair test.  
**Sev:** **P0-MONEY**.

### S6.3 Two packages concurrent approve (race)  
Lock enrollment; second extends after first using **axis next**, not +1 integer.  
**Verify:** existing concurrent grant test adapted to Bright neo 37, two × N=3 → second starts 41 not 40.  
**Sev:** **P0-MONEY**.

### S6.4 maxExisting is last unit 59; renew +1  
**Correct:** no next unit → hard error / break-glass policy; never from=60.  
**Verify:** resolvePackageGrantRange throws or returns signal; grantUnitsFromReceipt does not create Black Hole orders.  
**Sev:** **P0-MONEY**.

### S6.5 existing toOrder = 43; next = 45 (skip 44)  
Same as 6.1 pattern at every band boundary.  
**Verify:** table-driven for each hole 40/44/48/52/56.  
**Sev:** **P0-MONEY**.

---

## 7. Axis — grantPast across holes

### S7.1 grantPast [37,45] on Bright  
True units: 37,38,39,41,42,43,45 (7). Integers in span: 9.  
**Correct:** accept endpoints that exist; entitlement for real stamped units only; **remaining/count APIs use 7**.  
If product requires “contiguous sold block,” either store as one label range and count via axis, or expand to only real orders — do not charge 9.  
**Verify:** grantPast succeeds; remainingUnits=7 from 37; isEntitled(40)=false.  
**Sev:** **P0-MONEY**.

### S7.2 grantPast from/to both holes (40–44)  
**Correct:** reject.  
**Verify:** BAD_REQUEST.  
**Sev:** **P1**.

### S7.3 grantPast single real unit that sits after hole (from=to=41)  
**Correct:** OK.  
**Verify:** range length 1.  
**Sev:** **P2**.

### S7.4 grantPast overlapping arithmetic with hole interior vs existing range  
Overlap detection is numeric interval — still OK if both ranges use same convention; ensure overlap with [37,39] vs [39,41] still caught.  
**Verify:** overlap tests unchanged + Bright numbers.  
**Sev:** **P1**.

---

## 8. Axis — revokeFromNext when cut lands on/near hole

### S8.1 Range [37,45]; revokeFromNext(from=40)  
**Broken truncate:** `to = 40-1 = 39` → drops **41** which was paid if 41 was in package.  
If 40 is not a real unit, cut policy must be defined:

| Policy option | Behavior |
|---------------|----------|
| A (recommended) | Interpret `fromOrderGlobal` as **first unit to remove on axis**; if 40∉axis, either reject or snap to **next real ≥40** (41) then truncate to previous real (39) |
| B | Require from ∈ axis always |

**Wrong:** silently `to=39` when user meant “remove from 41” after typing hole, **or** keep 41 while intending to cut from 40.

**Correct (recommended):** reject if `from` ∉ axis (force explicit 41); truncate keep `axis.previous(from)`.  
**Verify:** revoke from 41 on [37,45] → kept [37,39] (true units 37–39); 41+ gone.  
**Sev:** **P0-MONEY** (revoke too much/too little).

### S8.2 revokeFromNext(from=41) on [37,45]  
Truncate to **39** (previous real), not to 40.  
Writing `toOrderGlobal=40` leaves a **non-existent endpoint** (counts/validators confused).  
**Verify:** after revoke, `to` ∈ axis; remaining true count matches.  
**Sev:** **P0-MONEY**.

### S8.3 revoke entire future when from = class current on real unit after hole  
**Correct:** delete/truncate per existing rules; current unit still entitled if keep policy says so.  
**Verify:** int test Bright.  
**Sev:** **P0-LEARN**.

### S8.4 revoke when range end was arithmetic past frame (62)  
Cleanup: clamp/delete invalid; never leave Black Hole orders on Bright enrollment.  
**Verify:** data repair case.  
**Sev:** **P0-MONEY**.

---

## 9. Axis — program change / setCurrentUnit / realignHistory

### S9.1 setCurrentUnit to 43 then restamp  
**Correct:** progression from 43 along axis: 43,45,46…  
**Verify:** session stamps after setCurrentUnit.  
**Sev:** **P0-LEARN**.

### S9.2 setCurrentUnit across hole (39 → 41) without “teaching” 40  
**Correct:** allowed (admin neo jump); no sessions get unit 40.  
**Verify:** restamp; audit log.  
**Sev:** **P1**.

### S9.3 realignHistory / resolveReferenceAnchor with Bright gaps  
**Broken:** `firstUnitOrder = unitOrder + floor((0-i+(buoi-1))/4)` arithmetic.  
**Correct:** back-solve using **axis index** arithmetic (index ± floor(sessionDelta/4)), then map index→order; bounds = first/last **list** elements, not min/max integers only (same for continuous programs).  
**Verify:** pure tests: ref session is buoi 2 of unit 41 → first unit index correct; mid_unit_start still rejected; out_of_bounds when walks off list.  
**Sev:** **P0-LEARN** (wrong neo corrupts whole class timeline).

### S9.4 “Transfer” student Bright → UCREA (different program)  
order labels not comparable; must not keep Bright ranges on UCREA batch.  
**Verify:** enrollment move path rejects or remaps explicitly.  
**Sev:** **P0-MONEY**.

### S9.5 setCurrentUnit to unit id of wrong program  
**Correct:** reject.  
**Verify:** API test.  
**Sev:** **P1**.

---

## 10. Axis — program with 1 unit or 0 units

### S10.1 Program with exactly 1 unit (synthetic mini-catalog)  
derive: all sessions stamp that unit / then capped.  
grant N=1 OK; N=2 → error or cap.  
remaining from that unit = 1.  
**Verify:** pure tests with axis `[5]`.  
**Sev:** **P2** / **P0-MONEY** if N>1 silent.

### S10.2 Program with 0 units (`loadProgramUnitOrders` empty)  
restamp returns 0; grant must fail closed; createClassWithUnits should not pretend success.  
**Verify:** empty program fixture.  
**Sev:** **P1**.

### S10.3 resolveClassCurrentOrder when currentUnitId null → defaults to **1**  
On Bright, order 1 is **UCREA** label — wrong program!  
**Correct:** default must be **first unit of class program axis** (37 for Bright), never hardcode 1.  
**Verify:** Bright batch null neo → currentOrder 37 or explicit “neo required” error.  
**Sev:** **P0-MONEY** + **P0-LEARN** (easy to miss — not in BRIEF’s four functions).

### S10.4 Axis length 2 with hole labels e.g. [37,39]  
Advance/clamp/grant still index-based.  
**Verify:** pure.  
**Sev:** **P2**.

---

## 11. Axis — cross-program order collision (data)

### S11.1 Fact (verified): **no shared order_global across programs**  
Safe for global maps **only if** every query still filters by `program`.  
**Regression check:** re-run CSV analysis in CI when curriculum CSV changes.  
**Sev:** documentation / guardrail.

### S11.2 Near miss: Bright 59 vs Black 61; global hole 60  
Any “maxOrder across all CurriculumUnit” without program filter clamps Bright into Black space.  
**Correct:** always `where: { program }`.  
**Verify:** stamp-sessions already filters program — add test that Black units never appear on Bright batch.  
**Sev:** **P0-LEARN**.

### S11.3 Future CSV import reuses an order in two programs  
ADR 0046 is per-program unique only — collision across programs possible later.  
**Correct:** never key maps by order alone globally.  
**Verify:** import validation optional.  
**Sev:** **P1** future.

---

## 12. Extra axes implementers often skip

### S12.1 Dual-gate attendance when session unstamped (null unit)  
**Correct:** after fix, should not happen for planned curriculum classes; if null, fail closed with clear error (not empty roster silent).  
**Sev:** **P0-LEARN**.

### S12.2 Open-tier / SessionExercise delivery keyed by unit  
Wrong stamp → wrong homework open.  
**Verify:** Bright session after hole opens T1 (41) exercises not null.  
**Sev:** **P0-LEARN**.

### S12.3 `isEntitled` stays numeric interval — OK for membership of a **real** order  
Do **not** change isEntitled to require axis **if** ranges are always written with real endpoints; **do** ensure no code path asks isEntitled(hole).  
**Sev:** contract clarity.

### S12.4 Admin UI free-typing toOrder = from+N-1  
UI must use same axis list as API (dropdown of real units / computed to).  
**Sev:** **P0-MONEY** if UI still arithmetic.

### S12.5 E2E / seed only UCREA 1–4 continuous  
CI can stay green while Bright is broken.  
**Correct:** at least one domain pure suite with **real hole list** 40/44/48/52/56; one API int on BRIGHT_IG.  
**Sev:** process **P0** for escape.

### S12.6 Idempotent receipt grant after failed arithmetic attempt  
First approve threw on hole; money stays approved; retry after fix must grant correctly once.  
**Verify:** grantUnitsFromReceipt recovery.  
**Sev:** **P0-MONEY**.

### S12.7 `rangesOverlap` vs non-contiguous sold intent  
Numeric overlap OK; do not “fill” hole as overlap unit.  
**Sev:** **P2**.

### S12.8 Performance: axis length ~18–42 — fine in memory; no N=1e6 issue.  
**Sev:** **P2**.

### S12.9 Timezone / session sort stable across ICT dates  
Unrelated to holes but wrong sort mis-assigns units near boundaries.  
**Verify:** same-day two slots order by startTime.  
**Sev:** **P1**.

### S12.10 Worker + API both call domain — single pure function must own gap logic  
Duplicating “+1 skip hole” in API only → domain tests pass, production stamp still wrong.  
**Verify:** stamp-sessions passes full ordered array into domain; package-grant too.  
**Sev:** **P0** integration.

### S12.11 `remainingUnits` callers without axis parameter  
If signature adds `programOrders: number[]`, every caller must pass it — grep for `remainingUnits(` after change.  
**Sev:** compile-time + **P0-MONEY** display.

### S12.12 Historical sessions already stamped null in prod DB  
Backfill job: re-restamp Bright batches from neo; report sessions still null.  
**Sev:** **P0-LEARN** ops follow-up (out of pure domain, still scenario).

### S12.13 Unit type REVIEW absent in Bright CSV (all LESSON)  
Do not assume every 4th is REVIEW gap forever; axis is data-driven.  
**Verify:** fixture loaded from real gap list constant shared with tests.  
**Sev:** **P2**.

### S12.14 Black Hole / UCREA continuous regression  
Gap-aware algorithm must be **identity** on contiguous axes (1..36, 61..102).  
**Verify:** existing UCREA pure tests still pass unchanged expectations.  
**Sev:** **P1** regression gate.

---

## Priority shortlist — do not ship without these

| Pri | ID | Why |
|-----|-----|-----|
| 1 | **S6.1 / S6.5** | Renewal `max+1` lands on hole → **money grant fail or skip real unit** |
| 2 | **S3.1** | Package N units arithmetic under-delivers true count **or** fails grant after payment |
| 3 | **S1.1** | Neo 37 + 13th session → null stamp → **no attendance** |
| 4 | **S10.3** | `currentOrder` default `1` on Bright → wrong program axis |
| 5 | **S8.1–S8.2** | Revoke truncate `from-1` through hole → **strip paid unit 41** or leave to=40 |
| 6 | **S2.2** | Past last unit invents 60/61 → **cross-program contamination** |
| 7 | **S9.3** | realignHistory arithmetic rewrites neo wrong across holes |
| 8 | **S12.5** | Tests only contiguous UCREA → false confidence |
| 9 | **S5.4 / S6.4** | Oversell past frame end |
| 10 | **S4.1 / S4.3** | Cancel restamp reintroduces null units |

---

## Suggested pure-test fixture (copy into domain tests)

```ts
/** Real Bright I.G order_global axis from CMC_EDU_Khung_Chuong_Trinh.csv */
export const BRIGHT_IG_ORDERS = [
  37, 38, 39, 41, 42, 43, 45, 46, 47, 49, 50, 51, 53, 54, 55, 57, 58, 59,
] as const;
export const BRIGHT_IG_HOLES = [40, 44, 48, 52, 56] as const;
```

Minimum pure cases:

1. `deriveSessionUnits(axis, anchor=37, 16 sessions)` → groups 37,38,39,41.  
2. `deriveSessionUnits(axis, anchor=59, 8 sessions)` → all 59, capped after 4.  
3. `resolvePackageGrantRange(axis, from=37, N=4)` → to **41**.  
4. `resolvePackageGrantRange(axis, existing to=39, N=4)` → from **41**, to **45**.  
5. `remainingUnits(axis, [{37,48}], current=37)` → **9** not 12.  
6. UCREA contiguous identity: axis 1..36 matches old arithmetic expectations.  
7. `resolveReferenceAnchor` on axis with hole between ref and first session.

---

## Summary counts

| Severity | Count (approx.) |
|----------|-----------------|
| P0-MONEY | ~15 scenarios |
| P0-LEARN | ~12 scenarios |
| P1 | ~15 scenarios |
| P2 | ~6 scenarios |
| **Total concrete scenarios** | **~48** across axes 1–12 |

Dimensions covered: Business Logic, Data Integrity, State Transitions, Scale, Timing, User Types, Input Extremes, Integration, Error Cascades.  
Skipped: Environment, Compliance (not gap-specific).

---

## Note to implementing agent — likely blind spots

1. Fixing only `deriveSessionUnits` but leaving **`resolvePackageGrantRange` + renewal `max+1`** → money still broken.  
2. Passing `maxOrder` only (last label) without full array → clamp works, **holes still hit**.  
3. Counting remaining with `to-from+1` in UI while domain fixed → parent still misled.  
4. Hardcoding default current order **1**.  
5. Revoke `to = from - 1` when `from-1` is a hole.  
6. Tests only on UCREA.  
7. Silent `if (!unitId) continue` left in place after “fixing” domain — still drops stamps if any caller passes bad orders.

---

**Status: DONE**

Read-only scenario expansion complete. No code modified, no commit.  
Evidence: CSV analysis (Bright holes 40/44/48/52/56; no cross-program order overlap; global hole 60); domain + stamp + grant + revoke call-site read.
