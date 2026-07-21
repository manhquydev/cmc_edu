# Journals Sweep: Unresolved Threads Audit

**Scope:** `docs/journals/*.md` (20 files) — closing sections ("Next Steps", "Unresolved", "Câu hỏi mở", "Lingering Concerns") checked against later journals, `docs/project-changelog.md`, `docs/uat-checklist-go-live.md`, `docs/runbook-deploy.md`, `docs/project-roadmap.md`, `docs/codebase-summary.md`, git log, and `plans/reports/infra-deployment-audit-260717-1013-m0-exit-criteria-report.md` (an existing 2026-07-17 audit that already resurfaced several go-live gaps).

## Class (b) — still open, no resolution found anywhere

### 1. Azure MFA / conditional-access on `<super-admin-email>` — never actioned
- **Claim:** `docs/journals/260709-restore-drill-pass-backup-acl-gap.md:78` — "Azure: enable MFA/conditional-access on the seeded `admin@cmcvn.edu.vn`; record the deactivation procedure." Repeated in `docs/journals/260709-phase4-uat-e2e-modeb-gap-lmsauth-stub.md:77`.
- **Evidence of resolution:** none. `MFA` / `conditional-access` / `admin@cmcvn` do not appear anywhere else in `docs/` or in git log commit messages (checked both). The 2026-07-17 infra-deployment-audit report (which re-audited G1–G10 go-live gates and the Brevo/restore-drill gaps) does not mention this item either — it was dropped from every later pass.
- **Why it matters:** the seeded super-admin account for a system holding children's PII has had no follow-up on hardening its auth, 8 days after the journal flagged it as a pre-go-live action.

### 2. Backup-encryption passphrase escrow — confirmation never recorded
- **Claim:** `docs/project-changelog.md:287` (2026-07-09 entry) — "Escrow: passphrase copy in team password manager (**user action pending confirmation**)." Same open item in `docs/journals/260709-restore-drill-pass-backup-acl-gap.md:76-77` and `docs/journals/260709-phase4-uat-e2e-modeb-gap-lmsauth-stub.md:77`.
- **Evidence of resolution:** none found. `docs/runbook-deploy.md` (lines 22-23, 77, 100, 284, 287) documents the escrow *procedure* as a checklist step, but a procedure existing in the runbook is not evidence the passphrase was actually escrowed — the changelog's own "pending confirmation" wording was never updated to confirmed. Distinct from the (already-tracked) "restore drill only run once, 8 days old" finding in the 2026-07-17 infra audit report — that audit talks about re-running the drill, not about whether the passphrase escrow itself was ever confirmed done.
- **Why it matters:** if the VPS is lost, the stated recovery path depends on this escrow existing outside `.env.prod`; nobody has confirmed it does.

## Class (a) — resolved, but only a few representative examples (not exhaustively listed per instructions)

- **lms-auth-two-tier stub (delete vs. implement):** flagged unresolved in `260709-phase4-uat-e2e-modeb-gap-lmsauth-stub.md:74`. Resolved same day — user chose delete; commit `8a0f8f2`, confirmed in `260709-golive-sprint-session-summary.md:102` and `docs/project-changelog.md:310-313`.
- **ctv_mkt role revoke-vs-document decision:** flagged pending in `260709-golive-sprint-session-summary.md:185-189` and echoed as "pending before GO/NO-GO (2026-07-12 target)" in `docs/uat-checklist-go-live.md:97`. Resolved by inaction-as-decision: `docs/14-danh-muc-vai-tro-phan-quyen.md:27` shows current state "dormant — enum trơ, 0, 🟡 Deferred" — the role was simply left dormant, no code/doc ever marks this as an explicit close, but the current docs are consistent with "keep dormant" being the final answer.
- **network-ip / shift-config "coming soon" stubs:** `260712-premium-erp-screen-buildout-merged.md:233-237` lists both as backend-blocked, Phase-08 backlog. Resolved 2026-07-16 by PR #34 (`260716-super-admin-completion-audit-middleware.md`) — both got real CRUD. Correctly resurfaced forward in `docs/project-roadmap.md:48` ("cập nhật 2026-07-17... network-ip và shift-config nay là tính năng thật"). Good example of proper forward-linking — included here only as a contrast case.
- **Astryx build-regression "unresolved questions" (why admin's tsc passes while lms fails, is LMS live on cmcv2-prod, Brevo not yet in prod):** `260711-build-regression-brevo-otp-fix.md:195-199`. First two resolved same file via its own addendum (stale local `node_modules`, not a real bug) and by `260711-erp-lms-workflow-audit.md` (question reframed, closed). Third (Brevo prod deploy) is **not** resolved — see below, but it is NOT a silent dead end: it was independently re-discovered and documented in `plans/reports/infra-deployment-audit-260717-1013-m0-exit-criteria-report.md:38-39,88,96`, so a future reader following the thread does land on current tracking. Excluded from class (b) for that reason.

## Noted but excluded (already tracked forward in current docs — not misleading dead ends)

- Brevo/Graph API key rotation after being pasted in chat (`260711-premium-safe-merge-secret-near-miss.md:148-160`, `260711-build-regression-brevo-otp-fix.md:163,176-179`) — re-surfaced and still flagged open by `plans/reports/infra-deployment-audit-260717-1013-...-report.md:38-39,96`.
- Full G7 review / signed GO-NO-GO memo — never happened; `docs/uat-checklist-go-live.md` Section 5 is blank and the doc carries its own 2026-07-17 staleness banner (lines 359-364) pointing at the same infra audit report.
- Astryx trade-offs (Dialog focus-trap, NumberInput formatting, TabList a11y, change-password.tsx redirect bug) from phase3/4 journals — all listed as "Known trade-offs (TODO(astryx-review))" in `docs/project-roadmap.md:42-43` or `docs/codebase-summary.md:539`.

## Unresolved questions (from this audit, not the journals)
- Should the Azure MFA item and the passphrase-escrow confirmation be added to the 2026-07-17 infra-deployment-audit report's open-items list, since that report is evidently the current "living" tracker for go-live gaps and both were missed by it?

---
Status: DONE
Summary: Swept 20 journals; found 2 genuinely still-open, untracked items (Azure MFA/conditional-access on the seeded super-admin account; backup passphrase escrow confirmation) with no resolution anywhere in docs/git history. Most other closing-section items either resolved same-session/next-session or were already re-surfaced by a 2026-07-17 infra audit report — excluded per instructions to avoid flagging normal historical closure.
