import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Banner, Button, Grid, HStack, PageHeader, Spinner, Stack, Text } from '@cmc/ui';
import type { ComponentProps } from 'react';
import { trpc } from '../../lib/trpc.js';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

const STAGE_LABELS: Record<string, string> = {
  O1_LEAD: 'Tiếp cận',
  O2_CONTACTED: 'Đã liên hệ',
  O3_TEST_SCHEDULED: 'Đặt lịch kiểm tra',
  O4_TESTED: 'Đã kiểm tra',
  O5_ENROLLED: 'Đã ghi danh',
};

// Astryx Badge has no 'indigo' variant — approximated onto 'purple' (closest
// hue in the fixed palette), matching the same class of approximation
// already accepted for ConfirmDialog's color mapping.
const STAGE_COLOR: Record<string, BadgeVariant> = {
  O1_LEAD: 'neutral',
  O2_CONTACTED: 'blue',
  O3_TEST_SCHEDULED: 'purple',
  O4_TESTED: 'purple',
  O5_ENROLLED: 'success',
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
      <Stack hAlign="center" gap={2} style={{ paddingBlock: 64 }}>
        <Spinner size="md" />
        <Text type="supporting" size="sm">
          Đang tải thông tin cơ hội...
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
      </div>
    );
  }

  const opp = data?.items.find((item) => item.id === id);

  if (!opp) {
    return (
      <div style={{ padding: 16 }}>
        <Banner status="warning" title="Không tìm thấy cơ hội" description="Cơ hội không tồn tại hoặc bạn không có quyền truy cập." />
      </div>
    );
  }

  const isLost = Boolean(opp.closedAt);
  const stageLabel = STAGE_LABELS[opp.stage] ?? opp.stage;
  const stageVariant = STAGE_COLOR[opp.stage] ?? 'blue';

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
          <HStack gap={2}>
            {opp.stage === 'O4_TESTED' && !isLost && (
              <Button
                label="Tạo phiếu thu"
                variant="primary"
                size="sm"
                onClick={() => void navigate(`/finance/new?opportunityId=${opp.id}`)}
              />
            )}
            <Button
              label="← Pipeline"
              variant="secondary"
              size="sm"
              onClick={() => void navigate('/crm')}
            />
          </HStack>
        }
      />

      <div style={{ padding: 16, maxWidth: 640 }}>
        <Stack gap={5}>
          {isLost && (
            <Banner
              status="error"
              title="Cơ hội đã đóng (Lost)"
              description={
                opp.lostReason
                  ? `Lý do: ${LOST_REASON_LABELS[opp.lostReason] ?? opp.lostReason}`
                  : 'Không có lý do cụ thể'
              }
            />
          )}

          {/* Stage indicator */}
          <HStack gap={3} align="center">
            <Text
              type="supporting"
              size="xsm"
              weight="semibold"
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Giai đoạn hiện tại
            </Text>
            <Badge
              label={isLost ? 'Lost' : stageLabel}
              variant={isLost ? 'error' : stageVariant}
              style={
                !isLost && opp.stage !== 'O5_ENROLLED'
                  ? { background: 'var(--cmc-brand)', color: '#fff' }
                  : undefined
              }
            />
          </HStack>

          {/* Contact information */}
          <div
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                paddingInline: 16,
                paddingBlock: 8,
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text
                type="supporting"
                size="xsm"
                weight="semibold"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Thông tin liên hệ
              </Text>
            </div>
            <div style={{ paddingInline: 16, paddingBlock: 8 }}>
              <Grid columns={2} gap={4}>
                <Stack gap={0.5}>
                  <Text type="supporting" size="xsm">
                    Họ tên
                  </Text>
                  <Text size="sm" weight="medium">
                    {opp.contact.name}
                  </Text>
                </Stack>
                <Stack gap={0.5}>
                  <Text type="supporting" size="xsm">
                    Số điện thoại
                  </Text>
                  <Text size="sm">{opp.contact.phone}</Text>
                </Stack>
                {/* email is not included in opportunityList contact select — omitted */}
              </Grid>
            </div>
          </div>

          {/* Timeline summary */}
          <div
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                paddingInline: 16,
                paddingBlock: 8,
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text
                type="supporting"
                size="xsm"
                weight="semibold"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Timeline
              </Text>
            </div>
            <Stack gap={0}>
              {(['O1_LEAD', 'O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED', 'O5_ENROLLED'] as const).map(
                (stage, idx, arr) => {
                  const stageOrder = arr.indexOf(opp.stage as typeof arr[number]);
                  const done = idx <= stageOrder;
                  const isCurrent = opp.stage === stage;
                  // TODO(astryx-review): Astryx Text's `color` prop is a fixed
                  // semantic enum (primary/secondary/disabled/placeholder/accent/
                  // inherit) with no raw-CSS-var escape hatch, but this line needs
                  // the brand-blue token specifically for the "current" step — kept
                  // as a plain <span style> like StatCard's value line, per the
                  // documented fallback for arbitrary-color Text usages.
                  const stepColor = isCurrent
                    ? 'var(--cmc-brand)'
                    : done
                      ? 'var(--cmc-text)'
                      : 'var(--cmc-text-muted)';
                  return (
                    <HStack
                      key={stage}
                      gap={3}
                      style={{
                        paddingInline: 16,
                        paddingBlock: 8,
                        borderBottom:
                          idx < arr.length - 1 ? '1px solid var(--cmc-border)' : undefined,
                        background: isCurrent ? 'var(--cmc-brand-muted)' : undefined,
                      }}
                    >
                      <div
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
                      <span style={{ fontSize: 14, fontWeight: isCurrent ? 600 : 400, color: stepColor }}>
                        {STAGE_LABELS[stage]}
                      </span>
                    </HStack>
                  );
                },
              )}
              {isLost && (
                <HStack gap={3} style={{ paddingInline: 16, paddingBlock: 8 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--cmc-danger)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cmc-danger)' }}>
                    Đã đóng (Lost)
                  </span>
                </HStack>
              )}
            </Stack>
          </div>
        </Stack>
      </div>
    </>
  );
}
