import { Anchor, Breadcrumbs, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
}

export function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <Stack
      gap={4}
      px="md"
      py="sm"
      style={{
        background: 'var(--cmc-surface)',
        borderBottom: '1px solid var(--cmc-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs fz="xs" c="dimmed">
          {breadcrumbs.map((bc, i) =>
            bc.href ? (
              <Anchor key={i} href={bc.href} fz="xs">
                {bc.label}
              </Anchor>
            ) : (
              <Text key={i} fz="xs">
                {bc.label}
              </Text>
            ),
          )}
        </Breadcrumbs>
      )}
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Title order={4} style={{ color: 'var(--cmc-text)' }}>
            {title}
          </Title>
          {subtitle && (
            <Text fz="sm" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Stack>
        {actions && <Group gap="xs">{actions}</Group>}
      </Group>
    </Stack>
  );
}
