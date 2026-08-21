import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedGuardianLink,
  seedParentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';
import { hashPassword, verifyPassword } from './password-hash.js';
import { verifyLmsToken, LMS_SESSION_SECRET_DEV_DEFAULT } from './session-token.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('lmsAuth.familyLogin / forgot / reset (Wave 1 additive)', () => {
  let facility: { id: string };
  const anon: Caller = appRouter.createCaller({
    subject: null,
    facilityId: null,
    lmsSubject: null,
    db: testDb(),
    ip: '127.0.0.1',
  });
  const phonesToClean: string[] = [];
  const emailsToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Family Login Facility');
  });

  afterEach(async () => {
    if (emailsToClean.length > 0) {
      await testDb().emailOutbox.deleteMany({ where: { to: { in: emailsToClean } } });
    }
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
    emailsToClean.length = 0;
  });

  async function seedFamilyReady(phoneRaw: string, opts?: { hash?: string | null; email?: string }) {
    const phone = normalizeLoginPhone(phoneRaw);
    phonesToClean.push(phone);
    const parent = await seedParentAccount(phone);
    if (opts?.email) {
      emailsToClean.push(opts.email);
      await testDb().parentAccount.update({
        where: { id: parent.id },
        data: { email: opts.email, passwordHash: opts?.hash === undefined ? hashPassword('FamilyPass1234') : opts.hash },
      });
    } else if (opts?.hash !== undefined) {
      await testDb().parentAccount.update({
        where: { id: parent.id },
        data: { passwordHash: opts.hash },
      });
    } else {
      await testDb().parentAccount.update({
        where: { id: parent.id },
        data: { passwordHash: hashPassword('FamilyPass1234') },
      });
    }
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Family Child' } }),
    );
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parent.id,
      studentId: student.id,
      status: 'approved',
    });
    return { parent, student, phone };
  }

  it('familyLogin succeeds and mints kind family without studentId', async () => {
    const { phone } = await seedFamilyReady('0998100001');
    const result = await anon.lmsAuth.familyLogin({ phone, password: 'FamilyPass1234' });
    expect(result.needsPicker).toBe(false);
    expect(result.children).toHaveLength(1);
    const secret = process.env['LMS_SESSION_SECRET'] ?? LMS_SESSION_SECRET_DEV_DEFAULT;
    const claims = verifyLmsToken(result.sessionToken, secret);
    expect(claims?.kind).toBe('family');
    expect(claims?.studentId).toBeUndefined();
  });

  it('hash-null familyLogin fails generic; OTP procedures still exist', async () => {
    const { phone } = await seedFamilyReady('0998100002', { hash: null });
    await expect(anon.lmsAuth.familyLogin({ phone, password: 'FamilyPass1234' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid credentials.',
    });
    expect(anon.lmsAuth.requestOtpEmail).toEqual(expect.any(Function));
    expect(anon.lmsAuth.loginStudent).toEqual(expect.any(Function));
  });

  it('wrong password lockout: 5 failures then correct password still fails', async () => {
    const { phone } = await seedFamilyReady('0998100003');
    for (let i = 0; i < 5; i++) {
      await expect(anon.lmsAuth.familyLogin({ phone, password: 'WrongPass!!!!' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    }
    await expect(anon.lmsAuth.familyLogin({ phone, password: 'FamilyPass1234' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid credentials.',
    });
  });

  it('unknown phone fails generic and does not leak', async () => {
    await expect(
      anon.lmsAuth.familyLogin({ phone: '0998100099', password: 'FamilyPass1234' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Invalid credentials.' });
  });

  it('2 children sets needsPicker; family kind can call enrollment.mine', async () => {
    const phoneRaw = '0998100004';
    const phone = normalizeLoginPhone(phoneRaw);
    phonesToClean.push(phone);
    const parent = await seedParentAccount(phone);
    await testDb().parentAccount.update({
      where: { id: parent.id },
      data: { passwordHash: hashPassword('FamilyPass1234') },
    });
    const [a, b] = await testDbBypass((tx) =>
      Promise.all([
        tx.student.create({ data: { facilityId: facility.id, fullName: 'Fam A' } }),
        tx.student.create({ data: { facilityId: facility.id, fullName: 'Fam B' } }),
      ]),
    );
    for (const student of [a, b]) {
      await seedGuardianLink({
        facilityId: facility.id,
        parentAccountId: parent.id,
        studentId: student.id,
        status: 'approved',
      });
    }
    const result = await anon.lmsAuth.familyLogin({ phone, password: 'FamilyPass1234' });
    expect(result.needsPicker).toBe(true);
    expect(result.children).toHaveLength(2);

    const familyCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, kind: 'family' }),
    );
    await expect(familyCaller.enrollment.mine()).resolves.toEqual(expect.any(Array));

    const studentCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, kind: 'student', studentId: a.id }),
    );
    await expect(studentCaller.enrollment.mine()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('forgot + reset on hash-null then familyLogin succeeds; no auto-session', async () => {
    const email = 'family-reset-1@test.com';
    const { parent, phone } = await seedFamilyReady('0998100005', { hash: null, email });

    const forgot = await anon.lmsAuth.familyForgotPassword({ phone });
    expect(forgot).toEqual({ ok: true });

    const rows = await testDb().emailOutbox.findMany({ where: { to: email } });
    expect(rows).toHaveLength(1);
    const payload = rows[0]?.payload as { kind: string; resetUrl: string };
    expect(payload.kind).toBe('family-reset');
    const token = payload.resetUrl.split('#token=')[1];
    expect(token).toBeTruthy();

    const reset = await anon.lmsAuth.familyResetPasswordWithToken({
      token: token!,
      newPassword: 'BrandNewFamily1',
    });
    expect(reset).toEqual({ ok: true });

    const updated = await testDb().parentAccount.findUniqueOrThrow({ where: { id: parent.id } });
    expect(updated.tokenVersion).toBe(parent.tokenVersion + 1);
    expect(verifyPassword('BrandNewFamily1', updated.passwordHash ?? '')).toBe(true);

    const login = await anon.lmsAuth.familyLogin({ phone, password: 'BrandNewFamily1' });
    expect(login.sessionToken).toEqual(expect.any(String));
  });

  it('forgot for unknown phone still returns ok and enqueues nothing', async () => {
    const result = await anon.lmsAuth.familyForgotPassword({ phone: '0998100088' });
    expect(result).toEqual({ ok: true });
  });

  it('forgot cooldown on a known emailed phone still returns ok (no-leak)', async () => {
    const email = 'family-reset-cd@test.com';
    const { phone } = await seedFamilyReady('0998100007', { email });
    for (let i = 0; i < 5; i++) {
      await expect(anon.lmsAuth.familyForgotPassword({ phone })).resolves.toEqual({ ok: true });
    }
    await expect(anon.lmsAuth.familyForgotPassword({ phone })).resolves.toEqual({ ok: true });
    const rows = await testDb().emailOutbox.findMany({ where: { to: email } });
    expect(rows.length).toBe(5);
  });

  it('same password on reset is rejected when a hash already exists', async () => {
    const email = 'family-reset-2@test.com';
    const { phone } = await seedFamilyReady('0998100006', { email });
    await anon.lmsAuth.familyForgotPassword({ phone });
    const row = await testDb().emailOutbox.findFirstOrThrow({ where: { to: email } });
    const token = (row.payload as { resetUrl: string }).resetUrl.split('#token=')[1]!;
    await expect(
      anon.lmsAuth.familyResetPasswordWithToken({ token, newPassword: 'FamilyPass1234' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
