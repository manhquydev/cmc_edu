import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Box, Button, Group, Loader, ScrollArea, Stack, Text } from '@mantine/core';
import { PageHeader } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// Stage metadata — O5 is reached only via finance.receiptApprove, never via opportunityAdvance.
const STAGES = [
  { key: 'O1_LEAD', label: 'Tiếp cận', next: 'O2_CONTACTED' as const },
  { key: 'O2_CONTACTED', label: 'Đã liên hệ', next: 'O3_TEST_SCHEDULED' as const },
  { key: 'O3_TEST_SCHEDULED', label: 'Đặt lịch kiểm tra', next: 'O4_TESTED' as const },
  { key: 'O4_TESTED', label: 'Đã kiểm tra', next: null },
  { key: 'O5_ENROLLED', label: 'Đã ghi danh', next: null },
] as const;

type StageKey = (typeof STAGES)[number]['key'];
type AdvanceableStage = 'O2_CONTACTED' | 'O3_TEST_SCHEDULED' | 'O4_TESTED';

interface OpportunityItem {
  id: string;
  stage: string;
  closedAt: Date | null;
  contact: { id: string; name: string; phone: string };
}

function KanbanCard({
  opp,
  nextStage,
  onAdvance,
  advancing,
}: {
  opp: OpportunityItem;
  nextStage: AdvanceableStage | null;
  onAdvance: (id: string, toStage: AdvanceableStage) => void;
  advancing: boolean;
}) {
  const navigate = useNavigate();
  const isLost = Boolean(opp.closedAt);

  return (
    <Box
      style={{
        background: 'var(--cmc-surface)',
        border: '1px solid var(--cmc-border)',
        borderRadius: 'var(--cmc-radius-xs)',
        padding: '10px 12px',
        cursor: 'pointer',
      }}
      onClick={() => void navigate(`/crm/opportunities/${opp.id}`)}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start">
          <Text fz="sm" fw={600} style={{ color: 'var(--cmc-text)' }} lineClamp={1}>
            {opp.contact.name}
          </Text>
          {isLost && (
            <Badge color="red" variant="light" size="xs">
              Lost
            </Badge>
          )}
        </Group>
        <Text fz="xs" c="dimmed">
          {opp.contact.phone}
        </Text>

        {nextStage && !isLost && (
          <Button
            size="xs"
            variant="light"
            radius="xs"
            loading={advancing}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance(opp.id, nextStage);
            }}
          >
            Chuyển lên →
          </Button>
        )}

        {/* O4_TESTED: advance to O5 is only via receipt — show quick-create shortcut. */}
        {opp.stage === 'O4_TESTED' && !isLost && (
          <Button
            size="xs"
            variant="light"
            color="green"
            radius="xs"
            onClick={(e) => {
              e.stopPropagation();
              void navigate(`/finance/new?opportunityId=${opp.id}`);
            }}
          >
            Tạo phiếu thu
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default function CrmPipelinePage() {
  const utils = trpc.useUtils();
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  // Load all opportunities across all stages (large pageSize — kanban shows all).
  const { data, isLoading, error } = trpc.crm.opportunityList.useQuery({ pageSize: 100 });

  const advanceMutation = trpc.crm.opportunityAdvance.useMutation({
    onMutate: async ({ opportunityId, toStage }) => {
      // Optimistic update: move the opportunity to the new stage before the server confirms.
      await utils.crm.opportunityList.cancel({ pageSize: 100 });
      const prev = utils.crm.opportunityList.getData({ pageSize: 100 });
      if (prev) {
        utils.crm.opportunityList.setData({ pageSize: 100 }, {
          ...prev,
          items: prev.items.map((item) =>
            item.id === opportunityId ? { ...item, stage: toStage } : item,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback to previous state on error.
      if (ctx?.prev) {
        utils.crm.opportunityList.setData({ pageSize: 100 }, ctx.prev);
      }
    },
    onSettled: () => {
      void utils.crm.opportunityList.invalidate();
    },
  });

  function handleAdvance(opportunityId: string, toStage: AdvanceableStage) {
    setAdvancingId(opportunityId);
    advanceMutation.mutate(
      { opportunityId, toStage },
      { onSettled: () => setAdvancingId(null) },
    );
  }

  if (isLoading) {
    return (
      <Stack align="center" py={64}>
        <Loader size="md" />
        <Text fz="sm" c="dimmed">
          Đang tải pipeline CRM...
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Box p="md">
        <Alert color="red" title="Lỗi tải pipeline">
          {error.message}
        </Alert>
      </Box>
    );
  }

  const items = (data?.items ?? []) as OpportunityItem[];

  // Group opportunities by stage.
  const byStage = new Map<StageKey, OpportunityItem[]>(
    STAGES.map((s) => [s.key, []]),
  );
  for (const item of items) {
    const bucket = byStage.get(item.stage as StageKey);
    if (bucket) bucket.push(item);
  }

  return (
    <>
      <PageHeader
        title="Pipeline CRM"
        subtitle="Theo dõi cơ hội từ Tiếp cận đến Ghi danh"
        breadcrumbs={[{ label: 'Kinh doanh' }, { label: 'Pipeline CRM' }]}
      />
      <ScrollArea style={{ height: 'calc(100vh - 90px)' }}>
        <Group
          gap="md"
          align="flex-start"
          px="md"
          py="md"
          style={{ flexWrap: 'nowrap', minWidth: 960 }}
        >
          {STAGES.map((stage) => {
            const stageItems = byStage.get(stage.key) ?? [];
            const hasItems = stageItems.length > 0;

            return (
              <Box
                key={stage.key}
                style={{
                  width: 220,
                  flexShrink: 0,
                  background: 'var(--cmc-surface-2)',
                  borderRadius: 'var(--cmc-radius-xs)',
                  border: '1px solid var(--cmc-border)',
                }}
              >
                {/* Column header — active stage uses brand blue per docs/12 §3. */}
                <Box
                  px="sm"
                  py="xs"
                  style={{
                    borderBottom: '1px solid var(--cmc-border)',
                    background: hasItems ? 'var(--cmc-brand-muted)' : undefined,
                    borderRadius: 'var(--cmc-radius-xs) var(--cmc-radius-xs) 0 0',
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Text
                      fz="xs"
                      fw={700}
                      tt="uppercase"
                      style={{
                        letterSpacing: '0.05em',
                        // Stage with cards = brand blue; empty = muted.
                        color: hasItems ? 'var(--cmc-brand)' : 'var(--cmc-text-muted)',
                      }}
                    >
                      {stage.label}
                    </Text>
                    <Badge
                      size="xs"
                      variant="filled"
                      style={{
                        background: hasItems ? 'var(--cmc-brand)' : 'var(--cmc-border)',
                        color: hasItems ? '#fff' : 'var(--cmc-text-muted)',
                      }}
                    >
                      {stageItems.length}
                    </Badge>
                  </Group>
                </Box>

                <Stack gap="xs" p="xs">
                  {stageItems.length === 0 ? (
                    <Text fz="xs" c="dimmed" ta="center" py="sm">
                      Chưa có
                    </Text>
                  ) : (
                    stageItems.map((opp) => (
                      <KanbanCard
                        key={opp.id}
                        opp={opp}
                        nextStage={stage.next as AdvanceableStage | null}
                        onAdvance={handleAdvance}
                        advancing={advancingId === opp.id}
                      />
                    ))
                  )}
                </Stack>
              </Box>
            );
          })}
        </Group>
      </ScrollArea>
    </>
  );
}
