import { useState } from 'react';
import { Button, Dialog, DialogHeader, HStack, Stack, TextArea } from '@cmc/ui';
import { useAfterSaleActions } from './use-after-sale-actions.js';

/**
 * Shared "Giải quyết" dialog for the after-sale case list — requires a
 * non-empty resolution (backend rejects an empty one). `caseId === null`
 * means closed; any other value opens the dialog for that case.
 */
export function ResolveAfterSaleCaseDialog({ caseId, onClose }: { caseId: string | null; onClose: () => void }) {
  const [resolution, setResolution] = useState('');
  const { resolveMutation } = useAfterSaleActions();

  function close() {
    setResolution('');
    resolveMutation.reset();
    onClose();
  }

  function handleSubmit() {
    if (!caseId || !resolution.trim()) return;
    resolveMutation.mutate({ caseId, resolution: resolution.trim() }, { onSuccess: close });
  }

  return (
    <Dialog
      isOpen={caseId !== null}
      onOpenChange={(next) => {
        if (!next && !resolveMutation.isPending) close();
      }}
      purpose="form"
      width={400}
    >
      <DialogHeader
        title="Giải quyết case"
        onOpenChange={(next) => {
          if (!next && !resolveMutation.isPending) close();
        }}
      />
      <Stack gap={2} padding={4}>
        <TextArea
          label="Kết quả xử lý"
          placeholder="Mô tả cách xử lý case…"
          value={resolution}
          onChange={setResolution}
          rows={4}
          isRequired
        />
        {resolveMutation.error && (
          // TODO(astryx-review): Text color enum has no error/danger slot —
          // plain <span> with CSS var per migration flag rule (see users.tsx).
          <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
            {resolveMutation.error.message}
          </span>
        )}
        <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
          <Button label="Hủy" variant="secondary" onClick={close} isDisabled={resolveMutation.isPending} />
          <Button
            label="Xác nhận"
            variant="primary"
            onClick={handleSubmit}
            isLoading={resolveMutation.isPending}
            isDisabled={!resolution.trim()}
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}
