// Form chi tiết 1 ShiftRegistration — /hr/shifts/:registrationId
// Record-centric (TL06 / plan 260811-1408). Cold-start via shift.get.

import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  DetailPage,
  Dialog,
  DialogHeader,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  PageHeader,
  ResultPanel,
  SectionBlock,
  Stack,
  StatusBadge,
  TextArea,
  WorkflowStatusbar,
} from '@cmc/ui';
import { shiftRegistrationsPath, UUID_RE } from '@cmc/links';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { RecordLink } from '../../lib/record-link.js';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

const REG_STATUS_LABELS: Record<string, string> = {
  draft: 'Soạn',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

function fmtDate(v: unknown): string {
  return new Date(v as string).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  const [y, m, day] = dateStr.split('-');
  return `${day}-${m}-${y} - ${weekday}`;
}

function hoursBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins / 60 : 0;
}

function entryDateStr(date: string | Date): string {
  if (typeof date === 'string') return date.slice(0, 10);
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

type Step = { id: string; label: string };

function statusSteps(status: string): { steps: Step[]; activeIndex: number } {
  if (status === 'rejected') {
    return {
      steps: [
        { id: 'draft', label: 'Soạn' },
        { id: 'submitted', label: 'Chờ duyệt' },
        { id: 'rejected', label: 'Từ chối' },
      ],
      activeIndex: 2,
    };
  }
  if (status === 'cancelled') {
    return {
      steps: [
        { id: 'draft', label: 'Soạn' },
        { id: 'submitted', label: 'Chờ duyệt' },
        { id: 'cancelled', label: 'Đã hủy' },
      ],
      activeIndex: 2,
    };
  }
  const steps = [
    { id: 'draft', label: 'Soạn' },
    { id: 'submitted', label: 'Chờ duyệt' },
    { id: 'approved', label: 'Đã duyệt' },
  ];
  const activeIndex = status === 'approved' ? 2 : status === 'submitted' ? 1 : 0;
  return { steps, activeIndex };
}

function listBackPath(state: unknown): string {
  const scope =
    state &&
    typeof state === 'object' &&
    'listScope' in state &&
    ((state as { listScope?: string }).listScope === 'mine' ||
      (state as { listScope?: string }).listScope === 'inbox')
      ? (state as { listScope: 'mine' | 'inbox' }).listScope
      : undefined;
  return shiftRegistrationsPath(scope ? { scope } : undefined);
}

/** Schedule matrix — domain-specific grid (Odoo-like work schedule sheet). */
const MATRIX_CSS = `
.ws-mx { width:100%; border-collapse:collapse; font-size:13px; }
.ws-mx th, .ws-mx td { border:1px solid var(--console-border, #dee2e6); padding:7px 10px; }
.ws-mx thead th { background:var(--console-bg-subtle, #f1f3f5); font-size:12px; }
.ws-mx .h { text-align:right; font-variant-numeric:tabular-nums; }
.ws-ft { display:flex; justify-content:flex-end; gap:24px; padding:8px 12px; font-weight:600; background:var(--console-bg-subtle, #f8f9fa); border:1px solid var(--console-border, #dee2e6); border-top:0; }
`;

export default function ShiftsDetailPage() {
  const { registrationId = '' } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { canDo, me } = useSession();
  const canApprove = canDo('shift', 'approve');
  const idOk = UUID_RE.test(registrationId);

  const { data, isLoading, error, refetch } = trpc.shift.get.useQuery(
    { registrationId },
    { enabled: idOk },
  );

  const utils = trpc.useUtils();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const approveMut = trpc.shift.approve.useMutation({
    onSuccess() {
      setApproveOpen(false);
      setFlash({ ok: true, text: 'Đã duyệt (approved).' });
      void refetch();
      void utils.shift.pendingForApproval.invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setApproveOpen(false);
    },
  });
  const rejectMut = trpc.shift.reject.useMutation({
    onSuccess() {
      setRejectOpen(false);
      setRejectReason('');
      setFlash({ ok: true, text: 'Đã từ chối (rejected).' });
      void refetch();
      void utils.shift.pendingForApproval.invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
    },
  });
  const cancelMut = trpc.shift.cancel.useMutation({
    onSuccess() {
      setCancelOpen(false);
      setFlash({ ok: true, text: 'Đã hủy (cancelled).' });
      void refetch();
      void utils.shift.myRegistrations.invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setCancelOpen(false);
    },
  });

  if (!idOk) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Work Schedule', href: listBackPath(location.state) },
              { label: 'Không hợp lệ' },
            ]}
          />
        }
      >
        <EmptyState title="ID không hợp lệ" description="URL cần UUID phiếu đăng ký ca." />
      </DetailPage>
    );
  }

  if (isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Work Schedule', href: listBackPath(location.state) },
              { label: '…' },
            ]}
          />
        }
      >
        <ResultPanel status="loading" title="Đang tải phiếu đăng ký ca…" />
      </DetailPage>
    );
  }

  if (error || !data) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Work Schedule', href: listBackPath(location.state) },
              { label: 'Lỗi' },
            ]}
          />
        }
      >
        <EmptyState
          title="Không mở được phiếu"
          description={error?.message ?? 'Không tìm thấy hoặc không có quyền xem.'}
          action={
            <Link to={listBackPath(location.state)}>
              <Button label="Về danh sách" size="sm" variant="secondary" />
            </Link>
          }
        />
      </DetailPage>
    );
  }

  const templates = data.shiftGroup.templates ?? [];
  const entries = data.entries ?? [];
  const { steps, activeIndex } = statusSteps(data.status);
  const shortId = registrationId.slice(0, 8);
  const isOwner = me?.userId && data.appUser.userId === me.userId;
  const canCancel =
    (data.status === 'submitted' || data.status === 'approved') &&
    (isOwner || canApprove);
  const showApprove =
    canApprove && data.status === 'submitted' && data.appUser.userId !== me?.userId;

  // Matrix hours
  const byDate = new Map<string, Set<string>>();
  for (const e of entries) {
    const d = entryDateStr(e.date as string | Date);
    if (!byDate.has(d)) byDate.set(d, new Set());
    byDate.get(d)!.add(e.shiftTemplateId);
  }
  const dates = [...byDate.keys()].sort();
  let totalHours = 0;
  for (const d of dates) {
    for (const tid of byDate.get(d) ?? []) {
      const t = templates.find((x) => x.id === tid);
      if (t) totalHours += hoursBetween(t.startTime, t.endTime);
    }
  }

  const trackLabel = data.shiftGroup.type === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh';

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Nhân sự' },
            { label: 'Work Schedule', href: listBackPath(location.state) },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              {idOk ? (
                <CopyLinkButton mode="go" entity="shiftRegistration" id={registrationId} />
              ) : null}
              <Button
                label="Về danh sách"
                size="sm"
                variant="ghost"
                onClick={() => navigate(listBackPath(location.state))}
              />
            </HStack>
          }
        />
      }
      entity={
        <EntityHeader
          title={`Work Schedule / ${data.appUser.fullName}`}
          subtitle={`${data.shiftGroup.name} · ${trackLabel} · ${data.selectionMode}`}
          initials={data.appUser.fullName.slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge
              status={data.status}
              label={REG_STATUS_LABELS[data.status] ?? data.status}
            />
          }
          meta={
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {entries.length} ca · {totalHours.toFixed(2)} giờ
            </span>
          }
          actions={
            showApprove || canCancel ? (
              <HStack gap={1} wrap="wrap">
                {canCancel ? (
                  <Button
                    label="Hủy phiếu"
                    size="sm"
                    variant="ghost"
                    onClick={() => setCancelOpen(true)}
                  />
                ) : null}
                {showApprove ? (
                  <>
                    <Button
                      label="Từ chối"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setRejectOpen(true);
                        setRejectReason('');
                      }}
                    />
                    <Button
                      label="Duyệt"
                      size="sm"
                      variant="primary"
                      onClick={() => setApproveOpen(true)}
                    />
                  </>
                ) : null}
              </HStack>
            ) : undefined
          }
        />
      }
      summary={
        <HighlightStrip
          items={[
            {
              key: 'status',
              label: 'Trạng thái',
              value: (
                <StatusBadge
                  status={data.status}
                  label={REG_STATUS_LABELS[data.status] ?? data.status}
                />
              ),
            },
            { key: 'from', label: 'Từ ngày', value: fmtDate(data.fromDate) },
            { key: 'to', label: 'Tới ngày', value: fmtDate(data.toDate) },
            {
              key: 'hours',
              label: 'Tổng giờ',
              value: totalHours.toFixed(2),
              tabular: true,
            },
          ]}
        />
      }
      statusbar={<WorkflowStatusbar steps={steps} activeIndex={activeIndex} />}
    >
      <style>{MATRIX_CSS}</style>
      <div className="console-detail-panel">
        <Stack gap={3} style={{ padding: 'var(--cmc-space-3)' }}>
          {flash ? (
            <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} />
          ) : null}

          <SectionBlock
            title="Thông tin phiếu"
            description="Cùng khung form chứng từ Console (list → form · statusbar · sheet)."
          >
            <KeyValueList
              items={[
                {
                  key: 'person',
                  label: 'Nhân viên',
                  value: (
                    <RecordLink entity="staff" id={data.appUser.id}>
                      {data.appUser.fullName}
                    </RecordLink>
                  ),
                },
                {
                  key: 'group',
                  label: 'Nhóm ca',
                  value: `${data.shiftGroup.name} (${data.shiftGroup.selectionMode})`,
                },
                { key: 'track', label: 'Track', value: trackLabel },
                { key: 'from', label: 'Từ ngày', value: fmtDate(data.fromDate) },
                { key: 'to', label: 'Tới ngày', value: fmtDate(data.toDate) },
                { key: 'count', label: 'Số ca', value: String(entries.length) },
                ...(data.rejectReason
                  ? [{ key: 'reject', label: 'Lý do từ chối', value: data.rejectReason }]
                  : []),
              ]}
            />
          </SectionBlock>

          <SectionBlock
            title="Đăng ký lịch làm việc"
            description="Ma trận ngày × ca (đặc thù nghiệp vụ — không thay bằng chatter)."
          >
            <table className="ws-mx">
              <thead>
                <tr>
                  <th>Ngày</th>
                  {templates.map((t) => (
                    <th key={t.id}>
                      {t.name}
                      <div style={{ fontWeight: 400, fontSize: 'var(--cmc-font-size-column)', opacity: 0.75 }}>
                        {t.startTime}–{t.endTime}
                      </div>
                    </th>
                  ))}
                  <th className="h">Tổng giờ</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => {
                  const sel = byDate.get(d) ?? new Set();
                  let rowH = 0;
                  for (const tid of sel) {
                    const t = templates.find((x) => x.id === tid);
                    if (t) rowH += hoursBetween(t.startTime, t.endTime);
                  }
                  return (
                    <tr key={d}>
                      <td>{formatDayLabel(d)}</td>
                      {templates.map((t) => (
                        <td key={t.id}>{sel.has(t.id) ? '✓ Đi làm' : '—'}</td>
                      ))}
                      <td className="h">{rowH.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ws-ft">
              <span>Tổng ca làm việc: {entries.length}</span>
              <span>Tổng giờ: {totalHours.toFixed(2)}</span>
            </div>
          </SectionBlock>
        </Stack>
      </div>

      <ConfirmDialog
        opened={approveOpen}
        title="Duyệt đăng ký ca"
        message="submitted → approved?"
        confirmLabel="Duyệt"
        confirmColor="blue"
        loading={approveMut.isPending}
        onConfirm={() => approveMut.mutate({ registrationId })}
        onCancel={() => setApproveOpen(false)}
      />
      <ConfirmDialog
        opened={cancelOpen}
        title="Hủy đăng ký ca"
        message="Hủy phiếu? Không hoàn tác."
        confirmLabel="Hủy ca"
        confirmColor="red"
        loading={cancelMut.isPending}
        onConfirm={() => cancelMut.mutate({ registrationId })}
        onCancel={() => setCancelOpen(false)}
      />
      <Dialog
        isOpen={rejectOpen}
        onOpenChange={(n) => {
          if (!n && !rejectMut.isPending) {
            setRejectOpen(false);
            setRejectReason('');
          }
        }}
        width={420}
        purpose="form"
      >
        <DialogHeader
          title="Từ chối đăng ký ca"
          onOpenChange={(n) => {
            if (!n) {
              setRejectOpen(false);
              setRejectReason('');
            }
          }}
        />
        <Stack gap={2}>
          <TextArea
            label="Lý do từ chối"
            value={rejectReason}
            onChange={setRejectReason}
            rows={3}
            maxLength={2000}
            placeholder="Tối thiểu 3 ký tự…"
          />
          <HStack justify="end" gap={1}>
            <Button
              label="Hủy"
              size="sm"
              variant="secondary"
              onClick={() => {
                setRejectOpen(false);
                setRejectReason('');
              }}
            />
            <Button
              label="Từ chối"
              size="sm"
              variant="destructive"
              isDisabled={rejectReason.trim().length < 3}
              isLoading={rejectMut.isPending}
              onClick={() =>
                rejectMut.mutate({ registrationId, reason: rejectReason.trim() })
              }
            />
          </HStack>
        </Stack>
      </Dialog>
    </DetailPage>
  );
}
