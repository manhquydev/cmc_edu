---
title: "Document experiential tour"
status: completed
---

# Phase 2: Experiential tour (role-by-role)

## Product in one paragraph

**CMC EDU v2** is a facility-scoped **ERP + LMS** for Vietnamese k–12 education
centers. Staff run CRM → receipt → class ops → HR/payroll inside **Admin ERP**.
Parents and students use **LMS** (mobile-first). Isolation is by `facilityId`
(RLS). Staff auth today is **email/password** (Entra SSO off).

## URLs

| App | URL | Who |
|-----|-----|-----|
| Admin ERP | https://erp.localhost | Staff roles |
| LMS | https://hoc.localhost | Parent / Student |

Browser will warn once on the self-signed cert — accept and continue.

## Accounts (local-sim only)

Passwords live in **`.env.local-sim-accounts`** (gitignored). Do not commit.

| Email / phone | Role | First things to open |
|---------------|------|----------------------|
| `admin@cmcvn.edu.vn` | `super_admin` | Facility, staff users, audit |
| `gdkd@cmcvn.edu.vn` | GĐ kinh doanh | CRM overview, finance oversight |
| `gddt@cmcvn.edu.vn` | GĐ đào tạo | Courses, class batches, receipt second-eye (≥20M) |
| `sale@cmcvn.edu.vn` | Sale | Leads/opportunities, create receipts |
| `gv@cmcvn.edu.vn` | Giáo viên | Classes, attendance, exercises, stars |
| Phone `0912345678` pw `Cmc2026@` | Student (Minh Anh) | Forced change password, then home |

## Tour A — Enrollment pipeline (production core story)

**Goal:** Feel the receipt-driven enrollment path (ADR-A / P1).

1. **Sale** → CRM → opportunity *Chị Hoa (PH bé Minh Anh)* stage `O5_ENROLLED`
   - Seed already completed: contact → test stages → receipt 25M → GĐĐT approve
2. Optional redo: create a new lead, advance stages, create receipt under 20M
   (sale can self-approve path) or over 20M (needs GĐĐT)
3. **GĐĐT** → Finance/receipts → see second-eye rule for large amounts
4. After approval → Student + Parent LMS accounts provisioned automatically

## Tour B — Class operations (P2)

1. **GĐĐT** → Courses / class batch *UCREA Sáng tạo 1* (seeded)
2. **Giáo viên** → class sessions, attendance, exercises/submissions
3. **Student LMS** → see class, exercises after password change

## Tour C — Super-admin

1. **admin@** → manage facilities, create staff, reset passwords, audit log
2. Reset student password path: forces `Cmc2026@` + must-change again

## Tour D — What not to expect locally

| Feature | Local-sim reality |
|---------|-------------------|
| Microsoft SSO | Off (`SSO_ENABLED=false`) |
| Parent email OTP | Needs Brevo/Graph; use student login instead |
| Real S3 | Local blob volume on api/worker |
| Production domain TLS | Self-signed localhost SAN only |
| Full HR payroll depth | Built, but seed is enrollment-centric |

## Suggested 30-minute path

1. Open ERP as **sale** — browse CRM enrolled opportunity (5 min)
2. Open ERP as **gddt** — courses + class batch (5 min)
3. Open ERP as **gv** — teaching surfaces (5 min)
4. Open LMS as **student** 0912345678 / Cmc2026@ — change password, home (5 min)
5. Open ERP as **admin** — staff list + audit (5 min)
6. Free explore (5 min)

## Commands useful during a session

```bash
# Stack status
docker compose -p cmcv2-prod ps

# Logs
docker compose -p cmcv2-prod logs -f api

# Re-print account emails only
grep -v '^#' .env.local-sim-accounts | cut -d= -f1

# Re-seed demo (destructive to existing demo identities if re-run carelessly)
LOCAL_SIM_SEED_ALLOW=1 npx tsx scripts/seed-local-sim-demo.ts
```
