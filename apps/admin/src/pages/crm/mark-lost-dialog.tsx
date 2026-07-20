import { useState } from 'react';
import { Button, Dialog, DialogHeader, HStack, Selector, Stack } from '@cmc/ui';
import { useOpportunityActions } from './use-opportunity-actions.js';

// Canonical lost-reason set (WF-P1-01) — single source of truth, imported by
// opportunity-detail.tsx for its lost-banner description instead of keeping
// a second copy.
export type LostReasonKey =
  | 'no_response'
  | 'price_too_high'
  | 'chose_competitor'
  | 'schedule_conflict'
  | 'not_interested'
  | 'other';

const LOST_REASON_OPTIONS: { value: LostReasonKey; label: string }[] = [
  { value: 'no_response', label: 'Không phản hồi' },
  { value: 'price_too_high', label: 'Học phí quá cao' },
  { value: 'chose_competitor', label: 'Chọn đối thủ' },
  { value: 'schedule_conflict', label: 'Lịch học không phù hợp' },
  { value: 'not_interested', label: 'Không có nhu cầu' },
  { value: 'other', label: 'Lý do khác' },
];

// Widened to `Record<string, string>` (rather than `Record<LostReasonKey,
// string>`) so callers can index it with an arbitrary DB-sourced string (e.g.
// `opp.lostReason`) without a TS7053 index-signature error.
export const LOST_REASON_LABELS: Record<string, string> = Object.fromEntries(
  LOST_REASON_OPTIONS.map((o) => [o.value, o.label]),
);

/**
 * Shared mark-lost dialog — rendered from both the pipeline card action and
 * the opportunity-detail action bar. `opportunityId === null` means closed;
 * any other value opens the dialog for that opportunity.
 */
export function MarkLostDialog({
  opportunityId,
  onClose,
}: {
  opportunityId: string | null;
  onClose: () => void;
}) {
  const [lostReason, setLostReason] = useState<LostReasonKey | ''>('');
  const { markLostMutation } = useOpportunityActions();

  function close() {
    setLostReason('');
    markLostMutation.reset();
    onClose();
  }

  function handleConfirm() {
    if (!opportunityId || lostReason === '') return;
    markLostMutation.mutate({ opportunityId, lostReason }, { onSuccess: close });
  }

  return (
    <Dialog
      isOpen={opportunityId !== null}
      onOpenChange={(next) => {
        if (!next && !markLostMutation.isPending) close();
      }}
      purpose="form"
      width={400}
    >
      <DialogHeader
        title="Đánh dấu mất cơ hội"
        onOpenChange={(next) => {
          if (!next && !markLostMutation.isPending) close();
        }}
      />
      <Stack gap={2} padding={4}>
        <Selector
          label="Lý do mất"
          placeholder="Chọn lý do…"
          isRequired
          options={LOST_REASON_OPTIONS}
          value={lostReason}
          onChange={(v) => setLostReason(v as LostReasonKey)}
        />
        {markLostMutation.error && (
          // TODO(astryx-review): Text color enum has no error/danger slot —
          // plain <span> with CSS var per migration flag rule (see users.tsx).
          <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
            {markLostMutation.error.message}
          </span>
        )}
        <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
          <Button label="Hủy" variant="secondary" onClick={close} isDisabled={markLostMutation.isPending} />
          <Button
            label="Xác nhận"
            variant="primary"
            onClick={handleConfirm}
            isLoading={markLostMutation.isPending}
            isDisabled={lostReason === ''}
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}
