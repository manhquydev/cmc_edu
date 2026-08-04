// "Bậc lương & gán bậc" — HR remediation phase 5 (R3-10, validate session 3).
// 2 GĐ (giam_doc_kinh_doanh|giam_doc_dao_tao) + super_admin: CRUD SalaryTier
// (`salaryTier.list/create/update`) + assign an AppUser (sale/giao_vien ONLY
// — GĐ have no payslip, validate s4) to a tier (`compensation.assignTier`).

import { useState } from 'react';
import {
  Banner,
  Button,
  Card,
  DataTable,
  DetailPage,
  HStack,
  NumberInput,
  PageHeader,
  Selector,
  SettingsShell,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

type TierType = 'KINH_DOANH' | 'GIAO_VIEN';

interface TierRow {
  id: string;
  name: string;
  type: TierType;
  baseSalary: number;
  unitRate: number;
  requiredShifts: number;
  requiredMetric: number;
  [key: string]: unknown;
}

function fmtVND(raw: unknown): string {
  return `${Number(raw).toLocaleString('vi-VN')} đ`;
}

const TIER_TYPE_OPTIONS = [
  { value: 'KINH_DOANH', label: 'Kinh doanh (Sale)' },
  { value: 'GIAO_VIEN', label: 'Giáo viên' },
];

// ---------------------------------------------------------------------------
// Tier form (create / edit)
// ---------------------------------------------------------------------------
interface TierFormState {
  name: string;
  type: TierType;
  baseSalary: string;
  unitRate: string;
  requiredShifts: string;
  requiredMetric: string;
}

const EMPTY_FORM: TierFormState = {
  name: '',
  type: 'KINH_DOANH',
  baseSalary: '',
  unitRate: '',
  requiredShifts: '',
  requiredMetric: '',
};

function tierToForm(tier: TierRow): TierFormState {
  return {
    name: tier.name,
    type: tier.type,
    baseSalary: String(tier.baseSalary),
    unitRate: String(tier.unitRate),
    requiredShifts: String(tier.requiredShifts),
    requiredMetric: String(tier.requiredMetric),
  };
}

function TierFormCard({
  editingId,
  initial,
  onDone,
}: {
  editingId: string | null;
  initial: TierFormState;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<TierFormState>(initial);

  const createMut = trpc.salaryTier.create.useMutation({
    onSuccess: () => {
      void utils.salaryTier.list.invalidate();
      onDone();
    },
  });
  const updateMut = trpc.salaryTier.update.useMutation({
    onSuccess: () => {
      void utils.salaryTier.list.invalidate();
      onDone();
    },
  });

  const mut = editingId ? updateMut : createMut;
  const numbersOk =
    form.name.trim().length > 0 &&
    Number(form.baseSalary) >= 0 &&
    Number(form.unitRate) >= 0 &&
    Number.isInteger(Number(form.requiredShifts)) &&
    Number(form.requiredShifts) >= 0 &&
    Number(form.requiredMetric) >= 0 &&
    form.baseSalary !== '' &&
    form.unitRate !== '' &&
    form.requiredShifts !== '' &&
    form.requiredMetric !== '';

  function submit() {
    if (!numbersOk) return;
    const payload = {
      name: form.name.trim(),
      type: form.type,
      baseSalary: Number(form.baseSalary),
      unitRate: Number(form.unitRate),
      requiredShifts: Number(form.requiredShifts),
      requiredMetric: Number(form.requiredMetric),
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  return (
    <Card padding={3}>
      <Stack gap={2}>
        <Text type="body" size="sm" weight="semibold">
          {editingId ? 'Sửa bậc lương' : 'Thêm bậc lương mới'}
        </Text>
        <TextInput
          label="Tên bậc"
          value={form.name}
          onChange={(v) => setForm((p) => ({ ...p, name: v }))}
          size="sm"
        />
        <Selector
          label="Loại"
          options={TIER_TYPE_OPTIONS}
          value={form.type}
          onChange={(v) => setForm((p) => ({ ...p, type: (v as TierType) ?? 'KINH_DOANH' }))}
          hasClear={false}
        />
        <HStack gap={1}>
          <div style={{ flex: 1 }}>
            <NumberInput
              label="Lương cơ bản (VND)"
              value={form.baseSalary === '' ? undefined : Number(form.baseSalary)}
              onChange={(v) => setForm((p) => ({ ...p, baseSalary: v === undefined ? '' : String(v) }))}
              size="sm"
              min={0}
            />
          </div>
          <div style={{ flex: 1 }}>
            <NumberInput
              label="Đơn giá (VND)"
              value={form.unitRate === '' ? undefined : Number(form.unitRate)}
              onChange={(v) => setForm((p) => ({ ...p, unitRate: v === undefined ? '' : String(v) }))}
              size="sm"
              min={0}
            />
          </div>
        </HStack>
        <HStack gap={1}>
          <div style={{ flex: 1 }}>
            <NumberInput
              label="Công ca yêu cầu"
              value={form.requiredShifts === '' ? undefined : Number(form.requiredShifts)}
              onChange={(v) => setForm((p) => ({ ...p, requiredShifts: v === undefined ? '' : String(v) }))}
              size="sm"
              min={0}
            />
          </div>
          <div style={{ flex: 1 }}>
            <NumberInput
              label="Chỉ số yêu cầu (giờ dạy / doanh thu)"
              value={form.requiredMetric === '' ? undefined : Number(form.requiredMetric)}
              onChange={(v) => setForm((p) => ({ ...p, requiredMetric: v === undefined ? '' : String(v) }))}
              size="sm"
              min={0}
            />
          </div>
        </HStack>

        {mut.error && <Banner status="error" title={mut.error.message} />}

        <HStack justify="end" gap={1}>
          <Button label="Hủy" variant="secondary" size="sm" onClick={onDone} />
          <Button
            label={editingId ? 'Lưu' : 'Thêm bậc'}
            size="sm"
            variant="primary"
            isLoading={mut.isPending}
            isDisabled={!numbersOk}
            onClick={submit}
          />
        </HStack>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tier CRUD tab
// ---------------------------------------------------------------------------
function TiersTab() {
  const { data, isLoading, error } = trpc.salaryTier.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TierRow | null>(null);

  const rows: TierRow[] = (data as TierRow[] | undefined) ?? [];

  const columns: TableColumn<TierRow>[] = [
    { key: 'name', label: 'Tên bậc' },
    {
      key: 'type',
      label: 'Loại',
      width: 140,
      render: (v) => (v === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh'),
    },
    { key: 'baseSalary', label: 'Lương cơ bản', render: (v) => fmtVND(v) },
    { key: 'unitRate', label: 'Đơn giá', render: (v) => fmtVND(v) },
    { key: 'requiredShifts', label: 'Công ca YC' },
    { key: 'requiredMetric', label: 'Chỉ số YC', render: (v) => Number(v).toLocaleString('vi-VN') },
    {
      key: '_actions',
      label: '',
      width: 80,
      render: (_v, row) => (
        <Button
          label="Sửa"
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(row);
            setShowForm(true);
          }}
        />
      ),
    },
  ];

  return (
    <Stack gap={2} padding={4}>
      {!showForm && (
        <Button
          label="+ Thêm bậc lương"
          size="sm"
          variant="secondary"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        />
      )}
      {showForm && (
        <TierFormCard
          editingId={editing?.id ?? null}
          initial={editing ? tierToForm(editing) : EMPTY_FORM}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
      <DataTable<TierRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có bậc lương nào."
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Assign tab
// ---------------------------------------------------------------------------
interface StaffRow {
  id: string;
  fullName: string;
  employeeCode: string;
  roles: string[];
  [key: string]: unknown;
}

function AssignTab() {
  const utils = trpc.useUtils();
  const { data: userData, isLoading: usersLoading, error: usersError } = trpc.user.pickList.useQuery({});
  const { data: tierData } = trpc.salaryTier.list.useQuery();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [tierChoice, setTierChoice] = useState<string | undefined>(undefined);

  const assignMut = trpc.compensation.assignTier.useMutation({
    onSuccess: () => {
      void utils.user.pickList.invalidate();
      setAssigningId(null);
      setTierChoice(undefined);
    },
  });

  const staff: StaffRow[] = ((userData?.items ?? []) as StaffRow[]).filter(
    (u) => u.roles.includes('sale') || u.roles.includes('giao_vien'),
  );
  const tiers: TierRow[] = (tierData as TierRow[] | undefined) ?? [];

  function tierOptionsFor(row: StaffRow) {
    const requiredType: TierType = row.roles.includes('giao_vien') ? 'GIAO_VIEN' : 'KINH_DOANH';
    return tiers
      .filter((t) => t.type === requiredType)
      .map((t) => ({ value: t.id, label: t.name }));
  }

  const columns: TableColumn<StaffRow>[] = [
    { key: 'employeeCode', label: 'Mã NV', width: 100 },
    { key: 'fullName', label: 'Họ tên' },
    {
      key: 'roles',
      label: 'Vai trò',
      width: 120,
      render: (_v, row) => (row.roles.includes('giao_vien') ? 'Giáo viên' : 'Sale'),
    },
    {
      key: '_assign',
      label: 'Gán bậc',
      width: 260,
      render: (_v, row) =>
        assigningId === row.id ? (
          <HStack gap={1} align="center">
            <div style={{ width: 160 }}>
              <Selector
                label="Bậc lương"
                isLabelHidden
                options={tierOptionsFor(row)}
                value={tierChoice}
                onChange={(v) => setTierChoice(v)}
                hasClear={false}
              />
            </div>
            <Button
              label="Lưu"
              size="sm"
              variant="primary"
              isDisabled={!tierChoice}
              isLoading={assignMut.isPending}
              onClick={() => tierChoice && assignMut.mutate({ appUserId: row.id, tierId: tierChoice })}
            />
            <Button label="Hủy" size="sm" variant="ghost" onClick={() => setAssigningId(null)} />
          </HStack>
        ) : (
          <Button
            label="Gán bậc"
            size="sm"
            variant="secondary"
            onClick={() => {
              setAssigningId(row.id);
              setTierChoice(undefined);
            }}
          />
        ),
    },
  ];

  return (
    <Stack gap={2} padding={4}>
      {assignMut.error && <Banner status="error" title={assignMut.error.message} />}
      <DataTable<StaffRow>
        columns={columns}
        data={staff}
        loading={usersLoading}
        error={usersError?.message}
        empty="Chưa có nhân viên sale/giáo viên nào."
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function SalaryTiersPage() {
  const [activeNav, setActiveNav] = useState('tiers');

  return (
    <DetailPage
      header={
        <PageHeader
          title="Bậc lương & gán bậc"
          subtitle="Quản lý bậc lương và gán bậc cho nhân viên sale/giáo viên"
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Bậc lương' }]}
        />
      }
    >
      <SettingsShell
        title="Bậc lương"
        activeId={activeNav}
        onSelect={setActiveNav}
        items={[
          { id: 'tiers', label: 'Bậc lương', description: 'CRUD bậc & đơn giá' },
          { id: 'assign', label: 'Gán bậc', description: 'Sale / giáo viên' },
        ]}
      >
        {activeNav === 'tiers' ? <TiersTab /> : <AssignTab />}
      </SettingsShell>
    </DetailPage>
  );
}
