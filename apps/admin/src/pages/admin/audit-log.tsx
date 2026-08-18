import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banner,
  DataTable,
  EmptyState,
  FilterBar,
  LineIcon,
  ListPage,
  ListPagination,
  PageHeader,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { resolveGo } from '@cmc/links';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  data: unknown;
  createdAt: Date;
  /** Server-proven @cmc/links entity key — set only when the target still
   *  exists in the caller's current facility; null renders plain text. */
  linkEntity: string | null;
  [key: string]: unknown;
}

const PAGE_SIZE = 20;
/** Free-text filters debounce — dates apply immediately (no keystroke spam). */
const TEXT_DEBOUNCE_MS = 300;

const AUDIT_FILTERS: FilterDef[] = [
  { key: 'actor', label: 'Người thực hiện', type: 'text', placeholder: 'User id…' },
  { key: 'action', label: 'Loại việc', type: 'text', placeholder: 'VD: facility.update' },
  { key: 'entity', label: 'Đối tượng', type: 'text', placeholder: 'VD: Facility' },
  { key: 'entityId', label: 'ID đối tượng', type: 'text', placeholder: 'UUID…' },
  { key: 'createdFrom', label: 'Từ ngày', type: 'date' },
  { key: 'createdTo', label: 'Đến ngày', type: 'date' },
];

const EMPTY_FILTERS: Record<string, string> = {
  actor: '',
  action: '',
  entity: '',
  entityId: '',
  createdFrom: '',
  createdTo: '',
};

const COLUMNS: TableColumn<AuditRow>[] = [
  {
    key: 'createdAt',
    label: 'Thời điểm',
    width: 170,
    render: (v) => new Date(v as string | Date).toLocaleString('vi-VN'),
  },
  { key: 'actor', label: 'Người thực hiện', width: 180 },
  { key: 'action', label: 'Loại việc', width: 220 },
  { key: 'entity', label: 'Đối tượng', width: 140 },
  { key: 'entityId', label: 'ID đối tượng', width: 220, render: (v, row) => {
    // Server already proved current-facility resolvability before setting
    // linkEntity; resolveGo re-validates entity+UUID shape on this side.
    const id = v as string;
    if (!row.linkEntity) return id;
    const target = resolveGo(row.linkEntity, id);
    return target ? <Link to={target}>{id}</Link> : id;
  } },
];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive ICT day start → ISO for `createdFrom` (UTC+7 wall). */
function toCreatedFromIso(dateText: string): string | undefined {
  if (!dateText || !DATE_ONLY.test(dateText)) return undefined;
  const d = new Date(`${dateText}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Inclusive ICT day end → ISO for `createdTo`. */
function toCreatedToIso(dateText: string): string | undefined {
  if (!dateText || !DATE_ONLY.test(dateText)) return undefined;
  const d = new Date(`${dateText}T23:59:59.999+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * YYYY-MM-DD strings compare lexicographically as calendar order.
 * D4: inverted range must not hit the API with a silent empty result.
 */
function isInvertedDateRange(from: string, to: string): boolean {
  return Boolean(from && to && DATE_ONLY.test(from) && DATE_ONLY.test(to) && from > to);
}

function AuditLogContent() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedText, setDebouncedText] = useState({
    actor: '',
    action: '',
    entity: '',
    entityId: '',
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText({
        actor: filters.actor,
        action: filters.action,
        entity: filters.entity,
        entityId: filters.entityId,
      });
    }, TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.actor, filters.action, filters.entity, filters.entityId]);

  const dateRangeInvalid = isInvertedDateRange(filters.createdFrom, filters.createdTo);
  const createdFromIso = dateRangeInvalid ? undefined : toCreatedFromIso(filters.createdFrom);
  const createdToIso = dateRangeInvalid ? undefined : toCreatedToIso(filters.createdTo);

  // Restart pagination when the effective query set changes.
  useEffect(() => {
    setPage(1);
  }, [
    debouncedText.actor,
    debouncedText.action,
    debouncedText.entity,
    debouncedText.entityId,
    createdFromIso,
    createdToIso,
    dateRangeInvalid,
  ]);

  const { data, isLoading, error } = trpc.audit.list.useQuery(
    {
      ...(debouncedText.actor ? { actor: debouncedText.actor } : {}),
      ...(debouncedText.action ? { action: debouncedText.action } : {}),
      ...(debouncedText.entity ? { entity: debouncedText.entity } : {}),
      ...(debouncedText.entityId ? { entityId: debouncedText.entityId } : {}),
      ...(createdFromIso ? { createdFrom: createdFromIso } : {}),
      ...(createdToIso ? { createdTo: createdToIso } : {}),
      page,
      pageSize: PAGE_SIZE,
    },
    // Skip network while the range is inverted — Banner explains the fix.
    { enabled: !dateRangeInvalid },
  );

  const total = data?.total ?? 0;

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Nhật ký hệ thống"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Nhật ký hệ thống' }]}
        />
      }
      filters={
        <FilterBar
          filters={AUDIT_FILTERS}
          value={filters}
          onChange={(next) => setFilters({ ...EMPTY_FILTERS, ...next })}
        />
      }
      controlFooter={
        <ListPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      }
    >
      {dateRangeInvalid ? (
        <div style={{ padding: '12px var(--cmc-keyline-x)' }}>
          <Banner
            status="warning"
            title="Khoảng ngày không hợp lệ"
            description='"Từ ngày" phải trước hoặc bằng "Đến ngày". Chỉnh lại bộ lọc để tải nhật ký.'
          />
        </div>
      ) : (
        <DataTable<AuditRow>
          columns={COLUMNS}
          data={(data?.items as AuditRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có nhật ký nào"
        />
      )}
    </ListPage>
  );
}

export default function AuditLogPage() {
  const { canDo } = useSession();

  if (!canDo('audit', 'list')) {
    return (
      <>
        <PageHeader
          title="Nhật ký hệ thống"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Nhật ký hệ thống' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này chỉ dành cho Super Admin."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  return <AuditLogContent />;
}
