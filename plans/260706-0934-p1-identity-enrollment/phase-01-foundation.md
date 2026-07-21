# Phase 0 — Nền P1 (data · RBAC · tRPC substrate)

> Unblock cả 9 WF. Không nghiệp vụ mới ở đây — chỉ khung dữ liệu + phân quyền + procedure convention.
> Nguồn: TL10 §1–4 · TL11 §1–4 · TL14 §5 · TL16 (ADR-A/B/D) · TL22 (ADR 0041) · TL18.

## Files to create/modify

### `packages/db/prisma/schema.prisma` (mở rộng)
Thêm enums + models P1 (giữ `Facility`):
- **Enums:** `OpportunityStage {O1_LEAD,O2_CONTACTED,O3_TEST_SCHEDULED,O4_TESTED,O5_ENROLLED}` ·
  `LostReason` · `ReceiptStatus {draft,approved,sent,cancelled}` · `ReceiptKind {new,renewal}` ·
  `EnrollmentStatus {reserved,active,completed,transferred,withdrawn}` · `GuardianRelation {father,mother,guardian}` ·
  `GuardianLinkStatus {pending,approved,rejected}`.
- **Models:** `Contact` · `Opportunity`(stage,lostReason,closedAt,facilityId,contactId) ·
  `Receipt`(code,netAmount,status,kind,opportunityId,parentPhone,studentName,classBatchId?,facilityId,approvedById?,createdById) ·
  `ReceiptCodeCounter` · `RefundRecord`(receiptId,amount,createdAt — append-only) ·
  `Student`(facilityId,**createdByReceiptId**,lifecycle) · `ParentAccount`(**phone @unique**,passwordHash?) ·
  `StudentAccount`(studentId,parentAccountId) · `Guardian`(parentAccountId,studentId,relation) ·
  `GuardianLinkRequest`(parentAccountId,studentRef,status) · `Enrollment`(studentId,classBatchId,status,facilityId) ·
  `LoginOtp`(phone,code,status,expiresAt) · `EmailOutbox`(to,transport,status,payload) · `AuditLog`(actor,action,entity,entityId,data,createdAt).
- Mọi model nghiệp vụ có `facilityId` (trừ global). uuid pk; `@@index([facilityId])`.
- Migration: `prisma migrate dev` (dev DB Postgres qua `DATABASE_URL` trong `.env`).

### `packages/auth/src/index.ts` (thay stub deny-all bằng registry thật)
- `PERMISSIONS: Record<`module.action`, Role[]>` từ TL14 §5 (P1 subset): `crm.opportunityList/Lookup/Create/Advance/MarkLost`,
  `finance.receiptCreate/receiptApprove/refundCreate`, `enrollment.enroll`, `guardian.approveLink`.
- `Role` enum (9 role, active: super_admin, giam_doc_kinh_doanh, giam_doc_dao_tao, sale, giao_vien).
- `can(subject, module, action)`: super_admin bypass; else lookup registry. `requirePermission(module,action)` → tRPC middleware ném `FORBIDDEN`.
- Test: `packages/auth` unit — sale không có `finance.receiptApprove`; GĐKD có; super_admin bypass.

### `apps/api/src/trpc.ts` + `context.ts` (mở rộng)
- `context`: parse session (dev stub: header `x-dev-user` → `{userId, roles, facilityId}`; TODO Entra SSO P0-debt), `db` (Prisma client RLS-scoped theo facilityId), `ip`.
- Procedures: `protectedProcedure` (cần session), `lmsProcedure` (session LMS, không SYSTEM bypass), `requirePermission('m','a')` middleware dùng `@cmc/auth`.
- Error: helper 5 mã `TRPCError` (BAD_REQUEST/FORBIDDEN/CONFLICT/NOT_FOUND/UNAUTHORIZED) — TL11 §2.
- RLS: mọi query domain filter `facilityId = ctx.facilityId` (helper `scoped(ctx)`); facilityId suy server-side, không tin client.

### `packages/domain-finance/` (mới — nơi bồi unit)
- Hàm thuần: `computeNetAmount`, `assertRefundWithinCap(sum, amount, netAmount)`, `nextReceiptCode(counter)`. Test ≥90% (TL29).

## Steps
1. Prisma schema + `migrate dev` + `prisma generate`.
2. `@cmc/auth` registry + `can()`/`requirePermission` + unit test.
3. tRPC ctx/procedures/error-model + dev session stub.
4. `packages/domain-finance` skeleton + unit.
5. `pnpm typecheck && pnpm test && pnpm build` xanh.

## Validation
| Layer | Case |
|---|---|
| Unit | `can()`: sale∌receiptApprove, GĐKD∋, super_admin bypass; domain-finance refund cap |
| Integration | Prisma client generate; ctx build; `requirePermission` ném FORBIDDEN |
| Platform | `pnpm build` xanh |

## Risks / rollback
- Migration là thao tác DB — chạy trên **dev DB** (không prod). Rollback: `prisma migrate reset` (dev only).
- Chưa có Entra SSO → dev session stub, đánh dấu P0-debt trong trace; KHÔNG để stub lọt production (gate ở P0 sau).
- Dừng hỏi người nếu cần đổi enum có sẵn (ADR-A cấm thêm `pending_payment`).
