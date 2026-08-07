import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { links } from '@cmc/links';
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  FunnelBar,
  HStack,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  LineIcon,
  ListPage,
  PageHeader,
  Panel,
  Skeleton,
  Stack,
  Text,
  type FilterDef,
  type TableColumn,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { formatContactPhone } from '../../lib/format-contact-phone.js';
import { CreateLeadDialog, SOURCE_LABELS } from './create-lead-dialog.js';
import { MarkLostDialog } from './mark-lost-dialog.js';
import { ScheduleTestDialog } from './schedule-test-dialog.js';

// Server-side page size for the flat opportunity list (F7 fix — the funnel
// used to be computed by counting a hard pageSize:100 fetch, which silently
// under-counted once a facility passed 100 open opportunities). 20 matches
// the `crm.opportunityList` input default.
const PAGE_SIZE = 20;

type LostVisibility = 'exclude' | 'include' | 'only';
/** TL6: `?view=table|kanban` — default kanban preserves current ops habit. */
type PipelineView = 'kanban' | 'table';

const LOST_FILTER_OPTIONS: { value: LostVisibility; label: string }[] = [
  { value: 'exclude', label: 'Đang chăm sóc' },
  { value: 'include', label: 'Tất cả' },
  { value: 'only', label: 'Đã mất' },
];

const PIPELINE_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tìm theo tên hoặc SĐT…',
  },
  {
    key: 'lost',
    label: 'Hiển thị',
    type: 'select',
    options: LOST_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    // Default domain is exclude (active care). Clearing would snap back via
    // `|| 'exclude'` and feel broken — hide clear; pick “Tất cả” (include) explicitly.
    placeholder: 'Đang chăm sóc',
    hasClear: false,
  },
];

// Stage metadata — O5 is reached only via finance.receiptApprove, never via
// opportunityAdvance. Single local source of truth for label + ordering
// (DRY-light: kept local per phase-03, not lifted into @cmc/ui since only
// this page needs the `next` transition alongside the label).
const STAGES = [
  { key: 'O1_LEAD', label: 'Tiếp cận', next: 'O2_CONTACTED' as const, color: 1 as const },
  { key: 'O2_CONTACTED', label: 'Đã liên hệ', next: 'O3_TEST_SCHEDULED' as const, color: 3 as const },
  { key: 'O3_TEST_SCHEDULED', label: 'Đặt lịch kiểm tra', next: 'O4_TESTED' as const, color: 4 as const },
  { key: 'O4_TESTED', label: 'Đã kiểm tra', next: null, color: 5 as const },
  { key: 'O5_ENROLLED', label: 'Đã ghi danh', next: null, color: 6 as const },
] as const;

type StageKey = (typeof STAGES)[number]['key'];
type AdvanceableStage = 'O2_CONTACTED' | 'O3_TEST_SCHEDULED' | 'O4_TESTED';

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
);

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

function isLostOpp(opp: OpportunityItem): boolean {
  // A won (O5) opportunity also carries a `closedAt` (the enrollment instant)
  // — only a closedAt WITHOUT O5 is a genuine loss (matches the backend's
  // `isOpportunityLost`/`LOST_WHERE` fragment in apps/api/src/crm/router.ts).
  return Boolean(opp.closedAt) && opp.stage !== 'O5_ENROLLED';
}

