// P3 — Nhập lead hàng loạt (paste text/CSV).
// Flow: paste → preview → confirm → result report + copy errors.

import { useMemo, useState } from 'react';
import {
  Banner,
  Button,
  HStack,
  ListPage,
  PageHeader,
  Panel,
  Selector,
  Stack,
  Text,
  TextArea,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { SOURCE_LABELS } from './create-lead-dialog.js';

type SourceKey = 'referral' | 'walkin' | 'fanpage' | 'hotline' | 'event' | 'other';

const SOURCE_OPTIONS: { value: SourceKey | ''; label: string }[] = [
  { value: '', label: '(Không gắn nguồn chung)' },
  ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({
    value: value as SourceKey,
    label,
  })),
];

const STATUS_LABEL: Record<string, string> = {
  create: 'Sẽ tạo',
  skip_open_opportunity: 'Bỏ — đã có cơ hội mở',
  skip_duplicate_in_file: 'Bỏ — trùng trong danh sách',
  error: 'Lỗi',
  created: 'Đã tạo',
  skipped: 'Đã bỏ',
};

type Phase = 'edit' | 'preview' | 'done';

export default function CrmBulkImportPage() {
  const [text, setText] = useState('');
  const [defaultSource, setDefaultSource] = useState<SourceKey | ''>('');
  const [phase, setPhase] = useState<Phase>('edit');

  const previewMutation = trpc.crm.opportunityBulkPreview.useMutation();
  const confirmMutation = trpc.crm.opportunityBulkConfirm.useMutation();
  const utils = trpc.useUtils();

  const preview = previewMutation.data;
  const confirm = confirmMutation.data;

  const errorLinesText = useMemo(() => {
    if (phase === 'preview' && preview) {
      return preview.rows
        .filter((r) => r.status === 'error')
        .map((r) => `${r.name},${r.phone}${r.email ? `,${r.email}` : ''}`)
        .join('\n');
    }
    if (phase === 'done' && confirm) {
      return confirm.results
        .filter((r) => r.status === 'error')
        .map((r) => `${r.name ?? ''},${r.phone ?? ''}`)
        .join('\n');
    }
    return '';
  }, [phase, preview, confirm]);

  const runPreview = () => {
    setPhase('edit');
    previewMutation.mutate(
      {
        text,
        ...(defaultSource ? { defaultSource } : {}),
      },
      {
        onSuccess: () => setPhase('preview'),
      },
    );
  };

  const runConfirm = () => {
    confirmMutation.mutate(
      {
        text,
        ...(defaultSource ? { defaultSource } : {}),
      },
      {
        onSuccess: () => {
          setPhase('done');
          void utils.crm.opportunityList.invalidate();
        },
      },
    );
  };

  return (
    <div data-testid="crm-bulk-import-page">
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Nhập lead hàng loạt"
            breadcrumbs={[
              { label: 'Kinh doanh' },
              { label: 'Pipeline CRM' },
              { label: 'Nhập hàng loạt' },
            ]}
          />
        }
      >
        <Stack gap={4} style={{ padding: '0 0 24px' }}>
          <Panel title="Dán danh sách" icon="users">
            <div style={{ padding: '0 22px 20px' }}>
              <Stack gap={3}>
                <Text type="supporting" size="sm">
                  Mỗi dòng: <code>họ tên, số điện thoại[, email[, nguồn]]</code>. Tối đa 500 dòng.
                  Nguồn hợp lệ: referral, walkin, fanpage, hotline, event, other. Xem trước bắt buộc
                  trước khi ghi.
                </Text>
                <TextArea
                  label="Danh sách lead"
                  value={text}
                  onChange={setText}
                  rows={12}
                  placeholder={'Nguyễn Văn A,0901234567,a@email.com,fanpage\nTrần B,0912345678'}
                />
                <Selector
                  label="Nguồn chung (nếu dòng không có cột nguồn)"
                  options={SOURCE_OPTIONS}
                  value={defaultSource}
                  onChange={(v) => setDefaultSource((v as SourceKey | '') ?? '')}
                />
                <HStack gap={2}>
                  <span data-testid="crm-bulk-preview-btn">
                    <Button
                      label="Xem trước"
                      variant="primary"
                      onClick={runPreview}
                      isDisabled={!text.trim() || previewMutation.isPending}
                      isLoading={previewMutation.isPending}
                    />
                  </span>
                  {phase === 'preview' && (
                    <span data-testid="crm-bulk-confirm-btn">
                      <Button
                        label="Xác nhận tạo"
                        variant="secondary"
                        onClick={runConfirm}
                        isDisabled={
                          confirmMutation.isPending ||
                          !preview ||
                          preview.summary.create === 0
                        }
                        isLoading={confirmMutation.isPending}
                      />
                    </span>
                  )}
                </HStack>
                {(previewMutation.error || confirmMutation.error) && (
                  <Banner
                    status="error"
                    title="Lỗi"
                    description={
                      previewMutation.error?.message ?? confirmMutation.error?.message ?? ''
                    }
                  />
                )}
              </Stack>
            </div>
          </Panel>

          {phase === 'preview' && preview && (
            <Panel title="Xem trước" icon="search">
              <div style={{ padding: '0 22px 20px' }} data-testid="crm-bulk-preview">
                <Stack gap={3}>
                  <HStack gap={4} wrap="wrap">
                    <Text size="sm">
                      Tổng: <strong>{preview.summary.total}</strong>
                    </Text>
                    <Text size="sm">
                      Sẽ tạo: <strong>{preview.summary.create}</strong>
                    </Text>
                    <Text size="sm">
                      Bỏ: <strong>{preview.summary.skip}</strong>
                    </Text>
                    <Text size="sm">
                      Lỗi: <strong>{preview.summary.error}</strong>
                    </Text>
                  </HStack>
                  {preview.overLimit && (
                    <Banner
                      status="warning"
                      title="Vượt 500 dòng"
                      description="Chỉ 500 dòng đầu được xử lý; phần còn lại báo lỗi."
                    />
                  )}
                  <PreviewTable
                    rows={preview.rows.map((r) => [
                      r.line,
                      r.name,
                      r.phone,
                      STATUS_LABEL[r.status] ?? r.status,
                      r.reason ?? '—',
                    ])}
                  />
                  {errorLinesText && (
                    <Button
                      label="Copy dòng lỗi"
                      variant="secondary"
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(errorLinesText)}
                    />
                  )}
                </Stack>
              </div>
            </Panel>
          )}

          {phase === 'done' && confirm && (
            <Panel title="Kết quả nhập" icon="check-circle">
              <div style={{ padding: '0 22px 20px' }} data-testid="crm-bulk-result">
                <Stack gap={3}>
                  <Banner
                    status="success"
                    title="Hoàn tất"
                    description={`Tạo ${confirm.summary.created}, bỏ ${confirm.summary.skipped}, lỗi ${confirm.summary.error}.`}
                  />
                  <PreviewTable
                    rows={confirm.results.map((r) => [
                      r.line,
                      r.name ?? '—',
                      r.phone ?? '—',
                      STATUS_LABEL[r.status] ?? r.status,
                      r.reason ?? (r.opportunityId ? r.opportunityId.slice(0, 8) : '—'),
                    ])}
                  />
                  {errorLinesText && (
                    <Button
                      label="Copy dòng lỗi"
                      variant="secondary"
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(errorLinesText)}
                    />
                  )}
                  <Button
                    label="Nhập lô khác"
                    variant="secondary"
                    onClick={() => {
                      setPhase('edit');
                      setText('');
                      previewMutation.reset();
                      confirmMutation.reset();
                    }}
                  />
                </Stack>
              </div>
            </Panel>
          )}
        </Stack>
      </ListPage>
    </div>
  );
}

function PreviewTable({ rows }: { rows: Array<Array<string | number>> }) {
  if (rows.length === 0) {
    return <Text type="supporting">Không có dòng nào.</Text>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Dòng', 'Họ tên', 'SĐT', 'Trạng thái', 'Chi tiết'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--cmc-border)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--cmc-border)',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
