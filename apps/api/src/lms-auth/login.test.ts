// WF-P1-07 integration tests: parent LMS login (phone + OTP, profile
// picker). Covers OTP issuance/expiry/replay without account-enumeration
// leakage, the 1-child-auto vs ≥2-children-picker split, and the
// `blocked_lms` lifecycle exclusion from LMS reads (docs/19 §2).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  cleanupFacility,
  cleanupLoginOtpsByPhone,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedGuardianLink,
  seedParentAccount,
  testDb,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('lmsAuth.requestOtp / verifyOtp (WF-P1-07)', () => {
  let facility: { id: string };
  const anon: Caller = appRouter.createCaller({
    subject: null,
    facilityId: null,
    lmsSubject: null,
    db: testDb(),
    ip: null,
  });
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('LMS Auth Facility');
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupLoginOtpsByPhone(...phonesToClean);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  async function issuedCode(phone: string): Promise<string> {
    const otp = await testDb().loginOtp.findFirstOrThrow({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    return otp.code;
  }

  it('requestOtp issues a 6-digit OTP readable from the DB (never returned in the response)', async () => {
    const phone = '0992000001';
    phonesToClean.push(normalizeLoginPhone(phone));

    const result = await anon.lmsAuth.requestOtp({ phone });
    expect(result).toEqual({ ok: true });

    const otp = await testDb().loginOtp.findFirstOrThrow({ where: { phone: normalizeLoginPhone(phone) } });
    expect(otp.code).toMatch(/^\d{6}$/);
    expect(otp.status).toBe('pending');
    expect(otp.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('verifyOtp with the correct code succeeds and returns approved children', async () => {
    const phone = '0992000002';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);
    const parentAccount = await seedParentAccount(normalized);
    const student = await testDb().student.create({
      data: { facilityId: facility.id, fullName: 'LMS Login Student 1' },
    });
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });

    await anon.lmsAuth.requestOtp({ phone });
    const code = await issuedCode(normalized);

    const result = await anon.lmsAuth.verifyOtp({ phone, code });
    expect(result.sessionToken).toEqual(expect.any(String));
    expect(result.needsPicker).toBe(false);
    expect(result.children).toEqual([{ studentId: student.id, fullName: student.fullName }]);
  });

  it('an expired code and a wrong code both fail with the same generic error (no enumeration)', async () => {
    const phone = '0992000003';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    await testDb().loginOtp.create({
      data: { phone: normalized, code: '111111', status: 'pending', expiresAt: new Date(Date.now() - 1000) },
    });

    let expiredError: unknown;
    try {
      await anon.lmsAuth.verifyOtp({ phone, code: '111111' });
    } catch (error) {
      expiredError = error;
    }
    expect(expiredError).toMatchObject({ code: 'BAD_REQUEST' });

    await anon.lmsAuth.requestOtp({ phone });
    let wrongCodeError: unknown;
    try {
      await anon.lmsAuth.verifyOtp({ phone, code: '000000' });
    } catch (error) {
      wrongCodeError = error;
    }
    expect(wrongCodeError).toMatchObject({ code: 'BAD_REQUEST' });
    expect((wrongCodeError as { message: string }).message).toBe(
      (expiredError as { message: string }).message,
    );
  });

  it('does not reveal whether an account exists: a correct code for a phone with no ParentAccount fails generically', async () => {
    const phone = '0992000004';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    await anon.lmsAuth.requestOtp({ phone });
    const code = await issuedCode(normalized);

    await expect(anon.lmsAuth.verifyOtp({ phone, code })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('a verified OTP cannot be replayed', async () => {
    const phone = '0992000005';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);
    await seedParentAccount(normalized);

    await anon.lmsAuth.requestOtp({ phone });
    const code = await issuedCode(normalized);

    await anon.lmsAuth.verifyOtp({ phone, code });
    await expect(anon.lmsAuth.verifyOtp({ phone, code })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('2+ children triggers the profile picker; blocked-lifecycle children are excluded from the picker AND enrollment.mine', async () => {
    const phone = '0992000006';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);
    const parentAccount = await seedParentAccount(normalized);

    const childA = await testDb().student.create({
      data: { facilityId: facility.id, fullName: 'LMS Login Student A' },
    });
    const childB = await testDb().student.create({
      data: { facilityId: facility.id, fullName: 'LMS Login Student B' },
    });
    const blockedChild = await testDb().student.create({
      data: { facilityId: facility.id, fullName: 'LMS Login Student Blocked', lifecycle: 'blocked_lms' },
    });

    for (const student of [childA, childB, blockedChild]) {
      await seedGuardianLink({
        facilityId: facility.id,
        parentAccountId: parentAccount.id,
        studentId: student.id,
        status: 'approved',
      });
    }
    await testDb().enrollment.create({
      data: { facilityId: facility.id, studentId: blockedChild.id, classBatchId: 'class-batch-blocked-1' },
    });

    await anon.lmsAuth.requestOtp({ phone });
    const code = await issuedCode(normalized);
    const result = await anon.lmsAuth.verifyOtp({ phone, code });

    expect(result.needsPicker).toBe(true);
    const returnedIds = result.children.map((c) => c.studentId).sort();
    expect(returnedIds).toEqual([childA.id, childB.id].sort());

    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));
    const mine = await parentCaller.enrollment.mine();
    expect(mine.find((e) => e.studentId === blockedChild.id)).toBeUndefined();
  });
});
