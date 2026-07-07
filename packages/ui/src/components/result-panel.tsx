import { Alert, Group, Loader, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export type ResultStatus = 'success' | 'error' | 'warning' | 'loading';

const STATUS_CONFIG: Record<ResultStatus, { color: string; icon: string }> = {
  success: { color: 'green', icon: '✓' },
  error: { color: 'red', icon: '✕' },
  warning: { color: 'orange', icon: '⚠' },
  loading: { color: 'blue', icon: '' },
};

export interface ResultPanelProps {
  status: ResultStatus;
  title: string;
  message?: string;
  actions?: ReactNode;
}

export function ResultPanel({ status, title, message, actions }: ResultPanelProps) {
  const cfg = STATUS_CONFIG[status];

  if (status === 'loading') {
    return (
      <Stack align="center" py={48} gap="md">
        <Loader size="md" />
        <Text fz="sm" c="dimmed">
          {title}
        </Text>
      </Stack>
    );
  }

  return (
    <Alert
      color={cfg.color}
      title={
        <Group gap={6}>
          <Text span fw={700}>
            {cfg.icon}
          </Text>
          {title}
        </Group>
      }
      radius="xs"
    >
      <Stack gap="sm">
        {message && <Text fz="sm">{message}</Text>}
        {actions && <Group gap="xs">{actions}</Group>}
      </Stack>
    </Alert>
  );
}
