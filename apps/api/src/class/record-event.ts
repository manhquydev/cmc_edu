// ClassBatch record events — operational class timeline (resource-depth
// Phase 6, module 1).
//
// Kinds and payload shapes are FROZEN by the phase-06 contract:
//   created {program, sessionsCreated}, teacher_changed {teacherAppUserId},
//   sessions_generated {created}, slot_added/slot_updated {weekday,startTime,
//   endTime}, slot_archived {}, session_confirmed {sessionId},
//   session_cancelled {sessionId}, session_unit_assigned {sessionId,
//   curriculumUnitId}, session_teacher_changed {sessionId, teacherAppUserId},
//   session_completed {sessionId}, student_enrolled {studentId, enrollmentId}.
// Payloads are allowlists, never sanitized raw input. Student names, teacher
// identities beyond the id, room names, money and free-text notes are NEVER
// stored — the timeline must not widen what class.read already exposes.

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

/** Server-fixed entity discriminator — the client never supplies it. */
export const CLASS_RECORD_EVENT_ENTITY = 'ClassBatch';

export const CLASS_RECORD_EVENT_KINDS = [
  'created',
  'teacher_changed',
  'sessions_generated',
  'slot_added',
  'slot_updated',
  'slot_archived',
  'session_confirmed',
  'session_cancelled',
  'session_unit_assigned',
  'session_teacher_changed',
  'session_completed',
  'student_enrolled',
] as const;

export type ClassRecordEventKind = (typeof CLASS_RECORD_EVENT_KINDS)[number];

export const CLASS_RECORD_EVENT_LABELS = {
  created: 'Đã mở lớp',
  teacher_changed: 'Đã đổi giáo viên phụ trách',
  sessions_generated: 'Đã phát sinh buổi học',
  slot_added: 'Đã thêm khung giờ',
  slot_updated: 'Đã đổi khung giờ',
  slot_archived: 'Đã gỡ khung giờ',
  session_confirmed: 'Đã xác nhận buổi học',
  session_cancelled: 'Đã huỷ buổi học',
  session_unit_assigned: 'Đã gán giáo trình cho buổi',
  session_teacher_changed: 'Đã đổi GV dạy buổi',
  session_completed: 'Buổi học đã hoàn tất',
  student_enrolled: 'Học viên mới vào lớp',
} as const satisfies Record<ClassRecordEventKind, string>;

export const UNKNOWN_CLASS_RECORD_EVENT_LABEL = 'Sự kiện không đọc được';

/** ICT calendar day ClassBatch event recording started (Phase 6 rollout). */
export const CLASS_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-19T00:00:00.000+07:00');

const KIND_SET: ReadonlySet<string> = new Set(CLASS_RECORD_EVENT_KINDS);

export function isClassRecordEventKind(kind: string): kind is ClassRecordEventKind {
  return KIND_SET.has(kind);
}

export function labelForClassRecordEventKind(kind: string): string {
  return isClassRecordEventKind(kind) ? CLASS_RECORD_EVENT_LABELS[kind]
    : UNKNOWN_CLASS_RECORD_EVENT_LABEL;
}

/** Keys a class event payload may never contain — defense in depth on top of
 *  the allowlist; asserted in tests via serialized-row scans. */
const SECRET_SHAPED_KEY_RE = /(password|hash|token|otp|secret|credential|phone|email|note)/i;

export function classEventPayloadLeaksSecret(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return false;
  return Object.keys(payload).some((k) => SECRET_SHAPED_KEY_RE.test(k));
}

export type EmitClassRecordEventArgs = {
  facilityId: string;
  /** The class the event describes (entityId). */
  classBatchId: string;
  /** Raw actor identity (subject userId or 'system' for workers). */
  actor: string;
} & (
  | { kind: 'created'; program: string; sessionsCreated: number }
  | { kind: 'teacher_changed'; teacherAppUserId: string }
  | { kind: 'sessions_generated'; created: number }
  | { kind: 'slot_added'; weekday: number; startTime: string; endTime: string }
  | { kind: 'slot_updated'; weekday: number; startTime: string; endTime: string }
  | { kind: 'slot_archived' }
  | { kind: 'session_confirmed'; sessionId: string }
  | { kind: 'session_cancelled'; sessionId: string }
  | { kind: 'session_unit_assigned'; sessionId: string; curriculumUnitId: string }
  | { kind: 'session_teacher_changed'; sessionId: string; teacherAppUserId: string }
  | { kind: 'session_completed'; sessionId: string }
  | { kind: 'student_enrolled'; studentId: string; enrollmentId: string }
);

function payloadJson(args: EmitClassRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'slot_archived':
      return undefined;
    case 'created':
      return { program: args.program, sessionsCreated: args.sessionsCreated };
    case 'teacher_changed':
      return { teacherAppUserId: args.teacherAppUserId };
    case 'sessions_generated':
      return { created: args.created };
    case 'slot_added':
    case 'slot_updated':
      return { weekday: args.weekday, startTime: args.startTime, endTime: args.endTime };
    case 'session_confirmed':
    case 'session_cancelled':
    case 'session_completed':
      return { sessionId: args.sessionId };
    case 'session_unit_assigned':
      return { sessionId: args.sessionId, curriculumUnitId: args.curriculumUnitId };
    case 'session_teacher_changed':
      return { sessionId: args.sessionId, teacherAppUserId: args.teacherAppUserId };
    case 'student_enrolled':
      return { studentId: args.studentId, enrollmentId: args.enrollmentId };
    default: {
      const _never: never = args;
      throw new Error(`Unhandled class event kind: ${JSON.stringify(_never)}`);
    }
  }
}

/** Append one class event inside the caller's mutation transaction — the
 *  event commits or rolls back together with the class write. */
export async function emitClassRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitClassRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: CLASS_RECORD_EVENT_ENTITY,
    entityId: args.classBatchId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}
