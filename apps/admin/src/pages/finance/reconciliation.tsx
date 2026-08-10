// Đối soát tài chính — P05 (US-010 reconciliation surface).
//
// Key invariants:
// - HOTL agent results are READ-ONLY AI output. The amber banner must be
//   present and unambiguous: "ai:recon" worker cannot self-action flags.
// - Dismiss / action buttons only shown to canDo('reconciliation','review')
//   (GĐ). All other roles see flags as read-only.
// - Flag deep-link: /finance/{receiptId}?flag={flagId}.
// - Status lifecycle is terminal: open → dismissed | actioned (no re-open).

import { useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  FilterBar,
  HStack,
  ListPage,
  PageHeader,
  Stack,
  Text,
  useToast,
  type FilterDef,
} from '@cmc/ui';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
type FlagKind =
  | 'self_approved'
  | 'exceeds_threshold'
  | 'excess_refunds'
  | 'missing_provisioning';

const KIND_LABELS: Record<FlagKind, string> = {
  self_approved: 'Tự duyệt phiếu thu',
  exceeds_threshold: 'Vượt ngưỡng phê duyệt',
  excess_refunds: 'Hoàn tiền vượt mức',
  missing_provisioning: 'Thiếu cấp phát dịch vụ',
};

const KIND_COLORS: Record<FlagKind, ComponentProps<typeof Badge>['variant']> = {
  self_approved: 'red',
  exceeds_threshold: 'orange',
  excess_refunds: 'orange',
  missing_provisioning: 'yellow',
};

const RECON_FILTERS: FilterDef[] = [
  {
    key: 'kind',
    label: 'Loại cảnh báo',
    type: 'select',
    options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
    placeholder: 'Tất cả',
  },
];

const KIND_DESCRIPTIONS: Record<FlagKind, string> = {
  self_approved:
    'Agent phát hiện phiếu thu được duyệt bởi chính người tạo (vi phạm kiểm soát nội bộ).',
  exceeds_threshold:
    'Phiếu thu vượt ngưỡng cần second-eye nhưng không có GĐ đào tạo hoặc Quản trị hệ thống phê duyệt.',
  excess_refunds:
    'Tổng hoàn tiền cho phiếu này vượt quá số tiền gốc (netAmount).',
  missing_provisioning:
    'Phiếu thu đã được duyệt nhưng không có bản ghi cấp phát dịch vụ tương ứng.',
};

// ---------------------------------------------------------------------------
// Narrow flag shape for JSX — avoids TS2589 from deep Prisma type inference
// ---------------------------------------------------------------------------
interface FlagItem {
  id: string;
  kind: string;
  receiptId: string | null;
  createdAt: Date | string;
  status: string;
}

// ---------------------------------------------------------------------------
// Confirm action type
// ---------------------------------------------------------------------------
type PendingAction = {
  type: 'dismiss' | 'action';
  flagId: string;
  flagKind: FlagKind;
} | null;

// ---------------------------------------------------------------------------
// Flag card
// ---------------------------------------------------------------------------
interface FlagCardProps {
  flag: {
    id: string;
    kind: string;
    receiptId: string | null;
    createdAt: Date | string;
    status: string;
  };
  canReview: boolean;
  onDismiss: (flagId: string, kind: FlagKind) => void;
  onAction: (flagId: string, kind: FlagKind) => void;
  isMutating: boolean;
}

