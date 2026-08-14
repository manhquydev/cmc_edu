import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  CmcTabs,
  ConfirmDialog,
  DetailPage,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  NumberInput,
  PageHeader,
  ResultPanel,
  SectionBlock,
  Stack,
  StatActions,
  StatusBadge,
  Text,
  TextArea,
  WorkflowStatusbar,
  useToast,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { useSession } from '../../lib/session-context.js';

// Receipt lifecycle stages shown in the workflow statusbar.
const PIPELINE_STAGES = [
  { key: 'draft', label: 'Nháp (Draft)' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'sent', label: 'Đã gửi' },
] as const;

// `cancelled` leaves the happy path instead of advancing along it, so it is
// appended as a terminal step rather than mapped onto a pipeline index.
const CANCELLED_STEP = { key: 'cancelled', label: 'Đã hủy' } as const;

/** Statusbar steps + active index for a receipt status, cancellation included. */
function workflowFor(status: string) {
  const stages =
    status === CANCELLED_STEP.key ? [...PIPELINE_STAGES, CANCELLED_STEP] : PIPELINE_STAGES;
  return {
    steps: stages.map((s) => ({ id: s.key, label: s.label })),
    activeIndex: Math.max(
      0,
      stages.findIndex((s) => s.key === status),
    ),
  };
}

function fmt(n: number) {
  return n.toLocaleString('vi-VN') + ' đ';
}

/**
 * A hidden button teaches nothing. When the viewer cannot approve, say which
 * rule stopped them and who holds the authority, so the receipt keeps moving
 * through a person instead of stalling in silence.
 */
