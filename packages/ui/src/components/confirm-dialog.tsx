import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import type { ComponentProps } from 'react';

type ActionVariant = ComponentProps<typeof AlertDialog>['actionVariant'];

export interface ConfirmDialogProps {
  opened: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
}

// Astryx's AlertDialog has only 4 fixed action variants (primary/secondary/
// ghost/destructive) — no arbitrary color escape hatch, unlike the prior UI's
// Button which accepted any color name. Approximates the prior color
// palette actually used by callers (red/orange/green/blue/gray) onto the
// closest semantic variant; loses the distinct green vs. blue vs. gray
// color-coding, an accepted visual approximation (plan Risk Assessment
// anticipated exactly this class of mismatch for ConfirmDialog).
function toActionVariant(confirmColor: string): ActionVariant {
  switch (confirmColor) {
    case 'red':
    case 'orange':
      return 'destructive';
    case 'gray':
      return 'secondary';
    default:
      return 'primary';
  }
}

export function ConfirmDialog({
  opened,
  title,
  message,
  onConfirm,
  onCancel,
  loading = false,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  confirmColor = 'red',
}: ConfirmDialogProps) {
  // Wrapper is a mount/registry hook for design3 float docs. Astryx Dialog uses
  // native <dialog>.showModal() (browser top layer — above toast/cmd z-index).
  return (
    <div className="ck-dialog-root" data-cmc-float="dialog">
      <AlertDialog
        className="ck-dialog"
        isOpen={opened}
        onOpenChange={(next) => {
          if (!next && !loading) onCancel();
        }}
        title={title}
        description={message}
        actionLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onAction={onConfirm}
        actionVariant={toActionVariant(confirmColor)}
        isActionLoading={loading}
      />
    </div>
  );
}
