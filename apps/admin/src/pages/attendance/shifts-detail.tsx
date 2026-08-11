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
  HStack,
  PageHeader,
  ResultPanel,
  Stack,
  StatusBadge,
  Text,
  TextArea,
} from '@cmc/ui';
import { shiftRegistrationsPath, UUID_RE } from '@cmc/links';
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

const STATUS_CSS = `
.ws-detail-bar { display:flex; gap:0; list-style:none; margin:0; padding:0; height:30px; --a:11px; }
.ws-detail-bar li { margin-left:calc(var(--a) * -1); }
.ws-detail-bar li:first-child { margin-left:0; }
.ws-detail-bar span {
  display:flex; align-items:center; justify-content:center;
  padding:0 calc(var(--a) + 12px); height:100%; font-size:11px; font-weight:600;
  letter-spacing:.03em; text-transform:uppercase; white-space:nowrap;
  background:#e9ecef; color:#868e96;
  clip-path: polygon(0 0, calc(100% - var(--a)) 0, 100% 50%, calc(100% - var(--a)) 100%, 0 100%, var(--a) 50%);
}
.ws-detail-bar li:first-child span {
  clip-path: polygon(0 0, calc(100% - var(--a)) 0, 100% 50%, calc(100% - var(--a)) 100%, 0 100%);
  padding-left:14px;
}
.ws-detail-bar li:last-child span {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, var(--a) 50%);
  padding-right:14px;
}
.ws-detail-bar li.is-done span { background:#d3f9d8; color:#2b8a3e; }
.ws-detail-bar li.is-current span { background:#00a09d; color:#fff; z-index:1; }
.ws-detail-bar li.is-bad span { background:#fa5252; color:#fff; }
.ws-mx { width:100%; border-collapse:collapse; font-size:13px; }
.ws-mx th, .ws-mx td { border:1px solid #dee2e6; padding:7px 10px; }
.ws-mx thead th { background:#f1f3f5; font-size:12px; }
.ws-mx .h { text-align:right; font-variant-numeric:tabular-nums; }
.ws-ft { display:flex; justify-content:flex-end; gap:24px; padding:8px 12px; font-weight:600; background:#f8f9fa; border:1px solid #dee2e6; border-top:0; }
.ws-kv { display:grid; grid-template-columns:140px 1fr; gap:6px 12px; font-size:13px; margin:12px 0; }
.ws-kv dt { color:#495057; font-weight:500; }
.ws-kv dd { margin:0; }
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

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          title="Work Schedule"
          subtitle={`${data.appUser.fullName} · ${data.shiftGroup.name}`}
          breadcrumbs={[
            { label: 'Nhân sự' },
            { label: 'Work Schedule', href: listBackPath(location.state) },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              {canCancel ? (
                <Button label="Hủy phiếu" size="sm" variant="ghost" onClick={() => setCancelOpen(true)} />
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
          }
        />
      }
      statusbar={
        <>
          <style>{STATUS_CSS}</style>
          <ol className="ws-detail-bar" aria-label="Trạng thái phiếu">
            {steps.map((s, i) => {
              const state =
                s.id === 'rejected' || s.id === 'cancelled'
                  ? i === activeIndex
                    ? 'bad'
                    : i < activeIndex
                      ? 'done'
                      : 'todo'
                  : i < activeIndex
                    ? 'done'
                    : i === activeIndex
                      ? 'current'
                      : 'todo';
              return (
                <li
                  key={s.id}
                  className={
                    state === 'bad' ? 'is-bad' : state === 'done' ? 'is-done' : state === 'current' ? 'is-current' : ''
                  }
                >
                  <span aria-current={i === activeIndex ? 'step' : undefined}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        </>
      }
      entity={
        <EntityHeader
          title={`Work Schedule / ${data.appUser.fullName}`}
          subtitle={`${data.shiftGroup.name} · ${data.shiftGroup.type === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh'} · ${data.selectionMode}`}
          initials={data.appUser.fullName.slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge
              status={data.status}
              label={REG_STATUS_LABELS[data.status] ?? data.status}
            />
          }
        />
      }
    >
      <style>{STATUS_CSS}</style>
      {flash ? (
        <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} />
      ) : null}

      <dl className="ws-kv">
        <dt>Từ ngày</dt>
        <dd>{fmtDate(data.fromDate)}</dd>
        <dt>Tới ngày</dt>
        <dd>{fmtDate(data.toDate)}</dd>
        <dt>Nhóm ca</dt>
        <dd>
          {data.shiftGroup.name} ({data.shiftGroup.selectionMode})
        </dd>
        <dt>Số ca</dt>
        <dd>{entries.length}</dd>
        {data.rejectReason ? (
          <>
            <dt>Lý do từ chối</dt>
            <dd>{data.rejectReason}</dd>
          </>
        ) : null}
      </dl>

      <Text type="body" size="sm" weight="semibold">
        Đăng ký lịch làm việc
      </Text>
      <table className="ws-mx">
        <thead>
          <tr>
            <th>Ngày</th>
            {templates.map((t) => (
              <th key={t.id}>
                {t.name}
                <div style={{ fontWeight: 400, fontSize: 11, opacity: 0.75 }}>
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

      <HStack gap={1} style={{ marginTop: 16 }}>
        <Button
          label="Về danh sách"
          size="sm"
          variant="secondary"
          onClick={() => navigate(listBackPath(location.state))}
        />
      </HStack>

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