function approvalDenial(
  block: 'no-permission' | 'self-created' | 'needs-second-eye',
  threshold: number | undefined,
): { title: string; description: string } {
  switch (block) {
    case 'no-permission':
      return {
        title: 'Bạn không có quyền duyệt phiếu thu',
        description:
          'Người duyệt được là Giám đốc kinh doanh, Giám đốc đào tạo, hoặc Quản trị hệ thống của cơ sở này. Gửi mã phiếu cho họ để duyệt.',
      };
    case 'self-created':
      return {
        title: 'Bạn soạn phiếu này nên không duyệt được nó',
        description:
          'Kiểm soát tiền: người soạn phiếu không được là người duyệt. Một người khác có quyền duyệt phải xác nhận, kể cả khi bạn giữ đủ vai trò.',
      };
    case 'needs-second-eye':
      return {
        title: 'Phiếu vượt ngưỡng nên cần người duyệt cấp cao hơn',
        description: threshold
          ? `Phiếu trên ${fmt(threshold)} chỉ Giám đốc đào tạo hoặc Quản trị hệ thống duyệt được. Đây không phải hai chữ ký: một người đủ quyền là đủ.`
          : 'Phiếu vượt ngưỡng chỉ Giám đốc đào tạo hoặc Quản trị hệ thống duyệt được.',
      };
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  approved: 'Đã duyệt',
  sent: 'Đã gửi',
  cancelled: 'Đã hủy',
};

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = useSession();
  const { success: toastSuccess } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [approveOpen, setApproveOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number | string>('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelVoid, setCancelVoid] = useState(false);
  const [approveResult, setApproveResult] = useState<{
    // C1 remediation: 'aborted' means provisioning correctly refused to run
    // because the receipt was no longer approved (e.g. cancelled) by the
    // time it started — distinct from 'pending' (transient failure, will
    // auto-retry).
    provisioning: 'ok' | 'pending' | 'aborted';
  } | null>(null);

  const {
    data: receipt,
    isLoading,
    error,
    refetch,
  } = trpc.finance.receiptGet.useQuery(
    { receiptId: id ?? '' },
    { enabled: Boolean(id) },
  );

  const approveMutation = trpc.finance.receiptApprove.useMutation({
    onSuccess: (res) => {
      setApproveOpen(false);
      setApproveResult({ provisioning: res.provisioning });
      toastSuccess('Đã duyệt phiếu thu');
      void refetch();
    },
    onError: () => {
      setApproveOpen(false);
    },
  });

  const refundMutation = trpc.finance.refundCreate.useMutation({
    onSuccess: (res) => {
      setRefundOpen(false);
      setRefundAmount('');
      toastSuccess(
        `Đã ghi hoàn ${fmt(res.refund.amount)} — còn lại ${fmt(res.remainingBalance)}`,
      );
      void refetch();
    },
    onError: () => {
      setRefundOpen(false);
    },
  });

  const cancelMutation = trpc.finance.receiptCancel.useMutation({
    onSuccess: (res) => {
      setCancelOpen(false);
      setCancelReason('');
      setCancelVoid(false);
      toastSuccess(
        res.opportunityReverted
          ? 'Đã huỷ phiếu — cơ hội tuyển sinh đã mở lại'
          : 'Đã huỷ phiếu thu',
      );
      void refetch();
    },
    onError: () => {
      setCancelOpen(false);
    },
  });

  // approveMutation.error is rendered below (overviewContent) — onError here
  // only owns dialog lifecycle, not error display, so an SoD/threshold/
  // conflict rejection from the API no longer disappears silently.

  if (isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/finance' },
              { label: 'Phiếu thu', href: '/finance' },
              { label: '…' },
            ]}
          />
        }
      >
        <ResultPanel status="loading" title="Đang tải phiếu thu..." />
      </DetailPage>
    );
  }

  if (error || !receipt) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/finance' },
              { label: 'Phiếu thu', href: '/finance' },
              { label: 'Không tìm thấy' },
            ]}
          />
        }
      >
        <Banner
          status="error"
          title="Không tìm thấy phiếu thu"
          description={error?.message ?? 'Phiếu thu không tồn tại hoặc bạn không có quyền truy cập.'}
        />
      </DetailPage>
    );
  }

  // Over-threshold banner: NEVER hardcode the VND amount — always read from session config.
  const threshold = me?.config.approvalSecondEyeThreshold;
  const isOverThreshold = threshold !== undefined && receipt.netAmount > threshold;
  const refundAmountNum = Number(refundAmount);
  const remainingBalance = receipt.remainingBalance ?? receipt.netAmount;
  const canSubmitRefund =
    Boolean(receipt.viewerCanRefund) &&
    Number.isInteger(refundAmountNum) &&
    refundAmountNum >= 1 &&
    refundAmountNum <= remainingBalance;
  const canSubmitCancel =
    Boolean(receipt.viewerCanCancel) && cancelReason.trim().length >= 1;

  const overviewContent = (
    <div className="console-detail-panel">
      <div className="console-detail-stack">
        {approveMutation.error && (
          <Banner
            status="error"
            title="Duyệt phiếu thất bại"
            description={approveMutation.error.message}
          />
        )}

        {approveResult && (
          <ResultPanel
            status={approveResult.provisioning === 'ok' ? 'success' : 'warning'}
            title={
              approveResult.provisioning === 'ok'
                ? 'Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'
                : approveResult.provisioning === 'aborted'
                  ? 'Phiếu đã bị huỷ trước khi cấp tài khoản LMS — không tạo tài khoản'
                  : 'Phiếu đã được duyệt — tài khoản LMS đang được xử lý (provisioning: pending)'
            }
            message={
              approveResult.provisioning === 'pending'
                ? 'Hệ thống sẽ tự động hoàn tất sau vài phút. Kiểm tra lại trạng thái nếu cần.'
                : approveResult.provisioning === 'aborted'
                  ? 'Phiếu thu này đã bị huỷ đúng lúc hệ thống chuẩn bị cấp tài khoản — không có gì cần làm thêm, hệ thống sẽ không tự thử lại.'
                  : undefined
            }
          />
        )}

        {isOverThreshold && (
          // Needing a higher signer is a state of the receipt, not a mistake, so
          // it reads as information rather than a caution.
          <Banner
            status="info"
            title="Phiếu vượt ngưỡng — cần GĐĐT/Quản trị hệ thống duyệt"
            description={`Phiếu có giá trị vượt ngưỡng ${fmt(threshold!)} — chỉ Giám đốc Đào tạo (GĐĐT) hoặc Quản trị hệ thống mới được phê duyệt. Không phải "2 chữ ký" — một người đủ quyền duyệt một mình.`}
          />
        )}

        {receipt.status === 'draft' && receipt.approvalBlock && (
          <Banner
            status="warning"
            title={approvalDenial(receipt.approvalBlock, threshold).title}
            description={approvalDenial(receipt.approvalBlock, threshold).description}
          />
        )}

        <SectionBlock title="Thông tin phiếu" description="Cùng KeyValue recipe với lớp / học viên / CRM.">
          <KeyValueList
            items={[
              {
                key: 'code',
                label: 'Mã phiếu',
                value: (
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{receipt.code}</span>
                ),
              },
              {
                key: 'status',
                label: 'Trạng thái',
                value: (
                  <StatusBadge
                    status={receipt.status}
                    label={STATUS_LABELS[receipt.status] ?? receipt.status}
                  />
                ),
              },
              { key: 'student', label: 'Học viên', value: receipt.studentName },
              { key: 'phone', label: 'SĐT phụ huynh', value: receipt.parentPhone },
              {
                key: 'amount',
                label: 'Số tiền',
                value: (
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(receipt.netAmount)}
                  </span>
                ),
              },
              {
                key: 'kind',
                label: 'Loại phiếu',
                value: (
                  <Badge
                    label={receipt.kind === 'new' ? 'Mới' : 'Gia hạn'}
                    variant={receipt.kind === 'new' ? 'blue' : 'teal'}
                  />
                ),
              },
              {
                key: 'class',
                label: 'Lớp học',
                value: receipt.classBatchCode ?? receipt.classBatchId ?? '—',
              },
              {
                key: 'created',
                label: 'Ngày tạo',
                value: new Date(receipt.createdAt).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              },
            ]}
          />
        </SectionBlock>

        {receipt.canApprove && receipt.status === 'draft' && (
          // description (not children) keeps the content always visible — Banner's
          // `children` slot adds a collapse/expand toggle, which would change the
          // always-expanded behavior of the original Alert.
          <Banner
            status="info"
            title="Khi duyệt phiếu thu này, hệ thống sẽ tự động:"
            description={
              <Stack gap={1}>
                <Text size="sm">• Tạo tài khoản học sinh + phụ huynh trên LMS</Text>
                <Text size="sm">• Chuyển ghi danh sang trạng thái active</Text>
                <Text size="sm">• Đưa cơ hội (nếu có) về O5_ENROLLED</Text>
                <Text size="sm">• Gửi email thông báo cho phụ huynh</Text>
                <Text type="supporting" size="xsm" style={{ marginTop: 'var(--cmc-space-1)' }}>
                  Kiểm soát tiền: người tạo phiếu không được là người duyệt.
                </Text>
              </Stack>
            }
          />
        )}

        {cancelMutation.error && (
          <Banner
            status="error"
            title="Huỷ phiếu thất bại"
            description={cancelMutation.error.message}
          />
        )}

        {receipt.viewerCanCancel && (
          <SectionBlock
            title="Huỷ phiếu"
            description="Chỉ phiếu đã duyệt. Huỷ cắt quyền học theo phiếu này; hoàn tiền một phần dùng mục Hoàn tiền bên dưới."
          >
            <Stack gap={2} style={{ maxWidth: 480 }}>
              <TextArea
                label="Lý do huỷ (bắt buộc)"
                value={cancelReason}
                onChange={setCancelReason}
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--cmc-space-2)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={cancelVoid}
                  onChange={(e) => setCancelVoid(e.target.checked)}
                  style={{ marginTop: 'var(--cmc-space-1)' }}
                />
                <Stack gap={0.5}>
                  <Text size="sm" weight="semibold">
                    Huỷ vì nhập nhầm (rút học viên)
                  </Text>
                  <Text type="supporting" size="xsm">
                    Bật khi phiếu tạo nhầm — hệ thống rút học viên. Để tắt khi huỷ thanh toán thật và giữ hồ sơ học viên.
                  </Text>
                </Stack>
              </label>
              <Button
                label="Huỷ phiếu thu"
                variant="secondary"
                size="sm"
                isDisabled={!canSubmitCancel}
                onClick={() => setCancelOpen(true)}
                isLoading={cancelMutation.isPending}
              />
            </Stack>
          </SectionBlock>
        )}

        {(receipt.status === 'approved' || (receipt.refunds?.length ?? 0) > 0) && (
          <SectionBlock
            title="Hoàn tiền"
            description="Sổ cái append-only trên phiếu thu (không phải màn duyệt riêng)."
          >
            <Stack gap={2}>
              {refundMutation.error && (
                <Banner
                  status="error"
                  title="Hoàn tiền thất bại"
                  description={refundMutation.error.message}
                />
              )}
              <KeyValueList
                items={[
                  {
                    key: 'refunded',
                    label: 'Đã hoàn',
                    value: (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(receipt.refundedTotal ?? 0)}
                      </span>
                    ),
                  },
                  {
                    key: 'remaining',
                    label: 'Còn lại',
                    value: (
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(remainingBalance)}
                      </span>
                    ),
                  },
                ]}
              />
              {(receipt.refunds ?? []).length === 0 ? (
                <Text type="supporting" size="sm">
                  Chưa có lần hoàn nào trên phiếu này.
                </Text>
              ) : (
                <Stack gap={1}>
                  {(receipt.refunds ?? []).map((r) => (
                    <HStack key={r.id} justify="between" gap={2}>
                      <Text type="supporting" size="xsm">
                        {new Date(r.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text size="sm" weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        −{fmt(r.amount)}
                      </Text>
                    </HStack>
                  ))}
                </Stack>
              )}
              {receipt.viewerCanRefund && (
                <Stack gap={2} style={{ maxWidth: 320 }}>
                  <NumberInput
                    label="Số tiền hoàn (VND)"
                    value={
                      refundAmount === '' || refundAmount == null
                        ? null
                        : Number(refundAmount)
                    }
                    onChange={(v) => setRefundAmount(v ?? '')}
                    min={1}
                    max={remainingBalance}
                    step={1_000}
                  />
                  <Button
                    label="Ghi hoàn tiền"
                    variant="primary"
                    size="sm"
                    isDisabled={!canSubmitRefund}
                    onClick={() => setRefundOpen(true)}
                    isLoading={refundMutation.isPending}
                  />
                </Stack>
              )}
            </Stack>
          </SectionBlock>
        )}
      </div>
    </div>
  );

  const orderLinesContent = (
    <div className="console-detail-panel">
      <SectionBlock title="Chi tiết thanh toán" description="Dòng dịch vụ và tổng cộng.">
        <div
          style={{
            border: '1px solid var(--cmc-border)',
            borderRadius: 'var(--cmc-radius-control)',
            overflow: 'hidden',
          }}
        >
          <HStack
            justify="between"
            style={{
              paddingInline: 'var(--cmc-space-3)',
              paddingBlock: 'var(--cmc-space-2)',
              background: 'var(--cmc-surface-2)',
              borderBottom: '1px solid var(--cmc-border)',
            }}
          >
            <Text
              type="supporting"
              size="xsm"
              weight="semibold"
              style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              Dịch vụ
            </Text>
            <Text
              type="supporting"
              size="xsm"
              weight="semibold"
              style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              Thành tiền
            </Text>
          </HStack>
          <HStack
            justify="between"
            style={{ paddingInline: 'var(--cmc-space-3)', paddingBlock: 'var(--cmc-space-2)' }}
          >
            <Stack gap={0.5}>
              <Text size="sm">
                Học phí — {receipt.classBatchCode ?? receipt.classBatchId ?? 'Chưa xếp lớp'}
              </Text>
              <Text type="supporting" size="xsm">
                {receipt.studentName}
              </Text>
            </Stack>
            <Text size="sm" weight="bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmt(receipt.netAmount)}
            </Text>
          </HStack>
          <HStack
            justify="between"
            style={{
              paddingInline: 'var(--cmc-space-3)',
              paddingBlock: 'var(--cmc-space-2)',
              background: 'var(--cmc-surface-2)',
              borderTop: '1px solid var(--cmc-border)',
            }}
          >
            <Text size="sm" weight="semibold">
              Tổng cộng
            </Text>
            <Text size="sm" weight="bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmt(receipt.netAmount)}
            </Text>
          </HStack>
        </div>
      </SectionBlock>
    </div>
  );

  return (
    <>
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/finance' },
              { label: 'Phiếu thu', href: '/finance' },
              { label: receipt.code },
            ]}
            actions={
              <>
                {id ? <CopyLinkButton mode="go" entity="receipt" id={id} /> : null}
                <Button
                  label="← Danh sách"
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigate('/finance')}
                />
              </>
            }
          />
        }
        entity={
          <EntityHeader
            title={receipt.code}
            subtitle={receipt.studentName}
            initials={receipt.code.slice(0, 2).toUpperCase()}
            badges={
              <StatusBadge
                status={receipt.status}
                label={STATUS_LABELS[receipt.status] ?? receipt.status}
              />
            }
            meta={
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(receipt.netAmount)}
                {' · '}
                {receipt.kind === 'new' ? 'Mới' : 'Gia hạn'}
              </span>
            }
            actions={
              receipt.canApprove && receipt.status === 'draft' ? (
                <Button
                  label="Duyệt & Kích hoạt"
                  variant="primary"
                  size="sm"
                  onClick={() => setApproveOpen(true)}
                  isLoading={approveMutation.isPending}
                />
              ) : receipt.status === 'approved' &&
                (receipt.viewerCanRefund || receipt.viewerCanCancel) ? (
                <HStack gap={1} style={{ flexWrap: 'wrap' }}>
                  {receipt.viewerCanCancel ? (
                    <Button
                      label="Huỷ phiếu"
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab('overview')}
                    />
                  ) : null}
                  {receipt.viewerCanRefund ? (
                    <Button
                      label="Hoàn tiền"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setActiveTab('overview');
                        if (refundAmount === '' || refundAmount == null) {
                          setRefundAmount(remainingBalance);
                        }
                        setRefundOpen(true);
                      }}
                      isLoading={refundMutation.isPending}
                    />
                  ) : null}
                </HStack>
              ) : undefined
            }
          />
        }
        summary={
          <div className="console-detail-stack">
            <HighlightStrip
              items={[
                {
                  key: 'amount',
                  label: 'Số tiền',
                  value: fmt(receipt.netAmount),
                  tabular: true,
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: (
                    <StatusBadge
                      status={receipt.status}
                      label={STATUS_LABELS[receipt.status] ?? receipt.status}
                    />
                  ),
                },
                { key: 'student', label: 'Học viên', value: receipt.studentName },
                {
                  key: 'class',
                  label: 'Lớp',
                  value: receipt.classBatchCode ?? receipt.classBatchId ?? '—',
                },
              ]}
            />
            <StatActions
              items={[
                {
                  key: 'list',
                  label: 'Danh sách phiếu',
                  href: '/finance',
                },
                {
                  key: 'kind',
                  label: receipt.kind === 'new' ? 'Mới' : 'Gia hạn',
                  count: receipt.kind === 'new' ? 'NEW' : 'REN',
                },
              ]}
            />
          </div>
        }
        statusbar={<WorkflowStatusbar {...workflowFor(receipt.status)} />}
        tabs={
          <CmcTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={[
              { id: 'overview', label: 'Tổng quan', content: overviewContent },
              { id: 'order-lines', label: 'Chi tiết thanh toán', content: orderLinesContent },
            ]}
          />
        }
      />
      <ConfirmDialog
        opened={approveOpen}
        title="Xác nhận duyệt phiếu thu"
        message={`Duyệt phiếu ${receipt.code} (${fmt(receipt.netAmount)}) cho học viên "${receipt.studentName}". Sau khi duyệt, hệ thống sẽ tự động tạo tài khoản LMS và gửi email thông báo cho phụ huynh. Hành động này không thể hoàn tác.`}
        confirmLabel="Duyệt & Kích hoạt"
        confirmColor="green"
        onConfirm={() => {
          if (!id) return;
          approveMutation.mutate({ receiptId: id });
        }}
        onCancel={() => setApproveOpen(false)}
        loading={approveMutation.isPending}
      />
      <ConfirmDialog
        opened={refundOpen}
        title="Xác nhận hoàn tiền"
        message={
          Number.isInteger(refundAmountNum) && refundAmountNum > 0
            ? `Ghi hoàn ${fmt(refundAmountNum)} trên phiếu ${receipt.code}. Sổ cái append-only — không sửa/xóa lần hoàn sau khi ghi. Còn lại sau lần này: ${fmt(remainingBalance - refundAmountNum)}.`
            : 'Nhập số tiền hoàn hợp lệ (số nguyên VND > 0) trước khi xác nhận.'
        }
        confirmLabel="Ghi hoàn tiền"
        confirmColor="red"
        onConfirm={() => {
          if (!id || !Number.isInteger(refundAmountNum) || refundAmountNum < 1) return;
          refundMutation.mutate({ receiptId: id, amount: refundAmountNum });
        }}
        onCancel={() => setRefundOpen(false)}
        loading={refundMutation.isPending}
      />
      <ConfirmDialog
        opened={cancelOpen}
        title="Xác nhận huỷ phiếu thu"
        message={
          cancelReason.trim().length >= 1
            ? `Huỷ phiếu ${receipt.code} (${fmt(receipt.netAmount)}) cho "${receipt.studentName}". Lý do: ${cancelReason.trim()}.${
                cancelVoid
                  ? ' Đã chọn rút học viên vì nhập nhầm.'
                  : ' Hồ sơ học viên được giữ (huỷ thanh toán thật).'
              } Hành động không hoàn tác trên phiếu.`
            : 'Nhập lý do huỷ trước khi xác nhận.'
        }
        confirmLabel="Huỷ phiếu thu"
        confirmColor="red"
        onConfirm={() => {
          if (!id || cancelReason.trim().length < 1) return;
          cancelMutation.mutate({
            receiptId: id,
            reason: cancelReason.trim(),
            void: cancelVoid,
          });
        }}
        onCancel={() => setCancelOpen(false)}
        loading={cancelMutation.isPending}
      />
    </>
  );
}
