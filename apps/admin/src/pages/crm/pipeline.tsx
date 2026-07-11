import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, FunnelBar, HStack, LineIcon, PageHeader, Panel, Skeleton, Stack, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// Stage metadata — O5 is reached only via finance.receiptApprove, never via
// opportunityAdvance. Single local source of truth for label + ordering
// (DRY-light: kept local per phase-03, not lifted into @cmc/ui since only
// this page needs the `next` transition alongside the label).
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

function OpportunityCard({
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
        borderBottom: '1px solid var(--cmc-border-subtle)',
        padding: '10px 22px',
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
            label="Chuyển lên"
            endContent={<LineIcon name="chevron" size={12} />}
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

  // Load all opportunities across all stages (large pageSize — dashboard shows all).
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

  const items = (data?.items ?? []) as OpportunityItem[];

  // Group opportunities by stage.
  const byStage = new Map<StageKey, OpportunityItem[]>(
    STAGES.map((s) => [s.key, []]),
  );
  for (const item of items) {
    const bucket = byStage.get(item.stage as StageKey);
    if (bucket) bucket.push(item);
  }
  const maxCount = Math.max(1, ...STAGES.map((s) => byStage.get(s.key)?.length ?? 0));

  const ready = !isLoading && !error;

  return (
    <>
      <PageHeader
        title="Pipeline CRM"
        subtitle="Theo dõi cơ hội từ Tiếp cận đến Ghi danh"
        breadcrumbs={[{ label: 'Kinh doanh' }, { label: 'Pipeline CRM' }]}
      />
      <Stack gap={5} padding={4}>
        <Panel title="Pipeline O1 → O5" icon="filter">
          {isLoading ? (
            <div style={{ padding: '0 22px 20px' }}>
              <Skeleton height={120} radius={0} data-testid="crm-pipeline-skeleton" />
            </div>
          ) : error ? (
            <div className="ck-empty">
              <span className="ck-empty-icon"><LineIcon name="alert" size={22} /></span>
              {error.message || 'Lỗi tải pipeline CRM'}
            </div>
          ) : (
            <div className="ck-fn">
              {STAGES.map((stage) => (
                <FunnelBar
                  key={stage.key}
                  label={stage.label}
                  value={byStage.get(stage.key)?.length ?? 0}
                  max={maxCount}
                />
              ))}
            </div>
          )}
        </Panel>

        {ready && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            {STAGES.map((stage) => {
              const stageItems = byStage.get(stage.key) ?? [];
              return (
                <Panel key={stage.key} title={`${stage.label} · ${stageItems.length}`}>
                  {stageItems.length === 0 ? (
                    <div className="ck-empty">Chưa có</div>
                  ) : (
                    <div>
                      {stageItems.map((opp) => (
                        <OpportunityCard
                          key={opp.id}
                          opp={opp}
                          nextStage={stage.next as AdvanceableStage | null}
                          onAdvance={handleAdvance}
                          advancing={advancingId === opp.id}
                        />
                      ))}
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </Stack>
    </>
  );
}
