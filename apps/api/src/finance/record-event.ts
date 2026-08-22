// Receipt operational events — money lifecycle history without duplicating
// the receipt/refund detail payload. Amounts, phone, email and student names
// stay in the authorized receipt detail API, never in RecordEvent payloads.

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

export const RECEIPT_RECORD_EVENT_ENTITY = 'Receipt';
export const RECEIPT_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-19T00:00:00.000+07:00');

export const RECEIPT_RECORD_EVENT_KINDS = [
  'created',
  'approved',
  'cancelled',
  'refunded',
  'provisioned',
] as const;

export type ReceiptRecordEventKind = (typeof RECEIPT_RECORD_EVENT_KINDS)[number];

export const RECEIPT_RECORD_EVENT_LABELS: Record<ReceiptRecordEventKind, string> = {
  created: 'Đã tạo phiếu thu',
  approved: 'Đã duyệt phiếu thu',
  cancelled: 'Đã huỷ phiếu thu',
  refunded: 'Đã ghi hoàn tiền',
  provisioned: 'Đã cấp phát dịch vụ',
};

export function isReceiptRecordEventKind(kind: string): kind is ReceiptRecordEventKind {
  return RECEIPT_RECORD_EVENT_KINDS.includes(kind as ReceiptRecordEventKind);
}

export function labelForReceiptRecordEventKind(kind: string): string {
  return isReceiptRecordEventKind(kind) ? RECEIPT_RECORD_EVENT_LABELS[kind] : 'Sự kiện không đọc được';
}

export type EmitReceiptRecordEventArgs = {
  facilityId: string;
  receiptId: string;
  actor: string;
} & (
  | { kind: 'created' }
  | { kind: 'approved'; receiptKind: 'new' | 'renewal' }
  | { kind: 'cancelled'; void: boolean; opportunityReverted: boolean }
  | { kind: 'refunded' }
  | { kind: 'provisioned'; status: 'ok' | 'pending' | 'aborted' }
);

function payloadJson(args: EmitReceiptRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'created':
    case 'refunded':
      return undefined;
    case 'approved':
      return { kind: args.receiptKind };
    case 'cancelled':
      return { void: args.void, opportunityReverted: args.opportunityReverted };
    case 'provisioned':
      return { status: args.status };
    default: {
      const _never: never = args;
      throw new Error(`Unhandled receipt event kind: ${JSON.stringify(_never)}`);
    }
  }
}

export async function emitReceiptRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitReceiptRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: RECEIPT_RECORD_EVENT_ENTITY,
    entityId: args.receiptId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}
