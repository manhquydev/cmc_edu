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
  PageHeader,
  ResultPanel,
  SectionBlock,
  Stack,
  StatActions,
  StatusBadge,
  Text,
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

  const overviewContent = (
    <div className="o-detail-panel">
      <div className="o-detail-stack">
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
          <Banner
            status="warning"
            title="Phiếu vượt ngưỡng — cần GĐĐT/Quản trị hệ thống duyệt"
            description={`Phiếu có giá trị vượt ngưỡng ${fmt(threshold!)} — chỉ Giám đốc Đào tạo (GĐĐT) hoặc Quản trị hệ thống mới được phê duyệt. Không phải "2 chữ ký" — một người đủ quyền duyệt một mình.`}
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
                <Text type="supporting" size="xsm" style={{ marginTop: 4 }}>
                  Kiểm soát tiền: người tạo phiếu không được là người duyệt.
                </Text>
              </Stack>
            }
          />
        )}
      </div>
    </div>
  );

  const orderLinesContent = (
    <div className="o-detail-panel">
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
              ) : undefined
            }
          />
        }
        summary={
          <div className="o-detail-stack">
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
    </>
  );
}
