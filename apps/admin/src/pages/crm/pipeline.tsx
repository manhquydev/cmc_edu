import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { links } from '@cmc/links';
import { Badge, Button, FunnelBar, HStack, LineIcon, ListPage, PageHeader, Panel, Selector, Skeleton, Stack, Text, TextInput } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { formatContactPhone } from '../../lib/format-contact-phone.js';
import { CreateLeadDialog } from './create-lead-dialog.js';
import { MarkLostDialog } from './mark-lost-dialog.js';
import { ScheduleTestDialog } from './schedule-test-dialog.js';

// Server-side page size for the flat opportunity list (F7 fix — the funnel
// used to be computed by counting a hard pageSize:100 fetch, which silently
// under-counted once a facility passed 100 open opportunities). 20 matches
// the `crm.opportunityList` input default.
const PAGE_SIZE = 20;

type LostVisibility = 'exclude' | 'include' | 'only';

const LOST_FILTER_OPTIONS: { value: LostVisibility; label: string }[] = [
  { value: 'exclude', label: 'Đang chăm sóc' },
  { value: 'include', label: 'Tất cả' },
  { value: 'only', label: 'Đã mất' },
];

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
  lostReason?: string;
  contact: { id: string; name: string; phone: string };
  source?: string | null;
  assignedTo?: { userId: string; fullName: string } | null;
}

// Owner-badge initials — first letter of the first word + first letter of
// the last word (e.g. "Nguyễn Văn A" -> "NA"), matching how initials avatars
// are conventionally derived from a Vietnamese full name.
function getOwnerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function OpportunityCard({
  opp,
  nextStage,
  onAdvance,
  advancing,
  onMarkLost,
  onScheduleTest,
}: {
  opp: OpportunityItem;
  nextStage: AdvanceableStage | null;
  onAdvance: (id: string, toStage: AdvanceableStage) => void;
  advancing: boolean;
  onMarkLost: (id: string) => void;
  onScheduleTest: (id: string) => void;
}) {
  const navigate = useNavigate();
  // A won (O5) opportunity also carries a `closedAt` (the enrollment instant)
  // — only a closedAt WITHOUT O5 is a genuine loss (matches the backend's
  // `isOpportunityLost`/`LOST_WHERE` fragment in apps/api/src/crm/router.ts).
  const isLost = Boolean(opp.closedAt) && opp.stage !== 'O5_ENROLLED';
  const canMarkLost = !isLost && opp.stage !== 'O5_ENROLLED';
  // testAppointment.schedule (apps/api/src/appointment/router.ts) only
  // accepts an opp at O2_CONTACTED or O3_TEST_SCHEDULED, and rejects a
  // lost opp — mirrored here so the action only appears when it would succeed.
  const canScheduleTest =
    !isLost && (opp.stage === 'O2_CONTACTED' || opp.stage === 'O3_TEST_SCHEDULED');

  return (
    <div
      style={{
        background: 'var(--cmc-surface)',
        borderBottom: '1px solid var(--cmc-border-subtle)',
        padding: '10px var(--cmc-keyline-x)',
        cursor: 'pointer',
      }}
      onClick={() => void navigate(links.opportunity(opp.id))}
    >
      <Stack gap={1.5}>
        <HStack justify="between" align="start">
          <Text size="sm" weight="semibold" maxLines={1} style={{ color: 'var(--cmc-text)' }}>
            {opp.contact.name}
          </Text>
          {isLost && <Badge label="Lost" variant="error" />}
        </HStack>
        <HStack justify="between" align="center">
          <Text type="supporting" size="xsm">
            {formatContactPhone(opp.contact.phone)}
          </Text>
          {opp.assignedTo ? (
            <div
              title={opp.assignedTo.fullName}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--cmc-brand-muted)',
                color: 'var(--cmc-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {getOwnerInitials(opp.assignedTo.fullName)}
            </div>
          ) : (
            <Text type="supporting" size="xsm" style={{ fontStyle: 'italic' }}>
              Chưa giao
            </Text>
          )}
        </HStack>

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

        {canScheduleTest && (
          <Button
            label="Đặt lịch test"
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onScheduleTest(opp.id);
            }}
          />
        )}

        {canMarkLost && (
          <Button
            label="Đánh dấu mất"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onMarkLost(opp.id);
            }}
          />
        )}
      </Stack>
    </div>
  );
}

