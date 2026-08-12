// Shared ParentAccount lifecycle gate for LMS sessions (teaching spine P4).
// Used by lmsProcedure and non-tRPC routes (e.g. session-photo GET).

import type { PrismaClient } from '@cmc/db';
import type { LmsSubject } from '../trpc.js';

export type LiveLmsSessionResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'inactive' | 'token_mismatch' };

/**
 * Returns ok when the parent account is active and tokenVersion matches the
 * claim embedded in the signed LMS token (or 0 for legacy/dev subjects).
 */
export async function assertLiveLmsSession(
  db: PrismaClient,
  lmsSubject: LmsSubject | null | undefined,
): Promise<LiveLmsSessionResult> {
  if (!lmsSubject) return { ok: false, reason: 'missing' };
  const account = await db.parentAccount.findUnique({
    where: { id: lmsSubject.parentAccountId },
    select: { isActive: true, tokenVersion: true },
  });
  if (!account || !account.isActive) return { ok: false, reason: 'inactive' };
  const claimTv = lmsSubject.tokenVersion ?? 0;
  if (claimTv !== account.tokenVersion) return { ok: false, reason: 'token_mismatch' };
  return { ok: true };
}
