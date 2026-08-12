// Form chi tiết 1 Reward — /admin/engagement/rewards/:rewardId
// Resource-centric form-depth (docs/ux-resource-centric-structure.md).
// List is index-only; HITL Duyệt / Giao quà / Từ chối lives here.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  DetailPage,
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
  WorkflowStatusbar,
} from '@cmc/ui';
import { UUID_RE } from '@cmc/links';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  delivered: 'Đã giao',
  rejected: 'Từ chối',
};

const LIST_PATH = '/admin/engagement/rewards';

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
  const steps = [
    { id: 'pending', label: 'Chờ duyệt' },
    { id: 'approved', label: 'Đã duyệt' },
    { id: 'delivered', label: 'Đã giao' },
  ];
  const activeIndex =
    status === 'delivered' ? 2 : status === 'approved' ? 1 : 0;
  return { steps, activeIndex };
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  return new Date(v as string).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RewardsDetailPage() {
  const { rewardId = '' } = useParams<{ rewardId: string }>();
  const navigate = useNavigate();
  const { canDo } = useSession();
  const canManage = canDo('rewards', 'manage');
  const idOk = UUID_RE.test(rewardId);

  const { data, isLoading, error, refetch } = trpc.rewards.get.useQuery(
    { rewardId },
    { enabled: idOk },
  );

  const utils = trpc.useUtils();
  const [approveOpen, setApproveOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function invalidate() {
    void refetch();
    void utils.rewards.list.invalidate();
  }

  const approveMut = trpc.rewards.approve.useMutation({
    onSuccess() {
      setApproveOpen(false);
      setFlash({ ok: true, text: 'Đã duyệt yêu cầu đổi quà.' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setApproveOpen(false);
    },
  });

  const deliverMut = trpc.rewards.deliver.useMutation({
    onSuccess() {
      setDeliverOpen(false);
      setFlash({ ok: true, text: 'Đã giao quà.' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setDeliverOpen(false);
    },
  });

  const rejectMut = trpc.rewards.reject.useMutation({
    onSuccess() {
      setRejectOpen(false);
      setFlash({ ok: true, text: 'Đã từ chối — sao đã hoàn (nếu áp dụng).' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setRejectOpen(false);
    },
  });

  if (!idOk) {
    return (
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Gắn kết' },
              { label: 'Đổi thưởng', href: LIST_PATH },
              { label: 'Phiếu' },
            ]}
          />
        }
      >
        <EmptyState title="Mã phiếu không hợp lệ" description="URL cần UUID rewardId." />
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
              { label: 'Gắn kết' },
              { label: 'Đổi thưởng', href: LIST_PATH },
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
              { label: 'Gắn kết' },
              { label: 'Đổi thưởng', href: LIST_PATH },
              { label: 'Phiếu' },
            ]}
          />
        }
      >
        <ResultPanel
          status="error"
          title="Không mở được phiếu"
          message={error?.message ?? 'Reward not found.'}
          actions={
            <Button
              label="Về danh sách"
              size="sm"
              variant="secondary"
              onClick={() => navigate(LIST_PATH)}
            />
          }
        />
      </DetailPage>
    );
  }

  const status = data.status as string;
  const canApprove = canManage && status === 'pending';
  const canDeliver = canManage && status === 'approved';
  const canReject = canManage && (status === 'pending' || status === 'approved');
  const { steps, activeIndex } = statusSteps(status);
  const shortId = rewardId.slice(0, 8);
  const giftName = data.gift.name;
  const studentShort = String(data.studentId).slice(0, 8);

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Gắn kết' },
            { label: 'Đổi thưởng', href: LIST_PATH },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="reward" id={rewardId} />
              <Button
                label="Về danh sách"
                size="sm"
                variant="ghost"
                onClick={() => navigate(LIST_PATH)}
              />
            </HStack>
          }
        />
      }
      entity={
        <EntityHeader
          title={`Đổi quà / ${giftName}`}
          subtitle={`Học viên ${studentShort} · ${data.gift.starsRequired} sao`}
          initials={giftName.slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge
              status={status}
              label={STATUS_LABELS[status] ?? status}
            />
          }
          actions={
            canApprove || canDeliver || canReject ? (
              <HStack gap={1} wrap="wrap">
                {canReject ? (
                  <Button
                    label="Từ chối"
                    size="sm"
                    variant="secondary"
                    onClick={() => setRejectOpen(true)}
                  />
                ) : null}
                {canApprove ? (
                  <Button
                    label="Duyệt"
                    size="sm"
                    variant="primary"
                    onClick={() => setApproveOpen(true)}
                  />
                ) : null}
                {canDeliver ? (
                  <Button
                    label="Giao quà"
                    size="sm"
                    variant="primary"
                    onClick={() => setDeliverOpen(true)}
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
              key: 'status',
              label: 'Trạng thái',
              value: (
                <StatusBadge
                  status={status}
                  label={STATUS_LABELS[status] ?? status}
                />
              ),
            },
            { key: 'gift', label: 'Quà', value: giftName },
            {
              key: 'stars',
              label: 'Sao',
              value: String(data.gift.starsRequired),
              tabular: true,
            },
            { key: 'redeemed', label: 'Ngày đổi', value: fmtDateTime(data.redeemedAt) },
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
            description="List chỉ mở phiếu — duyệt / giao / từ chối trên form."
          >
            <KeyValueList
              items={[
                { key: 'student', label: 'Học viên', value: studentShort },
                { key: 'gift', label: 'Quà tặng', value: giftName },
                {
                  key: 'stars',
                  label: 'Sao',
                  value: String(data.gift.starsRequired),
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: STATUS_LABELS[status] ?? status,
                },
                { key: 'redeemed', label: 'Ngày đổi', value: fmtDateTime(data.redeemedAt) },
                ...(data.note
                  ? [{ key: 'note', label: 'Ghi chú', value: String(data.note) }]
                  : []),
              ]}
            />
          </SectionBlock>
        </Stack>
      </div>

      <ConfirmDialog
        opened={approveOpen}
        title="Duyệt yêu cầu đổi quà"
        message="pending → approved?"
        confirmLabel="Duyệt"
        confirmColor="blue"
        loading={approveMut.isPending}
        onConfirm={() => approveMut.mutate({ rewardId })}
        onCancel={() => setApproveOpen(false)}
      />
      <ConfirmDialog
        opened={deliverOpen}
        title="Giao quà"
        message="approved → delivered? Stock sẽ trừ (nếu không unlimited)."
        confirmLabel="Giao quà"
        confirmColor="blue"
        loading={deliverMut.isPending}
        onConfirm={() => deliverMut.mutate({ rewardId })}
        onCancel={() => setDeliverOpen(false)}
      />
      <ConfirmDialog
        opened={rejectOpen}
        title="Từ chối yêu cầu đổi quà"
        message="Từ chối sẽ hoàn sao (nếu chưa hoàn). Không hoàn tác."
        confirmLabel="Từ chối"
        confirmColor="red"
        loading={rejectMut.isPending}
        onConfirm={() => rejectMut.mutate({ rewardId })}
        onCancel={() => setRejectOpen(false)}
      />
    </DetailPage>
  );
}
