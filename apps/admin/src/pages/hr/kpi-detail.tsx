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
  HighlightStrip,
  HStack,
  KeyValueList,
  NumberInput,
  PageHeader,
  ResultPanel,
  SectionBlock,
  Stack,
  StatusBadge,
  Text,
  TextArea,
  WorkflowStatusbar,
} from '@cmc/ui';
import type { SoftTone } from '@cmc/ui';
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

// `submitted` is the only KPI state waiting on someone else (the manager).
// `draft` stays on the default neutral map — the employee is still editing it.
function kpiStatusTone(status: string): SoftTone | undefined {
  return status === 'submitted' ? 'brand' : undefined;
}

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
  const { canDo } = useSession();
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
  const personName = data.fullName ?? data.appUser.fullName;
  // Prefer server flags (managerId / branch) over canDo alone — avoids false 403.
  const showConfirm = Boolean(data.viewerCanConfirm) && canDo('kpi', 'confirm');
  const showOverride = Boolean(data.viewerCanOverride) && canDo('kpi', 'approve');
  const overrideOk =
    overrideValue !== undefined && overrideValue >= 0 && overrideReason.trim().length >= 1;
  const valueLabel = `${Number(data.value).toLocaleString('vi-VN')} đ${data.override ? ' (ghi đè)' : ''}`;

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Nhân sự' },
            { label: 'KPI', href: kpiScoresPath({ period: data.period }) },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="kpiScore" id={scoreId} />
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
      entity={
        <EntityHeader
          title={personName}
          subtitle={`Phiếu KPI · ${data.position ?? '—'} · kỳ ${data.period}`}
          initials={personName.slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge
              status={data.status}
              label={STATUS_LABELS[data.status] ?? data.status}
              tone={kpiStatusTone(data.status)}
            />
          }
          meta={
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{valueLabel}</span>
          }
          actions={
            showConfirm || showOverride ? (
              <HStack gap={1} wrap="wrap">
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
              </HStack>
            ) : undefined
          }
        />
      }
      summary={
        <HighlightStrip
          items={[
            {
              key: 'value',
              label: 'Giá trị',
              value: valueLabel,
              tabular: true,
            },
            {
              key: 'status',
              label: 'Trạng thái',
              value: (
                <StatusBadge
                  status={data.status}
                  label={STATUS_LABELS[data.status] ?? data.status}
                  tone={kpiStatusTone(data.status)}
                />
              ),
            },
            { key: 'period', label: 'Kỳ', value: data.period },
            { key: 'role', label: 'Vị trí', value: data.position ?? '—' },
          ]}
        />
      }
      statusbar={<WorkflowStatusbar steps={steps} activeIndex={activeIndex} />}
    >
      <div className="console-detail-panel">
        <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 720 }}>
          {flash ? (
            <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} />
          ) : null}
          {data.tierMissing ? (
            <Banner status="warning" title="Chưa gán bậc lương — nộp phiếu có thể bị chặn." />
          ) : null}

          <SectionBlock
            title="Thông tin phiếu"
            description="Cùng khung form chứng từ Console (list → form · statusbar · sheet)."
          >
            <KeyValueList
              items={[
                { key: 'person', label: 'Nhân viên', value: personName },
                { key: 'period', label: 'Kỳ', value: data.period },
                { key: 'position', label: 'Vị trí', value: data.position ?? '—' },
                {
                  key: 'value',
                  label: 'Giá trị KPI',
                  value: (
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {valueLabel}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: (
                    <StatusBadge
                      status={data.status}
                      label={STATUS_LABELS[data.status] ?? data.status}
                      tone={kpiStatusTone(data.status)}
                    />
                  ),
                },
                ...(data.overrideReason
                  ? [
                      {
                        key: 'overrideReason',
                        label: 'Lý do ghi đè',
                        value: data.overrideReason,
                      },
                    ]
                  : []),
              ]}
            />
          </SectionBlock>

          <Text type="supporting" size="xsm">
            Tất toán cuối (Đã duyệt) chỉ qua thao tác trên bảng KPI theo kỳ — không duyệt lẻ
            trên form này.
          </Text>
        </Stack>
      </div>

      <ConfirmDialog
        opened={confirmOpen}
        title="Xác nhận điểm KPI"
        message={`Xác nhận phiếu của ${personName} kỳ ${data.period}?`}
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
