---
title: "Verify stack + restore LMS demo password"
status: completed
---

# Phase 1: Verify stack + restore LMS demo password

## Context

Local-sim was already running from a prior session (`cmcv2-prod` project).
Seed demo from 2026-07-26 left staff accounts in `.env.local-sim-accounts`.
Student default password no longer matched (`mustChangePassword=false`,
hash ≠ `Cmc2026@`) — likely rotated during prior browsing.

## Steps completed

1. `docker compose -p cmcv2-prod ps` — all six services up; api/postgres/worker healthy
2. Probed `https://erp.localhost`, `https://hoc.localhost`, `/health` → 200
3. Staff login sale + admin → `{"ok":true,"mustChangePassword":false}`
4. CRM data present: opportunity `O5_ENROLLED` for Chị Hoa / bé Minh Anh
5. Reset student password via `student.resetPassword` as super_admin
6. Student login `0912345678` / `Cmc2026@` → 200 + `mustChangePassword: true`
7. Registered project: `ak projects add .`

## Validation

| Check | Result |
|-------|--------|
| ERP SPA title | CMC EDU — Admin |
| LMS SPA title | CMC EDU — Học sinh & Phụ huynh |
| Staff auth | ok |
| Student auth | ok after reset |

## Notes

- Parent path uses OTP email (`lmsAuth.requestOtpEmail`); needs Brevo or TEST_OTP seam — not enabled in prod build. Prefer **student password** for LMS demo.
- nginx currently publishes 0.0.0.0:80/443 (base compose); local-sim override prefers 127.0.0.1 — functionally fine for solo machine.
