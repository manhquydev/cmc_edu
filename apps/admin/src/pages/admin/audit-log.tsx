import { useEffect, useState } from 'react';
import {
  DataTable,
  EmptyState,
  FilterBar,
  LineIcon,
  ListPage,
  ListPagination,
  PageHeader,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
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
  [key: string]: unknown;
}

const PAGE_SIZE = 20;
/** Free-text filters debounce — dates apply immediately (no keystroke spam). */
const TEXT_DEBOUNCE_MS = 300;

const AUDIT_FILTERS: FilterDef[] = [
  { key: 'actor', label: 'Người thực hiện', type: 'text', placeholder: 'User id…' },
  { key: 'action', label: 'Loại việc', type: 'text', placeholder: 'VD: facility.update' },
  { key: 'entity', label: 'Đối tượng', type: 'text', placeholder: 'VD: Facility' },
  { key: 'createdFrom', label: 'Từ ngày', type: 'date' },
  { key: 'createdTo', label: 'Đến ngày', type: 'date' },
];

const EMPTY_FILTERS: Record<string, string> = {
  actor: '',
  action: '',
  entity: '',
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
  { key: 'entityId', label: 'ID đối tượng', width: 220 },
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

function AuditLogContent() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedText, setDebouncedText] = useState({
    actor: '',
    action: '',
    entity: '',
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText({
        actor: filters.actor,
        action: filters.action,
        entity: filters.entity,
      });
    }, TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.actor, filters.action, filters.entity]);

  // Restart pagination when the effective query set changes.
  useEffect(() => {
    setPage(1);
  }, [
    debouncedText.actor,
    debouncedText.action,
    debouncedText.entity,
    filters.createdFrom,
    filters.createdTo,
  ]);

  const { data, isLoading, error } = trpc.audit.list.useQuery({
    ...(debouncedText.actor ? { actor: debouncedText.actor } : {}),
    ...(debouncedText.action ? { action: debouncedText.action } : {}),
    ...(debouncedText.entity ? { entity: debouncedText.entity } : {}),
    ...(toCreatedFromIso(filters.createdFrom)
      ? { createdFrom: toCreatedFromIso(filters.createdFrom) }
      : {}),
    ...(toCreatedToIso(filters.createdTo)
      ? { createdTo: toCreatedToIso(filters.createdTo) }
      : {}),
    page,
    pageSize: PAGE_SIZE,
  });

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
      <DataTable<AuditRow>
        columns={COLUMNS}
        data={(data?.items as AuditRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có nhật ký nào"
      />
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
