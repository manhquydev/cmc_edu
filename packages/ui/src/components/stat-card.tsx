import { Card } from '@astryxdesign/core/Card';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Skeleton } from '@astryxdesign/core/Skeleton';

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  color?: string;
  loading?: boolean;
}

export function StatCard({ label, value, trend, color, loading = false }: StatCardProps) {
  return (
    <Card padding={3}>
      <Stack gap={0.5}>
        <Text type="label" size="2xs" weight="semibold" color="secondary">
          {label}
        </Text>
        {loading ? (
          <>
            <Skeleton height={28} radius={0} />
            <Skeleton height={12} width="40%" radius={0} />
          </>
        ) : (
          <>
            {/* Astryx Text's `color` prop is a fixed semantic enum (no raw
                hex escape hatch) — callers here pass arbitrary hex values
                (e.g. threshold-based red/orange/green), so this line stays
                a plain element instead of Astryx's Text component. */}
            <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: color ?? 'var(--cmc-text)' }}>
              {value}
            </span>
            {trend && (
              <Text type="supporting" size="2xs">
                {trend}
              </Text>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
