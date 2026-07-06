// Shared room double-booking guard for `classBatch.create` and
// `schedule.generateSessions` (WF-P2-01: "trung phong -> CONFLICT"). Both the
// create path and the regenerate/extend path must enforce the same invariant;
// keeping it here avoids the drift where only one enforced it (G1 review M1).

import type { Prisma } from '@cmc/db';
import { conflict } from '../errors.js';
import type { PlannedSession } from './generate-sessions.js';

/**
 * Throws CONFLICT if any planned session overlaps (half-open interval:
 * back-to-back is fine) a non-cancelled session already booked in the same
 * room. `excludeClassBatchId` skips the batch's OWN existing sessions so a
 * regenerate does not conflict with itself.
 *
 * Note: this is a READ-COMMITTED check with no DB constraint backstop, so two
 * concurrent creates into the same room can still race (G1 review M3 —
 * tracked, low likelihood on the trusted admin path; a btree_gist exclusion
 * constraint is the durable fix).
 */
export async function assertNoRoomConflict(
  tx: Prisma.TransactionClient,
  facilityId: string,
  roomId: string,
  planned: readonly PlannedSession[],
  excludeClassBatchId?: string,
): Promise<void> {
  if (planned.length === 0) return;

  const existing = await tx.classSession.findMany({
    where: {
      facilityId,
      status: { not: 'cancelled' },
      classBatch: {
        roomId,
        ...(excludeClassBatchId ? { id: { not: excludeClassBatchId } } : {}),
      },
    },
    select: { startTime: true, endTime: true },
  });

  const hasConflict = planned.some((p) =>
    existing.some((e) => p.startTime < e.endTime && e.startTime < p.endTime),
  );
  if (hasConflict) {
    throw conflict('Room is already booked for an overlapping time on this schedule.');
  }
}
