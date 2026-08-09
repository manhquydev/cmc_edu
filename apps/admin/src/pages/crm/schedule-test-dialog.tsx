import { useState } from 'react';
import { Button, DateTimeField, Dialog, DialogHeader, HStack, Stack } from '@cmc/ui';
import { useTestAppointmentActions } from './use-test-appointment-actions.js';

/**
 * Shared "Đặt lịch test" dialog — rendered from both the pipeline card action
 * (pipeline.tsx) and the opportunity-detail action bar (opportunity-detail.tsx).
 * `opportunityId === null` means closed; any other value opens the dialog for
 * that opportunity. Schedules an `entrance` appointment; the backend rejects
 * (BAD_REQUEST) when the opp isn't at O2/O3 or is lost/O5 — surfaced inline,
 * non-fatally, via `scheduleMutation.error`.
 */
export function ScheduleTestDialog({
  opportunityId,
  onClose,
}: {
  opportunityId: string | null;
  onClose: () => void;
}) {
  // datetime-local's raw string value (e.g. "2026-08-01T10:00") — converted
  // to an ISO instant only at submit time via `new Date(v).toISOString()`.
  const [scheduledAt, setScheduledAt] = useState('');
  const { scheduleMutation } = useTestAppointmentActions();

  function close() {
    setScheduledAt('');
    scheduleMutation.reset();
    onClose();
  }

  function handleSubmit() {
    if (!opportunityId || !scheduledAt) return;
    scheduleMutation.mutate(
      {
        type: 'entrance',
        opportunityId,
        scheduledAt: new Date(scheduledAt).toISOString(),
      },
      { onSuccess: close },
    );
  }

  return (
    <Dialog
      isOpen={opportunityId !== null}
      onOpenChange={(next) => {
        if (!next && !scheduleMutation.isPending) close();
      }}
      purpose="form"
      width={400}
    >
      <DialogHeader
        title="Đặt lịch test đầu vào"
        onOpenChange={(next) => {
          if (!next && !scheduleMutation.isPending) close();
        }}
      />
      <Stack gap={2} padding={4}>
        <DateTimeField label="Thời gian test" value={scheduledAt} onChange={setScheduledAt} />
        {scheduleMutation.error && (
          // TODO(astryx-review): Text color enum has no error/danger slot —
          // plain <span> with CSS var per migration flag rule (see users.tsx).
          <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
            {scheduleMutation.error.message}
          </span>
        )}
        <HStack justify="end" gap={1} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <Button label="Hủy" variant="secondary" onClick={close} isDisabled={scheduleMutation.isPending} />
          <Button
            label="Đặt lịch"
            variant="primary"
            onClick={handleSubmit}
            isLoading={scheduleMutation.isPending}
            isDisabled={!scheduledAt}
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}
