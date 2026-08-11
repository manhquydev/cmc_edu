// After-sale case form — /crm/aftersale/:caseId (resource-centric).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
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
import { trpc } from '../../lib/trpc.js';
import { useAfterSaleActions } from './use-after-sale-actions.js';
import { ResolveAfterSaleCaseDialog } from './resolve-after-sale-case-dialog.js';

const STATUS_LABELS: Record<string, string> = {
  open: 'Mở',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
};

function statusSteps(status: string): {
  steps: { id: string; label: string }[];
  activeIndex: number;
} {
  const steps = [
    { id: 'open', label: 'Mở' },
    { id: 'in_progress', label: 'Đang xử lý' },
    { id: 'resolved', label: 'Đã giải quyết' },
    { id: 'closed', label: 'Đã đóng' },
  ];
  const idx =
    status === 'closed'
      ? 3
      : status === 'resolved'
        ? 2
        : status === 'in_progress'
          ? 1
          : 0;
  return { steps, activeIndex: idx };
}

export default function AfterSaleDetailPage() {
  const { caseId = '' } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const idOk = UUID_RE.test(caseId);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, error, refetch } = trpc.afterSale.get.useQuery(
    { caseId },
    { enabled: idOk },
  );
  const utils = trpc.useUtils();
  const { advanceMutation, closeMutation } = useAfterSaleActions();

  if (!idOk) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'CRM' },
              { label: 'Sau bán', href: '/crm/aftersale' },
              { label: 'Không hợp lệ' },
            ]}
          />
        }
      >
        <EmptyState title="ID không hợp lệ" description="URL cần UUID case." />
      </DetailPage>
    );
  }

  if (isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'CRM' },
              { label: 'Sau bán', href: '/crm/aftersale' },
              { label: '…' },
            ]}
          />
        }
      >
        <ResultPanel status="loading" title="Đang tải case…" />
      </DetailPage>
    );
  }

  if (error || !data) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'CRM' },
              { label: 'Sau bán', href: '/crm/aftersale' },
              { label: 'Lỗi' },
            ]}
          />
        }
      >
        <EmptyState
          title="Không mở được case"
          description={error?.message ?? 'Không tìm thấy.'}
          action={
            <Link to="/crm/aftersale">
              <Button label="Về danh sách" size="sm" variant="secondary" />
            </Link>
          }
        />
      </DetailPage>
    );
  }

  const shortId = caseId.slice(0, 8);
  const { steps, activeIndex } = statusSteps(data.status);
  const studentLabel = data.studentName ?? data.studentId ?? 'Học viên';
  const priorityLabel = PRIORITY_LABELS[data.priority] ?? data.priority;
  const showAdvance = data.status === 'open';
  const showResolve = data.status === 'open' || data.status === 'in_progress';
  const showClose = data.status === 'resolved';

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'CRM' },
            { label: 'Sau bán', href: '/crm/aftersale' },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="afterSaleCase" id={caseId} />
              <Button
                label="Về danh sách"
                size="sm"
                variant="ghost"
                onClick={() => navigate('/crm/aftersale')}
              />
            </HStack>
          }
        />
      }
      entity={
        <EntityHeader
          title={studentLabel}
          subtitle={`Case sau bán · ưu tiên ${priorityLabel}`}
          initials={(data.studentName ?? 'C').slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge
              status={data.status}
              label={STATUS_LABELS[data.status] ?? data.status}
            />
          }
          actions={
            showAdvance || showResolve || showClose ? (
              <HStack gap={1} wrap="wrap">
                {showAdvance ? (
                  <Button
                    label="Tiếp nhận"
                    size="sm"
                    variant="secondary"
                    isLoading={advanceMutation.isPending}
                    onClick={() =>
                      advanceMutation.mutate(
                        { caseId },
                        {
                          onSuccess: () =>
                            setFlash({ ok: true, text: 'Đã tiếp nhận (in_progress).' }),
                          onError: (e) => setFlash({ ok: false, text: e.message }),
                        },
                      )
                    }
                  />
                ) : null}
                {showResolve ? (
                  <Button
                    label="Giải quyết"
                    size="sm"
                    variant="primary"
                    onClick={() => setResolveOpen(true)}
                  />
                ) : null}
                {showClose ? (
                  <Button
                    label="Đóng"
                    size="sm"
                    variant="ghost"
                    isLoading={closeMutation.isPending}
                    onClick={() =>
                      closeMutation.mutate(
                        { caseId },
                        {
                          onSuccess: () => setFlash({ ok: true, text: 'Đã đóng case.' }),
                          onError: (e) => setFlash({ ok: false, text: e.message }),
                        },
                      )
                    }
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
                  status={data.status}
                  label={STATUS_LABELS[data.status] ?? data.status}
                />
              ),
            },
            { key: 'priority', label: 'Ưu tiên', value: priorityLabel },
            { key: 'student', label: 'Học viên', value: studentLabel },
          ]}
        />
      }
      statusbar={<WorkflowStatusbar steps={steps} activeIndex={activeIndex} />}
    >
      <div className="console-detail-panel">
        <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 720 }}>
          {flash ? <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} /> : null}

          <SectionBlock
            title="Nội dung case"
            description="Cùng khung form chứng từ Console (list → form · statusbar · sheet)."
          >
            <KeyValueList
              items={[
                { key: 'student', label: 'Học viên', value: studentLabel },
                { key: 'priority', label: 'Ưu tiên', value: priorityLabel },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: STATUS_LABELS[data.status] ?? data.status,
                },
              ]}
            />
            <Text type="body" size="sm" style={{ marginTop: 12 }}>
              {data.description}
            </Text>
            {data.resolution ? (
              <Text type="body" size="xsm" color="secondary" style={{ marginTop: 8 }}>
                Giải pháp: {data.resolution}
              </Text>
            ) : null}
          </SectionBlock>
        </Stack>
      </div>

      <ResolveAfterSaleCaseDialog
        caseId={resolveOpen ? caseId : null}
        onClose={() => {
          setResolveOpen(false);
          void refetch();
          void utils.afterSale.list.invalidate();
        }}
      />
    </DetailPage>
  );
}
