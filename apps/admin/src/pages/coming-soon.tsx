import { Stack, Text, Title } from '@mantine/core';

export function ComingSoon() {
  return (
    <Stack align="center" justify="center" gap="md" style={{ minHeight: 320 }}>
      <Text fz={48} lh={1}>
        🚧
      </Text>
      <Title order={4} c="dimmed">
        Đang phát triển
      </Title>
      <Text fz="sm" c="dimmed">
        Tính năng này sẽ ra mắt trong phiên bản tiếp theo.
      </Text>
    </Stack>
  );
}
