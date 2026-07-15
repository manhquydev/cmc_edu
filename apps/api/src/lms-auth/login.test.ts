// WF-P1-07 integration tests: parent LMS login (phone + OTP, profile
// picker). Covers OTP issuance/expiry/replay without account-enumeration
// leakage, the 1-child-auto vs ≥2-children-picker split, the `blocked_lms`
// lifecycle exclusion from LMS reads (docs/19 §2), and the H5 remediation:
// hashed storage (no plaintext code persisted), brute-force lockout, and the
// request cooldown. Also covers the M3 child-data-read audit trail.
//
// `node:crypto`'s `randomInt` is mocked to a fixed value so every OTP issued
// in this file is deterministic and the test can submit the correct code
// without ever reading it back from the DB (which is now impossible — the
// code is hashed, not stored plaintext).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  cleanupFacility,
  cleanupLoginOtpsByPhone,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  seedGuardianLink,
  seedParentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';

// Hoisted by vitest above every import in this file, so `../router.js` (and
// its transitive `lms-auth/router.ts` import of `randomInt`) always sees the
// mock — every OTP issued in this file is deterministic, which is the only
// way a test can know the correct code to submit now that H5 hashes it (no
// more reading the plaintext back from the DB). The literal below MUST stay
// in sync with `MOCKED_OTP_CODE` further down — vitest's hoisting forbids
// referencing an outer non-`mock`-prefixed const from inside the factory.
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomInt: () => 654321 };
});

