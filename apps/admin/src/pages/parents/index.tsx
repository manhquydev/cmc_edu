import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  CmcTabs,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogHeader,
  FilterBar,
  HStack,
  ListPage,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

type FilterStatus = 'pending' | 'approved' | 'rejected';
type EmailFilter = 'missing' | 'all';

interface LinkRow {
  id: string;
  studentName: string;
  parentPhone: string;
  parentAccountId: string;
  status: string;
  createdAt: string | Date;
  [key: string]: unknown;
}

interface ParentRow {
  id: string;
  phone: string;
  email: string | null;
  linkedChildrenCount: number;
  createdAt: string | Date;
  [key: string]: unknown;
}

/** Common shape the shared email modal needs, whichever tab opened it —
 *  a guardian-link-request row and a parentAccount.list row carry different
 *  fields, so each tab maps its own row into this before opening the modal. */
interface EmailModalTarget {
  parentAccountId: string;
  parentPhone: string;
  detail: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const RELATION_OPTIONS = [
  { value: 'father', label: 'Bố' },
  { value: 'mother', label: 'Mẹ' },
  { value: 'guardian', label: 'Người giám hộ' },
];

// Defaults to `missing` — the actionable subset (locked out of LMS login),
// same reasoning as `guardian.listPendingLinks` defaulting its status filter
// to `pending`: staff open this tab to fix something, not to browse everyone.
const LINK_STATUS_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: [
      { value: 'pending', label: 'Chờ duyệt' },
      { value: 'approved', label: 'Đã duyệt' },
      { value: 'rejected', label: 'Từ chối' },
    ],
  },
];

const PARENT_DIR_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tìm theo SĐT hoặc email…',
  },
  {
    key: 'email',
    label: 'Email LMS',
    type: 'select',
    options: [
      { value: 'missing', label: 'Chưa có email' },
      { value: 'all', label: 'Tất cả' },
    ],
  },
];

const ALL_PARENTS_PAGE_SIZE = 20;

