// After-sale case form — /crm/aftersale/:caseId (resource-centric).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  DetailPage,
  EmptyState,
  EntityHeader,
  HStack,
  PageHeader,
  ResultPanel,
  Stack,
  StatusBadge,
  Text,
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

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          title="Case sau bán"
          subtitle={data.studentName ?? data.studentId}
          breadcrumbs={[
            { label: 'CRM' },
            { label: 'Sau bán', href: '/crm/aftersale' },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="afterSaleCase" id={caseId} />
              {data.status === 'open' ? (
                <Button
                  label="Tiếp nhận"
                  size="sm"
                  variant="secondary"
                  isLoading={advanceMutation.isPending}
                  onClick={() =>
                    advanceMutation.mutate(
                      { caseId },
                      {
                        onSuccess: () => setFlash({ ok: true, text: 'Đã tiếp nhận (in_progress).' }),
                        onError: (e) => setFlash({ ok: false, text: e.message }),
                      },
                    )
                  }
                />
              ) : null}
              {data.status === 'open' || data.status === 'in_progress' ? (
                <Button
                  label="Giải quyết"
                  size="sm"
                  variant="primary"
                  onClick={() => setResolveOpen(true)}
                />
              ) : null}
              {data.status === 'resolved' ? (
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
          title={data.studentName ?? 'Học viên'}
          subtitle={`Ưu tiên: ${PRIORITY_LABELS[data.priority] ?? data.priority}`}
          initials={(data.studentName ?? 'C').slice(0, 1).toUpperCase()}
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
        {flash ? <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} /> : null}
        <Text type="body" size="sm">
          {data.description}
        </Text>
        {data.resolution ? (
          <Text type="body" size="xsm" color="secondary">
            Giải pháp: {data.resolution}
          </Text>
        ) : null}
      </Stack>

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
