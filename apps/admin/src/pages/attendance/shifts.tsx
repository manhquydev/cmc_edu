// Đăng ký ca — HR remediation phase 5 (R3-10, phase-04 shift.reject/list
// procedures). Rebuilt on top of the phase-04 procedures:
//   - shift.listGroups        → group + template dropdowns (bỏ paste-UUID).
//   - shift.myRegistrations   → "Đăng ký của tôi" (+ rejectReason display).
//   - shift.pendingForApproval + shift.reject → GĐ inbox tab with an
//     approve/reject modal (reject reason mandatory, min 3 chars).
//
// Key invariants:
// - fromDate must be a future ICT date: client validates (date > todayICT),
//   server validates independently.
// - "Duyệt / Từ chối" tab only renders for canDo('shift','approve') — GĐ.
// - Ticket-lock: at most 1 submitted registration per user at a time
//   (server enforces; UI surfaces the error message).

import { useState } from 'react';
import {
  Banner,
  Button,
  CmcTabs,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogHeader,
  Divider,
  FormPage,
  HStack,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  Text,
  TextArea,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function todayICT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function isFutureICT(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return dateStr > todayICT();
}

function fmtDate(v: unknown): string {
  return new Date(v as string).toLocaleDateString('vi-VN');
}

const REG_STATUS_LABELS: Record<string, string> = {
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

// ---------------------------------------------------------------------------
// Entry row state
// ---------------------------------------------------------------------------
interface EntryRow {
  _key: number;
  date: string;
  shiftTemplateId: string;
}

function makeEntry(counter: { current: number }): EntryRow {
  return { _key: ++counter.current, date: '', shiftTemplateId: '' };
}

interface ShiftGroupOption {
  id: string;
  name: string;
  type: string;
  templates: { id: string; name: string; startTime: string; endTime: string }[];
}

// ---------------------------------------------------------------------------
// Submit tab
// ---------------------------------------------------------------------------
function SubmitTab() {
  const keyCounter = useState(() => ({ current: 0 }))[0];
  const { data: groupsData, isLoading: groupsLoading, error: groupsError } =
    trpc.shift.listGroups.useQuery();
  const groups: ShiftGroupOption[] = (groupsData as ShiftGroupOption[] | undefined) ?? [];

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entries, setEntries] = useState<EntryRow[]>(() => [makeEntry(keyCounter)]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedGroup = groups.find((g) => g.id === groupId);
  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: `${g.name} (${g.type === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh'})`,
  }));
  const templateOptions = (selectedGroup?.templates ?? []).map((t) => ({
    value: t.id,
    label: `${t.name} (${t.startTime}–${t.endTime})`,
  }));

  const mut = trpc.shift.submit.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đăng ký ca đã gửi, chờ GĐ duyệt.' });
      setGroupId(undefined);
      setFromDate('');
      setToDate('');
      setEntries([makeEntry(keyCounter)]);
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
    },
  });

  const fromDateError =
    fromDate && !isFutureICT(fromDate) ? 'Ngày bắt đầu phải là ngày tương lai (giờ ICT)' : undefined;

  const canSubmit =
    Boolean(groupId) &&
    isFutureICT(fromDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toDate) &&
    entries.length > 0 &&
    entries.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Boolean(e.shiftTemplateId));

  function updateEntry(key: number, field: 'date' | 'shiftTemplateId', val: string) {
    setEntries((prev) => prev.map((e) => (e._key === key ? { ...e, [field]: val } : e)));
  }

  function removeEntry(key: number) {
    setEntries((prev) => prev.filter((e) => e._key !== key));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !groupId) return;
    mut.mutate({
      shiftGroupId: groupId,
      fromDate,
      toDate,
      entries: entries.map((e2) => ({ date: e2.date, shiftTemplateId: e2.shiftTemplateId })),
    });
  }

  const resultContent = result ? (
    <Banner status={result.ok ? 'success' : 'error'} title={result.text} />
  ) : undefined;

  return (
    <form onSubmit={handleSubmit}>
      <FormPage
        header={
          <Banner
            status="info"
            title="Lưu ý khi đăng ký ca"
            description={
              <>
                Chọn nhóm ca và mẫu ca từ danh mục. Ngày bắt đầu phải{' '}
                <Text type="body" size="xsm" weight="semibold" as="span">sau hôm nay (ICT)</Text>. Hệ thống cho phép tối đa 1 đăng ký
                chờ duyệt tại một thời điểm (ticket-lock).
              </>
            }
          />
        }
        result={resultContent}
        actions={
          <Button
            label="Gửi đăng ký"
            type="submit"
            size="sm"
            variant="primary"
            isLoading={mut.isPending}
            isDisabled={!canSubmit}
          />
        }
      >
        <Stack gap={2}>
          {groupsError && <Banner status="error" title={groupsError.message} />}

          <Selector
            label="Nhóm ca"
            placeholder={groupsLoading ? 'Đang tải…' : 'Chọn nhóm ca'}
            options={groupOptions}
            value={groupId}
            onChange={(v) => {
              setGroupId(v);
              setEntries([makeEntry(keyCounter)]);
            }}
            hasClear={false}
          />

          <HStack gap={1} style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextInput
                label="Từ ngày (YYYY-MM-DD)"
                placeholder="2099-01-08"
                value={fromDate}
                onChange={(v) => setFromDate(v)}
                status={fromDateError ? { type: 'error', message: fromDateError } : undefined}
                size="sm"
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextInput
                label="Đến ngày (YYYY-MM-DD)"
                placeholder="2099-01-31"
                value={toDate}
                onChange={(v) => setToDate(v)}
                status={
                  toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
                    ? { type: 'error', message: 'Định dạng YYYY-MM-DD' }
                    : undefined
                }
                size="sm"
              />
            </div>
          </HStack>

          <Divider label="Danh sách ngày đăng ký" />

          {entries.map((entry) => (
            <HStack key={entry._key} align="end" gap={1} wrap="wrap">
              <div style={{ flex: '0 0 160px' }}>
                <TextInput
                  label="Ngày (YYYY-MM-DD)"
                  placeholder="2099-01-08"
                  value={entry.date}
                  onChange={(v) => updateEntry(entry._key, 'date', v)}
                  size="sm"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Selector
                  label="Mẫu ca"
                  placeholder={selectedGroup ? 'Chọn mẫu ca' : 'Chọn nhóm ca trước'}
                  options={templateOptions}
                  value={entry.shiftTemplateId || undefined}
                  onChange={(v) => updateEntry(entry._key, 'shiftTemplateId', v ?? '')}
                  isDisabled={!selectedGroup}
                  hasClear={false}
                />
              </div>
              {entries.length > 1 && (
                <Button
                  label="Xóa"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeEntry(entry._key)}
                />
              )}
            </HStack>
          ))}

          <Button
            label="+ Thêm ngày"
            variant="secondary"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setEntries((prev) => [...prev, makeEntry(keyCounter)])}
          />
        </Stack>
      </FormPage>
    </form>
  );
}

