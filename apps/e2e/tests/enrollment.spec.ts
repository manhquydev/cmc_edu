// Critical-path e2e #1 (docs/26 phase-02): the full P1 pipeline end to end —
// GĐĐT sets up a course + class, sale runs the CRM pipeline O1->O4, a draft
// Receipt is created and approved (the money gate), provisioning fires, and
// the paying parent can log in via phone+OTP and see the enrolled child. Runs
// against the real spawned api server + real Postgres (see
// ../src/global-setup.ts) — this is deliberately NOT a mocked integration
// test, it is the same HTTP surface a real client hits.

import { test, expect } from '@playwright/test';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { cleanupParentAccountsByPhone } from '../src/db.js';
import { randomVnPhone } from '../src/random-vn-phone.js';
import { createAnonClient, createE2eStaffClient } from '../src/trpc-client.js';
import { readOtpCode } from '../src/db.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('enrollment end-to-end (O1..O5 -> receipt -> approve -> parent OTP login)', () => {
  const parentPhone = randomVnPhone();

  test.afterAll(async () => {
    await cleanupParentAccountsByPhone(normalizeLoginPhone(parentPhone));
  });

  test('sale-to-provisioning-to-parent-login happy path', async () => {
    const gddt = createE2eStaffClient(baseUrl, {
      userId: 'e2e-gddt',
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });
    const sale = createE2eStaffClient(baseUrl, {
      userId: 'e2e-sale',
      roles: ['sale'],
      facilityId,
    });
    const gdkd = createE2eStaffClient(baseUrl, {
      userId: 'e2e-gdkd',
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });

    const course = await gddt.course.create.mutate({ program: 'UCREA', name: 'E2E Enrollment Course' });

    const classBatch = await gddt.classBatch.create.mutate({
      courseId: course.id,
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      slots: [{ weekday: 6, startTime: '08:00', endTime: '09:00' }],
    });

    const opportunity = await sale.crm.opportunityCreate.mutate({
      contactName: 'E2E Parent',
      phone: parentPhone,
    });
    expect(opportunity.stage).toBe('O1_LEAD');

    for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
      const advanced = await sale.crm.opportunityAdvance.mutate({
        opportunityId: opportunity.id,
        toStage,
      });
      expect(advanced.stage).toBe(toStage);
    }

    const receiptResult = await sale.finance.receiptCreate.mutate({
      opportunityId: opportunity.id,
      studentName: 'E2E Child',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.classBatch.id,
    });
    if (receiptResult.status !== 'success') {
      throw new Error(`Expected receiptCreate to succeed without warnings, got: ${receiptResult.message}`);
    }

    const approveResult = await gdkd.finance.receiptApprove.mutate({
      receiptId: receiptResult.receipt.id,
    });
    expect(approveResult.receipt.status).toBe('approved');
    expect(approveResult.opportunityStage).toBe('O5_ENROLLED');
    expect(approveResult.provisioning).toBe('ok');

    const anon = createAnonClient(baseUrl);
    const otpRequest = await anon.lmsAuth.requestOtp.mutate({ phone: parentPhone });
    expect(otpRequest.ok).toBe(true);

    const normalizedPhone = normalizeLoginPhone(parentPhone);
    const code = await readOtpCode(normalizedPhone);

    const verifyResult = await anon.lmsAuth.verifyOtp.mutate({ phone: parentPhone, code });
    expect(verifyResult.needsPicker).toBe(false);
    expect(verifyResult.children).toHaveLength(1);
    expect(verifyResult.children[0]?.fullName).toBe('E2E Child');
  });
});
