import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  Divider,
  HStack,
  ListPage,
  PageHeader,
  ResultPanel,
  Selector,
  Spinner,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

type LookupBy = 'phone' | 'name';

interface SelectedStudent {
  id: string;
  fullName: string;
  lifecycle: string;
}

export default function ClassPlacementPage() {
  const navigate = useNavigate();
  const { success: toastSuccess } = useToast();

  const [lookupBy, setLookupBy] = useState<LookupBy>('phone');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupError, setLookupError] = useState('');

  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [classBatchId, setClassBatchId] = useState<string>('');
  const [enrollResult, setEnrollResult] = useState<{ classBatchId: string } | null>(null);
  const [enrollConfirmOpen, setEnrollConfirmOpen] = useState(false);

  // Lookup fires on demand — null means "not yet triggered".
  const [lookupInput, setLookupInput] = useState<{ phone?: string; name?: string } | null>(null);

  const {
    data: lookupData,
    isFetching: lookupLoading,
    error: lookupFetchError,
  } = trpc.student.lookup.useQuery(
    // Non-null assertion is safe: query is disabled when lookupInput is null.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    lookupInput!,
    { enabled: lookupInput !== null },
  );

  const { data: classBatchData, isLoading: classBatchLoading } =
    trpc.classBatch.list.useQuery({ pageSize: 100 });

  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: (res) => {
      setEnrollConfirmOpen(false);
      setEnrollResult({ classBatchId: res.classBatchId });
      toastSuccess('Đã xếp lớp');
    },
    onError: () => {
      setEnrollConfirmOpen(false);
    },
  });

  const classBatchOptions = (classBatchData?.items ?? []).map((b) => ({
    value: b.id,
    label: `${b.code} — ${b.program} (${new Date(b.startDate).toLocaleDateString('vi-VN')})`,
  }));

  const selectedClassCode =
    (classBatchData?.items ?? []).find((b) => b.id === classBatchId)?.code ?? classBatchId;

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const q = lookupQuery.trim();
    if (!q) {
      setLookupError('Vui lòng nhập SĐT hoặc tên học viên');
      return;
    }
    setLookupError('');
    setSelectedStudent(null);
    setEnrollResult(null);
    setLookupInput(lookupBy === 'phone' ? { phone: q } : { name: q });
  }

  function handleEnroll() {
    if (!selectedStudent || !classBatchId) return;
    setEnrollConfirmOpen(true);
  }

  // TODO(astryx-review): Text's `color` prop is a fixed semantic enum
  // (primary/secondary/disabled/placeholder/accent/inherit) with no
  // success/danger/warning slot — this 3-way lifecycle status color has no
  // clean Astryx equivalent, so lifecycle labels stay a plain <span style>
  // per the documented fallback (same pattern as receipt-detail's pipeline
  // labels / payroll's penalty row).
  const lifecycleColor: Record<string, string> = {
    active: 'var(--cmc-success)',
    blocked_lms: 'var(--cmc-danger)',
    withdrawn: 'var(--cmc-warning)',
  };

  return (
    <>
      <ListPage
        header={
          <PageHeader
            title="Xếp lớp học viên"
            subtitle="Đặt chỗ (reserved) cho học viên đã có trong hệ thống vào lớp học"
            breadcrumbs={[
              { label: 'Kinh doanh' },
              { label: 'Phiếu thu', href: '/finance' },
              { label: 'Xếp lớp' },
            ]}
            actions={
              <Button
                label="← Quay lại"
                variant="secondary"
                size="sm"
                onClick={() => void navigate('/finance')}
              />
            }
          />
        }
      >
        <div style={{ padding: 'var(--cmc-space-3)', maxWidth: 560 }}>
          <Stack gap={4}>
            {enrollResult && (
              <ResultPanel
                status="success"
                title="Đã xếp lớp thành công"
                message={`Học viên "${selectedStudent?.fullName}" đã được đặt chỗ (reserved). Trạng thái chuyển sang active sau khi phiếu thu liên quan được duyệt.`}
                actions={
                  <Button
                    label="Xếp lớp tiếp"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEnrollResult(null);
                      setSelectedStudent(null);
                      setClassBatchId('');
                      setLookupInput(null);
                      setLookupQuery('');
                    }}
                  />
                }
              />
            )}

            {!enrollResult && (
              <>
                {/* Step 1 — Student lookup */}
                <div
                  style={{
                    border: '1px solid var(--cmc-border)',
                    borderRadius: 'var(--cmc-radius-xs)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'var(--cmc-surface-2)',
                      borderBottom: '1px solid var(--cmc-border)',
                    }}
                  >
                    <Text type="supporting" size="2xs" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Bước 1 — Tìm học viên
                    </Text>
                  </div>
                  <div style={{ padding: 'var(--cmc-space-3)' }}>
                    <Banner
                      status="info"
                      title="Chỉ dành cho học viên đã có trong hệ thống"
                      description={
                        <>
                          Màn hình này dành cho học viên <strong>đã có trong hệ thống</strong>. Để ghi
                          danh học viên mới, hãy{' '}
                          {/* TODO(astryx-review): raw brand-color link-styled text — Text's
                              `color` enum has no exact brand slot (`accent` resolves to a
                              darker brand-ink shade, not the same hex), so this stays a plain
                              <span style> per the documented fallback. */}
                          <span
                            style={{ fontSize: 12, color: 'var(--cmc-brand)', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => void navigate('/finance/new')}
                          >
                            tạo phiếu thu mới
                          </span>
                          .
                        </>
                      }
                    />

                    <div style={{ marginTop: 16 }}>
                      <form onSubmit={handleLookup}>
                        <Stack gap={2}>
                          {/* Lookup-by toggle */}
                          <HStack gap={2}>
                            {(['phone', 'name'] as LookupBy[]).map((opt) => (
                              <Button
                                key={opt}
                                label={opt === 'phone' ? 'SĐT phụ huynh' : 'Tên học viên'}
                                size="sm"
                                variant={lookupBy === opt ? 'primary' : 'secondary'}
                                onClick={() => {
                                  setLookupBy(opt);
                                  setLookupQuery('');
                                  setLookupInput(null);
                                }}
                              />
                            ))}
                          </HStack>

                          <HStack gap={1} align="end" style={{ flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <TextInput
                                label={lookupBy === 'phone' ? 'SĐT phụ huynh' : 'Tên học viên'}
                                isLabelHidden
                                placeholder={lookupBy === 'phone' ? 'VD: 0912345678' : 'VD: Nguyễn Văn A'}
                                value={lookupQuery}
                                onChange={(v) => {
                                  setLookupQuery(v);
                                  setLookupError('');
                                }}
                                status={lookupError ? { type: 'error', message: lookupError } : undefined}
                              />
                            </div>
                            <Button label="Tìm" type="submit" size="sm" isLoading={lookupLoading} />
                          </HStack>
                        </Stack>
                      </form>

                      {lookupFetchError && (
                        <div style={{ marginTop: 8 }}>
                          <Banner status="error" title={lookupFetchError.message} />
                        </div>
                      )}

                      {lookupLoading && (
                        <HStack gap={1} style={{ marginTop: 8 }}>
                          <Spinner size="sm" />
                          <Text type="supporting" size="2xs">Đang tìm...</Text>
                        </HStack>
                      )}

                      {!lookupLoading && lookupData && lookupData.length === 0 && (
                        <Text type="supporting" size="sm" style={{ marginTop: 8 }}>
                          Không tìm thấy học viên. Kiểm tra lại SĐT/tên, hoặc tạo phiếu thu mới.
                        </Text>
                      )}

                      {!lookupLoading && lookupData && lookupData.length > 0 && (
                        <Stack gap={1} style={{ marginTop: 8 }}>
                          <Text type="supporting" size="2xs">Chọn học viên:</Text>
                          {lookupData.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => setSelectedStudent(s)}
                              style={{
                                padding: '8px 12px',
                                border: `1px solid ${
                                  selectedStudent?.id === s.id ? 'var(--cmc-brand)' : 'var(--cmc-border)'
                                }`,
                                borderRadius: 'var(--cmc-radius-xs)',
                                cursor: 'pointer',
                                background:
                                  selectedStudent?.id === s.id
                                    ? 'var(--cmc-brand-muted)'
                                    : 'var(--cmc-surface)',
                              }}
                            >
                              <HStack justify="between">
                                <Text type="body" size="sm" weight={selectedStudent?.id === s.id ? 'semibold' : 'normal'}>
                                  {s.fullName}
                                </Text>
                                {/* TODO(astryx-review): same raw-color fallback as the
                                    lifecycle badge above — 3-way status color, no Text
                                    enum slot. */}
                                <span style={{ fontSize: 12, fontWeight: 600, color: lifecycleColor[s.lifecycle] ?? 'inherit' }}>
                                  {s.lifecycle}
                                </span>
                              </HStack>
                            </div>
                          ))}
                        </Stack>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 2 — Class selection (only shown after selecting a student) */}
                {selectedStudent && (
                  <>
                    <Divider />
                    <div
                      style={{
                        border: '1px solid var(--cmc-border)',
                        borderRadius: 'var(--cmc-radius-xs)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 16px',
                          background: 'var(--cmc-surface-2)',
                          borderBottom: '1px solid var(--cmc-border)',
                        }}
                      >
                        <Text type="supporting" size="2xs" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Bước 2 — Chọn lớp học cho{' '}
                          {/* TODO(astryx-review): raw brand-color emphasis text — same
                              fallback as the "tạo phiếu thu mới" link above. */}
                          <span style={{ color: 'var(--cmc-brand)' }}>
                            {selectedStudent.fullName}
                          </span>
                        </Text>
                      </div>
                      <div style={{ padding: 'var(--cmc-space-3)' }}>
                        <Stack gap={3}>
                          {/* TODO(astryx-review): Astryx Selector has no
                              `nothingFoundMessage` equivalent (empty search results use
                              its own built-in "no results" UI) — the prior custom
                              message is dropped (same flag as receipt-create's class
                              selector). */}
                          <Selector
                            label="Lớp học"
                            placeholder={classBatchLoading ? 'Đang tải danh sách lớp...' : 'Chọn lớp học'}
                            isRequired
                            options={classBatchOptions}
                            value={classBatchId || undefined}
                            onChange={(v) => setClassBatchId(v)}
                            hasSearch
                            isDisabled={classBatchLoading}
                          />

                          {enrollMutation.error && (
                            <Banner status="error" title="Lỗi xếp lớp" description={enrollMutation.error.message} />
                          )}

                          <Text type="supporting" size="2xs">
                            Xếp lớp tạo trạng thái <strong>reserved</strong> (đặt chỗ). Trạng thái
                            chuyển sang <strong>active</strong> sau khi phiếu thu được duyệt.
                          </Text>

                          <HStack gap={1} style={{ flexWrap: 'wrap' }}>
                            <Button
                              label="Xác nhận xếp lớp"
                              variant="primary"
                              isDisabled={!classBatchId}
                              isLoading={enrollMutation.isPending}
                              onClick={handleEnroll}
                            />
                            <Button
                              label="Chọn lại học viên"
                              variant="secondary"
                              onClick={() => setSelectedStudent(null)}
                              isDisabled={enrollMutation.isPending}
                            />
                          </HStack>
                        </Stack>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </Stack>
        </div>
      </ListPage>

      <ConfirmDialog
        opened={enrollConfirmOpen}
        title="Xác nhận xếp lớp"
        message={`Xếp học viên "${selectedStudent?.fullName ?? ''}" vào lớp ${selectedClassCode}? Trạng thái sẽ là reserved cho đến khi phiếu thu được duyệt.`}
        confirmLabel="Xếp lớp"
        confirmColor="blue"
        loading={enrollMutation.isPending}
        onConfirm={() => {
          if (!selectedStudent || !classBatchId) return;
          enrollMutation.mutate({ studentId: selectedStudent.id, classBatchId });
        }}
        onCancel={() => setEnrollConfirmOpen(false)}
      />
    </>
  );
}
