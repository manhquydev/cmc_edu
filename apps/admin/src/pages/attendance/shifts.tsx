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
  DateField,
  Dialog,
  DialogHeader,
  Divider,
  FormPage,
  HStack,
  PageHeader,
  ProgressSteps,
  Selector,
  Stack,
  StatusBadge,
  Text,
  TextArea,
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

interface ShiftGroupOption {
  id: string;
  name: string;
  type: string;
  selectionMode: 'SINGLE' | 'MULTIPLE';
  templates: { id: string; name: string; startTime: string; endTime: string }[];
}

type SelectedTemplatesByDate = Record<string, string[]>;

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function datesInRange(fromDate: string, toDate: string): string[] {
  if (!isDateOnly(fromDate) || !isDateOnly(toDate) || toDate < fromDate) return [];

  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  const dates: string[] = [];

  for (let current = start; current <= end && dates.length <= 366; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10));
  }

  return dates;
}

function formatScheduleDate(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

// ---------------------------------------------------------------------------
// Submit tab
// ---------------------------------------------------------------------------
function SubmitTab() {
  const utils = trpc.useUtils();
  const { data: groupsData, isLoading: groupsLoading, error: groupsError } =
    trpc.shift.listGroups.useQuery();
  const { data: registrationsData } = trpc.shift.myRegistrations.useQuery();
  const groups: ShiftGroupOption[] = (groupsData as ShiftGroupOption[] | undefined) ?? [];
  const registrations: MyRegRow[] = (registrationsData as MyRegRow[] | undefined) ?? [];

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTemplatesByDate, setSelectedTemplatesByDate] = useState<SelectedTemplatesByDate>({});
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedGroup = groups.find((g) => g.id === groupId);
  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: `${g.name} (${g.type === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh'})`,
  }));
  const selectionMode = selectedGroup?.selectionMode;
  const fromDateError =
    fromDate && !isFutureICT(fromDate) ? 'Ngày bắt đầu phải là ngày tương lai theo giờ ICT.' : undefined;
  const rawVisibleDates = datesInRange(fromDate, toDate);
  const toDateError =
    toDate && !isDateOnly(toDate)
      ? 'Chọn ngày kết thúc hợp lệ.'
      : fromDate && toDate && toDate < fromDate
        ? 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'
        : rawVisibleDates.length > 366
          ? 'Kỳ đăng ký tối đa 366 ngày.'
          : undefined;
  const visibleDates = fromDateError || toDateError ? [] : rawVisibleDates;
  const entries = visibleDates.flatMap((date) =>
    (selectedTemplatesByDate[date] ?? []).map((shiftTemplateId) => ({ date, shiftTemplateId })),
  );
  const selectedDayCount = visibleDates.filter((date) => (selectedTemplatesByDate[date] ?? []).length > 0).length;
  const hasSelection = Object.values(selectedTemplatesByDate).some((templateIds) => templateIds.length > 0);
  const hasSubmittedRegistration = registrations.some((registration) => registration.status === 'submitted');
  const activeStep = !selectedGroup ? 0 : visibleDates.length === 0 ? 1 : entries.length > 0 ? 2 : 1;

  const mut = trpc.shift.submit.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đăng ký ca đã gửi, chờ GĐ duyệt.' });
      setGroupId(undefined);
      setFromDate('');
      setToDate('');
      setSelectedTemplatesByDate({});
      void utils.shift.myRegistrations.invalidate();
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
    },
  });

  const canSubmit =
    Boolean(groupId) &&
    isFutureICT(fromDate) &&
    isDateOnly(toDate) &&
    !toDateError &&
    entries.length > 0;

  function applyGroupChange(nextGroupId: string) {
    setGroupId(nextGroupId);
    setSelectedTemplatesByDate({});
    setPendingGroupId(null);
    setResult(null);
  }

  function requestGroupChange(nextGroupId: string) {
    if (nextGroupId === groupId) return;
    if (hasSelection) {
      setPendingGroupId(nextGroupId);
      return;
    }
    applyGroupChange(nextGroupId);
  }

  function selectTemplate(date: string, shiftTemplateId: string) {
    setSelectedTemplatesByDate((previous) => {
      const current = previous[date] ?? [];
      const next =
        selectionMode === 'MULTIPLE'
          ? current.includes(shiftTemplateId)
            ? current.filter((id) => id !== shiftTemplateId)
            : [...current, shiftTemplateId]
          : [shiftTemplateId];

      return { ...previous, [date]: next };
    });
  }

  function clearDate(date: string) {
    setSelectedTemplatesByDate((previous) => ({ ...previous, [date]: [] }));
  }

  function selectWeekdays(shiftTemplateId: string) {
    setSelectedTemplatesByDate((previous) => {
      const next = { ...previous };
      for (const date of visibleDates) {
        if (!isWeekday(date)) continue;
        const current = next[date] ?? [];
        next[date] =
          selectionMode === 'MULTIPLE'
            ? current.includes(shiftTemplateId)
              ? current
              : [...current, shiftTemplateId]
            : [shiftTemplateId];
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !groupId) return;
    mut.mutate({
      shiftGroupId: groupId,
      fromDate,
      toDate,
      entries,
    });
  }

  const resultContent = result ? (
    <div aria-live="polite">
      <Banner status={result.ok ? 'success' : 'error'} title={result.text} />
    </div>
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
                <Text type="body" size="xsm" weight="semibold" as="span">sau hôm nay theo giờ ICT</Text>. Mỗi nhân sự chỉ có một đăng ký
                chờ duyệt tại một thời điểm.
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

          <div className="shift-registration-progress">
            <ProgressSteps
              steps={[
                { id: 'period', label: 'Chọn kỳ' },
                { id: 'schedule', label: 'Chọn ca' },
                { id: 'review', label: 'Rà soát và gửi' },
              ]}
              activeIndex={activeStep}
            />
          </div>

          <Selector
            label="Nhóm ca"
            placeholder={groupsLoading ? 'Đang tải…' : 'Chọn nhóm ca'}
            options={groupOptions}
            value={groupId}
            onChange={requestGroupChange}
            hasClear={false}
          />

          {selectedGroup ? (
            <div className="shift-registration-group-note" role="status">
              <Text type="body" size="sm" weight="semibold">
                {selectedGroup.name}
              </Text>
              <Text type="supporting" size="2xs">
                {selectionMode === 'MULTIPLE'
                  ? 'Có thể chọn nhiều mẫu ca khác nhau trong cùng một ngày.'
                  : 'Mỗi ngày chỉ chọn một mẫu ca.'}
              </Text>
            </div>
          ) : null}

          <div className="shift-registration-period">
            <div>
              <DateField
                label="Từ ngày"
                value={fromDate}
                onChange={(value) => {
                  setFromDate(value);
                  setResult(null);
                }}
                size="md"
              />
              {fromDateError ? (
                <Text className="shift-registration-field-error" type="supporting" size="2xs" role="alert">
                  {fromDateError}
                </Text>
              ) : null}
            </div>
            <div>
              <DateField
                label="Đến ngày"
                value={toDate}
                onChange={(value) => {
                  setToDate(value);
                  setResult(null);
                }}
                size="md"
              />
              {toDateError ? (
                <Text className="shift-registration-field-error" type="supporting" size="2xs" role="alert">
                  {toDateError}
                </Text>
              ) : null}
            </div>
          </div>

          {hasSubmittedRegistration ? (
            <Banner
              status="warning"
              title="Bạn đang có một đăng ký chờ duyệt"
              description="Hệ thống sẽ không nhận thêm đăng ký mới cho đến khi phiếu này được xử lý hoặc hủy."
            />
          ) : null}

          {selectedGroup && visibleDates.length > 0 && selectedGroup.templates.length > 0 ? (
            <>
              <Divider label="Lịch đăng ký" />

              <div className="shift-registration-quick-actions" aria-label="Chọn nhanh ngày làm việc">
                {selectedGroup.templates.map((template) => (
                  <Button
                    key={template.id}
                    label={`Chọn T2–T6: ${template.name}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => selectWeekdays(template.id)}
                  />
                ))}
                {hasSelection ? (
                  <Button
                    label="Xóa các ca đã chọn"
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTemplatesByDate({})}
                  />
                ) : null}
              </div>

              <section className="shift-registration-schedule" aria-labelledby="shift-registration-schedule-title">
                <h2 id="shift-registration-schedule-title" className="console-sr-only">
                  Chọn ca theo ngày
                </h2>

                <div className="shift-registration-grid">
                  <div
                    className="shift-registration-grid-heading"
                    aria-hidden
                    style={{ '--shift-template-count': selectedGroup.templates.length } as React.CSSProperties}
                  >
                    <span>Ngày</span>
                    {selectedGroup.templates.map((template) => (
                      <span key={template.id}>
                        {template.name}
                        <small>{template.startTime}–{template.endTime}</small>
                      </span>
                    ))}
                  </div>

                  {visibleDates.map((date) => {
                    const selectedTemplateIds = selectedTemplatesByDate[date] ?? [];
                    return (
                      <div
                        key={date}
                        className="shift-registration-day"
                        style={{ '--shift-template-count': selectedGroup.templates.length } as React.CSSProperties}
                      >
                        <div className="shift-registration-day-label">
                          <Text type="body" size="sm" weight="semibold">
                            {formatScheduleDate(date)}
                          </Text>
                          {selectedTemplateIds.length > 0 ? (
                            <Button
                              label="Bỏ chọn"
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => clearDate(date)}
                            />
                          ) : (
                            <Text type="supporting" size="2xs">
                              Chưa chọn ca
                            </Text>
                          )}
                        </div>

                        {selectedGroup.templates.map((template) => {
                          const isSelected = selectedTemplateIds.includes(template.id);
                          const inputId = `shift-${date}-${template.id}`;
                          const label = `${template.name}, ${template.startTime} đến ${template.endTime}, ngày ${formatScheduleDate(date)}`;
                          return (
                            <label
                              key={template.id}
                              className={`shift-registration-choice${isSelected ? ' is-selected' : ''}`}
                              htmlFor={inputId}
                            >
                              <input
                                id={inputId}
                                type={selectionMode === 'MULTIPLE' ? 'checkbox' : 'radio'}
                                name={selectionMode === 'MULTIPLE' ? inputId : `shift-${date}`}
                                checked={isSelected}
                                onChange={() => selectTemplate(date, template.id)}
                                aria-label={label}
                              />
                              <span className="shift-registration-choice-copy">
                                <strong>{template.name}</strong>
                                <small>{template.startTime}–{template.endTime}</small>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="shift-registration-summary" aria-labelledby="shift-registration-summary-title">
                <h2 id="shift-registration-summary-title">Rà soát đăng ký</h2>
                <dl>
                  <div>
                    <dt>Nhóm ca</dt>
                    <dd>{selectedGroup.name}</dd>
                  </div>
                  <div>
                    <dt>Kỳ đăng ký</dt>
                    <dd>
                      {formatScheduleDate(visibleDates[0])} đến {formatScheduleDate(visibleDates[visibleDates.length - 1])}
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày đã chọn</dt>
                    <dd>{selectedDayCount}</dd>
                  </div>
                  <div>
                    <dt>Ca đã chọn</dt>
                    <dd>{entries.length}</dd>
                  </div>
                </dl>
                {entries.length === 0 ? (
                  <Text type="supporting" size="2xs">
                    Chọn ít nhất một ca trước khi gửi đăng ký.
                  </Text>
                ) : null}
              </section>
            </>
          ) : selectedGroup && visibleDates.length > 0 && selectedGroup.templates.length === 0 ? (
            <Banner
              status="warning"
              title="Nhóm ca chưa có mẫu ca"
              description="Liên hệ người quản lý để bổ sung mẫu ca trước khi đăng ký."
            />
          ) : selectedGroup && fromDate && toDate && !fromDateError && !toDateError ? (
            <Banner
              status="warning"
              title="Kỳ đăng ký chưa có ngày để chọn"
              description="Điều chỉnh kỳ đăng ký để tiếp tục."
            />
          ) : null}
        </Stack>
      </FormPage>

      <ConfirmDialog
        opened={pendingGroupId !== null}
        title="Đổi nhóm ca"
        message="Các ca đã chọn không phù hợp với nhóm ca mới và sẽ bị xóa."
        confirmLabel="Đổi nhóm ca"
        confirmColor="blue"
        onConfirm={() => pendingGroupId && applyGroupChange(pendingGroupId)}
        onCancel={() => setPendingGroupId(null)}
      />
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
  const [cancelTarget, setCancelTarget] = useState<MyRegRow | null>(null);
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
          <Button label="Hủy" size="sm" variant="ghost" onClick={() => setCancelTarget(row)} />
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
        message={
          cancelTarget
            ? `Hủy đăng ký từ ${fmtDate(cancelTarget.fromDate)} đến ${fmtDate(cancelTarget.toDate)}? Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Hủy ca"
        confirmColor="red"
        loading={cancelMut.isPending}
        onConfirm={() => cancelTarget && cancelMut.mutate({ registrationId: cancelTarget.id })}
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
  const [approveTarget, setApproveTarget] = useState<PendingRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingRow | null>(null);
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
          <Button label="Duyệt" size="sm" variant="primary" onClick={() => setApproveTarget(row)} />
          <Button
            label="Từ chối"
            size="sm"
            variant="destructive"
            onClick={() => {
              setRejectTarget(row);
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
        message={
          approveTarget
            ? `Duyệt đăng ký của ${approveTarget.appUser.fullName} từ ${fmtDate(approveTarget.fromDate)} đến ${fmtDate(approveTarget.toDate)}? Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Duyệt"
        confirmColor="blue"
        loading={approveMut.isPending}
        onConfirm={() => approveTarget && approveMut.mutate({ registrationId: approveTarget.id })}
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
          <Text type="supporting" size="2xs">
            Nêu lý do từ chối, tối thiểu 3 ký tự.
          </Text>
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
              onClick={() => rejectTarget && rejectMut.mutate({ registrationId: rejectTarget.id, reason: rejectReason.trim() })}
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
        breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Đăng ký ca' }]}
      />
      <CmcTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
    </>
  );
}
