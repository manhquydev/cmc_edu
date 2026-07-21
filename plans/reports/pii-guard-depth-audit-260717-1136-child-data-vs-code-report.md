# PII/Child-Data Guard Depth Audit — docs/08 vs Code

Scope: docs/08-nfr-va-du-lieu-tre-em.md §3/§7, cross-referenced with docs/13-ai-agent-llm-integration.md §5 (the doc §7 links to for LLM-layer detail) and docs/30-threat-model-v2.md T9 (cites both as the mitigation pair).

## Finding 1 — PII guard covers only phone numbers; doc claims full-name/CCCD/address/photo coverage (MISMATCH, real gap)

- **Doc claim**: `docs/13-ai-agent-llm-integration.md:75-77` (§5, linked from docs/08 §7 and cited by docs/30:33 as T9's mitigation): "Che PII trước khi gửi ra LLM ngoài: **tên đầy đủ trẻ, SĐT, CCCD, địa chỉ, ảnh trẻ** → không gửi... ưu tiên **token hoá/ẩn danh**." Comment in `packages/llm/src/index.ts:9` echoes this: "Callers must not include student fullName, phone, or other PII in the prompt — the guard detects phone patterns and throws."
- **Code reality**: `packages/llm/src/pii-guard.ts:6-9,15-23` — `assertNoPii` only regex-matches two Vietnamese mobile-number patterns (`0[35789]\d{8}`, `01[2689]\d{8}`). It does **not** check names, CCCD, addresses, or photo references at all — enforcement of "no fullName/CCCD/address" is **caller discipline only**, not code-enforced.
- **Mechanism mismatch**: doc says "ưu tiên token hoá/ẩn danh" (mask/tokenize preferred) but the code has no masking/tokenization path — it's hard reject-and-throw (`PII_BOUNDARY_VIOLATION`) on phone match only, nothing else transforms or blocks.
- **Verdict**: the guard is real and correctly wired (runs before every network call, index.ts:51/66), but its actual scope is materially narrower than what TL13§5 (and the threat-model T9 mitigation it backs) claims. Photos are never sent by this code path at all (no image param exists), so that specific sub-claim ("không gửi ảnh trẻ") holds by omission of capability, not by an explicit photo-check.

## Finding 2 — docs/08 §3 blanket RLS claim omits documented child-adjacent-table exemptions (MISMATCH)

- **Doc claim**: `docs/08-nfr-va-du-lieu-tre-em.md:33` (§3 Bảo mật table, no caveat): "Cô lập dữ liệu | RLS theo `facilityId` trên mọi query nghiệp vụ."
- **Code reality**: `Guardian`, `ParentAccount`, and `StudentAccount` — the three tables most directly holding child/guardian identity and consent data — are explicitly documented as carrying **no RLS policy** by deliberate design (ADR 0042), substituted with application-level ownership checks instead. Confirmed at: `apps/api/src/session-evidence/router.ts:17-18,377`, `apps/api/src/student/router.ts:18,84`, `apps/api/src/provisioning/provision-from-receipt.ts:22,86,230,275`, `apps/api/src/guardian/approved-children.ts:33`.
- **Verdict**: not a security weakness per se (app-level checks are present and tested — see Finding 3-adjacent consent gate below), but docs/08's unconditional "RLS on every business query" statement is stale/incomplete for exactly the tables §7 (child-data section) cares most about. A reader of §3+§7 together would reasonably conclude Guardian/StudentAccount data has DB-level RLS; it doesn't.

## Finding 3 — docs/08 §7 retention/deletion claim is aspirational; no child-data deletion mechanism exists (MISMATCH)

- **Doc claim**: `docs/08-nfr-va-du-lieu-tre-em.md:73-74` (§7, listed as a *hard* constraint, not a recommendation): "Lưu trữ & xoá: chính sách retention rõ ràng cho dữ liệu trẻ; xoá được khi hết mục đích/hết quan hệ học tập."
- **Code reality**: only two retention/deletion sweeps exist in `apps/api/src/worker/`: `audit-log-retention-sweep.ts` (deletes `AuditLog` rows >12 months, facility-agnostic, not child-data-specific) and `sweepStaleOtpPayloads` in `relay-email-outbox.ts` (scrubs plaintext OTP codes from `EmailOutbox`, an auth artifact, not child data). **No sweep, job, or API path deletes/anonymizes `Student`, `Guardian`, `SessionEvidencePhoto`, or `StudentAccount` rows** when a learning relationship ends.
- **Verdict**: the "hard ràng buộc" for child-data deletion described in §7 is not implemented anywhere in the codebase as of PR #34 (2026-07-17). This is the most consequential gap of the three — it's a stated child-data-protection *requirement*, not just infra housekeeping.

## Verified correct (no mismatch) — Photo consent gating

- **Doc claim**: `docs/08:66-67` — child photos gated on guardian consent + revocation mechanism.
- **Code reality**: `apps/api/src/session-evidence/router.ts:376-407` (`listForChild`) and `photo-access.ts:65-75` (`canAccessSessionPhoto`, used by the raw blob-serving endpoint) both independently gate on `Guardian.photoConsent = true AND photoConsentRevokedAt IS NULL`, and `guardianLmsRouter.setPhotoConsent:416-444` implements grant/revoke. This matches the doc claim accurately — flagging as verified-correct per instructions, not a finding.

## Unresolved Questions

- Is child-data deletion (Finding 3) planned in a not-yet-merged phase, or genuinely unscoped? Worth confirming before treating docs/08 §7's retention line as a compliance gap vs. a forward-looking placeholder.
- Should docs/08 §3 add an explicit RLS-exemption footnote pointing to ADR 0042, given §7 singles out child data for the strictest isolation language?

Status: DONE
Summary: Two doc claims materially overstate protection (PII guard covers only phone regex, not the full name/CCCD/address set TL13§5 claims; no masking/tokenization exists, only reject) and no child-data deletion mechanism exists despite §7 calling retention/deletion a hard requirement; docs/08's unconditional RLS claim also omits the documented Guardian/ParentAccount/StudentAccount RLS exemption (ADR 0042). Photo-consent gating, by contrast, is implemented exactly as documented.
