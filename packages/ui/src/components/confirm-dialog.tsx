import { Button, Group, Modal, Text } from '@mantine/core';

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
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title}
      radius="xs"
      size="sm"
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Text fz="sm" mb="lg">
        {message}
      </Text>
      <Group justify="flex-end" gap="xs">
        <Button variant="default" radius="xs" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button color={confirmColor} radius="xs" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