// ---------------------------------------------------------------------------
// "Đăng ký của tôi" tab
// ---------------------------------------------------------------------------
interface MyRegRow {
  id: string;
  fromDate: string | Date;
  toDate: string | Date;
  status: string;
  rejectReason: string | null;
  entries: unknown[];
  [key: string]: unknown;
}

function MyRegistrationsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.shift.myRegistrations.useQuery();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const cancelMut = trpc.shift.cancel.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đã hủy đăng ký ca.' });
      setCancelTarget(null);
      void utils.shift.myRegistrations.invalidate();
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
      setCancelTarget(null);
    },
  });

  const rows: MyRegRow[] = (data as MyRegRow[] | undefined) ?? [];

  const columns: TableColumn<MyRegRow>[] = [
    { key: 'fromDate', label: 'Từ ngày', render: fmtDate },
    { key: 'toDate', label: 'Đến ngày', render: fmtDate },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 140,
      render: (v) => <StatusBadge status={String(v)} label={REG_STATUS_LABELS[String(v)] ?? String(v)} />,
    },
    {
      key: 'entries',
      label: 'Số ngày',
      width: 90,
      render: (v) => (Array.isArray(v) ? v.length : 0),
    },
    {
      key: 'rejectReason',
      label: 'Lý do từ chối',
      render: (v) => (v ? String(v) : '—'),
    },
    {
      key: '_actions',
      label: '',
      width: 100,
      render: (_v, row) =>
        row.status === 'submitted' || row.status === 'approved' ? (
          <Button label="Hủy" size="sm" variant="ghost" onClick={() => setCancelTarget(row.id)} />
        ) : null,
    },
  ];

  return (
    <Stack gap={2} padding={4}>
      {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}
      <DataTable<MyRegRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có đăng ký ca nào."
      />
      <ConfirmDialog
        opened={cancelTarget !== null}
        title="Hủy đăng ký ca"
        message="Hủy đăng ký ca này? Hành động này không thể hoàn tác."
        confirmLabel="Hủy ca"
        confirmColor="red"
        loading={cancelMut.isPending}
        onConfirm={() => cancelTarget && cancelMut.mutate({ registrationId: cancelTarget })}
        onCancel={() => setCancelTarget(null)}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// GĐ inbox tab — approve / reject (reason mandatory, min 3 chars)
// ---------------------------------------------------------------------------
interface PendingRow {
  id: string;
  fromDate: string | Date;
  toDate: string | Date;
  entries: unknown[];
  appUser: { fullName: string };
  shiftGroup: { name: string; type: string };
  [key: string]: unknown;
}

function ApproveTab() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.shift.pendingForApproval.useQuery();
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function invalidate() {
    void utils.shift.pendingForApproval.invalidate();
  }

  const approveMut = trpc.shift.approve.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đã duyệt ca thành công.' });
      setApproveTarget(null);
      invalidate();
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
      setApproveTarget(null);
    },
  });

  const rejectMut = trpc.shift.reject.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đã từ chối đăng ký ca.' });
      setRejectTarget(null);
      setRejectReason('');
      invalidate();
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
    },
  });

  const rows: PendingRow[] = (data as PendingRow[] | undefined) ?? [];
  const reasonOk = rejectReason.trim().length >= 3;

  const columns: TableColumn<PendingRow>[] = [
    { key: 'appUser', label: 'Nhân viên', render: (_v, row) => row.appUser.fullName },
    {
      key: 'shiftGroup',
      label: 'Nhóm ca',
      render: (_v, row) => (row.shiftGroup.type === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh'),
    },
    { key: 'fromDate', label: 'Từ ngày', render: fmtDate },
    { key: 'toDate', label: 'Đến ngày', render: fmtDate },
    {
      key: 'entries',
      label: 'Số ngày',
      width: 90,
      render: (v) => (Array.isArray(v) ? v.length : 0),
    },
    {
      key: '_actions',
      label: '',
      width: 180,
      render: (_v, row) => (
        <HStack gap={1}>
          <Button label="Duyệt" size="sm" variant="primary" onClick={() => setApproveTarget(row.id)} />
          <Button
            label="Từ chối"
            size="sm"
            variant="destructive"
            onClick={() => {
              setRejectTarget(row.id);
              setRejectReason('');
            }}
          />
        </HStack>
      ),
    },
  ];

  return (
    <Stack gap={2} padding={4}>
      {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}
      <DataTable<PendingRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Không có đăng ký chờ duyệt."
      />

      <ConfirmDialog
        opened={approveTarget !== null}
        title="Duyệt đăng ký ca"
        message="Duyệt đăng ký ca này? Hành động này không thể hoàn tác."
        confirmLabel="Duyệt"
        confirmColor="blue"
        loading={approveMut.isPending}
        onConfirm={() => approveTarget && approveMut.mutate({ registrationId: approveTarget })}
        onCancel={() => setApproveTarget(null)}
      />

      <Dialog
        isOpen={rejectTarget !== null}
        onOpenChange={(next) => { if (!next && !rejectMut.isPending) { setRejectTarget(null); setRejectReason(''); } }}
        width={420}
        purpose="form"
      >
        <DialogHeader
          title="Từ chối đăng ký ca"
          onOpenChange={(next) => { if (!next) { setRejectTarget(null); setRejectReason(''); } }}
        />
        <Stack gap={2}>
          <TextArea
            label="Lý do từ chối"
            placeholder="Nêu lý do từ chối (tối thiểu 3 ký tự)…"
            value={rejectReason}
            onChange={(v) => setRejectReason(v)}
            rows={3}
            maxLength={2000}
          />
          <HStack justify="end" gap={1}>
            <Button label="Hủy" variant="secondary" size="sm" onClick={() => { setRejectTarget(null); setRejectReason(''); }} />
            <Button
              label="Từ chối"
              size="sm"
              variant="destructive"
              isLoading={rejectMut.isPending}
              isDisabled={!reasonOk}
              onClick={() => rejectTarget && rejectMut.mutate({ registrationId: rejectTarget, reason: rejectReason.trim() })}
            />
          </HStack>
        </Stack>
      </Dialog>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function ShiftsPage() {
  const { canDo } = useSession();
  const [activeTab, setActiveTab] = useState('submit');

  const tabs = [
    { id: 'submit', label: 'Đăng ký ca mới', content: <SubmitTab /> },
    { id: 'my', label: 'Đăng ký của tôi', content: <MyRegistrationsTab /> },
    ...(canDo('shift', 'approve')
      ? [{ id: 'approve', label: 'Duyệt / Từ chối', content: <ApproveTab /> }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Đăng ký ca"
        subtitle="Đăng ký và xét duyệt ca làm việc"
        breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Đăng ký ca' }]}
      />
      <CmcTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
    </>
  );
}
