import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Box, Button, Grid, Group, Stack, Text, Title } from '@mantine/core';
import {
  CmcTabs,
  ConfirmDialog,
  MasterDetail,
  PageHeader,
  ResultPanel,
  StatusBadge,
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
    <Stack gap="xs" p="md">
      <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
        Tiến trình
      </Text>
      {PIPELINE_STAGES.map((stage, i) => {
        const isActive = !isCancelled && i === current;
        const isDone = !isCancelled && i < current;
        return (
          <Group key={stage.key} gap="sm" align="center">
            <Box
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
            <Text
              fz="sm"
              fw={isActive ? 600 : 400}
              c={isActive ? 'var(--cmc-brand)' : isDone ? 'dimmed' : 'var(--cmc-text-muted)'}
            >
              {stage.label}
            </Text>
          </Group>
        );
      })}
      {isCancelled && (
        <Group gap="sm" align="center">
          <Box
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--cmc-danger)',
              flexShrink: 0,
            }}
          />
          <Text fz="sm" fw={600} c="red">
            Đã hủy
          </Text>
        </Group>
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
      <Box p="md">
        <Alert color="red" title="Không tìm thấy phiếu thu">
          {error?.message ?? 'Phiếu thu không tồn tại hoặc bạn không có quyền truy cập.'}
        </Alert>
      </Box>
    );
  }

  // Over-threshold banner: NEVER hardcode the VND amount — always read from session config.
  const threshold = me?.config.approvalSecondEyeThreshold;
  const isOverThreshold = threshold !== undefined && receipt.netAmount > threshold;

  const overviewContent = (
    <Stack gap="md" p="md">
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
        <Alert color="orange" title="Phiếu vượt ngưỡng — cần GĐĐT/super_admin duyệt">
          Phiếu có giá trị vượt ngưỡng {fmt(threshold!)} — chỉ Giám đốc Đào tạo (GĐĐT) hoặc
          super_admin mới được phê duyệt. Không phải "2 chữ ký" — một người đủ quyền duyệt một mình.
        </Alert>
      )}

      <Grid gutter="md">
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Mã phiếu
            </Text>
            <Text fz="sm" fw={600} ff="monospace">
              {receipt.code}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Trạng thái
            </Text>
            <StatusBadge
              status={receipt.status}
              label={STATUS_LABELS[receipt.status] ?? receipt.status}
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Học viên
            </Text>
            <Text fz="sm">{receipt.studentName}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              SĐT phụ huynh
            </Text>
            <Text fz="sm">{receipt.parentPhone}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Số tiền
            </Text>
            <Text fz="sm" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmt(receipt.netAmount)}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Loại phiếu
            </Text>
            <Badge variant="dot" color={receipt.kind === 'new' ? 'blue' : 'teal'}>
              {receipt.kind === 'new' ? 'Mới' : 'Gia hạn'}
            </Badge>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Lớp học
            </Text>
            <Text fz="sm">{receipt.classBatchCode ?? receipt.classBatchId ?? '—'}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap={4}>
            <Text fz="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Ngày tạo
            </Text>
            <Text fz="sm">
              {new Date(receipt.createdAt).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </Stack>
        </Grid.Col>
      </Grid>

      {receipt.canApprove && receipt.status === 'draft' && (
        <Alert color="blue" variant="light" title="Khi duyệt phiếu thu này, hệ thống sẽ tự động:">
          <Stack gap={4}>
            <Text fz="sm">• Tạo tài khoản học sinh + phụ huynh trên LMS</Text>
            <Text fz="sm">• Chuyển ghi danh sang trạng thái active</Text>
            <Text fz="sm">• Đưa cơ hội (nếu có) về O5_ENROLLED</Text>
            <Text fz="sm">• Gửi email thông báo cho phụ huynh</Text>
            <Text fz="xs" c="dimmed" mt={4}>
              Cổng tiền (SoD): người tạo phiếu ≠ người duyệt.
            </Text>
          </Stack>
        </Alert>
      )}

      {receipt.canApprove && receipt.status === 'draft' && (
        <Group mt="sm">
          <Button
            color="green"
            radius="xs"
            onClick={() => setApproveOpen(true)}
            loading={approveMutation.isPending}
          >
            Duyệt &amp; Kích hoạt
          </Button>
        </Group>
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
    <Stack gap="md" p="md">
      <Title order={6} c="dimmed">
        Chi tiết thanh toán
      </Title>
      <Box
        style={{
          border: '1px solid var(--cmc-border)',
          borderRadius: 'var(--cmc-radius-xs)',
          overflow: 'hidden',
        }}
      >
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ background: 'var(--cmc-surface-2)', borderBottom: '1px solid var(--cmc-border)' }}
        >
          <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Dịch vụ
          </Text>
          <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Thành tiền
          </Text>
        </Group>
        <Group justify="space-between" px="md" py="sm">
          <Stack gap={2}>
            <Text fz="sm">Học phí — {receipt.classBatchCode ?? receipt.classBatchId ?? 'Chưa xếp lớp'}</Text>
            <Text fz="xs" c="dimmed">
              {receipt.studentName}
            </Text>
          </Stack>
          <Text fz="sm" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(receipt.netAmount)}
          </Text>
        </Group>
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ background: 'var(--cmc-surface-2)', borderTop: '1px solid var(--cmc-border)' }}
        >
          <Text fz="sm" fw={600}>
            Tổng cộng
          </Text>
          <Text fz="sm" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(receipt.netAmount)}
          </Text>
        </Group>
      </Box>
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
            variant="default"
            size="xs"
            radius="xs"
            onClick={() => void navigate('/finance')}
          >
            ← Danh sách
          </Button>
        }
      />
      <Box style={{ height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
        <MasterDetail
          list={<PipelinePanel status={receipt.status} />}
          detail={detail}
          selectedId={id}
          listWidth={220}
        />
      </Box>
    </>
  );
}
