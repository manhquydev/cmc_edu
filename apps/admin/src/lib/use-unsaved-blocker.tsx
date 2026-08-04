import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '@cmc/ui';

export interface UseUnsavedBlockerOptions {
  dirty: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Blocks in-app navigation when `dirty`. Renders ConfirmDialog.
 * Also registers beforeunload for tab close / refresh.
 */
export function useUnsavedBlocker({
  dirty,
  title = 'Rời trang?',
  message = 'Thay đổi chưa lưu sẽ bị mất. Bạn có chắc muốn rời đi?',
  confirmLabel = 'Rời trang',
  cancelLabel = 'Ở lại',
}: UseUnsavedBlockerOptions) {
  const blocker = useBlocker(dirty);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (blocker.state === 'blocked') setOpen(true);
    else setOpen(false);
  }, [blocker.state]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const onConfirmLeave = useCallback(() => {
    setOpen(false);
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker]);

  const onStay = useCallback(() => {
    setOpen(false);
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  const dialog = (
    <ConfirmDialog
      opened={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirmColor="orange"
      onConfirm={onConfirmLeave}
      onCancel={onStay}
    />
  );

  return { dialog, blocker };
}