const MOCKED_OTP_CODE = '654321';

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

  it('requestOtp issues an OTP whose codeHash is a salted hash, never the plaintext code', async () => {
    const phone = '0992000001';
    phonesToClean.push(normalizeLoginPhone(phone));

    const result = await anon.lmsAuth.requestOtp({ phone });
    expect(result).toEqual({ ok: true });

    const otp = await testDb().loginOtp.findFirstOrThrow({ where: { phone: normalizeLoginPhone(phone) } });
    expect(otp.codeHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(otp.codeHash).not.toContain(MOCKED_OTP_CODE);
    expect(otp.attempts).toBe(0);
    expect(otp.status).toBe('pending');
    expect(otp.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('verifyOtp with the correct code succeeds and returns approved children', async () => {
    const phone = '0992000002';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);
    const parentAccount = await seedParentAccount(normalized);
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'LMS Login Student 1' } }),
    );
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });

    await anon.lmsAuth.requestOtp({ phone });

    const result = await anon.lmsAuth.verifyOtp({ phone, code: MOCKED_OTP_CODE });
    expect(result.sessionToken).toEqual(expect.any(String));
    expect(result.needsPicker).toBe(false);
    expect(result.children).toEqual([{ studentId: student.id, fullName: student.fullName }]);
  });

  it('an expired code and a wrong code both fail with the same generic error (no enumeration)', async () => {
    const phone = '0992000003';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    // Backdated `createdAt` (not just `expiresAt`) so the real `requestOtp`
    // call below is outside the H5 cooldown window against this row.
    await testDb().loginOtp.create({
      data: {
        phone: normalized,
        codeHash: 'deadbeefdeadbeefdeadbeefdeadbeef:deadbeef',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - 60_000),
      },
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

    await expect(anon.lmsAuth.verifyOtp({ phone, code: MOCKED_OTP_CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('a verified OTP cannot be replayed', async () => {
    const phone = '0992000005';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);
    await seedParentAccount(normalized);

    await anon.lmsAuth.requestOtp({ phone });

    await anon.lmsAuth.verifyOtp({ phone, code: MOCKED_OTP_CODE });
    await expect(anon.lmsAuth.verifyOtp({ phone, code: MOCKED_OTP_CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('2+ children triggers the profile picker; blocked-lifecycle children are excluded from the picker AND enrollment.mine', async () => {
    const phone = '0992000006';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);
    const parentAccount = await seedParentAccount(normalized);

    const [childA, childB, blockedChild] = await testDbBypass((tx) =>
      Promise.all([
        tx.student.create({ data: { facilityId: facility.id, fullName: 'LMS Login Student A' } }),
        tx.student.create({ data: { facilityId: facility.id, fullName: 'LMS Login Student B' } }),
        tx.student.create({
          data: { facilityId: facility.id, fullName: 'LMS Login Student Blocked', lifecycle: 'blocked_lms' },
        }),
      ]),
    );

    for (const student of [childA, childB, blockedChild]) {
      await seedGuardianLink({
        facilityId: facility.id,
        parentAccountId: parentAccount.id,
        studentId: student.id,
        status: 'approved',
      });
    }
    const classBatch = await seedClassBatch({ facilityId: facility.id });
    await testDbBypass((tx) =>
      tx.enrollment.create({
        data: { facilityId: facility.id, studentId: blockedChild.id, classBatchId: classBatch.id },
      }),
    );

    await anon.lmsAuth.requestOtp({ phone });
    const result = await anon.lmsAuth.verifyOtp({ phone, code: MOCKED_OTP_CODE });

    expect(result.needsPicker).toBe(true);
    const returnedIds = result.children.map((c) => c.studentId).sort();
    expect(returnedIds).toEqual([childA.id, childB.id].sort());

    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));
    const mine = await parentCaller.enrollment.mine();
    expect(mine.find((e) => e.studentId === blockedChild.id)).toBeUndefined();
  });

  it('writes an AuditLog row when verifyOtp returns child data — M3', async () => {
    const phone = '0992000010';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);
    const parentAccount = await seedParentAccount(normalized);
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Audit Child' } }),
    );
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });

    await anon.lmsAuth.requestOtp({ phone });
    await anon.lmsAuth.verifyOtp({ phone, code: MOCKED_OTP_CODE });

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'Student', entityId: student.id, action: 'guardian.childDataRead' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect((audit!.data as { via: string }).via).toBe('lmsAuth.verifyOtp');
  });

  it('locks the OTP after MAX failed verify attempts (brute-force cap) — H5', async () => {
    const phone = '0992000007';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    await anon.lmsAuth.requestOtp({ phone });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(anon.lmsAuth.verifyOtp({ phone, code: '000000' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    }

    // Locked: even the correct code now fails.
    await expect(anon.lmsAuth.verifyOtp({ phone, code: MOCKED_OTP_CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    const otp = await testDb().loginOtp.findFirstOrThrow({
      where: { phone: normalized },
      orderBy: { createdAt: 'desc' },
    });
    expect(otp.status).toBe('expired');
    expect(otp.attempts).toBeGreaterThanOrEqual(5);
  });

  it('requestOtp enforces a cooldown: a second request for the same phone immediately after the first is rejected — H5', async () => {
    const phone = '0992000008';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    await anon.lmsAuth.requestOtp({ phone });
    await expect(anon.lmsAuth.requestOtp({ phone })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const otpCount = await testDb().loginOtp.count({ where: { phone: normalized } });
    expect(otpCount).toBe(1);
  });

  it('atomic-lock standardization (scenario audit pattern #3, NS #6/#7): rate-limits OTP requests — 6th request within the window is rejected, no new row created', async () => {
    const phone = '0992000010';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    // 5 prior requests, each spaced 1 minute apart (well outside the 30s
    // cooldown) but all inside the 15-minute rate-limit window.
    for (let i = 0; i < 5; i++) {
      await testDb().loginOtp.create({
        data: {
          phone: normalized,
          codeHash: `${'a'.repeat(32)}:${'b'.repeat(64)}`,
          status: 'expired',
          expiresAt: new Date(Date.now() + 5 * 60_000),
          createdAt: new Date(Date.now() - (10 - i) * 60_000),
        },
      });
    }

    await expect(anon.lmsAuth.requestOtp({ phone })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const otpCount = await testDb().loginOtp.count({ where: { phone: normalized } });
    expect(otpCount).toBe(5); // the 6th request never created a new row
  });

  it('atomic-lock standardization: 2 concurrent requestOtp calls for the SAME phone leave exactly 1 pending row, not 2', async () => {
    const phone = '0992000011';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    const results = await Promise.allSettled([
      anon.lmsAuth.requestOtp({ phone }),
      anon.lmsAuth.requestOtp({ phone }),
    ]);
    // Both calls return the caller-facing no-leak {ok:true} regardless of
    // which one "won" the race — the invariant under test is DB state, not
    // which promise settles which way.
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);

    const pendingCount = await testDb().loginOtp.count({ where: { phone: normalized, status: 'pending' } });
    expect(pendingCount).toBe(1);
  });

  it('issuing a new code invalidates the prior pending code for the same phone — H5', async () => {
    const phone = '0992000009';
    const normalized = normalizeLoginPhone(phone);
    phonesToClean.push(normalized);

    await anon.lmsAuth.requestOtp({ phone });
    const firstOtp = await testDb().loginOtp.findFirstOrThrow({ where: { phone: normalized } });

    // Backdate so the cooldown does not block this second request.
    await testDb().loginOtp.update({
      where: { id: firstOtp.id },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    await anon.lmsAuth.requestOtp({ phone });

    const priorRow = await testDb().loginOtp.findUniqueOrThrow({ where: { id: firstOtp.id } });
    expect(priorRow.status).toBe('expired');
  });
});

// ---------------------------------------------------------------------------
// Gap-closure 260710-0005 Phase 1: requestOtpEmail → EmailOutbox delivery.
// Prior to this phase requestOtpEmail only created a LoginOtp row and never
// enqueued an email — parents could never receive their OTP in production.
// ---------------------------------------------------------------------------
describe('lmsAuth.requestOtpEmail — EmailOutbox enqueue (gap-closure 260710-0005)', () => {
  const anon: Caller = appRouter.createCaller({
    subject: null,
    facilityId: null,
    lmsSubject: null,
    db: testDb(),
    ip: null,
  });
  const emailsToClean: string[] = [];
  const phonesToClean: string[] = [];

  afterEach(async () => {
    if (emailsToClean.length > 0) {
      await testDb().emailOutbox.deleteMany({ where: { to: { in: emailsToClean } } });
      await testDb().loginOtp.deleteMany({ where: { email: { in: emailsToClean } } });
      await testDb().parentAccount.deleteMany({ where: { email: { in: emailsToClean } } });
    }
    if (phonesToClean.length > 0) {
      await testDb().parentAccount.deleteMany({ where: { phone: { in: phonesToClean } } });
    }
    emailsToClean.length = 0;
    phonesToClean.length = 0;
  });

  it('enqueues exactly one EmailOutbox row with the OTP payload shape when a ParentAccount owns the email', async () => {
    const email = 'otp-enqueue-1@test.com';
    const phone = '0993000001';
    emailsToClean.push(email);
    phonesToClean.push(phone);
    await testDb().parentAccount.create({ data: { phone, email } });

    const result = await anon.lmsAuth.requestOtpEmail({ email });
    expect(result).toEqual({ ok: true });

    const rows = await testDb().emailOutbox.findMany({ where: { to: email } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.transport).toBe('brevo');
    expect(rows[0]?.status).toBe('pending');
    const payload = rows[0]?.payload as { kind: string; code: string; ttlMinutes: number };
    expect(payload.kind).toBe('otp');
    expect(payload.code).toMatch(/^\d{6}$/);
    expect(payload.ttlMinutes).toBe(5);
  });

  it('does NOT enqueue an EmailOutbox row when no ParentAccount owns the email, but still returns {ok:true} (no-leak)', async () => {
    const email = 'otp-no-account@test.com';
    emailsToClean.push(email);

    const result = await anon.lmsAuth.requestOtpEmail({ email });
    expect(result).toEqual({ ok: true });

    const rows = await testDb().emailOutbox.findMany({ where: { to: email } });
    expect(rows).toHaveLength(0);
    // LoginOtp is still created unconditionally (no-leak response invariant).
    const otp = await testDb().loginOtp.findFirst({ where: { email } });
    expect(otp).not.toBeNull();
  });

  it('the global otp-enqueue cap fail-closes further email requests once the hourly ceiling is hit', async () => {
    const email = 'otp-cap-test@test.com';
    emailsToClean.push(email);
    // Seed 200 pre-existing otp EmailOutbox rows within the last hour to
    // simulate the cap already being saturated by other requests.
    await testDb().emailOutbox.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({
        to: `otp-cap-filler-${i}@test.com`,
        transport: 'brevo' as const,
        status: 'pending' as const,
        payload: { kind: 'otp', code: '000000', ttlMinutes: 5 },
      })),
    });
    const fillerEmails = Array.from({ length: 200 }, (_, i) => `otp-cap-filler-${i}@test.com`);

    try {
      await expect(anon.lmsAuth.requestOtpEmail({ email })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      const rows = await testDb().emailOutbox.findMany({ where: { to: email } });
      expect(rows).toHaveLength(0);
    } finally {
      await testDb().emailOutbox.deleteMany({ where: { to: { in: fillerEmails } } });
    }
  });

  it('atomic-lock standardization (scenario audit pattern #3, NS #6/#7): per-identifier rate-limit rejects the 6th request within the window', async () => {
    const email = 'otp-ratelimit-test@test.com';
    emailsToClean.push(email);

    for (let i = 0; i < 5; i++) {
      await testDb().loginOtp.create({
        data: {
          phone: null,
          email,
          codeHash: `${'a'.repeat(32)}:${'b'.repeat(64)}`,
          status: 'expired',
          expiresAt: new Date(Date.now() + 5 * 60_000),
          createdAt: new Date(Date.now() - (10 - i) * 60_000),
        },
      });
    }

    await expect(anon.lmsAuth.requestOtpEmail({ email })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const otpCount = await testDb().loginOtp.count({ where: { email } });
    expect(otpCount).toBe(5);
  });
});
