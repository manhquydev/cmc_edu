// Form chi tiết 1 ManualAttendanceTicket — /hr/checkin/:ticketId
// Resource-centric form-depth (docs/ux-resource-centric-structure.md).
// List (Hàng chờ) is index-only; HITL Duyệt/Từ chối lives here with ConfirmDialog.

import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
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
  Text,
  TextArea,
  WorkflowStatusbar,
} from '@cmc/ui';
import { checkInPath, UUID_RE } from '@cmc/links';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

const TICKET_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  resubmitted: 'Gửi lại',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

function fmtDate(v: unknown): string {
  return new Date(v as string).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  return new Date(v as string).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtTime(v: unknown): string {
  return new Date(v as string).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function verificationBadge(v: string): { label: string; variant: 'success' | 'warning' | 'neutral' } {
  switch (v) {
    case 'network':
      return { label: 'Mạng cơ sở', variant: 'success' };
    case 'geo':
      return { label: 'GPS', variant: 'warning' };
    case 'open':
      return { label: 'Không kiểm chứng', variant: 'neutral' };
    default:
      return { label: 'Offsite', variant: 'neutral' };
  }
}

type Step = { id: string; label: string };

function statusSteps(status: string): { steps: Step[]; activeIndex: number } {
  if (status === 'rejected') {
    return {
      steps: [
        { id: 'pending', label: 'Chờ duyệt' },
        { id: 'rejected', label: 'Từ chối' },
      ],
      activeIndex: 1,
    };
  }
  if (status === 'approved') {
    return {
      steps: [
        { id: 'pending', label: 'Chờ duyệt' },
        { id: 'approved', label: 'Đã duyệt' },
      ],
      activeIndex: 1,
    };
  }
  // pending | resubmitted
  return {
    steps: [
      { id: 'pending', label: status === 'resubmitted' ? 'Gửi lại' : 'Chờ duyệt' },
      { id: 'approved', label: 'Đã duyệt' },
    ],
    activeIndex: 0,
  };
}

function listBackPath(state: unknown): string {
  const scope =
    state &&
    typeof state === 'object' &&
    'listScope' in state &&
    ((state as { listScope?: string }).listScope === 'mine' ||
      (state as { listScope?: string }).listScope === 'inbox')
      ? (state as { listScope: 'mine' | 'inbox' }).listScope
      : 'inbox';
  return checkInPath({ scope });
}

interface DayPunchRow {
  punchAt: string | Date;
  verification: string;
  accuracyM: number | null;
  geofenceDistanceM: number | null;
  matchedRadiusM: number | null;
}

export default function CheckInTicketDetailPage() {
  const { ticketId = '' } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { canDo, me } = useSession();
  const canApprove = canDo('manualPunch', 'approve');
  const idOk = UUID_RE.test(ticketId);

  const { data, isLoading, error, refetch } = trpc.manualPunch.get.useQuery(
    { ticketId },
    { enabled: idOk },
  );

  const dayPunchesQuery = trpc.manualPunch.dayPunches.useQuery(
    { ticketId },
    { enabled: idOk && canApprove && Boolean(data) },
  );

  const utils = trpc.useUtils();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function invalidate() {
    void refetch();
    void utils.manualPunch.list.invalidate();
    void utils.checkInOut.geoPunchSummary.invalidate();
  }

  const approveMut = trpc.manualPunch.approve.useMutation({
    onSuccess(res) {
      setApproveOpen(false);
      const warnings = (res as { warnings?: string[] })?.warnings ?? [];
      const extra =
        warnings.includes('SINGLE_PUNCH_NO_CREDIT')
          ? ' (cảnh báo: 1 mốc punch — ngày có thể 0 credit)'
          : warnings.includes('PAYSLIP_FINALIZED')
            ? ' (cảnh báo: kỳ lương đã chốt)'
            : '';
      setFlash({ ok: true, text: `Đã duyệt yêu cầu chấm công.${extra}` });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setApproveOpen(false);
    },
  });

  const rejectMut = trpc.manualPunch.reject.useMutation({
    onSuccess() {
      setRejectOpen(false);
      setRejectReason('');
      setFlash({ ok: true, text: 'Đã từ chối yêu cầu chấm công.' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
    },
  });

  if (!idOk) {
    return (
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Chấm công', href: checkInPath() },
              { label: 'Phiếu' },
            ]}
          />
        }
      >
        <EmptyState title="Mã phiếu không hợp lệ" description="UUID ticketId required." />
      </DetailPage>
    );
  }

  if (isLoading) {
    return (
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Chấm công', href: listBackPath(location.state) },
              { label: '…' },
            ]}
          />
        }
      >
        <Text type="supporting" size="sm">
          Đang tải phiếu…
        </Text>
      </DetailPage>
    );
  }

  if (error || !data) {
    return (
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Chấm công', href: listBackPath(location.state) },
              { label: 'Phiếu' },
            ]}
          />
        }
      >
        <ResultPanel
          status="error"
          title="Không mở được phiếu"
          description={error?.message ?? 'Ticket not found.'}
          primaryAction={{
            label: 'Về danh sách',
            onClick: () => navigate(listBackPath(location.state)),
          }}
        />
      </DetailPage>
    );
  }

  const status = data.status as string;
  const actionable = status === 'pending' || status === 'resubmitted';
  const isOwner = Boolean(me?.userId && data.appUser.userId === me.userId);
  const showApprove = canApprove && actionable && !isOwner;
  const { steps, activeIndex } = statusSteps(status);
  const dayPunches = (dayPunchesQuery.data as DayPunchRow[] | undefined) ?? [];
  const shortId = ticketId.slice(0, 8);

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Nhân sự' },
            { label: 'Chấm công', href: listBackPath(location.state) },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              {idOk ? (
                <CopyLinkButton mode="go" entity="manualPunchTicket" id={ticketId} />
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
          title={`Chấm công / ${data.appUser.fullName}`}
          subtitle={`Ngày ${fmtDate(data.ticketDate)}`}
          initials={data.appUser.fullName.slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge
              status={status}
              label={TICKET_STATUS_LABELS[status] ?? status}
            />
          }
          actions={
            showApprove ? (
              <HStack gap={1} wrap="wrap">
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
                  status={status}
                  label={TICKET_STATUS_LABELS[status] ?? status}
                />
              ),
            },
            { key: 'date', label: 'Ngày', value: fmtDate(data.ticketDate) },
            { key: 'in', label: 'Giờ vào', value: fmtDateTime(data.checkInAt) },
            { key: 'out', label: 'Giờ ra', value: fmtDateTime(data.checkOutAt) },
          ]}
        />
      }
      statusbar={<WorkflowStatusbar steps={steps} activeIndex={activeIndex} />}
    >
      <div className="console-detail-panel">
        <Stack gap={3} style={{ padding: 'var(--cmc-space-3)' }}>
          {flash ? (
            <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} />
          ) : null}

          <SectionBlock
            title="Thông tin phiếu"
            description="List chỉ mở phiếu — duyệt/từ chối trên form."
          >
            <KeyValueList
              items={[
                { key: 'person', label: 'Nhân viên', value: data.appUser.fullName },
                { key: 'date', label: 'Ngày', value: fmtDate(data.ticketDate) },
                { key: 'in', label: 'Giờ vào', value: fmtDateTime(data.checkInAt) },
                { key: 'out', label: 'Giờ ra', value: fmtDateTime(data.checkOutAt) },
                { key: 'note', label: 'Lý do', value: data.note || '—' },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: TICKET_STATUS_LABELS[status] ?? status,
                },
              ]}
            />
          </SectionBlock>

          {canApprove ? (
            <SectionBlock
              title="Punch trong ngày"
              description="Snapshot verification (không lộ lat/lng/IP)."
            >
              {dayPunchesQuery.isLoading ? (
                <Text type="supporting" size="2xs">
                  Đang tải punch…
                </Text>
              ) : dayPunches.length === 0 ? (
                <Text type="supporting" size="2xs">
                  Không có punch trong ngày.
                </Text>
              ) : (
                <table
                  style={{
                    width: '100%',
                    fontSize: 'var(--cmc-font-size-data)',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 'var(--cmc-space-1) 0' }}>Giờ</th>
                      <th style={{ textAlign: 'left', padding: 'var(--cmc-space-1) 0' }}>Nhãn</th>
                      <th style={{ textAlign: 'left', padding: 'var(--cmc-space-1) 0' }}>Sai số</th>
                      <th style={{ textAlign: 'left', padding: 'var(--cmc-space-1) 0' }}>
                        Khoảng cách
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayPunches.map((p, i) => {
                      const badge = verificationBadge(p.verification);
                      const dist =
                        p.geofenceDistanceM != null && p.matchedRadiusM != null
                          ? `cách tâm ${Math.round(p.geofenceDistanceM)}m (bán kính ${p.matchedRadiusM}m)`
                          : '—';
                      return (
                        <tr key={i}>
                          <td style={{ padding: 'var(--cmc-space-1) 0' }}>{fmtTime(p.punchAt)}</td>
                          <td style={{ padding: 'var(--cmc-space-1) 0' }}>
                            <Badge label={badge.label} variant={badge.variant} />
                          </td>
                          <td style={{ padding: 'var(--cmc-space-1) 0' }}>
                            {p.accuracyM != null ? `±${Math.round(p.accuracyM)}m` : '—'}
                          </td>
                          <td style={{ padding: 'var(--cmc-space-1) 0' }}>{dist}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </SectionBlock>
          ) : null}
        </Stack>
      </div>

      <ConfirmDialog
        opened={approveOpen}
        title="Duyệt yêu cầu chấm công"
        message="pending|resubmitted → approved?"
        confirmLabel="Duyệt"
        confirmColor="blue"
        loading={approveMut.isPending}
        onConfirm={() => approveMut.mutate({ ticketId })}
        onCancel={() => setApproveOpen(false)}
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
          title="Từ chối yêu cầu chấm công"
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
            placeholder="Nêu lý do từ chối…"
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
              isDisabled={rejectReason.trim().length === 0}
              isLoading={rejectMut.isPending}
              onClick={() =>
                rejectMut.mutate({ ticketId, note: rejectReason.trim() })
              }
            />
          </HStack>
        </Stack>
      </Dialog>
    </DetailPage>
  );
}
