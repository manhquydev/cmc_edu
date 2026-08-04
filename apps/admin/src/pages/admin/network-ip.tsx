import { useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  DetailPage,
  Dialog,
  DialogHeader,
  EmptyState,
  HStack,
  LineIcon,
  PageHeader,
  SettingsSection,
  SettingsShell,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface NetworkRow {
  id: string;
  cidr: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
  [key: string]: unknown;
}

interface CreateForm {
  cidr: string;
  label: string;
}

const EMPTY_CREATE_FORM: CreateForm = { cidr: '', label: '' };

function NetworkIpContent() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.facilityNetwork.list.useQuery();
  const detectQuery = trpc.facilityNetwork.detectMyIp.useQuery(undefined, { enabled: false });
  const [settingsNav, setSettingsNav] = useState<'list' | 'guide'>('list');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [detectNotice, setDetectNotice] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<NetworkRow | null>(null);
  const [editForm, setEditForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [deleteTarget, setDeleteTarget] = useState<NetworkRow | null>(null);

  const createMut = trpc.facilityNetwork.create.useMutation({
    onSuccess: () => {
      closeCreateModal();
      void utils.facilityNetwork.list.invalidate();
    },
  });
  const updateMut = trpc.facilityNetwork.update.useMutation({
    onSuccess: () => {
      setEditRow(null);
      void utils.facilityNetwork.list.invalidate();
    },
  });
  const deleteMut = trpc.facilityNetwork.delete.useMutation({
    onSuccess: () => void utils.facilityNetwork.list.invalidate(),
  });

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setDetectNotice(null);
  }

  function openEditModal(row: NetworkRow) {
    setEditRow(row);
    setEditForm({ cidr: row.cidr, label: row.label });
  }

  async function handleDetect() {
    const result = await detectQuery.refetch();
    const suggested = result.data?.suggestedCidr32;
    if (suggested) {
      setCreateForm((f) => ({ ...f, cidr: suggested }));
      setDetectNotice(null);
    } else {
      setDetectNotice('Không xác định được IP tự động — vui lòng nhập tay theo hướng dẫn bên dưới.');
    }
  }

  const rows = (data as NetworkRow[] | undefined) ?? [];

  const COLUMNS: TableColumn<NetworkRow>[] = [
    { key: 'cidr', label: 'CIDR', width: 180 },
    { key: 'label', label: 'Nhãn' },
    {
      key: 'isActive',
      label: 'Trạng thái',
      width: 120,
      render: (v) => (
        <Badge label={Boolean(v) ? 'Đang bật' : 'Đang tắt'} variant={Boolean(v) ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'id',
      label: 'Hành động',
      width: 220,
      render: (_v, row) => (
        <HStack gap={1}>
          <Button
            label={row.isActive ? 'Tắt' : 'Bật'}
            size="sm"
            variant="secondary"
            onClick={() => updateMut.mutate({ id: row.id, isActive: !row.isActive })}
          />
          <Button label="Sửa" size="sm" variant="secondary" onClick={() => openEditModal(row)} />
          <Button
            label="Xoá"
            size="sm"
            variant="secondary"
            onClick={() => setDeleteTarget(row)}
          />
        </HStack>
      ),
    },
  ];

  const canSubmitCreate = createForm.cidr.trim().length > 0;
  const canSubmitEdit = editForm.cidr.trim().length > 0;

  return (
    <>
      <DetailPage
        density="ops"
        header={
          <PageHeader
            title="Quản lý IP mạng"
            subtitle="Dải IP được phép chấm công tại cơ sở"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'IP mạng' }]}
            actions={
              settingsNav === 'list' ? (
                <Button label="Thêm dải mạng" size="sm" variant="primary" onClick={() => setCreateOpen(true)} />
              ) : undefined
            }
          />
        }
      >
        <SettingsShell
          title="IP mạng"
          activeId={settingsNav}
          onSelect={(id) => setSettingsNav(id as 'list' | 'guide')}
          items={[
            { id: 'list', label: 'Dải mạng', description: 'CRUD CIDR / bật tắt' },
            { id: 'guide', label: 'Hướng dẫn', description: 'CIDR · tự dò · ngoài mạng' },
          ]}
        >
          {settingsNav === 'list' ? (
            <Stack gap={2} padding={4}>
              <Banner
                status="info"
                title="Ảnh hưởng khi bật dải mạng"
                description="Bật dải mạng sẽ khiến chấm công ngoài mạng cần nhập lý do + tạo yêu cầu duyệt. Thêm dải mới mặc định ở trạng thái tắt — hãy kiểm tra kỹ trước khi bật."
              />
              {updateMut.error && !editRow && <Banner status="error" title={updateMut.error.message} />}
              {deleteMut.error && <Banner status="error" title={deleteMut.error.message} />}
              <DataTable<NetworkRow>
                columns={COLUMNS}
                data={rows}
                loading={isLoading}
                error={error?.message}
                empty="Chưa có dải mạng nào"
              />
            </Stack>
          ) : (
            <Stack gap={3} padding={4} style={{ maxWidth: 640 }}>
              <SettingsSection
                title="Hướng dẫn nhập CIDR"
                description="Dùng khi nút tự dò không chính xác (proxy / CDN / IP di động)."
              >
                <Text type="body" size="sm">
                  CIDR là dải IP, ví dụ <code>192.168.1.0/24</code> (cả dải văn phòng) hoặc một IP
                  đơn <code>10.0.0.5/32</code>. Có thể tự tra IP công cộng (vd. whatismyip) rồi nhập
                  tay trong form Thêm dải mạng.
                </Text>
              </SettingsSection>
              <SettingsSection title="Hệ quả khi bật dải" description="Liên quan chấm công ngoài mạng.">
                <Text type="body" size="sm">
                  Khi có dải đang bật, chấm công ngoài mạng yêu cầu lý do và tạo yêu cầu duyệt. Luôn
                  kiểm tra kỹ trước khi bật dải mới.
                </Text>
              </SettingsSection>
              <Button
                label="Quay lại danh sách"
                size="sm"
                variant="secondary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setSettingsNav('list')}
              />
            </Stack>
          )}
        </SettingsShell>
      </DetailPage>

      <Dialog
        isOpen={createOpen}
        onOpenChange={(next) => {
          if (!next && !createMut.isPending) closeCreateModal();
        }}
        purpose="form"
        width={420}
      >
        <DialogHeader
          title="Thêm dải mạng"
          onOpenChange={(next) => {
            if (!next && !createMut.isPending) closeCreateModal();
          }}
        />
        <Stack gap={2} padding={4}>
          <Button
            label="Lấy IP hiện tại của tôi"
            size="sm"
            variant="secondary"
            onClick={() => void handleDetect()}
          />
          {detectNotice && <Banner status="warning" title={detectNotice} />}
          <TextInput
            label="CIDR"
            placeholder="VD: 10.0.0.5/32 hoặc 192.168.1.0/24"
            value={createForm.cidr}
            onChange={(v) => setCreateForm((f) => ({ ...f, cidr: v }))}
            isRequired
          />
          <TextInput
            label="Nhãn"
            placeholder="VD: Văn phòng chính"
            value={createForm.label}
            onChange={(v) => setCreateForm((f) => ({ ...f, label: v }))}
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
                createMut.mutate({ cidr: createForm.cidr.trim(), label: createForm.label.trim() })
              }
              isLoading={createMut.isPending}
              isDisabled={!canSubmitCreate}
            />
          </HStack>
        </Stack>
      </Dialog>

      <Dialog
        isOpen={editRow !== null}
        onOpenChange={(next) => {
          if (!next && !updateMut.isPending) setEditRow(null);
        }}
        purpose="form"
        width={420}
      >
        <DialogHeader
          title="Sửa dải mạng"
          onOpenChange={(next) => {
            if (!next && !updateMut.isPending) setEditRow(null);
          }}
        />
        <Stack gap={2} padding={4}>
          <TextInput
            label="CIDR"
            value={editForm.cidr}
            onChange={(v) => setEditForm((f) => ({ ...f, cidr: v }))}
            isRequired
          />
          <TextInput
            label="Nhãn"
            value={editForm.label}
            onChange={(v) => setEditForm((f) => ({ ...f, label: v }))}
          />
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
              onClick={() =>
                editRow &&
                updateMut.mutate({ id: editRow.id, cidr: editForm.cidr.trim(), label: editForm.label.trim() })
              }
              isLoading={updateMut.isPending}
              isDisabled={!canSubmitEdit}
            />
          </HStack>
        </Stack>
      </Dialog>

      <ConfirmDialog
        opened={deleteTarget !== null}
        title="Xoá dải mạng"
        message={
          deleteTarget
            ? `Xoá dải "${deleteTarget.cidr}"${deleteTarget.label ? ` (${deleteTarget.label})` : ''}? Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        loading={deleteMut.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate({ id: deleteTarget.id });
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

export default function NetworkIpPage() {
  const { canDo } = useSession();

  if (!canDo('facilityNetwork', 'manage')) {
    return (
      <>
        <PageHeader
          title="Quản lý IP mạng"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'IP mạng' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này chỉ dành cho Super Admin."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  return <NetworkIpContent />;
}
