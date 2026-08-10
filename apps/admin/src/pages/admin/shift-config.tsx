// Cấu hình ca làm việc — HR remediation phase 5 (R3-10). Real build on the
// phase-04/2 procedures that already exist: `shift.listGroups` (read),
// `shift.createGroup`/`shift.createTemplate` (write), `compensationPolicy.get`/
// `compensationPolicy.upsert` (per-facility penalty rates). Replaces the
// premium-plan coming-soon EmptyState — super_admin only (nav-registry).

import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  DetailPage,
  EmptyState,
  HStack,
  LineIcon,
  NumberInput,
  PageHeader,
  Selector,
  SettingsSection,
  SettingsShell,
  Stack,
  Text,
  TextInput,
  TimeField,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface ShiftTemplateRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface ShiftGroupRow {
  id: string;
  name: string;
  type: 'KINH_DOANH' | 'GIAO_VIEN';
  selectionMode: 'SINGLE' | 'MULTIPLE';
  templates: ShiftTemplateRow[];
}

const GROUP_TYPE_OPTIONS = [
  { value: 'KINH_DOANH', label: 'Kinh doanh (Sale)' },
  { value: 'GIAO_VIEN', label: 'Giáo viên' },
];

const SELECTION_MODE_OPTIONS = [
  { value: 'SINGLE', label: 'SINGLE — 1 ca/ngày' },
  { value: 'MULTIPLE', label: 'MULTIPLE — nhiều ca/ngày' },
];

