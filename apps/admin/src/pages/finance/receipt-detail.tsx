import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  CmcTabs,
  ConfirmDialog,
  Grid,
  Heading,
  HStack,
  MasterDetail,
  PageHeader,
  ResultPanel,
  Stack,
  StatusBadge,
  Text,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

// Receipt lifecycle stages shown in the left pipeline panel.
const PIPELINE_STAGES = [
  { key: 'draft', label: 'Nháp (Draft)' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'sent', label: 'Đã gửi' },
] as const;

function stageIndex(status: string): number {
  return PIPELINE_STAGES.findIndex((s) => s.key === status);
}

function PipelinePanel({ status }: { status: string }) {
  const current = stageIndex(status);
  const isCancelled = status === 'cancelled';

  return (
    <Stack gap={2} padding={4}>
      <Text
        type="supporting"
        size="xsm"
        weight="semibold"
        style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        Tiến trình
      </Text>
      {PIPELINE_STAGES.map((stage, i) => {
        const isActive = !isCancelled && i === current;
        const isDone = !isCancelled && i < current;
        // TODO(astryx-review): Astryx Text's `color` prop is a fixed semantic
        // enum (primary/secondary/disabled/placeholder/accent/inherit) with
        // no raw-CSS-var escape hatch — this line needs the brand/success/
        // muted tokens per pipeline stage state, so it stays a plain <span>
        // like StatCard's value line, per the documented fallback.
        const labelColor = isActive
          ? 'var(--cmc-brand)'
          : isDone
            ? 'var(--cmc-text)'
            : 'var(--cmc-text-muted)';
        return (
          <HStack key={stage.key} gap={2} align="center">
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                flexShrink: 0,
                background: isActive
                  ? 'var(--cmc-brand)'
                  : isDone
                    ? 'var(--cmc-success)'
                    : 'var(--cmc-border)',
                border: isActive ? '2px solid var(--cmc-brand)' : undefined,
                boxShadow: isActive ? '0 0 0 3px var(--cmc-brand-muted)' : undefined,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, color: labelColor }}>
              {stage.label}
            </span>
          </HStack>
        );
      })}
      {isCancelled && (
        <HStack gap={2} align="center">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--cmc-danger)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cmc-danger)' }}>
            Đã hủy
          </span>
        </HStack>
      )}
    </Stack>
  );
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

  const [activeTab, setActiveTab] = useState('overview');
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveResult, setApproveResult] = useState<{
    provisioning: 'ok' | 'pending';
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
      void refetch();
    },
    onError: () => {
      setApproveOpen(false);
    },
  });

  if (isLoading) {
    return (
      <ResultPanel status="loading" title="Đang tải phiếu thu..." />
    );
  }

  if (error || !receipt) {
    return (
      <div style={{ padding: 16 }}>
        <Banner
          status="error"
          title="Không tìm thấy phiếu thu"
          description={error?.message ?? 'Phiếu thu không tồn tại hoặc bạn không có quyền truy cập.'}
        />
      </div>
    );
  }

  // Over-threshold banner: NEVER hardcode the VND amount — always read from session config.
  const threshold = me?.config.approvalSecondEyeThreshold;
  const isOverThreshold = threshold !== undefined && receipt.netAmount > threshold;

  const overviewContent = (
    <Stack gap={4} padding={4}>
      {approveResult && (
        <ResultPanel
          status={approveResult.provisioning === 'ok' ? 'success' : 'warning'}
          title={
            approveResult.provisioning === 'ok'
              ? 'Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'
              : 'Phiếu đã được duyệt — tài khoản LMS đang được xử lý (provisioning: pending)'
          }
          message={
            approveResult.provisioning === 'pending'
              ? 'Hệ thống sẽ tự động hoàn tất sau vài phút. Kiểm tra lại trạng thái nếu cần.'
              : undefined
          }
        />
      )}

      {isOverThreshold && (
        <Banner
          status="warning"
          title="Phiếu vượt ngưỡng — cần GĐĐT/super_admin duyệt"
          description={`Phiếu có giá trị vượt ngưỡng ${fmt(threshold!)} — chỉ Giám đốc Đào tạo (GĐĐT) hoặc super_admin mới được phê duyệt. Không phải "2 chữ ký" — một người đủ quyền duyệt một mình.`}
        />
      )}

      <Grid columns={2} gap={4}>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Mã phiếu
          </Text>
          <Text size="sm" weight="semibold" style={{ fontFamily: 'monospace' }}>
            {receipt.code}
          </Text>
        </Stack>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Trạng thái
          </Text>
          <StatusBadge
            status={receipt.status}
            label={STATUS_LABELS[receipt.status] ?? receipt.status}
          />
        </Stack>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Học viên
          </Text>
          <Text size="sm">{receipt.studentName}</Text>
        </Stack>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            SĐT phụ huynh
          </Text>
          <Text size="sm">{receipt.parentPhone}</Text>
        </Stack>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Số tiền
          </Text>
          <Text size="sm" weight="bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(receipt.netAmount)}
          </Text>
        </Stack>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Loại phiếu
          </Text>
          <Badge
            label={receipt.kind === 'new' ? 'Mới' : 'Gia hạn'}
            variant={receipt.kind === 'new' ? 'blue' : 'teal'}
          />
        </Stack>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Lớp học
          </Text>
          <Text size="sm">{receipt.classBatchCode ?? receipt.classBatchId ?? '—'}</Text>
        </Stack>
        <Stack gap={1}>
          <Text type="supporting" size="xsm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Ngày tạo
          </Text>
          <Text size="sm">
            {new Date(receipt.createdAt).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Stack>
      </Grid>

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
                Cổng tiền (SoD): người tạo phiếu ≠ người duyệt.
              </Text>
            </Stack>
          }
        />
      )}

      {receipt.canApprove && receipt.status === 'draft' && (
        <HStack style={{ marginTop: 8 }}>
          <Button
            label="Duyệt & Kích hoạt"
            variant="primary"
            onClick={() => setApproveOpen(true)}
            isLoading={approveMutation.isPending}
          />
        </HStack>
      )}

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
    </Stack>
  );

  const orderLinesContent = (
    <Stack gap={4} padding={4}>
      <Heading level={6} color="secondary">
        Chi tiết thanh toán
      </Heading>
      <div
        style={{
          border: '1px solid var(--cmc-border)',
          borderRadius: 'var(--cmc-radius-xs)',
          overflow: 'hidden',
        }}
      >
        <HStack
          justify="between"
          style={{
            paddingInline: 16,
            paddingBlock: 8,
            background: 'var(--cmc-surface-2)',
            borderBottom: '1px solid var(--cmc-border)',
          }}
        >
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Dịch vụ
          </Text>
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Thành tiền
          </Text>
        </HStack>
        <HStack justify="between" style={{ paddingInline: 16, paddingBlock: 8 }}>
          <Stack gap={0.5}>
            <Text size="sm">Học phí — {receipt.classBatchCode ?? receipt.classBatchId ?? 'Chưa xếp lớp'}</Text>
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
            paddingInline: 16,
            paddingBlock: 8,
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
    </Stack>
  );

  const detail = (
    <CmcTabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabs={[
        { id: 'overview', label: 'Tổng quan', content: overviewContent },
        { id: 'order-lines', label: 'Chi tiết thanh toán', content: orderLinesContent },
      ]}
    />
  );

  return (
    <>
      <PageHeader
        title={`Phiếu thu ${receipt.code}`}
        breadcrumbs={[
          { label: 'Kinh doanh' },
          { label: 'Phiếu thu', href: '/finance' },
          { label: receipt.code },
        ]}
        actions={
          <Button
            label="← Danh sách"
            variant="secondary"
            size="sm"
            onClick={() => void navigate('/finance')}
          />
        }
      />
      <div style={{ height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
        <MasterDetail
          list={<PipelinePanel status={receipt.status} />}
          detail={detail}
          selectedId={id}
          listWidth={220}
        />
      </div>
    </>
  );
}
