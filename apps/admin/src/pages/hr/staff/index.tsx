// Staff list — canonical /hr/staff surface (resource-depth D1).
//
// List is an INDEX: the row's work happens on the record detail pages
// (/hr/staff/:staffId/{profile,access}); row click navigates to the profile,
// it never opens a permission dialog. The list owns exactly two persisted
// query keys, `q` and `page`, and hydrates from / writes back to them so
// F5, share and back preserve the view (D1/D7).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  BulkActionBar,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  HStack,
  LineIcon,
  ListPage,
  ListPagination,
  PageHeader,
  Text,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { formatRole } from '@cmc/auth';
import { trpc } from '../../../lib/trpc.js';
import { useSession } from '../../../lib/session-context.js';
import { staffListPath, staffNewPath, staffProfilePath } from '@cmc/links';

interface StaffRow {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string;
  email: string;
  roles: string[];
  isActive: boolean;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<StaffRow>[] = [
  { key: 'employeeCode', label: 'Mã NV', width: 100 },
  { key: 'fullName', label: 'Họ tên' },
  { key: 'position', label: 'Vị trí', width: 160 },
  { key: 'email', label: 'Email' },
  {
    key: 'roles',
    label: 'Vai trò',
    render: (v) => {
      const roles = v as string[];
      if (!roles || roles.length === 0)
        return (
          <Text type="supporting" size="xsm">
            —
          </Text>
        );
      return (
        <HStack gap={0.5}>
          {roles.map((r) => (
            <Badge key={r} label={formatRole(r)} variant="info" />
          ))}
        </HStack>
      );
    },
  },
  {
    key: 'isActive',
    label: 'Trạng thái',
    width: 120,
    render: (v) => (
      <Badge label={Boolean(v) ? 'Hoạt động' : 'Vô hiệu'} variant={Boolean(v) ? 'success' : 'neutral'} />
    ),
  },
];

const USER_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên, email, mã NV…',
  },
];

const PAGE_SIZE = 20;

export default function StaffListPage() {
  const { canDo } = useSession();
  const navigate = useNavigate();
  const { success: toastSuccess } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth for q/page (D1): hydrate once from the query
  // keys, then every change writes them back with `replace` so the history
  // entry stays the list URL (never a stack of intermediate query states).
  const queryQ = searchParams.get('q') ?? '';
  const queryPageRaw = searchParams.get('page');
  const queryPage = queryPageRaw && /^\d+$/.test(queryPageRaw) ? parseInt(queryPageRaw, 10) : 1;

  const [searchInput, setSearchInput] = useState(queryQ);
  const [debouncedSearch, setDebouncedSearch] = useState(queryQ);
  const [page, setPage] = useState(queryPage);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Keep local state in lockstep when the URL changes externally (back/forward,
  // a shared link, F5) so the rendered list always matches the address bar.
  useEffect(() => {
    setSearchInput(queryQ);
    setDebouncedSearch(queryQ);
  }, [queryQ]);

  useEffect(() => {
    setPage(queryPage);
  }, [queryPage]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever the debounced search term changes from a USER
  // action (new result set). The debounced value is the dependency — the input
  // keystrokes that produced it are intentionally not (they would reset on
  // every keypress). The first render is skipped so a deep-linked / F5 / back
  // ?page=N hydrates from the URL instead of being clobbered to page 1.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
    setSelectedIds([]);
  }, [debouncedSearch]);

  function writeUrl(nextQ: string, nextPage: number) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (nextQ) params.set('q', nextQ);
        else params.delete('q');
        if (nextPage > 1) params.set('page', String(nextPage));
        else params.delete('page');
        return params;
      },
      { replace: true },
    );
  }

  function onSearch(next: Record<string, string>) {
    const q = (next.q ?? '').trim();
    setSearchInput(q);
    setPage(1);
    writeUrl(q, 1);
  }

  function onPageChange(next: number) {
    setPage(next);
    setSelectedIds([]);
    writeUrl(debouncedSearch, next);
  }

  const listInput = debouncedSearch ? { search: debouncedSearch } : {};
  const { data, isLoading, error } = trpc.user.list.useQuery(listInput);

  const allRows = useMemo(() => (data?.items as StaffRow[] | undefined) ?? [], [data]);
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openProfile(row: StaffRow) {
    navigate(staffProfilePath(row.id), {
      state: { from: { pathname: staffListPath({ q: debouncedSearch || undefined, page: page > 1 ? page : undefined }), search: '' } },
    });
  }

  if (!canDo('user', 'manage')) {
    return (
      <>
        <PageHeader
          title="Nhân viên"
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý tài khoản (user.manage)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Nhân viên"
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên' }]}
          actions={
            <Button label="Thêm nhân viên" size="sm" variant="primary" onClick={() => navigate(staffNewPath())} />
          }
        />
      }
      filters={
        <FilterBar
          filters={USER_FILTERS}
          value={{ q: searchInput }}
          onChange={onSearch}
        />
      }
      controlFooter={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cmc-space-2)', width: '100%' }}>
          <BulkActionBar
            selectionCount={selectedIds.length}
            onClear={() => setSelectedIds([])}
          >
            <Button
              label="Sao chép email"
              size="sm"
              variant="secondary"
              isDisabled={selectedIds.length === 0}
              onClick={() => {
                const emails = allRows
                  .filter((r) => selectedIds.includes(r.id))
                  .map((r) => r.email)
                  .filter(Boolean);
                void navigator.clipboard?.writeText(emails.join(', '));
                toastSuccess(`Đã sao chép ${emails.length} email`);
              }}
            />
          </BulkActionBar>
          <ListPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={allRows.length}
            onPageChange={onPageChange}
          />
        </div>
      }
    >
      <DataTable<StaffRow>
        columns={COLUMNS}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có nhân viên nào"
        onRowClick={openProfile}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </ListPage>
  );
}
