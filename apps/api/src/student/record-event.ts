// Student record events — operational student timeline (resource-depth
// Phase 6, module 2; frozen map: reports/phase-06-module-2-student-freeze.md).
//
// Kinds and payload shapes are FROZEN by that contract:
//   created {}, guardian_linked {parentAccountId, relation},
//   enrolled {enrollmentId, classBatchId},
//   enrollment_activated {enrollmentId, classBatchId},
//   enrollment_withdrawn {classBatchId}, lifecycle_changed {from, to},
//   password_reset {}.
// Payloads are allowlists, never sanitized raw input. Student names, parent
// phones/emails, addresses, notes, money and receipt codes are NEVER stored —
// the timeline must not widen what student.get already exposes.

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

/** Server-fixed entity discriminator — the client never supplies it. */
export const STUDENT_RECORD_EVENT_ENTITY = 'Student';

export const STUDENT_RECORD_EVENT_KINDS = [
  'created',
  'guardian_linked',
  'enrolled',
  'enrollment_activated',
  'enrollment_withdrawn',
  'lifecycle_changed',
  'password_reset',
] as const;

export type StudentRecordEventKind = (typeof STUDENT_RECORD_EVENT_KINDS)[number];

export const STUDENT_RECORD_EVENT_LABELS = {
  created: 'Đã tạo hồ sơ học viên',
  guardian_linked: 'Đã liên kết phụ huynh',
  enrolled: 'Đã đăng ký vào lớp (giữ chỗ)',
  enrollment_activated: 'Đã kích hoạt ghế học',
  enrollment_withdrawn: 'Đã rút khỏi lớp',
  lifecycle_changed: 'Đã đổi trạng thái học viên',
  password_reset: 'Đã đặt lại mật khẩu học viên',
} as const satisfies Record<StudentRecordEventKind, string>;

export const UNKNOWN_STUDENT_RECORD_EVENT_LABEL = 'Sự kiện không đọc được';

/** ICT calendar day Student event recording started (Phase 6 rollout). */
export const STUDENT_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-19T00:00:00.000+07:00');

/** Static membership table — string-keyed, never mutated. */
const KIND_LOOKUP: Record<StudentRecordEventKind, true> = {
  created: true,
  guardian_linked: true,
  enrolled: true,
  enrollment_activated: true,
  enrollment_withdrawn: true,
  lifecycle_changed: true,
  password_reset: true,
};

export function isStudentRecordEventKind(kind: string): kind is StudentRecordEventKind {
  return KIND_LOOKUP[kind as StudentRecordEventKind] === true;
}

export function labelForStudentRecordEventKind(kind: string): string {
  return isStudentRecordEventKind(kind)
    ? STUDENT_RECORD_EVENT_LABELS[kind]
    : UNKNOWN_STUDENT_RECORD_EVENT_LABEL;
}

/** Keys a student event payload may never contain — defense in depth on top
 * of the allowlist; asserted in tests via serialized-row scans. */
const SECRET_SHAPED_KEY_RE = /(password|hash|token|otp|secret|credential|phone|email|note)/i;

export function studentEventPayloadLeaksSecret(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object') return false;
  return JSON.stringify(payload).split('"').some((part) => SECRET_SHAPED_KEY_RE.test(part));
}

export type EmitStudentRecordEventArgs = {
  facilityId: string;
  studentId: string;
  actor: string;
} & (
  | { kind: 'created' }
  | { kind: 'guardian_linked'; parentAccountId: string; relation: 'father' | 'mother' | 'guardian' }
  | { kind: 'enrolled'; enrollmentId: string; classBatchId: string }
  | { kind: 'enrollment_activated'; enrollmentId: string; classBatchId: string }
  | { kind: 'enrollment_withdrawn'; classBatchId: string }
  | {
      kind: 'lifecycle_changed';
      from: 'active' | 'blocked_lms' | 'withdrawn';
      to: 'active' | 'blocked_lms' | 'withdrawn';
    }
  | { kind: 'password_reset' }
);

function payloadJson(args: EmitStudentRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'created':
    case 'password_reset':
      return undefined;
    case 'guardian_linked':
      return { parentAccountId: args.parentAccountId, relation: args.relation };
    case 'enrolled':
    case 'enrollment_activated':
      return { enrollmentId: args.enrollmentId, classBatchId: args.classBatchId };
    case 'enrollment_withdrawn':
      return { classBatchId: args.classBatchId };
    case 'lifecycle_changed':
      return { from: args.from, to: args.to };
    default: {
      const _never: never = args;
      throw new Error(`Unhandled student event kind: ${JSON.stringify(_never)}`);
    }
  }
}

/** Append one student event inside the caller's mutation transaction — the
 * event commits or rolls back together with the student write. */
export async function emitStudentRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitStudentRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: STUDENT_RECORD_EVENT_ENTITY,
    entityId: args.studentId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}