// ---------------------------------------------------------------------------
// New group form
// ---------------------------------------------------------------------------
function NewGroupForm() {
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [type, setType] = useState<'KINH_DOANH' | 'GIAO_VIEN'>('KINH_DOANH');
  const [selectionMode, setSelectionMode] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');

  const mut = trpc.shift.createGroup.useMutation({
    onSuccess: () => {
      void utils.shift.listGroups.invalidate();
      setName('');
    },
  });

  const canSubmit = name.trim().length > 0;

  return (
    <Card padding={3}>
      <Stack gap={2}>
        <Text type="body" size="sm" weight="semibold">Thêm nhóm ca</Text>
        <TextInput label="Tên nhóm ca" value={name} onChange={setName} size="sm" />
        <HStack gap={1}>
          <div style={{ flex: 1 }}>
            <Selector label="Loại" options={GROUP_TYPE_OPTIONS} value={type} onChange={(v) => setType((v as typeof type) ?? 'KINH_DOANH')} hasClear={false} />
          </div>
          <div style={{ flex: 1 }}>
            <Selector
              label="Chế độ chọn"
              options={SELECTION_MODE_OPTIONS}
              value={selectionMode}
              onChange={(v) => setSelectionMode((v as typeof selectionMode) ?? 'SINGLE')}
              hasClear={false}
            />
          </div>
        </HStack>
        {mut.error && <Banner status="error" title={mut.error.message} />}
        <Button
          label="Thêm nhóm ca"
          size="sm"
          variant="primary"
          style={{ alignSelf: 'flex-start' }}
          isLoading={mut.isPending}
          isDisabled={!canSubmit}
          onClick={() => mut.mutate({ name: name.trim(), type, selectionMode })}
        />
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New template form (per group)
// ---------------------------------------------------------------------------
function NewTemplateForm({ groupId }: { groupId: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const mut = trpc.shift.createTemplate.useMutation({
    onSuccess: () => {
      void utils.shift.listGroups.invalidate();
      setName('');
      setStartTime('');
      setEndTime('');
    },
  });

  const timeOk = (v: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
  const canSubmit = name.trim().length > 0 && timeOk(startTime) && timeOk(endTime);

  return (
    <Stack gap={1} paddingBlock={1}>
      <HStack gap={1} align="end" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextInput label="Tên mẫu ca" value={name} onChange={setName} size="sm" />
        </div>
        <div style={{ flex: '0 0 100px' }}>
          <TimeField label="Bắt đầu (HH:mm)" value={startTime} onChange={setStartTime} size="sm" />
        </div>
        <div style={{ flex: '0 0 100px' }}>
          <TimeField label="Kết thúc (HH:mm)" value={endTime} onChange={setEndTime} size="sm" />
        </div>
        <Button
          label="+ Thêm mẫu ca"
          size="sm"
          variant="secondary"
          isLoading={mut.isPending}
          isDisabled={!canSubmit}
          onClick={() => mut.mutate({ shiftGroupId: groupId, name: name.trim(), startTime, endTime })}
        />
      </HStack>
      {mut.error && <Banner status="error" title={mut.error.message} />}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Groups tab
// ---------------------------------------------------------------------------
function GroupsTab() {
  const { data, isLoading, error } = trpc.shift.listGroups.useQuery();
  const groups: ShiftGroupRow[] = (data as ShiftGroupRow[] | undefined) ?? [];

  return (
    <Stack gap={3} padding={4}>
      <NewGroupForm />

      {isLoading && (
        <Text type="supporting" size="sm">Đang tải…</Text>
      )}
      {error && <Banner status="error" title={error.message} />}
      {!isLoading && !error && groups.length === 0 && (
        <Text type="supporting" size="sm">Chưa có nhóm ca nào.</Text>
      )}

      {groups.map((group) => (
        <Card key={group.id} padding={3}>
          <Stack gap={1}>
            <HStack justify="between">
              <Text type="body" size="sm" weight="semibold">
                {group.name}
              </Text>
              <Text type="supporting" size="xsm">
                {group.type === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh'} · {group.selectionMode}
              </Text>
            </HStack>
            {group.templates.length === 0 ? (
              <Text type="supporting" size="xsm">Chưa có mẫu ca nào.</Text>
            ) : (
              <Stack gap={0.5}>
                {group.templates.map((t) => (
                  <HStack key={t.id} justify="between" paddingBlock={0.5} style={{ borderBottom: '1px solid var(--cmc-border)' }}>
                    <Text type="body" size="xsm">{t.name}</Text>
                    <Text type="supporting" size="xsm" hasTabularNumbers>{t.startTime}–{t.endTime}</Text>
                  </HStack>
                ))}
              </Stack>
            )}
            <NewTemplateForm groupId={group.id} />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// CompensationPolicy tab
// ---------------------------------------------------------------------------
export function PolicyTab() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.compensationPolicy.get.useQuery();
  const [lateRate, setLateRate] = useState<number | undefined>(undefined);
  const [earlyRate, setEarlyRate] = useState<number | undefined>(undefined);
  // Seed the fields from the fetched policy exactly once. Without this guard,
  // a background refetch (react-query's default refetch-on-window-focus)
  // resolves with a NEW `data` object — same values, different reference —
  // which re-fires this effect and silently discards whatever the admin was
  // mid-typing before clicking Save.
  const seededRef = useRef(false);

  useEffect(() => {
    if (data && !seededRef.current) {
      seededRef.current = true;
      setLateRate(Number(data.penaltyRatePerLateMinute));
      setEarlyRate(Number(data.penaltyRatePerEarlyMinute));
    }
  }, [data]);

  const upsertMut = trpc.compensationPolicy.upsert.useMutation({
    onSuccess: () => void utils.compensationPolicy.get.invalidate(),
  });

  const canSubmit = lateRate !== undefined && lateRate >= 0 && earlyRate !== undefined && earlyRate >= 0;

  return (
    <Stack gap={3} padding={4} style={{ maxWidth: 560 }}>
      {isLoading && (
        <Text type="supporting" size="sm">Đang tải…</Text>
      )}
      {error && <Banner status="error" title={error.message} />}
      {!isLoading && !error && !data && (
        <Banner
          status="info"
          title="Chưa cấu hình chính sách phạt"
          description="Hệ thống dùng mặc định 500đ/phút muộn, 1.000đ/phút về sớm."
        />
      )}

      <SettingsSection
        title="Chính sách phạt muộn/sớm"
        description="Áp dụng theo cơ sở hiện tại khi tính phạt trên bảng lương."
      >
        <Stack gap={2}>
          <NumberInput
            label="Phạt mỗi phút đi muộn (VND)"
            min={0}
            value={lateRate}
            onChange={setLateRate}
          />
          <NumberInput
            label="Phạt mỗi phút về sớm (VND)"
            min={0}
            value={earlyRate}
            onChange={setEarlyRate}
          />
          {upsertMut.error && <Banner status="error" title={upsertMut.error.message} />}
          {upsertMut.isSuccess && <Banner status="success" title="Đã lưu chính sách phạt." />}
          <Button
            label="Lưu chính sách"
            size="sm"
            variant="primary"
            style={{ alignSelf: 'flex-start' }}
            isLoading={upsertMut.isPending}
            isDisabled={!canSubmit}
            onClick={() =>
              lateRate !== undefined &&
              earlyRate !== undefined &&
              upsertMut.mutate({ penaltyRatePerLateMinute: lateRate, penaltyRatePerEarlyMinute: earlyRate })
            }
          />
        </Stack>
      </SettingsSection>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function ShiftConfigPage() {
  const { canDo } = useSession();
  // Two independent gates, not one: `shift.manage` (the 2 GĐ) owns Nhóm ca &
  // mẫu ca, `compensationPolicy.manage` (super_admin only — empty role list)
  // owns Chính sách phạt. A GĐ holding only the former must not be walled off
  // by the latter, so the page renders whichever tab(s) the session can open
  // instead of gating the whole screen on one key.
  const canManageShift = canDo('shift', 'manage');
  const canManagePolicy = canDo('compensationPolicy', 'manage');
  const [activeTab, setActiveTab] = useState(canManageShift ? 'groups' : 'policy');

  if (!canManageShift && !canManagePolicy) {
    return (
      <DetailPage
        header={
          <PageHeader
            title="Cấu hình ca làm việc"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Ca làm việc' }]}
          />
        }
      >
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý ca làm việc (shift.manage) hoặc chính sách phạt (compensationPolicy.manage)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </DetailPage>
    );
  }

  const railItems = [
    ...(canManageShift
      ? [{ id: 'groups', label: 'Nhóm ca & mẫu ca', description: 'Shift groups + templates' }]
      : []),
    ...(canManagePolicy
      ? [{ id: 'policy', label: 'Chính sách phạt', description: 'Muộn / về sớm theo cơ sở' }]
      : []),
  ];

  return (
    <DetailPage
      header={
        <PageHeader
          title="Cấu hình ca làm việc"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Ca làm việc' }]}
        />
      }
    >
      <SettingsShell
        title="Cấu hình"
        items={railItems}
        activeId={activeTab}
        onSelect={setActiveTab}
      >
        {activeTab === 'groups' && canManageShift ? <GroupsTab /> : null}
        {activeTab === 'policy' && canManagePolicy ? <PolicyTab /> : null}
      </SettingsShell>
    </DetailPage>
  );
}
