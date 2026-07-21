# Audit: docs/31-phased-build-plan.md vs git/PR history

## 1. Doc nature (key premise check)

docs/31 has **zero explicit per-phase status markers** ("done"/"in progress"/"not started"). Each of
P0–P5 (lines 21–68) only states Phạm vi (scope) / Nguồn (source ADRs/WFs) / Acceptance (test criteria) —
it is a **scope + acceptance-criteria map**, not a status tracker. So the usual "claimed status is stale"
failure mode mostly does not apply here; the more relevant checks are (a) is it still framed correctly as
frozen, and (b) do its *content* claims (sources, acceptance bullets) still match reality.

## 2. Freeze status — confirmed intentional, not a bug

- `git log -1 -- docs/31-phased-build-plan.md` → single commit `528b378` (2026-07-05, bootstrap). **Never
  touched since.**
- `docs/project-roadmap.md:70` explicitly states: "file này là trạng thái sống, TL31 giữ nguyên làm bản đồ
  thi công gốc" (roadmap = living status; TL31 stays as the original construction map). This is the
  documented design — **TL31 being untouched for 12 days is by design, not drift.**
- `docs/15-ra-soat-dong-bo-va-register.md:144` and `docs/README.md:70,106` reinforce this: TL31 is called
  "authoritative" / "Design Frozen" for the *plan/scope*, while `project-roadmap.md` and
  `project-changelog.md` carry live status. Per repo convention this framing itself is correct.

## 3. Content cross-check — each phase vs actual git/changelog history

| Phase | TL31 claim (scope+source) | Reality (commit/changelog) | Verdict |
|---|---|---|---|
| P0 Nền | RLS, auth registry, design tokens, SSO+OTP, backup off-box | Done 2026-07-06→09 (P1 Backend Complete 07-06; SSO PR #24 07-08; Backup hardening R2 07-09) | Consistent — no status claimed, no contradiction |
| P1 Định danh/Ghi danh | ADR-A/B/0041, provisioning atomic | Done 2026-07-06 ("P1 Backend Complete & Merged"), gap closure 07-10 | Consistent |
| P2 Vận hành lớp | ADR0038, annotation, grading | Built 2026-07-06/07 (annotation/submission/exercise tests, phase summary index) | Consistent |
| P3 HR/Ca/Lương | **Nguồn: ADR0039/0040 only** | **Superseded/extended by ADR0044** (docs/22:110, docs/25:78,81 "superseded bởi ADR 0044") via PR #33 "HR module remediation" (`10f4375`, 2026-07-12) — BREAKING: `kpi.submit`/`kpi.approve`/`compensation.upsertRate` REMOVED, replaced by tier-based salary model, KPI auto-score, session-done engine | **Stale source citation** — TL31's "Nguồn" line for P3 omits ADR0044, the doc that now actually governs the P3 API surface |
| P4 Đổi quà/Họp PH/After-sale | Not yet built (forward scope) | Confirmed still "Chưa" per `project-roadmap.md` M2 row (test-gap sub-item only, done 2026-07-10) | Consistent — correctly still-pending |
| P5 AI Agent | Forward, crawl-walk-run | Still aspirational per roadmap M3 = "Chưa" | Consistent |

## 4. Recent events NOT reflected (expected, given freeze date)

- Gap-fix waves `9c1522c` (2026-07-15, "close 43 happy-path gaps"), `2af7b9d`/`bc44689` (2026-07-16,
  post-implementation review gaps) — general hardening across P1–P3 surfaces, not a new named phase; TL31
  wouldn't be expected to mention these.
- Super-admin completion PR #34 (`35cff7d`, 2026-07-17: facility mgmt, network-ip/shift-config CRUD, audit
  log) — these are **premium-ERP-screen-buildout** deliverables (`plans/260711-1720-premium-erp-screen-
  buildout/`), not part of TL31's P0–P5 vocabulary at all. TL31 never mentions "super-admin", "network-ip",
  "shift-config", or "audit log" as concepts, so there's nothing in TL31 for this to contradict.
- Both are correctly absent — not misleading, just out of TL31's frozen scope.

## 5. Caveat (not a docs/31 finding)

`docs/project-changelog.md`'s newest dated entries top out at **2026-07-12**; no `## [2026-07-15]`/
`[2026-07-16]`/`[2026-07-17]` entries exist for the gap-fix waves or PR #34, even though the changelog file
itself was touched again on 2026-07-17 (`495aa96`, unrelated docs-drift fix). Per task instructions this
file was to be trusted as ground truth and not re-verified, so this is flagged only as a caveat affecting
confidence in cross-referencing recent dates — not re-litigated here.

## 6. Verdict

- **Not a bug:** TL31 being 12 days stale and un-updated. This is the documented, intentional design
  (frozen "bản đồ thi công gốc"); `project-roadmap.md` is correctly the living-status doc.
- **Real (minor) finding:** TL31 §P3's "Nguồn" line (`docs/31-phased-build-plan.md:35`, "ADR0039/0040")
  is now incomplete — the HR/payroll/KPI surface it describes is actually governed by ADR0044, which
  superseded/extended it via a BREAKING remediation (PR #33). A reader following `docs/README.md:18`
  ("Bắt đầu build: TL31 → P0, dùng TL25 + TL29 làm acceptance") into P3 without cross-checking docs/22 or
  docs/25 could reference removed APIs (`kpi.submit`, `kpi.approve`, `compensation.upsertRate`).
  TL31's acceptance *bullets* for P3 (line 53–54) are high-level enough that they still hold true; only the
  **source citation** is stale.
- No other phase shows a false "still pending" or false "already done" claim — P0–P2 completions and
  P4–P5 pending states TL31 implies are all consistent with actual history.

## Unresolved questions

- Should TL31's P3 "Nguồn" line be amended to add ADR0044, or is the intentional-freeze policy meant to
  cover source citations too (i.e., leave as historical record, rely on docs/22/25 as the living pointer)?
  Not my call — policy question for the doc owner.

Status: DONE
Summary: docs/31 is intentionally frozen (single commit, 2026-07-05) per project-roadmap.md's own framing — not a bug. It carries no per-phase completion status, so most phases show no contradiction with git history; the one real staleness is P3's source citation (ADR0039/0040) omitting the superseding ADR0044 from the 2026-07-12 HR remediation (PR #33), which a reader could hit via the README's "start here" pointer.
