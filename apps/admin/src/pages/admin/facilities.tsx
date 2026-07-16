import { useState } from 'react';
import {
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  EmptyState,
  HStack,
  LineIcon,
  ListPage,
  PageHeader,
  Stack,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface FacilityRow {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<FacilityRow>[] = [
  { key: 'name', label: 'Tên cơ sở' },
  { key: 'code', label: 'Mã cơ sở', width: 160 },
  {
    key: 'createdAt',
    label: 'Ngày tạo',
    width: 140,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

interface CreateForm {
  name: string;
  code: string;
}

const EMPTY_CREATE_FORM: CreateForm = { name: '', code: '' };

// Separate query component so the hook is only called when permission is granted.
function FacilitiesContent() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.facility.list.useQuery({
    page: 1,
    pageSize: 50,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [editRow, setEditRow] = useState<FacilityRow | null>(null);
  const [editName, setEditName] = useState('');

  const createMut = trpc.facility.create.useMutation({
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      void utils.facility.list.invalidate();
    },
  });

  const updateMut = trpc.facility.update.useMutation({
    onSuccess: () => {
      setEditRow(null);
      void utils.facility.list.invalidate();
    },
  });

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
  }

  function openEditModal(row: FacilityRow) {
    setEditRow(row);
    setEditName(row.name);
  }

  const canSubmitCreate = createForm.name.trim().length > 0 && createForm.code.trim().length > 0;
  const canSubmitEdit = editName.trim().length > 0;

  return (
    <>
      <ListPage
        header={
          <PageHeader
            title="Cơ sở"
            subtitle="Danh sách cơ sở trong hệ thống (Super Admin)"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Cơ sở' }]}
            actions={
              <Button label="Thêm cơ sở" size="sm" variant="primary" onClick={() => setCreateOpen(true)} />
            }
          />
        }
      >
        <DataTable<FacilityRow>
          columns={COLUMNS}
          data={(data?.items as FacilityRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có cơ sở nào"
          onRowClick={(row) => openEditModal(row)}
        />
      </ListPage>

      <Dialog
        isOpen={createOpen}
        onOpenChange={(next) => {
          if (!next && !createMut.isPending) closeCreateModal();
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title="Thêm cơ sở"
          onOpenChange={(next) => {
            if (!next && !createMut.isPending) closeCreateModal();
          }}
        />
        <Stack gap={2} padding={4}>
          <TextInput
            label="Tên cơ sở"
            value={createForm.name}
            onChange={(v) => setCreateForm((f) => ({ ...f, name: v }))}
            isRequired
          />
          <TextInput
            label="Mã cơ sở"
            placeholder="VD: HN, HD…"
            value={createForm.code}
            onChange={(v) => setCreateForm((f) => ({ ...f, code: v }))}
            isRequired
          />
          {createMut.error && (
            <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>{createMut.error.message}</span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={closeCreateModal}
              isDisabled={createMut.isPending}
            />
            <Button
              label="Tạo"
              variant="primary"
              onClick={() =>
                createMut.mutate({ name: createForm.name.trim(), code: createForm.code.trim() })
              }
              isLoading={createMut.isPending}
              isDisabled={!canSubmitCreate}
            />
          </HStack>
        </Stack>
      </Dialog>

      {/* Edit name only — `code` is immutable after creation (baked into
          already-issued class-codes), so it is shown nowhere in this modal. */}
      <Dialog
        isOpen={editRow !== null}
        onOpenChange={(next) => {
          if (!next && !updateMut.isPending) setEditRow(null);
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title={editRow ? `Sửa tên — ${editRow.code}` : 'Sửa tên'}
          onOpenChange={(next) => {
            if (!next && !updateMut.isPending) setEditRow(null);
          }}
        />
        <Stack gap={2} padding={4}>
          <TextInput label="Tên cơ sở" value={editName} onChange={setEditName} isRequired />
          {updateMut.error && (
            <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>{updateMut.error.message}</span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={() => setEditRow(null)}
              isDisabled={updateMut.isPending}
            />
            <Button
              label="Lưu"
              variant="primary"
              onClick={() => editRow && updateMut.mutate({ id: editRow.id, name: editName.trim() })}
              isLoading={updateMut.isPending}
              isDisabled={!canSubmitEdit}
            />
          </HStack>
        </Stack>
      </Dialog>
    </>
  );
}

export default function FacilitiesPage() {
  const { canDo } = useSession();

  if (!canDo('facility', 'list')) {
    return (
      <>
        <PageHeader
          title="Cơ sở"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Cơ sở' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này chỉ dành cho Super Admin."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  return <FacilitiesContent />;
}
