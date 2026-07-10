// Đăng ký ca — P05 (WF-P3-03/04).
//
// Key invariants:
// - fromDate must be a future ICT date: client validates (date > todayICT),
//   server validates independently.
// - Approve button gated by canDo('shift','approve') — only GĐ sees it.
// - Ticket-lock: at most 1 submitted registration per user at a time
//   (server enforces; UI surfaces the error message).
//
// Note: no shift.list endpoint exists in the current API. This page provides
// submission + approval/cancel action forms. A full kanban view requires a
// future shift.list procedure.

import { useState } from 'react';
import {
  Banner,
  Button,
  CmcTabs,
  ConfirmDialog,
  Divider,
  HStack,
  PageHeader,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function todayICT(): string {
  // en-CA locale produces YYYY-MM-DD which allows direct string comparison.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function isFutureICT(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return dateStr > todayICT();
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ---------------------------------------------------------------------------
// Entry row state
// ---------------------------------------------------------------------------
interface EntryRow {
  _key: number;
  date: string;
  shiftTemplateId: string;
}

let _keyCounter = 0;
function newEntry(): EntryRow {
  return { _key: ++_keyCounter, date: '', shiftTemplateId: '' };
}

// ---------------------------------------------------------------------------
// Submit tab
// ---------------------------------------------------------------------------
function SubmitTab() {
  const [groupId, setGroupId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entries, setEntries] = useState<EntryRow[]>([newEntry()]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const mut = trpc.shift.submit.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đăng ký ca đã gửi, chờ GĐ duyệt.' });
      setGroupId('');
      setFromDate('');
      setToDate('');
      setEntries([newEntry()]);
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
    },
  });

  const fromDateError =
    fromDate && !isFutureICT(fromDate)
      ? 'Ngày bắt đầu phải là ngày tương lai (giờ ICT)'
      : undefined;

  const canSubmit =
    isValidUuid(groupId) &&
    isFutureICT(fromDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toDate) &&
    entries.length > 0 &&
    entries.every(
      (e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isValidUuid(e.shiftTemplateId),
    );

  function updateEntry(
    key: number,
    field: 'date' | 'shiftTemplateId',
    val: string,
  ) {
    setEntries((prev) =>
      prev.map((e) => (e._key === key ? { ...e, [field]: val } : e)),
    );
  }

  function removeEntry(key: number) {
    setEntries((prev) => prev.filter((e) => e._key !== key));
  }

  function handleSubmit() {
    mut.mutate({
      shiftGroupId: groupId,
      fromDate,
      toDate,
      entries: entries.map((e) => ({
        date: e.date,
        shiftTemplateId: e.shiftTemplateId,
      })),
    });
  }

  return (
    <Stack gap={2} padding={4}>
      <Banner
        status="info"
        title="Lưu ý khi đăng ký ca"
        description={
          <>
            Nhập UUID nhóm ca và mẫu ca từ admin. Ngày bắt đầu phải{' '}
            <Text type="body" size="xsm" weight="semibold" as="span">sau hôm nay (ICT)</Text>. Hệ thống cho phép tối đa 1 đăng ký
            chờ duyệt tại một thời điểm (ticket-lock).
          </>
        }
      />

      <TextInput
        label="Nhóm ca (shiftGroupId — UUID)"
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        value={groupId}
        onChange={(v) => setGroupId(v)}
        status={groupId && !isValidUuid(groupId) ? { type: 'error', message: 'UUID không hợp lệ' } : undefined}
        size="sm"
      />

      <HStack gap={1}>
        <div style={{ flex: 1 }}>
          <TextInput
            label="Từ ngày (YYYY-MM-DD)"
            placeholder="2026-07-08"
            value={fromDate}
            onChange={(v) => setFromDate(v)}
            status={fromDateError ? { type: 'error', message: fromDateError } : undefined}
            size="sm"
          />
        </div>
        <div style={{ flex: 1 }}>
          <TextInput
            label="Đến ngày (YYYY-MM-DD)"
            placeholder="2026-07-31"
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

      {/* TODO(astryx-review): Astryx Divider has no `labelPosition` prop — the
          label always renders centered (Mantine had it left-aligned). Cosmetic
          only, no functional change. */}
      <Divider label="Danh sách ngày đăng ký" />

      {entries.map((entry) => (
        <HStack key={entry._key} align="end" gap={1} wrap="nowrap">
          <div style={{ flex: '0 0 160px' }}>
            <TextInput
              label="Ngày (YYYY-MM-DD)"
              placeholder="2026-07-08"
              value={entry.date}
              onChange={(v) => updateEntry(entry._key, 'date', v)}
              size="sm"
            />
          </div>
          <div style={{ flex: 1 }}>
            <TextInput
              label="Mẫu ca (shiftTemplateId — UUID)"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={entry.shiftTemplateId}
              onChange={(v) => updateEntry(entry._key, 'shiftTemplateId', v)}
              size="sm"
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
        onClick={() => setEntries((prev) => [...prev, newEntry()])}
      />

      {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}

      <HStack justify="end">
        <Button
          label="Gửi đăng ký"
          size="sm"
          variant="primary"
          isLoading={mut.isPending}
          isDisabled={!canSubmit}
          onClick={handleSubmit}
        />
      </HStack>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Approve / cancel tab (GĐ and owner)
// ---------------------------------------------------------------------------
function ApproveTab() {
  const { canDo } = useSession();
  const [regId, setRegId] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmType, setConfirmType] = useState<'approve' | 'cancel' | null>(null);

  const approveMut = trpc.shift.approve.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đã duyệt ca thành công.' });
      setRegId('');
      setConfirmType(null);
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
      setConfirmType(null);
    },
  });

  const cancelMut = trpc.shift.cancel.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đã hủy đăng ký ca.' });
      setRegId('');
      setConfirmType(null);
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
      setConfirmType(null);
    },
  });

  const idOk = isValidUuid(regId);
  const isBusy = approveMut.isPending || cancelMut.isPending;
  const shortId = regId.slice(0, 8);

  return (
    <Stack gap={2} padding={4}>
      <Text type="supporting" size="2xs">
        Nhập ID đăng ký ca (UUID) để duyệt hoặc hủy. Nút "Duyệt" chỉ hiển thị với
        GĐ có quyền <code>shift.approve</code>.
      </Text>

      <div style={{ maxWidth: 440 }}>
        <TextInput
          label="ID đăng ký ca (registrationId — UUID)"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={regId}
          onChange={(v) => setRegId(v)}
          status={regId && !idOk ? { type: 'error', message: 'UUID không hợp lệ' } : undefined}
          size="sm"
        />
      </div>

      {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}

      <HStack gap={1}>
        {/* Approve: gated to shift.approve permission (GĐ only) */}
        {canDo('shift', 'approve') && (
          <Button
            label="Duyệt ca"
            size="sm"
            variant="primary"
            isDisabled={!idOk}
            isLoading={isBusy}
            onClick={() => setConfirmType('approve')}
          />
        )}

        {/* Cancel: owner or director */}
        <Button
          label="Hủy đăng ký"
          size="sm"
          variant="destructive"
          isDisabled={!idOk}
          isLoading={isBusy}
          onClick={() => setConfirmType('cancel')}
        />
      </HStack>

      <ConfirmDialog
        opened={confirmType === 'approve'}
        title="Duyệt đăng ký ca"
        message={`Duyệt đăng ký ca ${shortId}…? Hành động này không thể hoàn tác.`}
        confirmLabel="Duyệt"
        confirmColor="green"
        loading={isBusy}
        onConfirm={() => approveMut.mutate({ registrationId: regId })}
        onCancel={() => setConfirmType(null)}
      />
      <ConfirmDialog
        opened={confirmType === 'cancel'}
        title="Hủy đăng ký ca"
        message={`Hủy đăng ký ca ${shortId}…? Hành động này không thể hoàn tác.`}
        confirmLabel="Hủy ca"
        confirmColor="red"
        loading={isBusy}
        onConfirm={() => cancelMut.mutate({ registrationId: regId })}
        onCancel={() => setConfirmType(null)}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function ShiftsPage() {
  const [activeTab, setActiveTab] = useState('submit');

  return (
    <>
      <PageHeader
        title="Đăng ký ca"
        subtitle="Đăng ký và xét duyệt ca làm việc"
        breadcrumbs={[{ label: 'HR' }, { label: 'Đăng ký ca' }]}
      />
      <CmcTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          {
            id: 'submit',
            label: 'Đăng ký ca mới',
            content: <SubmitTab />,
          },
          {
            id: 'approve',
            label: 'Duyệt / Hủy',
            content: <ApproveTab />,
          },
        ]}
      />
    </>
  );
}
