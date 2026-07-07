import { Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Stack align="center" justify="center" gap="md" py={64}>
      {icon && (
        <Text fz={40} lh={1}>
          {icon}
        </Text>
      )}
      <Stack align="center" gap={4}>
        <Title order={5} c="dimmed">
          {title}
        </Title>
        {description && (
          <Text fz="sm" c="dimmed" ta="center" maw={360}>
            {description}
          </Text>
        )}
      </Stack>
      {action}
    </Stack>
  );
}
