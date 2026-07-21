# Brainstorm Report — Backup Script Security Gaps

**Date:** 2026-07-08 | **Plan context:** 260707-2308-golive-sprint-land-sso-env-uat / Phase 2

---

## Problem Statement

Phase 2 (`Env-Prod-Cmcv2`) runbook requires `restore-drill.sh` to pass before seeding production.
Four concrete defects in `scripts/backup-db.sh` and `scripts/restore-drill.sh` will cause the drill to either fail deterministically or pass with a security gap — regardless of whether R2 creds (B2) are provided.

---

## Findings

| ID | File | Issue | Risk |
|----|------|-------|------|
| B1 | `backup-db.sh:34-44` | Dump uploaded **plaintext** to R2 — no encryption | PII breach if bucket access leaked |
| B2 | `restore-drill.sh:94` | `rm -f $DUMP_FILE` NOT trap-protected — `set -e` abort leaves dump in `/tmp` | PII dump persists until reboot |
| B3 | Both scripts | `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` only in docs, not exported in script | aws-cli v2 + R2 checksum fail — deterministic drill failure |
| B4 | Neither script | No assertion that R2 bucket blocks public access before first upload | Upload succeeds silently even if bucket is public-readable |

---

## Agreed Solution

### B1 + B2: Encryption + Trap

**backup-db.sh additions:**
- Require `BACKUP_ENCRYPTION_PASSPHRASE` env var (fail-closed)
- After `pg_dump`, immediately encrypt: `openssl enc -aes-256-cbc -pbkdf2 -in $DUMP -out ${DUMP}.enc`
- Delete plaintext before upload: `rm -f "$DUMP_FILE"`
- Upload `.enc` file, update S3_KEY suffix to `.dump.enc`

**restore-drill.sh additions:**
- Add `trap 'rm -f "${DUMP_ENC:-}" "${DUMP_FILE:-}"' EXIT` immediately after variable declarations
- After download, decrypt before restore: `openssl enc -d -aes-256-cbc -pbkdf2 -in $DUMP_ENC -out $DUMP_FILE`
- Require same `BACKUP_ENCRYPTION_PASSPHRASE` env var

### B3: aws-cli checksum pin

Both scripts: add after `set -euo pipefail`:
```bash
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
```

### B4: Bucket-private acknowledgment

Add env var gate (lightweight, YAGNI):
```bash
: "${BACKUP_BUCKET_PRIVATE_CONFIRMED:?Set BACKUP_BUCKET_PRIVATE_CONFIRMED=true after verifying CF dashboard}"
```
Runbook step 7 updated: verify CF dashboard → bucket Settings → Public Access = Disabled → set var in `.env.prod`.

---

## Rationale

- `openssl` preferred over `gpg` — available in standard alpine/debian images without extra install
- `-pbkdf2` flag required on openssl ≥ 1.1.1 to avoid deprecated key derivation warning
- Option 1 for B4 (env var acknowledgment) chosen over Option 2 (live 403 probe) per YAGNI — R2 is private by default; acknowledgment is sufficient procedural control

---

## Files to Change

| File | Change |
|------|--------|
| `scripts/backup-db.sh` | Add B3 pin + B1 encryption + require passphrase |
| `scripts/restore-drill.sh` | Add B3 pin + B2 trap + B4 bucket-private gate + decrypt step |
| `scripts/env-check.sh` | Add `BACKUP_ENCRYPTION_PASSPHRASE` + `BACKUP_BUCKET_PRIVATE_CONFIRMED` to prod gate |
| `.env.prod.example` | Add both new vars with `CHANGE_ME` / empty placeholder |
| `docs/runbook-deploy.md` | Step 7: escrow passphrase procedure + bucket-private-confirm step |

---

## Out-of-Scope (This Plan)

- A1/A2/A3 user inputs (WSL2, R2 keypair, Entra email) — tracked in pm-status-report
- lms-auth-two-tier un-skip — Phase 4 pre-condition, separate task
- ctv_mkt manualPunch.create business decision — user must decide before Phase 4 sign-off

---

## Success Criteria

- [ ] `backup-db.sh` uploads only `.enc` files; no plaintext in transit
- [ ] `restore-drill.sh` cleans up `/tmp` even on abort (trap verified)
- [ ] Both scripts export checksum env vars before aws calls
- [ ] `env-check.sh` fails prod boot if `BACKUP_ENCRYPTION_PASSPHRASE` unset
- [ ] `BACKUP_BUCKET_PRIVATE_CONFIRMED` must be set before drill can run
- [ ] Runbook step 7 documents escrow + bucket verify procedure
- [ ] Existing drill logic (RT-13, smoke-1, smoke-2, RESTORE DRILL PASSED) unchanged
