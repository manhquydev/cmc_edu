import { Banner } from '@astryxdesign/core/Banner';
import { Stack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Spinner } from '@astryxdesign/core/Spinner';
import type { ReactNode } from 'react';

export type ResultStatus = 'success' | 'error' | 'warning' | 'loading';

export interface ResultPanelProps {
  status: ResultStatus;
  title: string;
  message?: string;
  actions?: ReactNode;
}

export function ResultPanel({ status, title, message, actions }: ResultPanelProps) {
  if (status === 'loading') {
    return (
      <Stack hAlign="center" paddingBlock={6} gap={2}>
        <Spinner size="md" />
        <Text type="supporting" size="sm">
          {title}
        </Text>
      </Stack>
    );
  }

  // Astryx's Banner picks its own icon per status automatically (no manual
  // ✓/✕/⚠ mapping needed — a simplification over the prior version).
  return (
    <Banner status={status} title={title}>
      {(message || actions) && (
        <Stack gap={2}>
          {message && (
            <Text type="body" size="sm">
              {message}
            </Text>
          )}
          {actions && <HStack gap={1}>{actions}</HStack>}
        </Stack>
      )}
    </Banner>
  );
}
