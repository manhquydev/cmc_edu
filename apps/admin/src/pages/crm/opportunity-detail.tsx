import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Box, Button, Grid, Group, Loader, Stack, Text } from '@mantine/core';
import { PageHeader } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

const STAGE_LABELS: Record<string, string> = {
  O1_LEAD: 'Tiếp cận',
  O2_CONTACTED: 'Đã liên hệ',
  O3_TEST_SCHEDULED: 'Đặt lịch kiểm tra',
  O4_TESTED: 'Đã kiểm tra',
  O5_ENROLLED: 'Đã ghi danh',
};

const STAGE_COLOR: Record<string, string> = {
  O1_LEAD: 'gray',
  O2_CONTACTED: 'blue',
  O3_TEST_SCHEDULED: 'indigo',
  O4_TESTED: 'violet',
  O5_ENROLLED: 'green',
};

const LOST_REASON_LABELS: Record<string, string> = {
  no_response: 'Không phản hồi',
  price_too_high: 'Học phí quá cao',
  chose_competitor: 'Chọn đối thủ',
  schedule_conflict: 'Lịch học không phù hợp',
  not_interested: 'Không có nhu cầu',
  other: 'Lý do khác',
};

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // No opportunityGet endpoint — query full list and find by id client-side.
  // pageSize: 100 covers typical facility pipeline volume.
  const { data, isLoading, error } = trpc.crm.opportunityList.useQuery(
    { pageSize: 100 },
    { enabled: Boolean(id) },
  );

  if (isLoading) {
    return (
      <Stack align="center" py={64}>
        <Loader size="md" />
        <Text fz="sm" c="dimmed">
          Đang tải thông tin cơ hội...
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Box p="md">
        <Alert color="red" title="Lỗi tải dữ liệu">
          {error.message}
        </Alert>
      </Box>
    );
  }

  const opp = data?.items.find((item) => item.id === id);

  if (!opp) {
    return (
      <Box p="md">
        <Alert color="orange" title="Không tìm thấy cơ hội">
          Cơ hội không tồn tại hoặc bạn không có quyền truy cập.
        </Alert>
      </Box>
    );
  }

  const isLost = Boolean(opp.closedAt);
  const stageLabel = STAGE_LABELS[opp.stage] ?? opp.stage;
  const stageColor = STAGE_COLOR[opp.stage] ?? 'blue';

  return (
    <>
      <PageHeader
        title={opp.contact.name}
        subtitle={`Cơ hội — ${stageLabel}`}
        breadcrumbs={[
          { label: 'Kinh doanh' },
          { label: 'Pipeline CRM', href: '/crm' },
          { label: opp.contact.name },
        ]}
        actions={
          <Group gap="xs">
            {opp.stage === 'O4_TESTED' && !isLost && (
              <Button
                size="xs"
                radius="xs"
                color="green"
                onClick={() => void navigate(`/finance/new?opportunityId=${opp.id}`)}
              >
                Tạo phiếu thu
              </Button>
            )}
            <Button
              variant="default"
              size="xs"
              radius="xs"
              onClick={() => void navigate('/crm')}
            >
              ← Pipeline
            </Button>
          </Group>
        }
      />

      <Box p="md" maw={640}>
        <Stack gap="lg">
          {isLost && (
            <Alert color="red" title="Cơ hội đã đóng (Lost)">
              {opp.lostReason
                ? `Lý do: ${LOST_REASON_LABELS[opp.lostReason] ?? opp.lostReason}`
                : 'Không có lý do cụ thể'}
            </Alert>
          )}

          {/* Stage indicator */}
          <Group gap="sm" align="center">
            <Text fz="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>
              Giai đoạn hiện tại
            </Text>
            <Badge
              color={isLost ? 'red' : stageColor}
              variant="filled"
              style={
                !isLost && opp.stage !== 'O5_ENROLLED'
                  ? { background: 'var(--cmc-brand)' }
                  : undefined
              }
            >
              {isLost ? 'Lost' : stageLabel}
            </Badge>
          </Group>

          {/* Contact information */}
          <Box
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <Box
              px="md"
              py="sm"
              style={{
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
                Thông tin liên hệ
              </Text>
            </Box>
            <Box px="md" py="sm">
              <Grid gutter="md">
                <Grid.Col span={6}>
                  <Stack gap={3}>
                    <Text fz="xs" c="dimmed">
                      Họ tên
                    </Text>
                    <Text fz="sm" fw={500}>
                      {opp.contact.name}
                    </Text>
                  </Stack>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap={3}>
                    <Text fz="xs" c="dimmed">
                      Số điện thoại
                    </Text>
                    <Text fz="sm">{opp.contact.phone}</Text>
                  </Stack>
                </Grid.Col>
                {/* email is not included in opportunityList contact select — omitted */}
              </Grid>
            </Box>
          </Box>

          {/* Timeline summary */}
          <Box
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <Box
              px="md"
              py="sm"
              style={{
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
                Timeline
              </Text>
            </Box>
            <Stack gap={0}>
              {(['O1_LEAD', 'O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED', 'O5_ENROLLED'] as const).map(
                (stage, idx, arr) => {
                  const stageOrder = arr.indexOf(opp.stage as typeof arr[number]);
                  const done = idx <= stageOrder;
                  const isCurrent = opp.stage === stage;
                  return (
                    <Group
                      key={stage}
                      gap="sm"
                      px="md"
                      py="xs"
                      style={{
                        borderBottom:
                          idx < arr.length - 1 ? '1px solid var(--cmc-border)' : undefined,
                        background: isCurrent ? 'var(--cmc-brand-muted)' : undefined,
                      }}
                    >
                      <Box
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: done
                            ? isCurrent
                              ? 'var(--cmc-brand)'
                              : 'var(--cmc-success)'
                            : 'var(--cmc-border)',
                        }}
                      />
                      <Text
                        fz="sm"
                        fw={isCurrent ? 600 : 400}
                        c={isCurrent ? 'var(--cmc-brand)' : done ? undefined : 'dimmed'}
                      >
                        {STAGE_LABELS[stage]}
                      </Text>
                    </Group>
                  );
                },
              )}
              {isLost && (
                <Group gap="sm" px="md" py="xs">
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--cmc-danger)',
                      flexShrink: 0,
                    }}
                  />
                  <Text fz="sm" fw={600} c="red">
                    Đã đóng (Lost)
                  </Text>
                </Group>
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </>
  );
}
