// 04-parent-otp — REAL-ENVIRONMENT LMS parent login (https://hoc.clawcmc.io.vn).
//
// P1-07 on live: the parent account provisioned by 02-receipt-approve-enroll
// logs into the LMS with a REAL emailed one-time code. Production has no
// TEST_OTP_SEAM (boot-check FATAL), so the code is read back from the
// EmailOutbox table via docker exec psql (read-only) — live-otp.ts polls the
// row and falls back to the LoginOtp hash when the outbox worker scrubs the
// payload first.
//
// Graceful skip: when 02 did not provision a parent (or the campaign started
// here), the spec skips with a note instead of failing — the coordinator's
// decision.

import { test, expect } from '@playwright/test';

import { readOtpFromEmailOutbox } from '../../src/live/live-otp.js';
import { readLiveState } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  assertNoErrors,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('04-parent-otp — parent logs into the LMS with a real emailed OTP and sees the child', () => {
  test('parent email-OTP login lands on /parent/home with the provisioned child', async ({ page }) => {
    const state = readLiveState();
    const parentEmail = state.parentEmail;
    const studentName = state.contactName;
    test.skip(!parentEmail || !studentName, 'no parent account provisioned yet — run 00→02 first (parent email + student name required).');

    attachErrors(page, scratch);

    await page.goto('/login');
    // Astryx TabList renders tabs as plain buttons (no role=tab) — match by label.
    await page.getByRole('button', { name: /phụ huynh/i }).click();

    // Request the code; the page switches to the verify step on success.
    await page.getByLabel('Email phụ huynh').fill(parentEmail!);
    await page.getByRole('button', { name: 'Gửi mã OTP' }).click();
    await expect(page.getByLabel('Mã OTP (6 số)')).toBeVisible({ timeout: 15_000 });

    // Real code from the queued email (EmailOutbox, read-only docker exec).
    const code = await readOtpFromEmailOutbox(parentEmail!);
    expect(code).toMatch(/^\d{6}$/);
    await page.getByLabel('Mã OTP (6 số)').fill(code);
    await page.getByRole('button', { name: 'Xác nhận mã' }).click();

    await expect(page).toHaveURL(/\/parent/);
    // The child chip is a plain <button> named by the child's full name.
    await expect(page.getByRole('button', { name: studentName! })).toBeVisible();
    await assertNoErrors(page, scratch.collectors[0]!, 'parent OTP login + child home');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
