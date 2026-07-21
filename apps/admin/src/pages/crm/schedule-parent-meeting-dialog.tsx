import { useState } from 'react';
import { Banner, Button, Dialog, DialogHeader, HStack, Stack } from '@cmc/ui';
import { StudentPicker } from '../../lib/student-picker.js';
import type { PickedStudent } from '../../lib/student-picker.js';
import { useParentMeetingActions } from './use-parent-meeting-actions.js';

/**
 * "Đặt lịch họp" dialog — pipeline header action on post-sale-meeting.tsx.
 * `parentMeeting.schedule` always succeeds once the student/time are valid;
 * a same-slot double-booking comes back as a non-fatal `warning` string on
 * the success payload (backend never blocks scheduling on it) — the meeting
 * is already created at that point, so the form is replaced with the warning
 * and a single "Đóng" action instead of re-showing "Đặt lịch"/"Hủy".
 */
export function ScheduleParentMeetingDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const { scheduleMutation } = useParentMeetingActions();

  function close() {
    setStudent(null);
    setScheduledAt('');
    setWarning(undefined);
    scheduleMutation.reset();
    onClose();
  }

  function handleSubmit() {
    if (!student || !scheduledAt) return;
    scheduleMutation.mutate(
      { studentId: student.id, scheduledAt: new Date(scheduledAt).toISOString() },
      {
        onSuccess: (res) => {
          if (res.warning) setWarning(res.warning);
          else close();
        },
      },
    );
  }

  const scheduled = warning !== undefined;

  return (
    <Dialog
      isOpen={opened}
      onOpenChange={(next) => {
        if (!next && !scheduleMutation.isPending) close();
      }}
      purpose="form"
      width={420}
    >
      <DialogHeader
        title="Đặt lịch họp phụ huynh"
        onOpenChange={(next) => {
          if (!next && !scheduleMutation.isPending) close();
        }}
      />
      <Stack gap={2} padding={4}>
        {scheduled && <Banner status="warning" title="Đã đặt lịch — trùng giờ" description={warning} />}
        {!scheduled && (
          <>
            <StudentPicker value={student} onChange={setStudent} />
            <Stack gap={0.5}>
              {/* Plain <label>, not Astryx `Text` — same fallback as
                  schedule-test-dialog.tsx's datetime label. */}
              <label htmlFor="meeting-datetime" style={{ fontSize: 13, fontWeight: 500, color: 'var(--cmc-text)' }}>
                Thời gian họp
              </label>
              {/* @cmc/ui has no date/time picker primitive — native
                  `datetime-local` input, same as schedule-test-dialog.tsx. */}
              <input
                id="meeting-datetime"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--cmc-border)',
                  borderRadius: 'var(--cmc-radius-xs)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  color: 'var(--cmc-text)',
                  background: 'var(--cmc-surface)',
                }}
              />
            </Stack>
            {scheduleMutation.error && (
              // TODO(astryx-review): Text color enum has no error/danger slot —
              // plain <span> with CSS var per migration flag rule (see users.tsx).
              <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
                {scheduleMutation.error.message}
              </span>
            )}
          </>
        )}
        <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
          {scheduled ? (
            <Button label="Đóng" variant="primary" onClick={close} />
          ) : (
            <>
              <Button label="Hủy" variant="secondary" onClick={close} isDisabled={scheduleMutation.isPending} />
              <Button
                label="Đặt lịch"
                variant="primary"
                onClick={handleSubmit}
                isLoading={scheduleMutation.isPending}
                isDisabled={!student || !scheduledAt}
              />
            </>
          )}
        </HStack>
      </Stack>
    </Dialog>
  );
}
