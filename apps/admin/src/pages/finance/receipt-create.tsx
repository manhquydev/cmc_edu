import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { links } from '@cmc/links';
import {
  Banner,
  Button,
  FormPage,
  HStack,
  NumberInput,
  PageHeader,
  Selector,
  Spinner,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { formatContactPhone } from '../../lib/format-contact-phone.js';
import { useSession } from '../../lib/session-context.js';

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
  // Required, not optional: the parent's email is their LMS credential (they
  // sign in with an emailed OTP). A parent enrolled without one cannot log in,
  // and since only a parent may reset a student's password, that child is
  // locked out too. The API still accepts it as optional so older callers and
  // back-office repairs keep working.
  if (!values.parentEmail.trim()) errors.parentEmail = 'Vui lòng nhập email phụ huynh';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.parentEmail))
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
  const { canDo } = useSession();

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
  const prefilled = useRef(false);

  // Metric & Data Integrity remediation (scenario audit, PO round 3): the
  // phone already owns ≥1 provisioned Student — sale must pick the existing
  // child or confirm this is genuinely a new one before the receipt is
  // actually created (finance.receiptCreate returns `needs_confirmation`
  // instead of creating anything in this case).
  const [needsConfirmation, setNeedsConfirmation] = useState<{
    message: string;
    existingStudents: { id: string; fullName: string }[];
  } | null>(null);

  // Roles allowed to create a receipt but not to open its detail page (only
  // `sale` today — `finance.receiptGet` excludes it by design, ADR-B SoD)
  // would land straight on "Không tìm thấy phiếu thu" if we navigated there.
  // For that case we stay on this page and show the result in place instead.
  const [createdReceipt, setCreatedReceipt] = useState<{ id: string; code: string } | null>(null);

  const { data: oppData, isLoading: oppLoading } = trpc.crm.opportunityGet.useQuery(
    { opportunityId: opportunityId! },
    { enabled: Boolean(opportunityId) },
  );

  useEffect(() => {
    if (oppData && !prefilled.current) {
      prefilled.current = true;
      setForm((prev) => ({
        ...prev,
        studentName: oppData.contact.name,
        parentPhone: oppData.contact.phone,
        parentEmail: oppData.contact.email ?? '',
      }));
    }
  }, [oppData]);

  const phoneForDedup = form.parentPhone.trim();
  const { data: dedupData } = trpc.crm.opportunityLookup.useQuery(
    { phone: phoneForDedup },
    { enabled: phoneForDedup.length >= 8 },
  );

  const { data: classBatchData, isLoading: classBatchLoading, error: classBatchError } =
    trpc.classBatch.list.useQuery({ pageSize: 100 });

  const createMutation = trpc.finance.receiptCreate.useMutation({
    onSuccess: (res) => {
      if (res.status === 'needs_confirmation') {
        setNeedsConfirmation({ message: res.message, existingStudents: res.existingStudents });
        return;
      }
      if (canDo('finance', 'receiptGet')) {
        void navigate(links.receipt(res.receipt.id));
        return;
      }
      setCreatedReceipt({ id: res.receipt.id, code: res.receipt.code });
    },
  });

  // "Tạo phiếu khác" after the in-place success screen — re-primes the form
  // the same way the initial opportunity prefill did, instead of leaving it
  // stuck on the just-submitted values.
  function resetForAnotherReceipt() {
    setCreatedReceipt(null);
    setForm({
      studentName: oppData?.contact.name ?? '',
      parentPhone: oppData?.contact.phone ?? '',
      parentEmail: oppData?.contact.email ?? '',
      classBatchId: '',
      amount: '',
    });
    setErrors({});
    setSubmitted(false);
  }

  function submitReceipt(extra?: { studentId?: string; confirmNewStudent?: boolean }) {
    createMutation.mutate({
      studentName: form.studentName.trim(),
      parentPhone: form.parentPhone.trim(),
      parentEmail: form.parentEmail.trim() || undefined,
      classBatchId: form.classBatchId,
      amount: Number(form.amount),
      opportunityId,
      ...extra,
    });
  }

  const classBatchOptions = (classBatchData?.items ?? []).map((b) => ({
    value: b.id,
    label: `${b.code} — ${b.program} (${new Date(b.startDate).toLocaleDateString('vi-VN')})`,
  }));

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (submitted) setErrors(validate(next));
    // Editing the form after a needs_confirmation response invalidates that
    // pending choice (different studentName/phone means a different lookup).
    if (needsConfirmation) setNeedsConfirmation(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (form.amount === '') return;

    submitReceipt();
  }

  // TODO(astryx-review): `ResultPanel` passes `message` as Astryx `Banner`
  // `children`, which renders behind a collapse/expand toggle (collapsed by
  // default) — that would hide this money-write error/warning until the
  // user clicks to expand, changing always-visible behavior. Same fallback
  // already used in receipt-detail.tsx/reconciliation.tsx: plain `Banner`
  // with `description` (always rendered) instead of `ResultPanel`.
  const resultContent = createdReceipt ? (
    <Stack gap={2}>
      <Banner
        status="success"
        title={`Đã tạo phiếu thu ${createdReceipt.code}`}
        description="Phiếu đang chờ duyệt. Vai trò của bạn không xem được chi tiết phiếu — theo dõi tiến độ tại cơ hội hoặc bảng kinh doanh."
      />
      <HStack gap={2}>
        <Button label="Tạo phiếu khác" variant="secondary" onClick={resetForAnotherReceipt} />
        <Button
          label={opportunityId ? 'Xem cơ hội' : 'Về bảng kinh doanh'}
          variant="primary"
          onClick={() => void navigate(opportunityId ? links.opportunity(opportunityId) : '/crm')}
        />
      </HStack>
    </Stack>
  ) : createMutation.error ? (
    <Banner status="error" title="Lỗi tạo phiếu thu" description={createMutation.error.message} />
  ) : createMutation.data?.status === 'warning' ? (
    <Banner status="warning" title="Cảnh báo" description={createMutation.data.message} />
  ) : undefined;

  return (
    <form onSubmit={handleSubmit}>
      <FormPage
        header={
          <PageHeader
            title={opportunityId ? 'Tạo phiếu từ cơ hội' : 'Tạo phiếu thu mới'}
            subtitle="Ghi danh học viên mới — tài khoản LMS sẽ tự động tạo sau khi duyệt"
            breadcrumbs={[
              { label: 'Kinh doanh' },
              { label: 'Phiếu thu', href: '/finance' },
              { label: opportunityId ? 'Tạo từ cơ hội' : 'Tạo mới' },
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
        result={resultContent}
        actions={
          <HStack gap={2}>
            <Button
              label="Tạo phiếu thu"
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
              // Guards against a double-submit off stale form values while the
              // in-place success screen (no `finance.receiptGet`) is showing —
              // "Tạo phiếu khác" clears `createdReceipt` to re-enable this.
              isDisabled={Boolean(createdReceipt)}
            />
            <Button
              label="Hủy"
              variant="secondary"
              onClick={() => void navigate('/finance')}
              isDisabled={createMutation.isPending}
            />
          </HStack>
        }
      >
        <Stack gap={4} style={{ maxWidth: 560 }}>
          {needsConfirmation && (
            <Stack gap={2}>
              {/* Interactive follow-up, not just informational — kept OUT of
                  Banner's `children` slot (Astryx collapses children behind a
                  toggle, hidden by default; see the ResultPanel TODO below),
                  so these buttons are always visible. */}
              <Banner status="warning" title="Cần xác nhận học sinh" description={needsConfirmation.message} />
              {needsConfirmation.existingStudents.map((s) => (
                <Button
                  key={s.id}
                  label={`Đây là bé đã có: ${s.fullName}`}
                  variant="secondary"
                  isLoading={createMutation.isPending}
                  onClick={() => submitReceipt({ studentId: s.id })}
                />
              ))}
              <Button
                label="Đây là bé mới (khác với các bé ở trên)"
                variant="primary"
                isLoading={createMutation.isPending}
                onClick={() => submitReceipt({ confirmNewStudent: true })}
              />
            </Stack>
          )}

          {opportunityId && oppLoading && (
            <Banner
              status="info"
              title="Đang tải thông tin cơ hội..."
              icon={<Spinner size="sm" />}
            />
          )}

          {opportunityId && oppData && (
            <Banner
              status="info"
              title={`Tạo phiếu từ cơ hội — ${oppData.contact.name} (${formatContactPhone(oppData.contact.phone)})`}
            />
          )}

          <TextInput
            label="Họ tên học viên"
            placeholder="Nguyễn Văn A"
            isRequired
            value={form.studentName}
            onChange={(v) => handleField('studentName', v)}
            status={errors.studentName ? { type: 'error', message: errors.studentName } : undefined}
          />

          <TextInput
            label="SĐT phụ huynh"
            placeholder="0912345678"
            isRequired
            value={form.parentPhone}
            onChange={(v) => handleField('parentPhone', v)}
            status={errors.parentPhone ? { type: 'error', message: errors.parentPhone } : undefined}
          />

          {dedupData?.exists && (
            <Banner
              status="warning"
              title="SĐT phụ huynh đã có hồ sơ — vẫn tạo mới?"
              description="Hệ thống dùng chung 1 tài khoản/SĐT."
            />
          )}

          <TextInput
            label="Email phụ huynh"
            placeholder="phu-huynh@example.com"
            description="Tài khoản đăng nhập LMS của phụ huynh — hệ thống gửi mã OTP về địa chỉ này. Phụ huynh cũng là người đổi mật khẩu cho học sinh."
            isRequired
            value={form.parentEmail}
            onChange={(v) => handleField('parentEmail', v)}
            status={errors.parentEmail ? { type: 'error', message: errors.parentEmail } : undefined}
          />

          {classBatchError && (
            <Banner status="warning" title="Không tải được danh sách lớp" description={classBatchError.message} />
          )}

          {/* TODO(astryx-review): Astryx Selector has no `nothingFoundMessage`
              equivalent (empty search results use its own built-in "no
              results" UI) — the prior custom message is dropped. */}
          <Selector
            label="Lớp học"
            placeholder={classBatchLoading ? 'Đang tải danh sách lớp...' : 'Chọn lớp học'}
            isRequired
            options={classBatchOptions}
            value={form.classBatchId || null}
            onChange={(v) => handleField('classBatchId', v ?? '')}
            hasSearch
            hasClear
            isDisabled={classBatchLoading}
            status={errors.classBatchId ? { type: 'error', message: errors.classBatchId } : undefined}
          />

          {/* TODO(astryx-review): Astryx NumberInput has no thousand/decimal
              separator formatting props (thousandSeparator/decimalSeparator) —
              dropped; `isIntegerOnly` covers the allowDecimal={false} behavior.
              Field stays numeric-only, just without live "5.000.000" grouping
              as the user types. */}
          <NumberInput
            label="Học phí (VND)"
            placeholder="5000000"
            isRequired
            min={1}
            // No `step`: HTML constraint validation reads step as "valid values
            // are min + k*step", so a step of 100_000 with min 1 silently
            // rejected every round tuition (5.000.000, 25.000.000 — the form
            // just refused to submit, with no message). `isIntegerOnly` is what
            // enforces whole VND.
            isIntegerOnly
            units="đ"
            description="Nhập số nguyên VND — không có xu"
            hasClear
            value={form.amount === '' ? null : form.amount}
            onChange={(v) => handleField('amount', v ?? '')}
            status={errors.amount ? { type: 'error', message: errors.amount } : undefined}
          />

          <Text type="supporting" size="xsm">
            Sau khi tạo, phiếu ở trạng thái <Text weight="bold" size="xsm">Nháp</Text>. GĐKD/GĐĐT/Kế toán duyệt để
            kích hoạt tài khoản LMS tự động.
          </Text>
        </Stack>
      </FormPage>
    </form>
  );
}
