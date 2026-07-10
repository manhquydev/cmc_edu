import { Stack, HStack } from '@astryxdesign/core/Stack';
import { Breadcrumbs, BreadcrumbItem } from '@astryxdesign/core/Breadcrumbs';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
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
      gap={0.5}
      paddingInline={3}
      paddingBlock={2}
      style={{
        background: 'var(--cmc-surface)',
        borderBottom: '1px solid var(--cmc-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs>
          {breadcrumbs.map((bc, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <BreadcrumbItem key={i} href={isLast ? undefined : bc.href} isCurrent={isLast}>
                {bc.href && !isLast ? <Link href={bc.href}>{bc.label}</Link> : bc.label}
              </BreadcrumbItem>
            );
          })}
        </Breadcrumbs>
      )}
      <HStack justify="between" align="end">
        <Stack gap={0}>
          <Heading level={4} color="primary">
            {title}
          </Heading>
          {subtitle && (
            <Text type="supporting" size="sm">
              {subtitle}
            </Text>
          )}
        </Stack>
        {actions && <HStack gap={1}>{actions}</HStack>}
      </HStack>
    </Stack>
  );
}
