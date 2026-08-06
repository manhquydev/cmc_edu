import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  HStack,
  LineIcon,
  ListPage,
  PageHeader,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
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

interface FilterForm {
  actor: string;
  action: string;
  entity: string;
  createdFrom: string;
  createdTo: string;
}

const EMPTY_FILTERS: FilterForm = { actor: '', action: '', entity: '', createdFrom: '', createdTo: '' };
const PAGE_SIZE = 20;

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

/** Converts a `YYYY-MM-DD` (or empty) text field to the ISO datetime string
 * `audit.list` expects, or `undefined` when blank/unparseable. */
function toIsoOrUndefined(dateText: string): string | undefined {
  if (!dateText) return undefined;
  const d = new Date(dateText);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function AuditLogContent() {
  const [draft, setDraft] = useState<FilterForm>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterForm>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = trpc.audit.list.useQuery({
    ...(applied.actor ? { actor: applied.actor } : {}),
    ...(applied.action ? { action: applied.action } : {}),
    ...(applied.entity ? { entity: applied.entity } : {}),
    ...(toIsoOrUndefined(applied.createdFrom) ? { createdFrom: toIsoOrUndefined(applied.createdFrom) } : {}),
    ...(toIsoOrUndefined(applied.createdTo) ? { createdTo: toIsoOrUndefined(applied.createdTo) } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  function applyFilters() {
    setApplied(draft);
    setPage(1);
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Nhật ký hệ thống"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Nhật ký hệ thống' }]}
        />
      }
    >
      <Stack gap={2} padding={4}>
        <HStack gap={1} wrap="wrap" align="end">
          <div style={{ width: 180 }}>
            <TextInput
              label="Người thực hiện"
              value={draft.actor}
              onChange={(v) => setDraft((f) => ({ ...f, actor: v }))}
              size="sm"
            />
          </div>
          <div style={{ width: 200 }}>
            <TextInput
              label="Loại việc"
              placeholder="VD: facility.update"
              value={draft.action}
              onChange={(v) => setDraft((f) => ({ ...f, action: v }))}
              size="sm"
            />
          </div>
          <div style={{ width: 160 }}>
            <TextInput
              label="Đối tượng"
              placeholder="VD: Facility"
              value={draft.entity}
              onChange={(v) => setDraft((f) => ({ ...f, entity: v }))}
              size="sm"
            />
          </div>
          <div style={{ width: 150 }}>
            <TextInput
              label="Từ ngày"
              placeholder="YYYY-MM-DD"
              value={draft.createdFrom}
              onChange={(v) => setDraft((f) => ({ ...f, createdFrom: v }))}
              size="sm"
            />
          </div>
          <div style={{ width: 150 }}>
            <TextInput
              label="Đến ngày"
              placeholder="YYYY-MM-DD"
              value={draft.createdTo}
              onChange={(v) => setDraft((f) => ({ ...f, createdTo: v }))}
              size="sm"
            />
          </div>
          <Button label="Lọc" size="sm" variant="primary" onClick={applyFilters} />
        </HStack>

        <DataTable<AuditRow>
          columns={COLUMNS}
          data={(data?.items as AuditRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có nhật ký nào"
        />

        <HStack justify="between" align="center">
          <Text type="supporting" size="xsm">
            Trang {page}/{totalPages} — {total} bản ghi
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
      </Stack>
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
