import { Stack, Text, Heading } from '@cmc/ui';

export function ComingSoon() {
  return (
    <Stack hAlign="center" vAlign="center" gap={2} style={{ minHeight: 320 }}>
      <Text size="4xl" style={{ lineHeight: 1 }}>
        🚧
      </Text>
      <Heading level={4} color="secondary">
        Đang phát triển
      </Heading>
      <Text type="supporting" size="sm">
        Tính năng này sẽ ra mắt trong phiên bản tiếp theo.
      </Text>
    </Stack>
  );
}
