// Puts a logged-in LMS session into a browser context, for journeys where
// logging in is NOT the business being proven.
//
// This file owns exactly one thing: the shape the LMS app expects in
// localStorage. It does NOT know how a token is built — `session-injection.ts`
// stays the single owner of the token format, and this wrapper calls
// `mintParentToken`/`mintStudentToken` for it. Two files minting tokens would
// mean two places to fix when the format changes, and the second one would be
// found by a failing spec rather than by a reader.
//
// When login IS the business (the parent OTP journey, the student activation
// journey), do not use this — drive the real login screen instead.

import type { BrowserContext } from '@playwright/test';

import { getDb } from '../db.js';
import { mintParentToken, mintStudentToken } from '../session-injection.js';

/** Mirrors `StoredLmsSession` in apps/lms/src/lib/trpc.ts. Kept as a local
 *  structural copy rather than an import because apps/e2e does not depend on
 *  apps/lms; the field names are asserted by every spec that renders a screen
 *  from this session, so a drift shows up as a failing journey. */
interface StoredLmsSession {
  kind: 'parent' | 'student';
  parentAccountId: string;
  studentId?: string;
  children?: Array<{ studentId: string; fullName: string }>;
  sessionToken: string;
  mustChangePassword?: boolean;
}

/** Must match LMS_SESSION_KEY in apps/lms/src/lib/trpc.ts. */
const LMS_SESSION_KEY = 'cmc_lms_session';

export type MintLmsSessionOptions =
  | { kind: 'parent'; parentAccountId: string }
  | { kind: 'student'; parentAccountId: string; studentId: string };

/**
 * Writes a signed LMS session into `context`'s localStorage for the LMS origin.
 *
 * For a parent session the `children` list is populated from the database. That
 * is a deliberate, narrow carve-out: the real app fills that list from the
 * verifyOtp RESPONSE at login time, and `parent/home.tsx` renders the child
 * picker straight from the stored copy — so a parent session injected without
 * it shows a parent who has no children, and every downstream assertion fails
 * for a reason unrelated to what the journey is testing. The children are read
 * back from the guardian links the ERP side of the journey actually created, so
 * this reflects real data rather than inventing any.
 */
export async function mintLmsSession(
  context: BrowserContext,
  options: MintLmsSessionOptions,
): Promise<void> {
  const session: StoredLmsSession =
    options.kind === 'parent'
      ? {
          kind: 'parent',
          parentAccountId: options.parentAccountId,
          sessionToken: mintParentToken(options.parentAccountId),
          children: await readLinkedChildren(options.parentAccountId),
        }
      : {
          kind: 'student',
          parentAccountId: options.parentAccountId,
          studentId: options.studentId,
          sessionToken: mintStudentToken(options.parentAccountId, options.studentId),
        };

  // The callback body runs in the browser, not in Node — this package has no
  // DOM lib, so `localStorage` is reached through the globalThis cast rather
  // than pulling DOM types into a Node-only tsconfig.
  await context.addInitScript(
    ([key, value]: readonly [string, string]) => {
      (globalThis as unknown as { localStorage: { setItem(k: string, v: string): void } }).localStorage.setItem(
        key,
        value,
      );
    },
    [LMS_SESSION_KEY, JSON.stringify(session)] as const,
  );

  // addInitScript runs before page scripts on every page opened afterwards, so
  // call this before the first navigation in the context.
}

async function readLinkedChildren(
  parentAccountId: string,
): Promise<Array<{ studentId: string; fullName: string }>> {
  const guardians = await getDb().guardian.findMany({
    where: { parentAccountId },
    select: { student: { select: { id: true, fullName: true } } },
  });
  return guardians.map((g) => ({ studentId: g.student.id, fullName: g.student.fullName }));
}
