import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { PageHeader, ResultPanel } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

type LookupBy = 'phone' | 'name';

interface SelectedStudent {
  id: string;
  fullName: string;
  lifecycle: string;
}

export default function ClassPlacementPage() {
  const navigate = useNavigate();

  const [lookupBy, setLookupBy] = useState<LookupBy>('phone');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupError, setLookupError] = useState('');

  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [classBatchId, setClassBatchId] = useState<string>('');
  const [enrollResult, setEnrollResult] = useState<{ classBatchId: string } | null>(null);

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
      setEnrollResult({ classBatchId: res.classBatchId });
    },
  });

  const classBatchOptions = (classBatchData?.items ?? []).map((b) => ({
    value: b.id,
    label: `${b.code} — ${b.program} (${new Date(b.startDate).toLocaleDateString('vi-VN')})`,
  }));

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
    enrollMutation.mutate({ studentId: selectedStudent.id, classBatchId });
  }

  const lifecycleColor: Record<string, string> = {
    active: 'var(--cmc-success)',
    blocked_lms: 'var(--cmc-danger)',
    withdrawn: 'var(--cmc-warning)',
  };

  return (
    <>
      <PageHeader
        title="Xếp lớp học viên"
        subtitle="Đặt chỗ (reserved) cho học viên đã có trong hệ thống vào lớp học"
        breadcrumbs={[
          { label: 'Kinh doanh' },
          { label: 'Phiếu thu', href: '/finance' },
          { label: 'Xếp lớp' },
        ]}
        actions={
          <Button variant="default" size="xs" radius="xs" onClick={() => void navigate('/finance')}>
            ← Quay lại
          </Button>
        }
      />

      <Box p="md" maw={560}>
        <Stack gap="lg">
          {enrollResult && (
            <ResultPanel
              status="success"
              title="Đã xếp lớp thành công"
              message={`Học viên "${selectedStudent?.fullName}" đã được đặt chỗ (reserved). Trạng thái chuyển sang active sau khi phiếu thu liên quan được duyệt.`}
              actions={
                <Button
                  size="xs"
                  radius="xs"
                  variant="light"
                  onClick={() => {
                    setEnrollResult(null);
                    setSelectedStudent(null);
                    setClassBatchId('');
                    setLookupInput(null);
                    setLookupQuery('');
                  }}
                >
                  Xếp lớp tiếp
                </Button>
              }
            />
          )}

          {!enrollResult && (
            <>
              {/* Step 1 — Student lookup */}
              <Box
                style={{
                  border: '1px solid var(--cmc-border)',
                  borderRadius: 'var(--cmc-radius-xs)',
                  overflow: 'hidden',
                }}
              >
                <Box
                  px="md"
                  py="sm"
                  style={{
                    background: 'var(--cmc-surface-2)',
                    borderBottom: '1px solid var(--cmc-border)',
                  }}
                >
                  <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
                    Bước 1 — Tìm học viên
                  </Text>
                </Box>
                <Box px="md" py="md">
                  <Alert color="blue" variant="light" mb="md" fz="xs">
                    Màn hình này dành cho học viên <strong>đã có trong hệ thống</strong>. Để ghi
                    danh học viên mới, hãy{' '}
                    <Text
                      component="span"
                      fz="xs"
                      c="blue"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => void navigate('/finance/new')}
                    >
                      tạo phiếu thu mới
                    </Text>
                    .
                  </Alert>

                  <form onSubmit={handleLookup}>
                    <Stack gap="sm">
                      {/* Lookup-by toggle */}
                      <Group gap="sm">
                        {(['phone', 'name'] as LookupBy[]).map((opt) => (
                          <Button
                            key={opt}
                            size="xs"
                            radius="xs"
                            variant={lookupBy === opt ? 'filled' : 'default'}
                            style={
                              lookupBy === opt
                                ? { background: 'var(--cmc-brand)' }
                                : undefined
                            }
                            onClick={() => {
                              setLookupBy(opt);
                              setLookupQuery('');
                              setLookupInput(null);
                            }}
                          >
                            {opt === 'phone' ? 'SĐT phụ huynh' : 'Tên học viên'}
                          </Button>
                        ))}
                      </Group>

                      <Group gap="xs" align="flex-end">
                        <TextInput
                          radius="xs"
                          placeholder={lookupBy === 'phone' ? 'VD: 0912345678' : 'VD: Nguyễn Văn A'}
                          style={{ flex: 1 }}
                          value={lookupQuery}
                          onChange={(e) => {
                            setLookupQuery(e.currentTarget.value);
                            setLookupError('');
                          }}
                          error={lookupError}
                        />
                        <Button type="submit" size="xs" radius="xs" loading={lookupLoading}>
                          Tìm
                        </Button>
                      </Group>
                    </Stack>
                  </form>

                  {lookupFetchError && (
                    <Alert color="red" mt="sm">
                      {lookupFetchError.message}
                    </Alert>
                  )}

                  {lookupLoading && (
                    <Group mt="sm" gap="xs">
                      <Loader size="xs" />
                      <Text fz="xs" c="dimmed">Đang tìm...</Text>
                    </Group>
                  )}

                  {!lookupLoading && lookupData && lookupData.length === 0 && (
                    <Text fz="sm" c="dimmed" mt="sm">
                      Không tìm thấy học viên. Kiểm tra lại SĐT/tên, hoặc tạo phiếu thu mới.
                    </Text>
                  )}

                  {!lookupLoading && lookupData && lookupData.length > 0 && (
                    <Stack gap="xs" mt="sm">
                      <Text fz="xs" c="dimmed">Chọn học viên:</Text>
                      {lookupData.map((s) => (
                        <Box
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
                          <Group justify="space-between">
                            <Text fz="sm" fw={selectedStudent?.id === s.id ? 600 : 400}>
                              {s.fullName}
                            </Text>
                            <Text
                              fz="xs"
                              fw={600}
                              style={{ color: lifecycleColor[s.lifecycle] ?? 'inherit' }}
                            >
                              {s.lifecycle}
                            </Text>
                          </Group>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              </Box>

              {/* Step 2 — Class selection (only shown after selecting a student) */}
              {selectedStudent && (
                <>
                  <Divider />
                  <Box
                    style={{
                      border: '1px solid var(--cmc-border)',
                      borderRadius: 'var(--cmc-radius-xs)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      px="md"
                      py="sm"
                      style={{
                        background: 'var(--cmc-surface-2)',
                        borderBottom: '1px solid var(--cmc-border)',
                      }}
                    >
                      <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
                        Bước 2 — Chọn lớp học cho{' '}
                        <Text span style={{ color: 'var(--cmc-brand)' }}>
                          {selectedStudent.fullName}
                        </Text>
                      </Text>
                    </Box>
                    <Box px="md" py="md">
                      <Stack gap="md">
                        <Select
                          label="Lớp học"
                          placeholder={classBatchLoading ? 'Đang tải danh sách lớp...' : 'Chọn lớp học'}
                          radius="xs"
                          withAsterisk
                          data={classBatchOptions}
                          value={classBatchId || null}
                          onChange={(v) => setClassBatchId(v ?? '')}
                          searchable
                          disabled={classBatchLoading}
                          nothingFoundMessage="Không tìm thấy lớp"
                        />

                        {enrollMutation.error && (
                          <Alert color="red" title="Lỗi xếp lớp">
                            {enrollMutation.error.message}
                          </Alert>
                        )}

                        <Text fz="xs" c="dimmed">
                          Xếp lớp tạo trạng thái <strong>reserved</strong> (đặt chỗ). Trạng thái
                          chuyển sang <strong>active</strong> sau khi phiếu thu được duyệt.
                        </Text>

                        <Group gap="xs">
                          <Button
                            radius="xs"
                            style={{ background: 'var(--cmc-brand)' }}
                            disabled={!classBatchId}
                            loading={enrollMutation.isPending}
                            onClick={handleEnroll}
                          >
                            Xác nhận xếp lớp
                          </Button>
                          <Button
                            variant="default"
                            radius="xs"
                            onClick={() => setSelectedStudent(null)}
                            disabled={enrollMutation.isPending}
                          >
                            Chọn lại học viên
                          </Button>
                        </Group>
                      </Stack>
                    </Box>
                  </Box>
                </>
              )}
            </>
          )}
        </Stack>
      </Box>
    </>
  );
}
