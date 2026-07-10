import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Banner, Button, HStack, PageHeader, Spinner, Stack, Text } from '@cmc/ui';
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
  closedAt: string | null;
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
    <div
      style={{
        background: 'var(--cmc-surface)',
        border: '1px solid var(--cmc-border)',
        borderRadius: 'var(--cmc-radius-xs)',
        padding: '10px 12px',
        cursor: 'pointer',
      }}
      onClick={() => void navigate(`/crm/opportunities/${opp.id}`)}
    >
      <Stack gap={1.5}>
        <HStack justify="between" align="start">
          <Text size="sm" weight="semibold" maxLines={1} style={{ color: 'var(--cmc-text)' }}>
            {opp.contact.name}
          </Text>
          {isLost && <Badge label="Lost" variant="error" />}
        </HStack>
        <Text type="supporting" size="xsm">
          {opp.contact.phone}
        </Text>

        {nextStage && !isLost && (
          <Button
            label="Chuyển lên →"
            size="sm"
            variant="secondary"
            isLoading={advancing}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance(opp.id, nextStage);
            }}
          />
        )}

        {opp.stage === 'O4_TESTED' && !isLost && (
          <Button
            label="Ghi danh"
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              void navigate(`/finance/new?opportunityId=${opp.id}`);
            }}
          />
        )}
      </Stack>
    </div>
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
      <Stack hAlign="center" gap={2} style={{ paddingBlock: 64 }}>
        <Spinner size="md" />
        <Text type="supporting" size="sm">
          Đang tải pipeline CRM...
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <Banner status="error" title="Lỗi tải pipeline" description={error.message} />
      </div>
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
      {/* Astryx has no dedicated scroll-container primitive (confirmed 0 direct
          equivalent in the Phase 1 spike — ScrollArea gap) — native CSS
          overflow replaces the prior ScrollArea, same visual result. */}
      <div style={{ height: 'calc(100vh - 90px)', overflow: 'auto' }}>
        <HStack
          gap={4}
          align="start"
          wrap="nowrap"
          style={{ paddingInline: 16, paddingBlock: 16, minWidth: 960 }}
        >
          {STAGES.map((stage) => {
            const stageItems = byStage.get(stage.key) ?? [];
            const hasItems = stageItems.length > 0;

            return (
              <div
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
                <div
                  style={{
                    paddingInline: 12,
                    paddingBlock: 8,
                    borderBottom: '1px solid var(--cmc-border)',
                    background: hasItems ? 'var(--cmc-brand-muted)' : undefined,
                    borderRadius: 'var(--cmc-radius-xs) var(--cmc-radius-xs) 0 0',
                  }}
                >
                  <HStack justify="between" align="center">
                    {/* TODO(astryx-review): stage label color is brand-blue when
                        active vs. a muted text token when empty — both CSS vars,
                        no raw hex, but Text's color enum has no direct
                        "brand"/"muted" slot distinct from primary/secondary, so
                        this stays a plain <span> like StatCard's value line. */}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: hasItems ? 'var(--cmc-brand)' : 'var(--cmc-text-muted)',
                      }}
                    >
                      {stage.label}
                    </span>
                    <Badge
                      label={String(stageItems.length)}
                      variant="neutral"
                      style={{
                        background: hasItems ? 'var(--cmc-brand)' : 'var(--cmc-border)',
                        color: hasItems ? '#fff' : 'var(--cmc-text-muted)',
                      }}
                    />
                  </HStack>
                </div>

                <Stack gap={2} padding={1}>
                  {stageItems.length === 0 ? (
                    <Text type="supporting" size="xsm" justify="center" display="block" style={{ paddingBlock: 8 }}>
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
              </div>
            );
          })}
        </HStack>
      </div>
    </>
  );
}
