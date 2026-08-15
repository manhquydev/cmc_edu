// live-auth — REAL-ENVIRONMENT staff authentication for the live suite.
//
// Two login paths, both through the real UI on https://erp.clawcmc.io.vn:
//   1. Cookie replay (primary): the 8h cmc_staff_session cookie captured at
//      login time is persisted to .live-credentials.json and re-injected into
//      a fresh context — zero staff-login POSTs on reruns.
//   2. Fresh UI login (fallback): real email/password form (#login-email,
//      #login-password, button "Đăng nhập" — apps/admin/src/pages/login.tsx),
//      handling the forced /change-password rotation (change-password.tsx:
//      "Mật khẩu hiện tại" / "Mật khẩu mới" / "Xác nhận mật khẩu mới" /
//      "Đổi mật khẩu") and persisting the rotated password + session cookie.
//
// RATE LIMITS (nginx infra/nginx/api-locations.conf): /auth/staff-login is
// 5r/m burst 10. paceStaffLogin() floors the gap between staff-login POSTs
// (default 20s, LIVE_STAFF_LOGIN_PACING_MS to override) and every role
// prefers cookie replay, so a full campaign issues at most 5 real logins.
//
// SECURITY: passwords are never printed or logged; only emails surface in
// failure messages.

import { randomUUID } from 'node:crypto';

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';
import {
  readCredentialsFile,
  updateCredentialsFile,
  liveSuperAdminCredentials,
  type PersistedSession,
} from './live-credentials.js';
import { LIVE_ADMIN_ORIGIN } from '../../playwright.live.config.js';
import { loadProdEnv } from './live-env.js';

const SHELL_SETTLE_TIMEOUT_MS = 10_000;
const LOGIN_FLOW_TIMEOUT_MS = 30_000;
const DEFAULT_LOGIN_PACING_MS = 20_000;

// ─── rate-limit pacing ──────────────────────────────────────────────────────

let lastStaffLoginAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits so consecutive staff-login POSTs never exceed the nginx 5r/m auth
 *  zone sustained rate (burst 10 absorbs a handful of retries). */
export async function paceStaffLogin(): Promise<void> {
  const minGap = Number(process.env.LIVE_STAFF_LOGIN_PACING_MS ?? DEFAULT_LOGIN_PACING_MS);
  const now = Date.now();
  const wait = minGap - (now - lastStaffLoginAt);
  if (wait > 0) {
    // eslint-disable-next-line no-console
    console.log('[live-auth] pacing staff login for ' + Math.ceil(wait / 1000) + 's (rate limit 5r/m)');
    await sleep(wait);
  }
  lastStaffLoginAt = Date.now();
}

// ─── session cookie capture / replay ────────────────────────────────────────

export async function captureStaffSession(context: BrowserContext): Promise<PersistedSession> {
  const cookies = await context.cookies();
  const staff = cookies.find((c) => c.name === STAFF_COOKIE_NAME);
  if (!staff) {
    throw new Error('captureStaffSession: no cmc_staff_session cookie after login — the login did not set one.');
  }
  return {
    name: staff.name,
    value: staff.value,
    // Host-only cookie: the returned domain has no leading dot; normalize in
    // case a proxy rewrote it.
    domain: staff.domain.replace(/^\./, ''),
    path: staff.path,
    expires: staff.expires,
  };
}

function sessionStillValid(session: PersistedSession | undefined): boolean {
  if (!session?.value) return false;
  // expires is unix seconds; Playwright reports -1 for session-scoped cookies.
  return session.expires > 0 && session.expires > Date.now() / 1000;
}

function addSessionToContext(context: BrowserContext, session: PersistedSession): void {
  void context.addCookies([
    {
      name: session.name,
      value: session.value,
      domain: session.domain.replace(/^\./, ''),
      path: session.path,
      expires: session.expires,
    },
  ]);
}

/** Opens /cockpit in a context carrying the persisted session cookie and
 *  returns whether the shell actually hydrated (the cookie was accepted). */
async function tryReplaySession(
  browser: Browser,
  session: PersistedSession,
): Promise<{ ok: boolean; context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: LIVE_ADMIN_ORIGIN });
  const page = await context.newPage();
  addSessionToContext(context, session);
  try {
    await page.goto('/cockpit', { waitUntil: 'domcontentloaded' });
    // The app-switcher toggle only renders for an authenticated staff session
    // (RequireAuth otherwise bounces to /login before the Shell mounts).
    await expect(page.getByRole('button', { name: 'Mở app switcher', exact: true })).toBeVisible({
      timeout: SHELL_SETTLE_TIMEOUT_MS,
    });
    return { ok: true, context, page };
  } catch {
    await context.close();
    return { ok: false, context, page };
  }
}

// ─── real UI login ──────────────────────────────────────────────────────────

export type LoginOutcome = 'authenticated' | 'must-change-password';

/** Drives the REAL staff login form. Throws with a guidance-rich message when
 *  the generic "Thông tin đăng nhập không chính xác" error renders (the API
 *  never distinguishes wrong-password from locked/unknown by design). */
export async function loginViaUi(page: Page, creds: { email: string; password: string }): Promise<LoginOutcome> {
  await page.goto('/login');
  await page.locator('#login-email').fill(creds.email);
  await page.locator('#login-password').fill(creds.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

  const deadline = Date.now() + LOGIN_FLOW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const path = new URL(page.url()).pathname;
    if (path === '/change-password') return 'must-change-password';
    if (path !== '/login') return 'authenticated';
    // Generic no-leak error message (login.tsx renders it verbatim).
    if (await page.getByText('Thông tin đăng nhập không chính xác', { exact: false }).count()) {
      throw new Error(
        'loginViaUi: staff-login refused for ' +
          creds.email +
          '. The API returns one generic message for every failure (wrong password, locked, ' +
          'unknown) by design. If this is a rerun, the saved password may have been rotated out of band — ' +
          'ops must reset it via user.resetPassword (or clear the AppUser passwordHash and re-seed) before ' +
          'the campaign can continue.',
      );
    }
    await sleep(500);
  }
  throw new Error(
    'loginViaUi: staff-login for ' + creds.email + ' neither succeeded nor failed within ' + LOGIN_FLOW_TIMEOUT_MS + 'ms.',
  );
}

