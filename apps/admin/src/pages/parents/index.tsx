import { useState } from 'react';
import {
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  HStack,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

type FilterStatus = 'pending' | 'approved' | 'rejected';

interface LinkRow {
  id: string;
  studentName: string;
  parentPhone: string;
  parentAccountId: string;
  status: string;
  createdAt: string | Date;
  [key: string]: unknown;
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

export default function ParentListPage() {
  const { canDo } = useSession();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');

  // Approve modal state
  const [approveRow, setApproveRow] = useState<LinkRow | null>(null);
  const [relation, setRelation] = useState<string>('guardian');

  // Email update modal state
  const [emailRow, setEmailRow] = useState<LinkRow | null>(null);
  const [emailInput, setEmailInput] = useState('');

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.guardian.listPendingLinks.useQuery({
    status: filterStatus,
    page: 1,
    pageSize: 50,
  });

  const approveMut = trpc.guardian.approveLink.useMutation({
    onSuccess: () => {
      setApproveRow(null);
      setRelation('guardian');
      void utils.guardian.listPendingLinks.invalidate();
    },
  });

  const rejectMut = trpc.guardian.rejectLink.useMutation({
    onSuccess: () => {
      void utils.guardian.listPendingLinks.invalidate();
    },
  });

  const updateEmailMut = trpc.parentAccount.updateEmail.useMutation({
    onSuccess: () => {
      setEmailRow(null);
      setEmailInput('');
    },
  });

  function handleReject(requestId: string) {
    rejectMut.mutate({ requestId });
  }

  function handleApproveSubmit() {
    if (!approveRow) return;
    approveMut.mutate({
      requestId: approveRow.id,
      relation: relation as 'father' | 'mother' | 'guardian',
    });
  }

  function handleOpenEmailModal(row: LinkRow) {
    setEmailRow(row);
    setEmailInput('');
  }

  function handleEmailSubmit() {
    if (!emailRow) return;
    updateEmailMut.mutate({
      parentAccountId: emailRow.parentAccountId,
      email: emailInput,
    });
  }

  const canUpdateEmail = canDo('parentAccount', 'updateEmail');

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
              <HStack gap={1} onClick={(e) => e.stopPropagation()}>
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
                  onClick={() => handleReject(row.id)}
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
                    onClick={() => handleOpenEmailModal(row)}
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
      <PageHeader
        title="Phụ huynh"
        subtitle="Duyệt yêu cầu liên kết phụ huynh — học viên"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Phụ huynh' }]}
      />

      <HStack padding={4} gap={2}>
        <Text type="supporting" size="sm">
          Lọc:
        </Text>
        <div style={{ width: 160 }}>
          <Selector
            label="Lọc theo trạng thái"
            isLabelHidden
            value={filterStatus}
            onChange={(v) => setFilterStatus((v as FilterStatus) ?? 'pending')}
            options={[
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'rejected', label: 'Từ chối' },
            ]}
            size="sm"
          />
        </div>
        {data && (
          <Text type="supporting" size="sm">
            {data.total} yêu cầu
          </Text>
        )}
      </HStack>

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
          implementation from Mantine's Modal. purpose="form" blocks backdrop
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

      {/* Email update modal — allows staff to set/update parent email for LMS login */}
      <Dialog
        isOpen={Boolean(emailRow)}
        onOpenChange={(next) => {
          if (!next && !updateEmailMut.isPending) {
            setEmailRow(null);
            setEmailInput('');
          }
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title="Cập nhật email phụ huynh"
          onOpenChange={(next) => {
            if (!next && !updateEmailMut.isPending) {
              setEmailRow(null);
              setEmailInput('');
            }
          }}
        />
        {emailRow && (
          <Stack gap={2} padding={4}>
            <Text size="sm">
              Phụ huynh: <strong>{emailRow.parentPhone}</strong>
            </Text>
            <Text size="sm">
              Học viên: <strong>{emailRow.studentName}</strong>
            </Text>
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
                onClick={() => {
                  setEmailRow(null);
                  setEmailInput('');
                }}
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
