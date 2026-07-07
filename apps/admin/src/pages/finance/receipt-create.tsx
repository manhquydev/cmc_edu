import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { PageHeader } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface FormState {
  studentName: string;
  parentPhone: string;
  parentEmail: string;
  classBatchId: string;
  amount: number | '';
}

interface FormErrors {
  studentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  classBatchId?: string;
  amount?: string;
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.studentName.trim()) errors.studentName = 'Vui lòng nhập họ tên học viên';
  if (!values.parentPhone.trim()) errors.parentPhone = 'Vui lòng nhập SĐT phụ huynh';
  if (values.parentEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.parentEmail))
    errors.parentEmail = 'Email không hợp lệ';
  if (!values.classBatchId) errors.classBatchId = 'Vui lòng chọn lớp học';
  if (values.amount === '' || values.amount === undefined)
    errors.amount = 'Vui lòng nhập số tiền';
  else if (Number(values.amount) <= 0) errors.amount = 'Số tiền phải lớn hơn 0';
  else if (!Number.isInteger(Number(values.amount)))
    errors.amount = 'Số tiền VND phải là số nguyên (không có xu)';
  return errors;
}

export default function ReceiptCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Deep-link: ?opportunityId= links receipt to an opportunity (passed to API).
  // Validate UUID format — a malformed param would fail server-side anyway, but
  // we reject it early so the UI alert never renders an arbitrary string.
  const rawOpportunityId = searchParams.get('opportunityId');
  const opportunityId =
    rawOpportunityId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawOpportunityId)
      ? rawOpportunityId
      : undefined;

  const [form, setForm] = useState<FormState>({
    studentName: '',
    parentPhone: '',
    parentEmail: '',
    classBatchId: '',
    amount: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: classBatchData, isLoading: classBatchLoading, error: classBatchError } =
    trpc.classBatch.list.useQuery({ pageSize: 100 });

  const createMutation = trpc.finance.receiptCreate.useMutation({
    onSuccess: (res) => {
      void navigate(`/finance/${res.receipt.id}`);
    },
  });

  const classBatchOptions = (classBatchData?.items ?? []).map((b) => ({
    value: b.id,
    label: `${b.code} — ${b.program} (${new Date(b.startDate).toLocaleDateString('vi-VN')})`,
  }));

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (submitted) setErrors(validate(next));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (form.amount === '') return;

    createMutation.mutate({
      studentName: form.studentName.trim(),
      parentPhone: form.parentPhone.trim(),
      parentEmail: form.parentEmail.trim() || undefined,
      classBatchId: form.classBatchId,
      amount: Number(form.amount),
      opportunityId,
    });
  }

  return (
    <>
      <PageHeader
        title="Tạo phiếu thu mới"
        subtitle="Ghi danh học viên mới — tài khoản LMS sẽ tự động tạo sau khi duyệt"
        breadcrumbs={[
          { label: 'Kinh doanh' },
          { label: 'Phiếu thu', href: '/finance' },
          { label: 'Tạo mới' },
        ]}
        actions={
          <Button variant="default" size="xs" radius="xs" onClick={() => void navigate('/finance')}>
            ← Quay lại
          </Button>
        }
      />

      <Box p="md" maw={560}>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {opportunityId && (
              <Alert color="blue" variant="light">
                Tạo phiếu thu từ cơ hội #{opportunityId.slice(0, 8)}
              </Alert>
            )}

            {createMutation.error && (
              <Alert color="red" title="Lỗi tạo phiếu thu">
                {createMutation.error.message}
              </Alert>
            )}

            {createMutation.data?.status === 'warning' && (
              <Alert color="orange" title="Cảnh báo">
                {createMutation.data.message}
              </Alert>
            )}

            <TextInput
              label="Họ tên học viên"
              placeholder="Nguyễn Văn A"
              radius="xs"
              withAsterisk
              value={form.studentName}
              onChange={(e) => handleField('studentName', e.currentTarget.value)}
              error={errors.studentName}
            />

            <TextInput
              label="SĐT phụ huynh"
              placeholder="0912345678"
              radius="xs"
              withAsterisk
              value={form.parentPhone}
              onChange={(e) => handleField('parentPhone', e.currentTarget.value)}
              error={errors.parentPhone}
            />

            <TextInput
              label="Email phụ huynh"
              placeholder="phu-huynh@example.com (tuỳ chọn)"
              description="Dùng cho đăng nhập LMS bằng email. Không bắt buộc."
              radius="xs"
              value={form.parentEmail}
              onChange={(e) => handleField('parentEmail', e.currentTarget.value)}
              error={errors.parentEmail}
            />

            {classBatchError && (
              <Alert color="orange" title="Không tải được danh sách lớp">
                {classBatchError.message}
              </Alert>
            )}

            <Select
              label="Lớp học"
              placeholder={classBatchLoading ? 'Đang tải danh sách lớp...' : 'Chọn lớp học'}
              radius="xs"
              withAsterisk
              data={classBatchOptions}
              value={form.classBatchId || null}
              onChange={(v) => handleField('classBatchId', v ?? '')}
              searchable
              disabled={classBatchLoading}
              nothingFoundMessage="Không tìm thấy lớp"
              error={errors.classBatchId}
            />

            <NumberInput
              label="Học phí (VND)"
              placeholder="5000000"
              radius="xs"
              withAsterisk
              min={1}
              step={100000}
              allowDecimal={false}
              thousandSeparator="."
              decimalSeparator=","
              description="Nhập số nguyên VND — không có xu"
              value={form.amount}
              onChange={(v) => handleField('amount', typeof v === 'number' ? v : '')}
              error={errors.amount}
            />

            <Text fz="xs" c="dimmed">
              Sau khi tạo, phiếu ở trạng thái <strong>Nháp</strong>. GĐKD/GĐĐT/Kế toán duyệt để
              kích hoạt tài khoản LMS tự động.
            </Text>

            <Group gap="xs">
              <Button
                type="submit"
                radius="xs"
                style={{ background: 'var(--cmc-brand)' }}
                loading={createMutation.isPending}
              >
                Tạo phiếu thu
              </Button>
              <Button
                variant="default"
                radius="xs"
                onClick={() => void navigate('/finance')}
                disabled={createMutation.isPending}
              >
                Hủy
              </Button>
            </Group>
          </Stack>
        </form>
      </Box>
    </>
  );
}