/** Completes the forced rotation on /change-password (change-password.tsx). */
export async function rotatePassword(page: Page, opts: { currentPassword: string; newPassword: string }): Promise<void> {
  await expect(page).toHaveURL(/\/change-password/, { timeout: SHELL_SETTLE_TIMEOUT_MS });
  await page.getByLabel(/^Mật khẩu hiện tại/).fill(opts.currentPassword);
  await page.getByLabel(/^Mật khẩu mới/).fill(opts.newPassword);
  await page.getByLabel(/^Xác nhận mật khẩu mới/).fill(opts.newPassword);
  // Race guard: React derives canSubmit from controlled state — wait for the button to
  // actually enable after the fills before clicking (seen flaky on live).
  await expect(page.getByRole('button', { name: 'Đổi mật khẩu', exact: true })).toBeEnabled({ timeout: SHELL_SETTLE_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  // On success the page navigates to safeReturnTo(returnTo) → / → /cockpit.
  await expect(page).not.toHaveURL(/\/change-password/, { timeout: SHELL_SETTLE_TIMEOUT_MS });
}

function freshRotationPassword(): string {
  // >= 8 chars, unique per rotation (changeOwnPassword enforces min 8).
  return 'CmcLive!' + randomUUID().slice(0, 10);
}

/** Fresh UI login for an account whose CURRENT password is known; performs
 *  the forced rotation when the server demands it and persists the rotated
 *  password + session cookie back to .live-credentials.json. */
export async function freshStaffLogin(
  browser: Browser,
  opts: { roleKey: string; email: string; password: string; userId: string },
): Promise<{ context: BrowserContext; page: Page }> {
  await paceStaffLogin();
  const context = await browser.newContext({ baseURL: LIVE_ADMIN_ORIGIN });
  const page = await context.newPage();
  const outcome = await loginViaUi(page, { email: opts.email, password: opts.password });
  if (outcome === 'must-change-password') {
    const newPassword = freshRotationPassword();
    await rotatePassword(page, { currentPassword: opts.password, newPassword });
    updateCredentialsFile((file) => {
      const account =
        opts.roleKey === 'superAdmin'
          ? file.superAdmin
          : (file.staff[opts.roleKey] ??= { email: opts.email, password: opts.password, userId: opts.userId, changedAt: '' });
      account.email = opts.email;
      account.userId = opts.userId;
      account.password = newPassword;
      account.changedAt = new Date().toISOString();
    });
  }
  await expect(page.getByRole('button', { name: 'Mở app switcher', exact: true })).toBeVisible({
    timeout: SHELL_SETTLE_TIMEOUT_MS,
  });
  const session = await captureStaffSession(context);
  updateCredentialsFile((file) => {
    const account =
      opts.roleKey === 'superAdmin'
        ? file.superAdmin
        : (file.staff[opts.roleKey] ??= { email: opts.email, password: opts.password, userId: opts.userId, changedAt: '' });
    account.session = session;
  });
  return { context, page };
}

// ─── role session facade ────────────────────────────────────────────────────

export interface RoleSession {
  context: BrowserContext;
  page: Page;
  /** true when a fresh login (not cookie replay) was performed */
  loggedIn: boolean;
}

/** Opens an authenticated ERP session for the given role: cookie replay first
 *  (8h TTL), fresh UI login + forced-rotation handling when the cookie is
 *  missing/expired. For roleKey 'superAdmin' the bootstrap .env.prod
 *  credentials are used on the very first campaign; staff roles must have
 *  been created by 00-setup-roles (their credentials live in the file). */
export async function openStaffSession(browser: Browser, roleKey: string): Promise<RoleSession> {
  const file = readCredentialsFile();
  const account = roleKey === 'superAdmin' ? file.superAdmin : (file.staff[roleKey] ?? null);

  if (sessionStillValid(account?.session)) {
    const replayed = await tryReplaySession(browser, account!.session!);
    if (replayed.ok) {
      // eslint-disable-next-line no-console
      console.log('[live-auth] ' + roleKey + ': reusing saved session cookie (' + account!.email + ')');
      return { context: replayed.context, page: replayed.page, loggedIn: false };
    }
    // eslint-disable-next-line no-console
    console.log('[live-auth] ' + roleKey + ': saved session cookie rejected — falling back to a real login');
  }

  let email: string;
  let password: string;
  let userId: string;
  if (roleKey === 'superAdmin') {
    const creds = liveSuperAdminCredentials();
    email = creds.email;
    password = creds.password;
    userId = loadProdEnv().SUPER_ADMIN_USER_ID ?? 'SA-001';
  } else {
    if (!account) {
      throw new Error(
        'openStaffSession: no saved credentials for staff role "' +
          roleKey +
          '" — run 00-setup-roles first (it creates the role accounts and records their passwords).',
      );
    }
    email = account.email;
    password = account.password;
    userId = account.userId;
  }

  const fresh = await freshStaffLogin(browser, { roleKey, email, password, userId });
  return { context: fresh.context, page: fresh.page, loggedIn: true };
}

export async function closeRoleSession(session: RoleSession): Promise<void> {
  await session.context.close();
}