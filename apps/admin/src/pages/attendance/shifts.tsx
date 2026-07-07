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
  Alert,
  Button,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { CmcTabs, ConfirmDialog, PageHeader } from '@cmc/ui';
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
    <Stack gap="sm" p="md">
      <Alert color="blue" variant="light" radius="xs" fz="xs">
        Nhập UUID nhóm ca và mẫu ca từ admin. Ngày bắt đầu phải{' '}
        <Text span fw={600}>sau hôm nay (ICT)</Text>. Hệ thống cho phép tối đa 1 đăng ký
        chờ duyệt tại một thời điểm (ticket-lock).
      </Alert>

      <TextInput
        label="Nhóm ca (shiftGroupId — UUID)"
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        value={groupId}
        onChange={(e) => setGroupId(e.currentTarget.value)}
        error={groupId && !isValidUuid(groupId) ? 'UUID không hợp lệ' : undefined}
        radius="xs"
        size="sm"
      />

      <Group grow gap="xs">
        <TextInput
          label="Từ ngày (YYYY-MM-DD)"
          placeholder="2026-07-08"
          value={fromDate}
          onChange={(e) => setFromDate(e.currentTarget.value)}
          error={fromDateError}
          radius="xs"
          size="sm"
        />
        <TextInput
          label="Đến ngày (YYYY-MM-DD)"
          placeholder="2026-07-31"
          value={toDate}
          onChange={(e) => setToDate(e.currentTarget.value)}
          error={
            toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
              ? 'Định dạng YYYY-MM-DD'
              : undefined
          }
          radius="xs"
          size="sm"
        />
      </Group>

      <Divider label="Danh sách ngày đăng ký" labelPosition="left" />

      {entries.map((entry) => (
        <Group key={entry._key} align="flex-end" gap="xs" wrap="nowrap">
          <TextInput
            label="Ngày (YYYY-MM-DD)"
            placeholder="2026-07-08"
            value={entry.date}
            onChange={(e) => updateEntry(entry._key, 'date', e.currentTarget.value)}
            radius="xs"
            size="sm"
            style={{ flex: '0 0 160px' }}
          />
          <TextInput
            label="Mẫu ca (shiftTemplateId — UUID)"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={entry.shiftTemplateId}
            onChange={(e) =>
              updateEntry(entry._key, 'shiftTemplateId', e.currentTarget.value)
            }
            radius="xs"
            size="sm"
            style={{ flex: 1 }}
          />
          {entries.length > 1 && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              radius="xs"
              onClick={() => removeEntry(entry._key)}
            >
              Xóa
            </Button>
          )}
        </Group>
      ))}

      <Button
        variant="default"
        size="xs"
        radius="xs"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => setEntries((prev) => [...prev, newEntry()])}
      >
        + Thêm ngày
      </Button>

      {result && (
        <Alert color={result.ok ? 'green' : 'red'} radius="xs">
          {result.text}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button
          radius="xs"
          size="sm"
          loading={mut.isPending}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Gửi đăng ký
        </Button>
      </Group>
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
    <Stack gap="sm" p="md">
      <Text fz="xs" c="dimmed">
        Nhập ID đăng ký ca (UUID) để duyệt hoặc hủy. Nút "Duyệt" chỉ hiển thị với
        GĐ có quyền <code>shift.approve</code>.
      </Text>

      <TextInput
        label="ID đăng ký ca (registrationId — UUID)"
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        value={regId}
        onChange={(e) => setRegId(e.currentTarget.value)}
        error={regId && !idOk ? 'UUID không hợp lệ' : undefined}
        radius="xs"
        size="sm"
        maw={440}
      />

      {result && (
        <Alert color={result.ok ? 'green' : 'red'} radius="xs">
          {result.text}
        </Alert>
      )}

      <Group gap="xs">
        {/* Approve: gated to shift.approve permission (GĐ only) */}
        {canDo('shift', 'approve') && (
          <Button
            size="sm"
            radius="xs"
            color="green"
            disabled={!idOk}
            loading={isBusy}
            onClick={() => setConfirmType('approve')}
          >
            Duyệt ca
          </Button>
        )}

        {/* Cancel: owner or director */}
        <Button
          size="sm"
          radius="xs"
          color="red"
          variant="light"
          disabled={!idOk}
          loading={isBusy}
          onClick={() => setConfirmType('cancel')}
        >
          Hủy đăng ký
        </Button>
      </Group>

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
