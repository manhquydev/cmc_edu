import { Card, Group, Skeleton, Stack, Text } from '@mantine/core';

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  color?: string;
  loading?: boolean;
}

export function StatCard({ label, value, trend, color, loading = false }: StatCardProps) {
  return (
    <Card padding="md" radius="xs" withBorder style={{ borderColor: 'var(--cmc-border)' }}>
      <Stack gap={6}>
        <Text fz={11} tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: '0.04em' }}>
          {label}
        </Text>
        {loading ? (
          <>
            <Skeleton height={28} width="60%" radius="xs" />
            <Skeleton height={12} width="40%" radius="xs" />
          </>
        ) : (
          <>
            <Text fz={24} fw={700} style={{ color: color ?? 'var(--cmc-text)', lineHeight: 1.2 }}>
              {value}
            </Text>
            {trend && (
              <Group gap={4}>
                <Text fz="xs" c="dimmed">
                  {trend}
                </Text>
              </Group>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