const BASE_COLUMNS: TableColumn<LinkRow>[] = [
  { key: 'studentName', label: 'Học viên' },
  { key: 'parentPhone', label: 'SĐT phụ huynh', width: 160 },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 120,
    render: (v) => (
      <StatusBadge status={String(v)} label={STATUS_LABELS[String(v)] ?? String(v)} />
    ),
  },
  {
    key: 'createdAt',
    label: 'Ngày yêu cầu',
    width: 140,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

/**
 * Tab 1: the pre-existing guardian-link-request review queue
 * (approve/reject a parent's self-service request to link to a student).
 */
function LinkRequestsTab({
  canUpdateEmail,
  onOpenEmailModal,
}: {
  canUpdateEmail: boolean;
  onOpenEmailModal: (row: LinkRow) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');

  // Approve modal state
  const [approveRow, setApproveRow] = useState<LinkRow | null>(null);
  const [relation, setRelation] = useState<string>('guardian');
  // Reject confirm — never mutate immediately on the destructive button.
  const [rejectRow, setRejectRow] = useState<LinkRow | null>(null);

  const utils = trpc.useUtils();
  const { success: toastSuccess } = useToast();

  const { data, isLoading, error } = trpc.guardian.listPendingLinks.useQuery({
    status: filterStatus,
    page: 1,
    pageSize: 50,
  });

  const approveMut = trpc.guardian.approveLink.useMutation({
    onSuccess: () => {
      setApproveRow(null);
      setRelation('guardian');
      toastSuccess('Đã duyệt liên kết');
      void utils.guardian.listPendingLinks.invalidate();
    },
  });

  const rejectMut = trpc.guardian.rejectLink.useMutation({
    onSuccess: () => {
      setRejectRow(null);
      toastSuccess('Đã từ chối yêu cầu');
      void utils.guardian.listPendingLinks.invalidate();
    },
    onError: () => {
      setRejectRow(null);
    },
  });

  function handleApproveSubmit() {
    if (!approveRow) return;
    approveMut.mutate({
      requestId: approveRow.id,
      relation: relation as 'father' | 'mother' | 'guardian',
    });
  }

  // Action column only appears on pending tab.
  const columns: TableColumn<LinkRow>[] =
    filterStatus === 'pending'
      ? [
          ...BASE_COLUMNS,
          {
            key: '_actions',
            label: 'Thao tác',
            width: 180,
            render: (_v, row) => (
              <HStack gap={1} style={{ flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                <Button
                  label="Duyệt"
                  size="sm"
                  variant="primary"
                  onClick={() => setApproveRow(row)}
                />
                <Button
                  label="Từ chối"
                  size="sm"
                  variant="destructive"
                  isLoading={rejectMut.isPending && rejectMut.variables?.requestId === row.id}
                  onClick={() => setRejectRow(row)}
                />
              </HStack>
            ),
          },
        ]
      : filterStatus === 'approved' && canUpdateEmail
        ? [
            ...BASE_COLUMNS,
            {
              key: '_email_actions',
              label: 'Thao tác',
              width: 160,
              render: (_v, row) => (
                <HStack gap={1} onClick={(e) => e.stopPropagation()}>
                  <Button
                    label="Cập nhật email"
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenEmailModal(row)}
                  />
                </HStack>
              ),
            },
          ]
        : BASE_COLUMNS;

  const rows: LinkRow[] = (data?.items ?? []).map((item) => ({
    ...item,
    _actions: null,
    _email_actions: null,
  }));

  return (
    <>
      <FilterBar
        filters={LINK_STATUS_FILTERS}
        value={{ status: filterStatus }}
        onChange={(next) =>
          setFilterStatus((next.status as FilterStatus) || 'pending')
        }
      />
      {data && (
        <Text type="supporting" size="sm" style={{ padding: '4px var(--cmc-keyline-x)' }}>
          {data.total} yêu cầu
        </Text>
      )}

      <DataTable<LinkRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Không có yêu cầu nào"
      />

      {/* Approve modal with relation selector.
          TODO(astryx-review): Astryx Dialog manages its own focus-trap and
          Escape/backdrop-dismiss internally (native <dialog>-based) — different
          implementation from the prior Modal. purpose="form" blocks backdrop
          click (closest match to the original closeOnClickOutside={!pending}
          guard, though Astryx has no per-render conditional for it). Flagged
          per migration rule for any non-confirm modal. */}
      <Dialog
        isOpen={Boolean(approveRow)}
        onOpenChange={(next) => {
          if (!next && !approveMut.isPending) setApproveRow(null);
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title="Duyệt liên kết phụ huynh"
          onOpenChange={(next) => {
            if (!next && !approveMut.isPending) setApproveRow(null);
          }}
        />
        {approveRow && (
          <Stack gap={2} padding={4}>
            <Text size="sm">
              Học viên: <strong>{approveRow.studentName}</strong>
            </Text>
            <Text size="sm">
              SĐT phụ huynh: <strong>{approveRow.parentPhone}</strong>
            </Text>
            <Selector
              label="Quan hệ với học viên"
              options={RELATION_OPTIONS}
              value={relation}
              onChange={(v) => setRelation(v ?? 'guardian')}
              isRequired
            />
            {approveMut.error && (
              // TODO(astryx-review): Text color enum has no error/danger slot —
              // plain <span> with CSS var per migration flag rule.
              <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
                {approveMut.error.message}
              </span>
            )}
            <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
              <Button
                label="Hủy"
                variant="secondary"
                onClick={() => setApproveRow(null)}
                isDisabled={approveMut.isPending}
              />
              <Button
                label="Xác nhận duyệt"
                variant="primary"
                onClick={handleApproveSubmit}
                isLoading={approveMut.isPending}
              />
            </HStack>
          </Stack>
        )}
      </Dialog>

      <ConfirmDialog
        opened={rejectRow !== null}
        title="Từ chối yêu cầu liên kết?"
        message={`Từ chối yêu cầu của phụ huynh ${rejectRow?.parentPhone ?? ''} với học viên "${rejectRow?.studentName ?? ''}". Phụ huynh sẽ không được liên kết với học viên này. Hành động không thể hoàn tác.`}
        confirmLabel="Từ chối"
        confirmColor="red"
        loading={rejectMut.isPending}
        onConfirm={() => {
          if (!rejectRow) return;
          rejectMut.mutate({ requestId: rejectRow.id });
        }}
        onCancel={() => setRejectRow(null)}
      />
    </>
  );
}

/**
 * Tab 2: the full parent directory — the discovery step provisioning never
 * gave staff. `finance/provisioning/provision-from-receipt.ts` creates
 * ParentAccount + an approved Guardian row directly, so a parent provisioned
 * that way never has a `GuardianLinkRequest` and never shows up in
 * `LinkRequestsTab`. Defaults to "chưa có email" — those parents are the ones
 * actually locked out of LMS login (and whose child can never get their
 * password reset, since only the parent can do that).
 */
function AllParentsTab({
  onOpenEmailModal,
}: {
  onOpenEmailModal: (row: ParentRow) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [emailFilter, setEmailFilter] = useState<EmailFilter>('missing');
  const [page, setPage] = useState(1);

  // Narrowing/widening the result set can strand the user on a now
  // out-of-range page — restart at page 1, same as crm/pipeline.tsx.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, emailFilter]);

  const { data, isLoading, error } = trpc.parentAccount.list.useQuery({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    missingEmailOnly: emailFilter === 'missing',
    page,
    pageSize: ALL_PARENTS_PAGE_SIZE,
  });

  const columns: TableColumn<ParentRow>[] = [
    { key: 'phone', label: 'SĐT phụ huynh', width: 160 },
    {
      key: 'email',
      label: 'Email đăng nhập LMS',
      render: (v) =>
        v ? (
          <Text size="sm">{String(v)}</Text>
        ) : (
          <Badge label="Chưa có email — bị khoá LMS" variant="warning" />
        ),
    },
    { key: 'linkedChildrenCount', label: 'Số con đã liên kết', width: 160 },
    {
      key: 'createdAt',
      label: 'Ngày tạo',
      width: 140,
      render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
    },
    {
      key: '_actions',
      label: 'Thao tác',
      width: 160,
      render: (_v, row) => (
        <HStack gap={1} onClick={(e) => e.stopPropagation()}>
          <Button
            label="Cập nhật email"
            size="sm"
            variant="secondary"
            onClick={() => onOpenEmailModal(row)}
          />
        </HStack>
      ),
    },
  ];

  const rows: ParentRow[] = (data?.items ?? []).map((item) => ({ ...item, _actions: null }));
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ALL_PARENTS_PAGE_SIZE));

  return (
    <Stack gap={2}>
      <FilterBar
        filters={PARENT_DIR_FILTERS}
        value={{ q: searchTerm, email: emailFilter }}
        onChange={(next) => {
          setSearchTerm(next.q ?? '');
          setEmailFilter((next.email as EmailFilter) || 'missing');
        }}
      />
      {data && (
        <Text type="supporting" size="sm" style={{ padding: '4px var(--cmc-keyline-x)' }}>
          {total} phụ huynh
        </Text>
      )}

      <DataTable<ParentRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty={
          emailFilter === 'missing'
            ? 'Không có phụ huynh nào đang thiếu email'
            : 'Không có phụ huynh nào'
        }
      />

      <HStack justify="between" align="center" padding={4}>
        <Text type="supporting" size="xsm">
          Trang {page}/{totalPages} — {total} phụ huynh
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
  );
}

export default function ParentListPage() {
  const { canDo } = useSession();
  const canUpdateEmail = canDo('parentAccount', 'updateEmail');
  const [activeTab, setActiveTab] = useState<'requests' | 'all'>('requests');

  const utils = trpc.useUtils();

  // Email update modal — shared by both tabs. They surface the exact same
  // action (parentAccount.updateEmail); only the context line shown differs,
  // captured in `EmailModalTarget.detail` by each tab's own open-handler.
  const [emailTarget, setEmailTarget] = useState<EmailModalTarget | null>(null);
  const [emailInput, setEmailInput] = useState('');

  const updateEmailMut = trpc.parentAccount.updateEmail.useMutation({
    onSuccess: () => {
      setEmailTarget(null);
      setEmailInput('');
      void utils.parentAccount.list.invalidate();
    },
  });

  function openEmailModalFromLink(row: LinkRow) {
    setEmailTarget({
      parentAccountId: row.parentAccountId,
      parentPhone: row.parentPhone,
      detail: `Học viên: ${row.studentName}`,
    });
    setEmailInput('');
  }

  function openEmailModalFromParent(row: ParentRow) {
    setEmailTarget({
      parentAccountId: row.id,
      parentPhone: row.phone,
      detail: `${row.linkedChildrenCount} con đã liên kết`,
    });
    // Prefilling with the current value lets staff correct a typo, not just
    // fill a blank — this tab (unlike the link-request queue) knows it.
    setEmailInput(row.email ?? '');
  }

  function closeEmailModal() {
    if (updateEmailMut.isPending) return;
    setEmailTarget(null);
    setEmailInput('');
  }

  function handleEmailSubmit() {
    if (!emailTarget) return;
    updateEmailMut.mutate({ parentAccountId: emailTarget.parentAccountId, email: emailInput });
  }

  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Phụ huynh"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Phụ huynh' }]}
          />
        }
      >
        <CmcTabs
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id === 'all' ? 'all' : 'requests')}
          tabs={[
            {
              id: 'requests',
              label: 'Yêu cầu liên kết',
              content: (
                <LinkRequestsTab
                  canUpdateEmail={canUpdateEmail}
                  onOpenEmailModal={openEmailModalFromLink}
                />
              ),
            },
            // Only offered when the caller can actually act on it — the tab
            // itself would otherwise call a query gated by the same permission
            // and render nothing but a FORBIDDEN error.
            ...(canUpdateEmail
              ? [
                  {
                    id: 'all',
                    label: 'Tất cả phụ huynh',
                    content: <AllParentsTab onOpenEmailModal={openEmailModalFromParent} />,
                  },
                ]
              : []),
          ]}
        />
      </ListPage>

      {/* Email update modal — allows staff to set/update parent email for LMS login */}
      <Dialog
        isOpen={Boolean(emailTarget)}
        onOpenChange={(next) => {
          if (!next) closeEmailModal();
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title="Cập nhật email phụ huynh"
          onOpenChange={(next) => {
            if (!next) closeEmailModal();
          }}
        />
        {emailTarget && (
          <Stack gap={2} padding={4}>
            <Text size="sm">
              Phụ huynh: <strong>{emailTarget.parentPhone}</strong>
            </Text>
            <Text size="sm">{emailTarget.detail}</Text>
            <TextInput
              label="Email đăng nhập LMS"
              placeholder="example@email.com"
              value={emailInput}
              onChange={(v) => setEmailInput(v)}
              type="email"
              isRequired
            />
            {updateEmailMut.error && (
              // TODO(astryx-review): Text color enum has no error/danger slot —
              // plain <span> with CSS var per migration flag rule.
              <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
                {updateEmailMut.error.message}
              </span>
            )}
            <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
              <Button
                label="Hủy"
                variant="secondary"
                onClick={closeEmailModal}
                isDisabled={updateEmailMut.isPending}
              />
              <Button
                label="Lưu email"
                variant="primary"
                onClick={handleEmailSubmit}
                isLoading={updateEmailMut.isPending}
                isDisabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)}
              />
            </HStack>
          </Stack>
        )}
      </Dialog>
    </>
  );
}
