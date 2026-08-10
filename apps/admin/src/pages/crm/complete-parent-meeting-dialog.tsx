import { useState } from 'react';
import { Button, Dialog, DialogHeader, HStack, Stack, TextArea } from '@cmc/ui';
import { useParentMeetingActions } from './use-parent-meeting-actions.js';

/**
 * "Hoàn thành" dialog for the post-sale meeting list — requires a non-empty
 * result (backend rejects an empty one). `meetingId === null` means closed;
 * any other value opens the dialog for that meeting.
 */
export function CompleteParentMeetingDialog({ meetingId, onClose }: { meetingId: string | null; onClose: () => void }) {
  const [result, setResult] = useState('');
  const { completeMutation } = useParentMeetingActions();

  function close() {
    setResult('');
    completeMutation.reset();
    onClose();
  }

  function handleSubmit() {
    if (!meetingId || !result.trim()) return;
    completeMutation.mutate({ meetingId, result: result.trim() }, { onSuccess: close });
  }

  return (
    <Dialog
      isOpen={meetingId !== null}
      onOpenChange={(next) => {
        if (!next && !completeMutation.isPending) close();
      }}
      purpose="form"
      width={400}
    >
      <DialogHeader
        title="Hoàn thành buổi họp"
        onOpenChange={(next) => {
          if (!next && !completeMutation.isPending) close();
        }}
      />
      <Stack gap={2} padding={4}>
        <TextArea
          label="Kết quả buổi họp"
          placeholder="Ghi nhận kết quả trao đổi với phụ huynh…"
          value={result}
          onChange={setResult}
          rows={4}
          isRequired
        />
        {completeMutation.error && (
          // TODO(astryx-review): Text color enum has no error/danger slot —
          // plain <span> with CSS var per migration flag rule (see users.tsx).
          <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
            {completeMutation.error.message}
          </span>
        )}
        <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
          <Button label="Hủy" variant="secondary" onClick={close} isDisabled={completeMutation.isPending} />
          <Button
            label="Xác nhận"
            variant="primary"
            onClick={handleSubmit}
            isLoading={completeMutation.isPending}
            isDisabled={!result.trim()}
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}
