// Phiếu KPI form — /hr/kpi/:scoreId (resource-centric shared workspace).
// Cold-start via kpi.get. Domain gates unchanged (managerId / track / bulk).

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  NumberInput,
  PageHeader,
  ResultPanel,
  Stack,
  StatusBadge,
  Text,
  TextArea,
} from '@cmc/ui';
import { kpiScoresPath, UUID_RE } from '@cmc/links';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  approved: 'Đã duyệt',
};

function statusSteps(status: string): { steps: { id: string; label: string }[]; activeIndex: number } {
  const steps = [
    { id: 'draft', label: 'Nháp' },
    { id: 'submitted', label: 'Chờ xác nhận' },
    { id: 'confirmed', label: 'Đã xác nhận' },
    { id: 'approved', label: 'Đã duyệt' },
  ];
  const idx =
    status === 'approved' ? 3 : status === 'confirmed' ? 2 : status === 'submitted' ? 1 : 0;
  return { steps, activeIndex: idx };
}

export default function KpiDetailPage() {
  const { scoreId = '' } = useParams<{ scoreId: string }>();
  const navigate = useNavigate();
  const { canDo, me } = useSession();
  const idOk = UUID_RE.test(scoreId);

  const { data, isLoading, error, refetch } = trpc.kpi.get.useQuery(
    { scoreId },
    { enabled: idOk },
  );

  const utils = trpc.useUtils();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideValue, setOverrideValue] = useState<number | undefined>(undefined);
  const [overrideReason, setOverrideReason] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function invalidate() {
    void refetch();
    void utils.kpi.list.invalidate();
    void utils.kpi.myScore.invalidate();
  }

  const confirmMut = trpc.kpi.confirm.useMutation({
    onSuccess() {
      setConfirmOpen(false);
      setFlash({ ok: true, text: 'Đã xác nhận phiếu KPI.' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setConfirmOpen(false);
    },
  });

  const overrideMut = trpc.kpi.override.useMutation({
    onSuccess() {
      setOverrideOpen(false);
      setOverrideReason('');
      setFlash({ ok: true, text: 'Đã ghi đè giá trị KPI.' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
    },
  });

  if (!idOk) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'KPI', href: kpiScoresPath() },
              { label: 'Không hợp lệ' },
            ]}
          />
        }
      >
        <EmptyState title="ID không hợp lệ" description="URL cần UUID phiếu KPI." />
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
              { label: 'KPI', href: kpiScoresPath() },
              { label: '…' },
            ]}
          />
        }
      >
        <ResultPanel status="loading" title="Đang tải phiếu KPI…" />
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
              { label: 'KPI', href: kpiScoresPath() },
              { label: 'Lỗi' },
            ]}
          />
        }
      >
        <EmptyState
          title="Không mở được phiếu"
          description={error?.message ?? 'Không tìm thấy hoặc không có quyền xem.'}
          action={
            <Link to={kpiScoresPath()}>
              <Button label="Về danh sách" size="sm" variant="secondary" />
            </Link>
          }
        />
      </DetailPage>
    );
  }

  const { steps, activeIndex } = statusSteps(data.status);
  const shortId = scoreId.slice(0, 8);
  const isOwner = data.appUser.userId === me?.userId;
  const showConfirm =
    canDo('kpi', 'confirm') && data.status === 'submitted' && !isOwner;
  const showOverride =
    canDo('kpi', 'approve') &&
    (data.status === 'submitted' || data.status === 'confirmed') &&
    !isOwner;
  const overrideOk =
    overrideValue !== undefined && overrideValue >= 0 && overrideReason.trim().length >= 1;

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          title="Phiếu KPI"
          subtitle={`${data.fullName ?? data.appUser.fullName} · ${data.period}`}
          breadcrumbs={[
            { label: 'Nhân sự' },
            { label: 'KPI', href: kpiScoresPath({ period: data.period }) },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="kpiScore" id={scoreId} />
              {showConfirm ? (
                <Button
                  label="Xác nhận"
                  size="sm"
                  variant="primary"
                  onClick={() => setConfirmOpen(true)}
                />
              ) : null}
              {showOverride ? (
                <Button
                  label="Ghi đè"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setOverrideValue(Number(data.value));
                    setOverrideReason('');
                    setOverrideOpen(true);
                  }}
                />
              ) : null}
              <Button
                label="Về danh sách"
                size="sm"
                variant="ghost"
                onClick={() => navigate(kpiScoresPath({ period: data.period }))}
              />
            </HStack>
          }
        />
      }
      statusbar={
        <HStack gap={1} wrap="wrap">
          {steps.map((s, i) => (
            <StatusBadge
              key={s.id}
              status={i === activeIndex ? 'info' : i < activeIndex ? 'success' : 'neutral'}
              label={s.label}
            />
          ))}
        </HStack>
      }
      entity={
        <EntityHeader
          title={data.fullName ?? data.appUser.fullName}
          subtitle={`${data.position ?? '—'} · kỳ ${data.period}`}
          initials={(data.fullName ?? data.appUser.fullName).slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge
              status={data.status}
              label={STATUS_LABELS[data.status] ?? data.status}
            />
          }
        />
      }
    >
      <Stack gap={2} padding={4}>
        {flash ? (
          <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} />
        ) : null}
        {data.tierMissing ? (
          <Banner status="warning" title="Chưa gán bậc lương — nộp phiếu có thể bị chặn." />
        ) : null}
        <Text type="body" size="sm">
          Giá trị KPI:{' '}
          <strong>{Number(data.value).toLocaleString('vi-VN')} đ</strong>
          {data.override ? ' (đã ghi đè)' : ''}
        </Text>
        {data.overrideReason ? (
          <Text type="body" size="xsm" color="secondary">
            Lý do ghi đè: {data.overrideReason}
          </Text>
        ) : null}
        <Text type="body" size="xsm" color="secondary">
          Trạng thái máy: {data.status}. Tất toán (approved) chỉ qua «Đã trả lương kỳ» trên
          board.
        </Text>
      </Stack>

      <ConfirmDialog
        opened={confirmOpen}
        title="Xác nhận điểm KPI"
        message={`Xác nhận phiếu của ${data.fullName ?? data.appUser.fullName} kỳ ${data.period}?`}
        confirmLabel="Xác nhận"
        confirmColor="blue"
        loading={confirmMut.isPending}
        onConfirm={() => confirmMut.mutate({ kpiScoreId: scoreId })}
        onCancel={() => setConfirmOpen(false)}
      />

      <Dialog
        isOpen={overrideOpen}
        onOpenChange={(next) => {
          if (!next && !overrideMut.isPending) setOverrideOpen(false);
        }}
        width={420}
        purpose="form"
      >
        <DialogHeader
          title="Ghi đè giá trị KPI"
          onOpenChange={(next) => {
            if (!next && !overrideMut.isPending) setOverrideOpen(false);
          }}
        />
        <Stack gap={2}>
          <NumberInput
            label="Giá trị mới (VND)"
            min={0}
            value={overrideValue}
            onChange={setOverrideValue}
          />
          <TextArea
            label="Lý do ghi đè"
            value={overrideReason}
            onChange={setOverrideReason}
            rows={3}
            maxLength={2000}
          />
          <HStack justify="end" gap={1}>
            <Button
              label="Hủy"
              size="sm"
              variant="secondary"
              isDisabled={overrideMut.isPending}
              onClick={() => setOverrideOpen(false)}
            />
            <Button
              label="Ghi đè"
              size="sm"
              variant="primary"
              isLoading={overrideMut.isPending}
              isDisabled={!overrideOk}
              onClick={() =>
                overrideValue !== undefined &&
                overrideMut.mutate({
                  kpiScoreId: scoreId,
                  value: overrideValue,
                  overrideReason: overrideReason.trim(),
                })
              }
            />
          </HStack>
        </Stack>
      </Dialog>
    </DetailPage>
  );
}
