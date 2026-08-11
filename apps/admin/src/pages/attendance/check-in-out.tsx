// Chấm công — ADR 0043 (docs/decisions/0043-attendance-daily-inout-pairing.md),
// plans/260713-1706-attendance-daily-inout-pairing/phase-07-frontend-punch-ticket-ui.md.
//
// Key invariants:
// - Bấm "Chấm công" → checkInOut.punch.mutate({}) (reason optional). UI never
//   self-calculates withinNetwork — server decides.
// - Success → nút hiện "Đã ghi nhận" ~5 giây rồi tự về "Chấm công" (bấm tiếp
//   được). Timer huỷ khi unmount hoặc bấm lại.
// - appCode OFFSITE_REASON_REQUIRED → mở modal nhập lý do; xác nhận gọi lại
//   punch({reason}). appCode COOLDOWN → banner cooldown, không mở modal.
// - KHÔNG còn form "chấm bù ngày quên" (manualPunch.create đã bị xoá ở backend
//   phase 4 — ADR 0043 §10).
// - "Phiếu của tôi" hiện Giờ vào/Giờ ra (checkInAt/checkOutAt); phiếu `rejected`
//   có nút "Gửi lại" → manualPunch.resubmit.mutate({ticketId, reason}).
// - Tab "Hàng chờ phiếu" chỉ hiện khi canDo('manualPunch','approve') — inbox
//   GĐ theo track (manualPunch.list({scope:'inbox'})), **index-only**: row
//   "Mở phiếu" → /hr/checkin/:ticketId (form owns Duyệt/Từ chối).
//   Tên tab resource-centric (phiếu), không product "Duyệt chấm công".

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  CmcTabs,
  DataTable,
  Dialog,
  DialogHeader,
  FormPage,
  HStack,
  PageHeader,
  Stack,
  StatusBadge,
  Text,
  TextArea,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { links } from '@cmc/links';
import { captureGeolocation, type CapturedGeo } from '../../lib/capture-geolocation.js';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

const PUNCH_RECORDED_DISPLAY_MS = 5_000;

function readAppCode(err: { data?: unknown; message?: string }): string | undefined {
  const data = err.data as { appCode?: unknown } | null | undefined;
  return typeof data?.appCode === 'string' ? data.appCode : undefined;
}