function FlagCard({ flag, canReview, onDismiss, onAction, isMutating }: FlagCardProps) {
  const kind = flag.kind as FlagKind;
  const label = KIND_LABELS[kind] ?? flag.kind;
  const color = KIND_COLORS[kind] ?? 'neutral';
  const description = KIND_DESCRIPTIONS[kind] ?? '';
  const createdAt = new Date(flag.createdAt as unknown as string).toLocaleDateString(
    'vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' },
  );

  return (
    <Card padding={4}>
      <Stack gap={2}>
        <HStack justify="between" wrap="nowrap">
          <Badge label={label} variant={color} />
          <Text type="supporting" size="xsm">
            {createdAt}
          </Text>
        </HStack>

        <Text type="supporting" size="xsm">
          {description}
        </Text>

        {flag.receiptId && (
          <HStack gap={1.5} align="center">
            <Text type="supporting" size="xsm">
              Phiếu thu:
            </Text>
            {/* Plain <a> (not react-router Link) — matches the original
                the prior anchor's full-page-navigation behavior exactly. */}
            <a
              href={`/finance/${flag.receiptId}?flag=${flag.id}`}
              style={{ fontSize: 'var(--cmc-fs-meta)', color: 'var(--cmc-brand)' }}
            >
              …{flag.receiptId.slice(-8)}
            </a>
          </HStack>
        )}

        <div style={{ marginTop: 'var(--cmc-space-1)' }}>
          {canReview ? (
            <HStack gap={2} justify="end">
              <Button
                label="Bỏ qua"
                size="sm"
                variant="secondary"
                isDisabled={isMutating}
                onClick={() => onDismiss(flag.id, kind)}
              />
              <Button
                label="Đã xử lý"
                size="sm"
                variant="primary"
                isDisabled={isMutating}
                onClick={() => onAction(flag.id, kind)}
              />
            </HStack>
          ) : (
            <Text type="supporting" size="xsm" style={{ fontStyle: 'italic' }}>
              Chỉ đọc — liên hệ GĐ để xử lý cảnh báo.
            </Text>
          )}
        </div>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ReconciliationPage() {
  const { canDo } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const kindFilter = (searchParams.get('kind') ?? '') as FlagKind | '';
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const { success: toastSuccess } = useToast();

  const utils = trpc.useUtils();

  const { data: flagsRaw, isLoading, error } = trpc.reconciliation.listFlags.useQuery(
    kindFilter ? { kind: kindFilter } : {},
  );
  // Cast to narrow local interface to avoid TS2589 from recursive Prisma types.
  const flags = flagsRaw as unknown as FlagItem[] | undefined;

  // Callbacks passed at mutate() call-site rather than useMutation() options to
  // avoid TS2589 (excessively deep type instantiation through Prisma generics).
  const dismissMut = trpc.reconciliation.dismiss.useMutation();
  const actionMut = trpc.reconciliation.action.useMutation();

  function afterMutateSuccess(type: 'dismiss' | 'action') {
    void utils.reconciliation.listFlags.invalidate();
    setPendingAction(null);
    toastSuccess(type === 'dismiss' ? 'Đã bỏ qua cảnh báo' : 'Đã đánh dấu xử lý');
  }

  function afterMutateError() {
    setPendingAction(null);
  }

  const isMutating = dismissMut.isPending || actionMut.isPending;
  const canReview = canDo('reconciliation', 'review');

  const activeKindLabel = pendingAction
    ? (KIND_LABELS[pendingAction.flagKind] ?? pendingAction.flagKind)
    : '';

  function handleFiltersChange(next: Record<string, string>) {
    const p = new URLSearchParams(searchParams);
    if (next.kind) {
      p.set('kind', next.kind);
    } else {
      p.delete('kind');
    }
    setSearchParams(p, { replace: true });
  }

  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Đối soát tài chính"
            breadcrumbs={[{ label: 'Ops' }, { label: 'Đối soát' }]}
          />
        }
        filters={
          <FilterBar
            filters={RECON_FILTERS}
            value={{ kind: kindFilter }}
            onChange={handleFiltersChange}
          />
        }
      >
        <Stack gap={4} padding={4}>
          {/* ----------------------------------------------------------------
              HOTL agent read-only banner — MUST be present and unambiguous.
              The ai:recon worker is read-only per-facility; it cannot action
              flags itself. Human review (dismiss / action) is gated to GĐ.
          ---------------------------------------------------------------- */}
          <Banner
            status="warning"
            title="Kết quả phân tích tự động — chỉ đọc"
            description={
              <>
                Các cảnh báo bên dưới được tạo tự động bởi{' '}
                <Text weight="bold" size="sm">
                  hệ thống phân tích tự động
                </Text>{' '}
                dựa trên quy tắc nghiệp vụ. Agent{' '}
                <Text weight="bold" size="sm">
                  không tự thực hiện hành động
                </Text>{' '}
                — mọi thao tác xử lý (bỏ qua / đã xử lý) đều yêu cầu GĐ xác nhận thủ công.
                Kết quả chỉ mang tính tham khảo và cần được xác minh độc lập.
              </>
            }
          />

          {error && (
            <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
          )}

          {isLoading && (
            <Text type="supporting" size="sm">
              Đang tải cảnh báo…
            </Text>
          )}

          {!isLoading && flags?.length === 0 && (
            <Banner
              status="success"
              title={`Không có cảnh báo nào đang mở${kindFilter ? ` (loại: ${KIND_LABELS[kindFilter]})` : ''}.`}
            />
          )}

          {flags?.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              canReview={canReview}
              isMutating={isMutating}
              onDismiss={(id, kind) =>
                setPendingAction({ type: 'dismiss', flagId: id, flagKind: kind })
              }
              onAction={(id, kind) =>
                setPendingAction({ type: 'action', flagId: id, flagKind: kind })
              }
            />
          ))}
        </Stack>
      </ListPage>

      {/* Confirm: dismiss */}
      <ConfirmDialog
        opened={pendingAction?.type === 'dismiss'}
        title="Bỏ qua cảnh báo"
        message={`Bỏ qua "${activeKindLabel}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Bỏ qua"
        confirmColor="gray"
        loading={isMutating}
        onConfirm={() => {
          if (pendingAction) {
            dismissMut.mutate(
              { flagId: pendingAction.flagId },
              {
                onSuccess: () => afterMutateSuccess('dismiss'),
                onError: afterMutateError,
              },
            );
          }
        }}
        onCancel={() => setPendingAction(null)}
      />

      {/* Confirm: action */}
      <ConfirmDialog
        opened={pendingAction?.type === 'action'}
        title="Đánh dấu đã xử lý"
        message={`Đánh dấu đã xử lý "${activeKindLabel}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Đã xử lý"
        confirmColor="blue"
        loading={isMutating}
        onConfirm={() => {
          if (pendingAction) {
            actionMut.mutate(
              { flagId: pendingAction.flagId },
              {
                onSuccess: () => afterMutateSuccess('action'),
                onError: afterMutateError,
              },
            );
          }
        }}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
