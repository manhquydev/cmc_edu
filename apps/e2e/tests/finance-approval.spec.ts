// Finance approval e2e (phase-08).
//
// Tests: canApprove gate (creator cannot approve own receipt), role-without-permission
// gate, over-threshold blocked for non-second-eye role, over-threshold allowed
// for giam_doc_dao_tao.
//
// API-driven (tRPC), no browser. Uses the ephemeral facility from global-setup.ts.

import { test, expect } from '@playwright/test';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../api/src/router.js';
import { createE2eStaffClient } from '../src/trpc-client.js';
import { randomVnPhone } from '../src/random-vn-phone.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Creates the shared course + classBatch used across tests in this suite. */
async function setupCourseAndBatch() {
  const gddt = createE2eStaffClient(baseUrl, {
    userId: 'e2e-finance-gddt',
    roles: ['giam_doc_dao_tao'],
    facilityId,
  });
  const course = await gddt.course.create.mutate({
    program: 'UCREA',
    name: 'E2E Finance Approval Course',
  });
  const classBatch = await gddt.classBatch.create.mutate({
    courseId: course.id,
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    slots: [{ weekday: 1, startTime: '08:00', endTime: '09:00' }],
  });
  return { classBatch: classBatch.classBatch };
}

/** Creates a draft receipt as a `sale` user and returns the receipt. */
async function createDraftReceipt(opts: {
  classBatchId: string;
  amount: number;
  saleUserId?: string;
}) {
  const sale = createE2eStaffClient(baseUrl, {
    userId: opts.saleUserId ?? 'e2e-finance-sale',
    roles: ['sale'],
    facilityId,
  });
  const parentPhone = randomVnPhone();
  const opp = await sale.crm.opportunityCreate.mutate({
    contactName: 'E2E Finance Parent',
    phone: parentPhone,
  });
  for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
    await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
  }
  const receiptResult = await sale.finance.receiptCreate.mutate({
    opportunityId: opp.id,
    studentName: 'E2E Finance Student',
    parentPhone,
    amount: opts.amount,
    classBatchId: opts.classBatchId,
  });
  if (receiptResult.status !== 'success') {
    throw new Error(`receiptCreate failed: ${receiptResult.message}`);
  }
  return receiptResult.receipt;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('finance — canApprove gate + over-threshold second-eye', () => {
  let classBatchId: string;

  test.beforeAll(async () => {
    const { classBatch } = await setupCourseAndBatch();
    classBatchId = classBatch.id;
  });

  test('canApprove=false for creator (self-approval guard)', async () => {
    const sale = createE2eStaffClient(baseUrl, {
      userId: 'e2e-finance-sale-selfcheck',
      roles: ['sale'],
      facilityId,
    });
    const parentPhone = randomVnPhone();
    const opp = await sale.crm.opportunityCreate.mutate({
      contactName: 'SelfApprove Parent',
      phone: parentPhone,
    });
    for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
      await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
    }
    const receiptResult = await sale.finance.receiptCreate.mutate({
      opportunityId: opp.id,
      studentName: 'SelfApprove Student',
      parentPhone,
      amount: 5_000_000,
      classBatchId,
    });
    if (receiptResult.status !== 'success') {
      throw new Error(`receiptCreate failed: ${receiptResult.message}`);
    }
    // The receipt DTO returned to the creator must have canApprove=false.
    expect(receiptResult.receipt.canApprove).toBe(false);
  });

  test('canApprove=false for role without finance.receiptApprove permission', async () => {
    // `sale` role lacks receiptApprove permission — attempting to approve throws FORBIDDEN.
    const receipt = await createDraftReceipt({ classBatchId, amount: 5_000_000 });

    // A different sale user (not the drafter) tries to approve — still blocked by permission.
    const saleApprover = createE2eStaffClient(baseUrl, {
      userId: 'e2e-finance-sale-approver',
      roles: ['sale'],
      facilityId,
    });

    let caughtError: unknown;
    try {
      await saleApprover.finance.receiptApprove.mutate({ receiptId: receipt.id });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');
  });

  test('over-threshold blocked for ke_toan (not in SECOND_EYE_ROLES)', async () => {
    // 20_000_001 VND > APPROVAL_SECOND_EYE_THRESHOLD — ke_toan cannot approve.
    const receipt = await createDraftReceipt({ classBatchId, amount: 20_000_001 });

    const keToan = createE2eStaffClient(baseUrl, {
      userId: 'e2e-finance-ketoan',
      roles: ['ke_toan'],
      facilityId,
    });

    let caughtError: unknown;
    try {
      await keToan.finance.receiptApprove.mutate({ receiptId: receipt.id });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');
  });

  test('over-threshold allowed for giam_doc_dao_tao (SECOND_EYE_ROLES)', async () => {
    // Same threshold — GĐDT (giam_doc_dao_tao) is in SECOND_EYE_ROLES, so approve succeeds.
    const receipt = await createDraftReceipt({
      classBatchId,
      amount: 20_000_001,
      saleUserId: 'e2e-finance-sale-threshold',
    });

    const gddt = createE2eStaffClient(baseUrl, {
      userId: 'e2e-finance-gddt-approver',
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });

    const result = await gddt.finance.receiptApprove.mutate({ receiptId: receipt.id });
    expect(result.receipt.status).toBe('approved');
  });
});