function readGeoThresholdM(err: { data?: unknown }): number | undefined {
  const data = err.data as { appData?: { geoThresholdM?: unknown } } | null | undefined;
  const v = data?.appData?.geoThresholdM;
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Client-side offsite message from local capture state + server geoThresholdM. */
export function offsiteGeoHint(
  captured: CapturedGeo | null,
  geoThresholdM: number | undefined,
): string {
  if (!captured) {
    return 'Không lấy được vị trí (bị chặn/timeout) — punch ghi nhận offsite, cần lý do.';
  }
  if (geoThresholdM !== undefined && captured.accuracyM > geoThresholdM) {
    return `GPS sai số ±${Math.round(captured.accuracyM)}m, vượt ngưỡng ${geoThresholdM}m — thử ra gần cửa sổ/ngoài trời rồi chấm lại.`;
  }
  return 'Bạn đang ngoài vùng cho phép.';
}

function fmtTime(v: unknown): string {
  return new Date(v as string).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

// ---------------------------------------------------------------------------
// Live clock (ICT)
// ---------------------------------------------------------------------------
function IctClock() {
  const fmtRef = useRef(
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );
  const [display, setDisplay] = useState(() => fmtRef.current.format(new Date()));

  useEffect(() => {
    const id = setInterval(() => setDisplay(fmtRef.current.format(new Date())), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Text type="body" size="2xl" weight="bold" display="block" justify="center" hasTabularNumbers>
      {display}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Offsite reason modal
// ---------------------------------------------------------------------------
function OffsiteReasonDialog({
  isOpen,
  isPending,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
  hint,
}: {
  isOpen: boolean;
  isPending: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  hint: string;
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(next) => { if (!next && !isPending) onClose(); }}
      width={420}
      purpose="form"
    >
      <DialogHeader title="Ngoài mạng cơ sở — nhập lý do" onOpenChange={(next) => { if (!next) onClose(); }} />
      <Stack gap={2}>
        <Text type="supporting" size="2xs">
          {hint}
        </Text>
        <TextArea
          label="Lý do"
          placeholder="Nêu lý do không thể chấm công qua IP cơ sở…"
          value={reason}
          onChange={onReasonChange}
          rows={3}
          maxLength={2000}
        />
        <HStack justify="end" gap={1}>
          <Button label="Hủy" variant="secondary" size="sm" onClick={onClose} />
          <Button
            label="Xác nhận"
            size="sm"
            isLoading={isPending}
            isDisabled={reason.trim().length === 0}
            onClick={() => onConfirm(reason.trim())}
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Resubmit dialog (rejected ticket → gửi lại lý do)
// ---------------------------------------------------------------------------
function ResubmitDialog({
  ticketId,
  isPending,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: {
  ticketId: string | null;
  isPending: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: (ticketId: string, reason: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      isOpen={ticketId !== null}
      onOpenChange={(next) => { if (!next && !isPending) onClose(); }}
      width={420}
      purpose="form"
    >
      <DialogHeader title="Gửi lại yêu cầu chấm công" onOpenChange={(next) => { if (!next) onClose(); }} />
      <Stack gap={2}>
        <TextArea
          label="Lý do gửi lại"
          placeholder="Bổ sung lý do để gửi lại xét duyệt…"
          value={reason}
          onChange={onReasonChange}
          rows={3}
          maxLength={2000}
        />
        <HStack justify="end" gap={1}>
          <Button label="Hủy" variant="secondary" size="sm" onClick={onClose} />
          <Button
            label="Gửi lại yêu cầu"
            size="sm"
            isLoading={isPending}
            isDisabled={reason.trim().length === 0}
            onClick={() => { if (ticketId) onConfirm(ticketId, reason.trim()); }}
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Phiếu của tôi — manualPunch.list({scope:'mine'})
// ---------------------------------------------------------------------------
interface MyTicketRow {
  id: string;
  ticketDate: string | Date;
  status: string;
  note: string;
  checkInAt: string | Date | null;
  checkOutAt: string | Date | null;
  [key: string]: unknown;
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  resubmitted: 'Đã gửi lại',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

function MyTicketsSection() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.manualPunch.list.useQuery({ scope: 'mine' });
  const [resubmitTarget, setResubmitTarget] = useState<string | null>(null);
  const [resubmitReason, setResubmitReason] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const resubmitMut = trpc.manualPunch.resubmit.useMutation({
    onSuccess() {
      // Clear ONLY on success — code-review finding: clearing on the confirm
      // click itself lost the user's typed reason if the mutation then failed
      // (dialog stayed open with an empty textarea).
      setResult({ ok: true, text: 'Đã gửi lại yêu cầu, chờ duyệt.' });
      setResubmitTarget(null);
      setResubmitReason('');
      void utils.manualPunch.list.invalidate();
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
    },
  });

  const rows = (data as MyTicketRow[] | undefined) ?? [];

  const columns: TableColumn<MyTicketRow>[] = [
    {
      key: 'ticketDate',
      label: 'Ngày',
      render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
    },
    { key: 'checkInAt', label: 'Giờ vào', render: fmtDateTime },
    { key: 'checkOutAt', label: 'Giờ ra', render: fmtDateTime },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 130,
      render: (v) => (
        <StatusBadge status={String(v)} label={TICKET_STATUS_LABELS[String(v)] ?? String(v)} />
      ),
    },
    { key: 'note', label: 'Lý do' },
    {
      key: '_actions',
      label: '',
      width: 100,
      render: (_v, row) =>
        row.status === 'rejected' ? (
          <Button label="Gửi lại" size="sm" variant="ghost" onClick={() => setResubmitTarget(row.id)} />
        ) : null,
    },
  ];

  return (
    <div>
      <Text
        type="supporting"
        size="xsm"
        weight="semibold"
        style={{ textTransform: 'uppercase', marginBottom: 'var(--cmc-space-1)' }}
      >
        Phiếu của tôi
      </Text>
      {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}
      <DataTable<MyTicketRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có yêu cầu chấm công thủ công nào."
      />
      <ResubmitDialog
        ticketId={resubmitTarget}
        isPending={resubmitMut.isPending}
        reason={resubmitReason}
        onReasonChange={setResubmitReason}
        onConfirm={(ticketId, reason) => resubmitMut.mutate({ ticketId, reason })}
        onClose={() => { setResubmitTarget(null); setResubmitReason(''); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hàng chờ phiếu — inbox GĐ theo track (manualPunch.list scope=inbox)
// ---------------------------------------------------------------------------
interface InboxTicketRow {
  id: string;
  ticketDate: string | Date;
  checkInAt: string | Date | null;
  checkOutAt: string | Date | null;
  note: string;
  appUser: { fullName: string };
  [key: string]: unknown;
}

interface GeoSummaryRow {
  appUserId: string;
  fullName: string;
  geoPunchCount: number;
  lastGeoPunchAt: string | Date;
  [key: string]: unknown;
}

function ApproveTicketsTab() {
  const navigate = useNavigate();
  const { data, isLoading, error } = trpc.manualPunch.list.useQuery({ scope: 'inbox' });
  const geoSummary = trpc.checkInOut.geoPunchSummary.useQuery({ days: 30 });

  const rows = (data as InboxTicketRow[] | undefined) ?? [];
  const geoRows = (geoSummary.data as GeoSummaryRow[] | undefined) ?? [];

  function openTicket(row: InboxTicketRow) {
    navigate(links.manualPunchTicket(row.id), { state: { listScope: 'inbox' as const } });
  }

  const columns: TableColumn<InboxTicketRow>[] = [
    { key: 'appUser', label: 'Nhân viên', render: (_v, row) => row.appUser.fullName },
    {
      key: 'ticketDate',
      label: 'Ngày',
      render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
    },
    { key: 'checkInAt', label: 'Giờ vào', render: fmtDateTime },
    { key: 'checkOutAt', label: 'Giờ ra', render: fmtDateTime },
    { key: 'note', label: 'Lý do' },
    {
      key: '_actions',
      label: '',
      width: 120,
      render: (_v, row) => (
        <Button label="Mở phiếu" size="sm" variant="primary" onClick={() => openTicket(row)} />
      ),
    },
  ];

  const geoColumns: TableColumn<GeoSummaryRow>[] = [
    { key: 'fullName', label: 'Nhân viên' },
    { key: 'geoPunchCount', label: 'Số punch GPS', width: 120 },
    {
      key: 'lastGeoPunchAt',
      label: 'Lần cuối',
      width: 160,
      render: (v) => fmtDateTime(v),
    },
  ];

  return (
    <Stack gap={2} padding={4}>
      <DataTable<InboxTicketRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Không có yêu cầu chờ duyệt."
        onRowClick={openTicket}
      />

      <Stack gap={1} style={{ marginTop: 'var(--cmc-space-3)' }}>
        <Text type="body" size="sm" weight="semibold">
          Chấm công GPS gần đây
        </Text>
        <DataTable<GeoSummaryRow>
          columns={geoColumns}
          data={geoRows}
          loading={geoSummary.isLoading}
          empty="Không có punch GPS 30 ngày qua."
        />
      </Stack>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Chấm công tab (main punch UI)
// ---------------------------------------------------------------------------
type PunchAlert =
  | { kind: 'none' }
  | { kind: 'locating' }
  | { kind: 'success'; timeStr: string }
  | { kind: 'offsite_reason_required' }
  | { kind: 'cooldown' }
  | { kind: 'error'; msg: string };

function CheckInTab() {
  const utils = trpc.useUtils();
  const [punchAlert, setPunchAlert] = useState<PunchAlert>({ kind: 'none' });
  const [recorded, setRecorded] = useState(false);
  const [offsiteModalOpen, setOffsiteModalOpen] = useState(false);
  const [offsiteReason, setOffsiteReason] = useState('');
  const [capturing, setCapturing] = useState(false);
  /** Keep last geo for offsite-reason retry — do not re-capture. */
  const capturedGeoRef = useRef<CapturedGeo | null>(null);
  const [offsiteHint, setOffsiteHint] = useState(
    'Thiết bị không khớp dải mạng WiFi cơ sở. Nhập lý do để ghi nhận — quản lý sẽ xét duyệt.',
  );
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
  }, []);

  const punchMut = trpc.checkInOut.punch.useMutation({
    onSuccess(data) {
      setPunchAlert({ kind: 'success', timeStr: fmtTime((data as { punchAt: unknown }).punchAt) });
      // Code-review finding: Astryx's Dialog.onOpenChange only fires on
      // user-initiated dismissal (Escape/backdrop), not this programmatic
      // close — clear the reason HERE (not relying on the dialog's own
      // close handler) so stale text can't reappear on the next offsite punch.
      setOffsiteModalOpen(false);
      setOffsiteReason('');
      capturedGeoRef.current = null;
      setRecorded(true);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => setRecorded(false), PUNCH_RECORDED_DISPLAY_MS);
      void utils.manualPunch.list.invalidate();
    },
    onError(err) {
      const appCode = readAppCode(err);
      if (appCode === 'OFFSITE_REASON_REQUIRED') {
        setOffsiteHint(offsiteGeoHint(capturedGeoRef.current, readGeoThresholdM(err)));
        setPunchAlert({ kind: 'offsite_reason_required' });
        setOffsiteModalOpen(true);
      } else if (appCode === 'COOLDOWN') {
        setPunchAlert({ kind: 'cooldown' });
      } else {
        setPunchAlert({ kind: 'error', msg: err.message ?? 'Lỗi không xác định.' });
      }
    },
  });

  async function handlePunch() {
    setCapturing(true);
    setPunchAlert({ kind: 'locating' });
    const geo = await captureGeolocation();
    capturedGeoRef.current = geo;
    setCapturing(false);
    punchMut.mutate(geo ? { geo } : {});
  }

  const resultContent =
    punchAlert.kind === 'locating' ? (
      <Banner status="info" title="Đang lấy vị trí…" description="Có thể mất vài giây. Nếu bị chặn, chấm công vẫn tiếp tục." />
    ) : punchAlert.kind === 'success' ? (
      <Banner
        status="success"
        title="Đã ghi nhận"
        description={`Chấm công lúc ${punchAlert.timeStr}. Nếu chưa có ca đã duyệt, hệ thống ghi nhận và chờ review — không áp phạt tự động.`}
      />
    ) : punchAlert.kind === 'offsite_reason_required' ? (
      <Banner
        status="warning"
        title="Ngoài mạng cơ sở — cần nhập lý do"
        description={offsiteHint}
      />
    ) : punchAlert.kind === 'cooldown' ? (
      <Banner
        status="warning"
        title="Chờ cooldown"
        description="Vừa chấm công trong 10 giây gần đây. Thử lại sau."
      />
    ) : punchAlert.kind === 'error' ? (
      <Banner status="error" title="Lỗi chấm công" description={punchAlert.msg} />
    ) : undefined;

  const busy = punchMut.isPending || capturing;
  const punchLabel = recorded
    ? 'Đã chấm công ✓'
    : capturing
      ? 'Đang lấy vị trí…'
      : 'Chấm công';

  return (
    <FormPage header={null} actions={null} result={resultContent}>
      <Stack gap={4} style={{ maxWidth: 640, marginInline: 'auto' /* layout center; not a spacing token */ }}>
        {/* Primary punch surface — large single CTA (Odoo/TEKY grammar, CMC Console chrome). */}
        <Card
          padding={6}
          data-testid="check-in-punch-card"
          style={{
            border: '1px solid var(--cmc-border)',
            boxShadow: 'var(--cmc-shadow-sm, 0 1px 3px rgba(0,0,0,.08))',
          }}
        >
          <Stack hAlign="center" gap={4}>
            <Text type="body" size="lg" weight="semibold" style={{ textAlign: 'center' }}>
              Chấm vào / chấm ra
            </Text>
            <Text type="supporting" size="sm" style={{ textAlign: 'center', maxWidth: 360 }}>
              Bấm một lần để ghi nhận. Ngoài mạng cơ sở hệ thống sẽ yêu cầu lý do — không tạo phiếu bù ngày quá khứ.
            </Text>
            <IctClock />
            <Button
              label={punchLabel}
              size="lg"
              isLoading={busy && !recorded}
              isDisabled={recorded}
              onClick={() => void handlePunch()}
              style={{
                minWidth: 220,
                minHeight: 52,
                fontWeight: 600,
              }}
            />
            <Text type="supporting" size="2xs" style={{ textAlign: 'center' }}>
              Trình duyệt có thể hỏi quyền vị trí — từ chối vẫn chấm được (cần lý do nếu ngoài mạng).
            </Text>
          </Stack>
        </Card>

        <Banner
          status="info"
          title="Ghi nhận không cần ca"
          description={
            <>
              Nếu chưa có ca đã duyệt, hệ thống{' '}
              <Text type="body" size="sm" weight="semibold" as="span">
                ghi nhận và chờ review
              </Text>{' '}
              — không tự áp phạt. Phạt (nếu có) chỉ được tính khi xử lý bảng lương cuối kỳ.
            </>
          }
        />

        <MyTicketsSection />
      </Stack>

      <OffsiteReasonDialog
        isOpen={offsiteModalOpen}
        isPending={punchMut.isPending}
        reason={offsiteReason}
        onReasonChange={setOffsiteReason}
        hint={offsiteHint}
        onConfirm={(reason) => {
          const geo = capturedGeoRef.current;
          punchMut.mutate(geo ? { reason, geo } : { reason });
        }}
        onClose={() => { setOffsiteModalOpen(false); setOffsiteReason(''); }}
      />
    </FormPage>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function CheckInOutPage() {
  const { canDo } = useSession();
  const canApprove = canDo('manualPunch', 'approve');
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = searchParams.get('scope');
  const defaultTab = canApprove && scope === 'inbox' ? 'approve' : 'checkin';
  const [activeTab, setActiveTab] = useState(defaultTab);

  function onTabChange(id: string) {
    setActiveTab(id);
    if (id === 'approve') setSearchParams({ scope: 'inbox' }, { replace: true });
    else setSearchParams({}, { replace: true });
  }

  const tabs = [
    // Tab label ≠ punch button label ("Chấm công") so a11y roles stay unique.
    { id: 'checkin', label: 'Tự chấm', content: <CheckInTab /> },
    ...(canApprove
      ? [{ id: 'approve', label: 'Hàng chờ phiếu', content: <ApproveTicketsTab /> }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Chấm công"
        subtitle={
          canApprove
            ? 'Danh sách phiếu · mở form để duyệt/từ chối (không duyệt trên list)'
            : undefined
        }
        breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Chấm công' }]}
      />
      <CmcTabs activeTab={activeTab} onTabChange={onTabChange} tabs={tabs} />
    </>
  );
}