function OpportunityKanbanCard({
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
  const lost = isLostOpp(opp);
  const canMarkLost = !lost && opp.stage !== 'O5_ENROLLED';
  const canScheduleTest =
    !lost && (opp.stage === 'O2_CONTACTED' || opp.stage === 'O3_TEST_SCHEDULED');
  const stageMeta = STAGES.find((s) => s.key === opp.stage);
  const colorIndex = lost ? 2 : (stageMeta?.color ?? 1);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void navigate(links.opportunity(opp.id))}
      onKeyDown={(e) => {
        // Only when the card shell itself is focused — descendant buttons
        // (advance / enroll / lost) must not bubble Enter/Space into navigate.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void navigate(links.opportunity(opp.id));
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <KanbanCard
        title={
          <HStack justify="between" align="start" gap={1}>
            <span>{opp.contact.name}</span>
            {lost ? <Badge label="Lost" variant="error" /> : null}
          </HStack>
        }
        subtitle={formatContactPhone(opp.contact.phone)}
        footer={opp.assignedTo ? opp.assignedTo.fullName : 'Chưa giao'}
        colorIndex={colorIndex}
      >
        <Stack gap={1} style={{ marginTop: 8 }}>
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
              }}
            >
              {getOwnerInitials(opp.assignedTo.fullName)}
            </div>
          ) : null}

          {nextStage && !lost && (
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

          {opp.stage === 'O4_TESTED' && !lost && (
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
      </KanbanCard>
    </div>
  );
}

export default function CrmPipelinePage() {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const stageFromUrl = searchParams.get('stage');
  const stageFilter =
    stageFromUrl && STAGES.some((s) => s.key === stageFromUrl)
      ? (stageFromUrl as (typeof STAGES)[number]['key'])
      : undefined;

  const rawView = searchParams.get('view');
  const view: PipelineView = rawView === 'table' ? 'table' : 'kanban';

  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [markLostId, setMarkLostId] = useState<string | null>(null);
  const [scheduleTestId, setScheduleTestId] = useState<string | null>(null);

  // Controlled FilterBar: search + lost visibility (G1 list chrome).
  const [filterValues, setFilterValues] = useState({ q: '', lost: 'exclude' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filterValues.q.trim()), 300);
    return () => clearTimeout(timer);
  }, [filterValues.q]);

  const lostFilter = (['exclude', 'include', 'only'].includes(filterValues.lost)
    ? filterValues.lost
    : 'exclude') as LostVisibility;
  const [page, setPage] = useState(1);

  // Changing the search term or the lost-visibility filter narrows/widens the
  // result set — restart pagination at page 1 so the user isn't stranded on
  // a now-out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, lostFilter, stageFilter]);

  // Single source of truth for the current query input — shared by kanban and
  // list views (Phase 4: no independent sort/page per view). Optimistic
  // advance targets this same cache key.
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

  function setView(next: PipelineView) {
    const params = new URLSearchParams(searchParams);
    if (next === 'kanban') {
      // Default — keep URLs short when on the primary ops view.
      params.delete('view');
    } else {
      params.set('view', next);
    }
    setSearchParams(params, { replace: true });
  }

  const items = (data?.items ?? []) as OpportunityItem[];

  // Group the current page's opportunities by stage — for CARD PLACEMENT
  // only. Counts shown to the user (funnel bars, per-stage panel headers)
  // come from the server-aggregated `stageCounts`/`lostCount` below, NOT
  // from these buckets — a page-scoped `.length` silently under/over-counts
  // once results span more than one page (the F7 bug this phase fixes).
  const byStage = new Map<StageKey, OpportunityItem[]>(STAGES.map((s) => [s.key, []]));
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

  const listColumns: TableColumn<OpportunityItem & Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'Học viên',
        render: (_v, row) => row.contact.name,
      },
      {
        key: 'phone',
        label: 'SĐT',
        render: (_v, row) => formatContactPhone(row.contact.phone),
      },
      {
        key: 'stage',
        label: 'Giai đoạn',
        render: (_v, row) => {
          if (isLostOpp(row)) return 'Lost';
          return STAGE_LABEL[row.stage] ?? row.stage;
        },
      },
      {
        key: 'owner',
        label: 'Phụ trách',
        render: (_v, row) => row.assignedTo?.fullName ?? 'Chưa giao',
      },
      {
        key: 'source',
        label: 'Nguồn',
        render: (_v, row) =>
          row.source ? (SOURCE_LABELS[row.source] ?? row.source) : '—',
      },
    ],
    [],
  );

  // Stage columns always exist (O1→O5). Never set isEmpty — ListPage would
  // hide the FunnelBar + board behind a page-level empty state.
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
                <div
                  className="console-view-switcher"
                  role="group"
                  aria-label="Chuyển chế độ xem pipeline"
                >
                  <button
                    type="button"
                    aria-pressed={view === 'table'}
                    aria-label="Xem dạng danh sách"
                    className={view === 'table' ? 'is-active' : ''}
                    onClick={() => setView('table')}
                  >
                    <LineIcon name="list" size={15} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    aria-pressed={view === 'kanban'}
                    aria-label="Xem dạng kanban"
                    className={view === 'kanban' ? 'is-active' : ''}
                    onClick={() => setView('kanban')}
                  >
                    <LineIcon name="kanban" size={15} strokeWidth={2.25} />
                  </button>
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
          <FilterBar
            filters={PIPELINE_FILTERS}
            value={filterValues}
            onChange={(next) =>
              setFilterValues({
                q: next.q ?? '',
                lost: next.lost || 'exclude',
              })
            }
          />
        }
      >
        <Stack gap={5}>
          <Panel title="Pipeline O1 → O5" icon="filter">
            {isLoading ? (
              <div style={{ padding: '0 var(--cmc-keyline-x) 20px' }}>
                <Skeleton height={120} radius={0} data-testid="crm-pipeline-skeleton" />
              </div>
            ) : error ? (
              <div className="console-kanban-empty" role="alert">
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

          {ready && view === 'kanban' && (
            <KanbanBoard>
              {STAGES.map((stage) => {
                const stageItems = byStage.get(stage.key) ?? [];
                const count = stageCounts[stage.key] ?? 0;
                return (
                  <KanbanColumn key={stage.key} title={stage.label} count={count}>
                    {stageItems.length === 0 ? (
                      <div className="console-kanban-empty">Chưa có</div>
                    ) : (
                      stageItems.map((opp) => (
                        <OpportunityKanbanCard
                          key={opp.id}
                          opp={opp}
                          nextStage={stage.next as AdvanceableStage | null}
                          onAdvance={handleAdvance}
                          advancing={advancingId === opp.id}
                          onMarkLost={setMarkLostId}
                          onScheduleTest={setScheduleTestId}
                        />
                      ))
                    )}
                  </KanbanColumn>
                );
              })}
            </KanbanBoard>
          )}

          {ready && view === 'table' && (
            <DataTable<OpportunityItem & Record<string, unknown>>
              columns={listColumns}
              data={items as (OpportunityItem & Record<string, unknown>)[]}
              empty="Chưa có cơ hội nào"
              onRowClick={(row) => void navigate(links.opportunity(row.id))}
            />
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
