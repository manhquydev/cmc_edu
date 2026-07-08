import { Box, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { trpc } from './trpc.js';

export function EnrollPicker({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.crm.opportunityList.useQuery(
    { stage: 'O4_TESTED', pageSize: 50 },
    { enabled: opened },
  );

  const items = (data?.items ?? []).filter((o) => !o.closedAt);

  return (
    <Modal opened={opened} onClose={onClose} title="Chọn cơ hội để ghi danh" size="md">
      {isLoading && (
        <Stack align="center" py="lg">
          <Loader size="sm" />
        </Stack>
      )}
      {!isLoading && items.length === 0 && (
        <Text fz="sm" c="dimmed" ta="center" py="lg">
          Không có cơ hội O4 nào sẵn sàng ghi danh.
        </Text>
      )}
      <Stack gap="xs">
        {items.map((opp) => (
          <Box
            key={opp.id}
            onClick={() => {
              onClose();
              void navigate(`/finance/new?opportunityId=${opp.id}`);
            }}
            style={{
              padding: '10px 12px',
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              cursor: 'pointer',
            }}
          >
            <Group justify="space-between">
              <Stack gap={2}>
                <Text fz="sm" fw={600}>{opp.contact.name}</Text>
                <Text fz="xs" c="dimmed">{opp.contact.phone}</Text>
              </Stack>
              <Text fz="xs" c="blue">Ghi danh →</Text>
            </Group>
          </Box>
        ))}
      </Stack>
    </Modal>
  );
}