export default function CrmPipelinePage() {
  const utils = trpc.useUtils();
  const [searchParams] = useSearchParams();
  const stageFromUrl = searchParams.get('stage');
  const stageFilter =
    stageFromUrl && STAGES.some((s) => s.key === stageFromUrl)
      ? (stageFromUrl as (typeof STAGES)[number]['key'])
      : undefined;

  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [markLostId, setMarkLostId] = useState<string | null>(null);
  const [scheduleTestId, setScheduleTestId] = useState<string | null>(null);

  // Debounced (~300ms) server-side search over contact name/phone.
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [lostFilter, setLostFilter] = useState<LostVisibility>('exclude');
  const [page, setPage] = useState(1);

  // Changing the search term or the lost-visibility filter narrows/widens the
  // result set — restart pagination at page 1 so the user isn't stranded on
  // a now-out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, lostFilter, stageFilter]);

  // Single source of truth for the current query input — reused by the
  // optimistic-advance mutation's cancel/getData/setData calls below so they
  // always target the SAME react-query cache key as the active query, even
  // as `search`/`lost`/`page` change the key.
  const listInput = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(stageFilter ? { stage: stageFilter } : {}),
    lost: lostFilter,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, error } = trpc.crm.opportunityList.useQuery(listInput);

  const advanceMutation = trpc.crm.opportunityAdvance.useMutation({
    onMutate: async ({ opportunityId, toStage }) => {
      // Optimistic update: move the opportunity to the new stage before the server confirms.
      await utils.crm.opportunityList.cancel(listInput);
      const prev = utils.crm.opportunityList.getData(listInput);
      if (prev) {
        utils.crm.opportunityList.setData(listInput, {
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
        utils.crm.opportunityList.setData(listInput, ctx.prev);
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

  // Group the current page's opportunities by stage — for CARD PLACEMENT
  // only. Counts shown to the user (funnel bars, per-stage panel headers)
  // come from the server-aggregated `stageCounts`/`lostCount` below, NOT
  // from these buckets — a page-scoped `.length` silently under/over-counts
  // once results span more than one page (the F7 bug this phase fixes).
  const byStage = new Map<StageKey, OpportunityItem[]>(
    STAGES.map((s) => [s.key, []]),
  );
  for (const item of items) {
    const bucket = byStage.get(item.stage as StageKey);
    if (bucket) bucket.push(item);
  }

  const stageCounts = data?.stageCounts ?? {};
  const lostCount = data?.lostCount ?? 0;
  const maxCount = Math.max(1, ...STAGES.map((s) => stageCounts[s.key] ?? 0));

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const ready = !isLoading && !error;

  // Stage columns always exist (O1→O5). Never set isEmpty — ListPage would
  // hide the FunnelBar + kanban board behind a page-level empty state.
  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Pipeline CRM"
            breadcrumbs={[{ label: 'Kinh doanh' }, { label: 'Pipeline CRM' }]}
            actions={
              <HStack gap={2} align="center">
                <div style={{ width: 220 }}>
                  <TextInput
                    label="Tìm kiếm"
                    isLabelHidden
                    placeholder="Tìm theo tên hoặc SĐT…"
                    value={searchTerm}
                    onChange={setSearchTerm}
                    hasClear
                    size="sm"
                    startIcon={<LineIcon name="search" size={14} />}
                  />
                </div>
                <Button
                  label="Thêm cơ hội"
                  size="sm"
                  variant="primary"
                  endContent={<LineIcon name="plus" size={14} />}
                  onClick={() => setCreateOpen(true)}
                />
              </HStack>
            }
          />
        }
        filters={
          <HStack gap={2} align="center" style={{ padding: '0 var(--cmc-keyline-x)' }}>
            <Text type="supporting" size="sm">
              Hiển thị:
            </Text>
            <div style={{ width: 180 }}>
              <Selector
                label="Hiển thị cơ hội đã mất"
                isLabelHidden
                value={lostFilter}
                onChange={(v) => setLostFilter(v as LostVisibility)}
                options={LOST_FILTER_OPTIONS}
                size="sm"
              />
            </div>
          </HStack>
        }
      >
        <Stack gap={5}>
          <Panel title="Pipeline O1 → O5" icon="filter">
            {isLoading ? (
              <div style={{ padding: '0 var(--cmc-keyline-x) 20px' }}>
                <Skeleton height={120} radius={0} data-testid="crm-pipeline-skeleton" />
              </div>
            ) : error ? (
              <div className="ck-empty">
                <span className="ck-empty-icon"><LineIcon name="alert" size={22} /></span>
                {error.message || 'Lỗi tải pipeline CRM'}
              </div>
            ) : (
              <>
                <div className="ck-fn">
                  {STAGES.map((stage) => (
                    <FunnelBar
                      key={stage.key}
                      label={stage.label}
                      value={stageCounts[stage.key] ?? 0}
                      max={maxCount}
                    />
                  ))}
                </div>
                <div style={{ padding: '0 var(--cmc-keyline-x) 18px' }}>
                  <Text type="supporting" size="xsm">
                    {lostCount} cơ hội đã mất
                  </Text>
                </div>
              </>
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
                  <Panel key={stage.key} title={`${stage.label} · ${stageCounts[stage.key] ?? 0}`}>
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
                            onMarkLost={setMarkLostId}
                            onScheduleTest={setScheduleTestId}
                          />
                        ))}
                      </div>
                    )}
                  </Panel>
                );
              })}
            </div>
          )}

          {ready && (
            <HStack justify="between" align="center">
              <Text type="supporting" size="xsm">
                Trang {page}/{totalPages} — {total} cơ hội
              </Text>
              <HStack gap={1}>
                <Button
                  label="Trang trước"
                  size="sm"
                  variant="secondary"
                  isDisabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
                <Button
                  label="Trang sau"
                  size="sm"
                  variant="secondary"
                  isDisabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              </HStack>
            </HStack>
          )}
        </Stack>
      </ListPage>

      <CreateLeadDialog opened={createOpen} onClose={() => setCreateOpen(false)} />
      <MarkLostDialog opportunityId={markLostId} onClose={() => setMarkLostId(null)} />
      <ScheduleTestDialog opportunityId={scheduleTestId} onClose={() => setScheduleTestId(null)} />
    </>
  );
}
