// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks receipt-create's query hydration (opportunityGet/opportunityLookup/
// classBatch.list) + `finance.receiptCreate.mutate` payload BEFORE the
// FormPage refactor (TDD per phase-04). This is a money-writing mutation
// (audited server-side) — the mutate payload MUST stay byte-identical; the
// refactor only changes presentation (FormPage header/children/actions/
// result slots).
//
// NOTE: jsdom does not synthesize a native form-submit event from a plain
// `fireEvent.click` on a `type="submit"` button (unlike real browsers), so
// tests submit via `fireEvent.submit(form)` — exercising the exact same
// `onSubmit={handleSubmit}` handler a real click would trigger.
const VALID_OPP_ID = '11111111-1111-4111-8111-111111111111';

const OPP_DATA = {
  contact: { id: 'c1', name: 'Nguyễn Văn A', phone: '0912345678', email: 'a@example.com' },
};

const BATCH_ROW = {
  id: 'batch-1',
  code: 'CB001',
  program: 'IELTS Foundation',
  startDate: '2026-08-01T00:00:00.000Z',
};

const classBatchState: { data: { items: (typeof BATCH_ROW)[] }; error: { message: string } | null } = {
  data: { items: [BATCH_ROW] },
  error: null,
};
const oppGetSpy = vi.fn();
const oppLookupSpy = vi.fn();
const classBatchSpy = vi.fn();
const createMutate = vi.fn();
let createOnSuccess: ((res: unknown) => void) | undefined;
const createMutationState: { error: { message: string } | null; data: unknown } = {
  error: null,
  data: undefined,
};
// Redirect-after-create (finding #1) depends on the caller's role: `sale`
// lacks `finance.receiptGet` (packages/auth/src/index.ts) and must NOT be
// routed to a page it can't open. Defaults to `sale` — the persona this bug
// actually hit — and is overridden per-test for the GĐKD/`receiptGet` path.
const sessionState: { roles: string[] } = { roles: ['sale'] };

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionState.roles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'crm.opportunityGet.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        oppGetSpy(input, opts?.enabled);
        if (!opts?.enabled) return queryResult(undefined, { isLoading: false });
        return queryResult(OPP_DATA);
      },
      'crm.opportunityLookup.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        oppLookupSpy(input, opts?.enabled);
        if (!opts?.enabled) return queryResult(undefined);
        return queryResult({ exists: false });
      },
      'classBatch.list.useQuery': (input: unknown) => {
        classBatchSpy(input);
        return queryResult(classBatchState.data, {
          error: classBatchState.error,
          isError: classBatchState.error !== null,
        });
      },
      'finance.receiptCreate.useMutation': (options: {
        onSuccess?: (res: unknown) => void;
      }) => {
        createOnSuccess = options?.onSuccess;
        return mutationResult({
          mutate: createMutate,
          error: createMutationState.error,
          isError: createMutationState.error !== null,
          data: createMutationState.data,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ReceiptCreatePage from './receipt-create.js';

async function selectClassBatch() {
  const trigger = screen.getByLabelText(/^Lớp học/);
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: /CB001/ });
  fireEvent.click(option);
}

function submitForm() {
  fireEvent.submit(document.querySelector('form')!);
}

// Wraps the page in real routes so navigation (or its absence) is observable
// via which route's content ends up on screen — a bare renderWithProviders
// render has no <Routes>, so `navigate()` would change the URL with nothing
// to react to it.
function renderCreatePage(route = '/finance/new') {
  return renderWithProviders(
    <Routes>
      <Route path="/finance/new" element={<ReceiptCreatePage />} />
      <Route path="/finance/:id" element={<div>RECEIPT_DETAIL_PAGE</div>} />
      <Route path="/crm" element={<div>CRM_PIPELINE_PAGE</div>} />
      <Route path="/crm/opportunities/:id" element={<div>CRM_OPPORTUNITY_PAGE</div>} />
    </Routes>,
    { route },
  );
}

describe('ReceiptCreatePage', () => {
  beforeEach(() => {
    classBatchState.data = { items: [BATCH_ROW] };
    classBatchState.error = null;
    oppGetSpy.mockClear();
    oppLookupSpy.mockClear();
    classBatchSpy.mockClear();
    createMutate.mockClear();
    createMutationState.error = null;
    createMutationState.data = undefined;
    sessionState.roles = ['sale'];
  });

  it('does not query crm.opportunityGet when no opportunityId is present in the URL', () => {
    renderWithProviders(<ReceiptCreatePage />, { route: '/finance/new' });
    expect(oppGetSpy).toHaveBeenCalledWith({ opportunityId: undefined }, false);
  });

  it('queries crm.opportunityGet({opportunityId}) when a valid opportunityId is present', () => {
    renderWithProviders(<ReceiptCreatePage />, { route: `/finance/new?opportunityId=${VALID_OPP_ID}` });
    expect(oppGetSpy).toHaveBeenCalledWith({ opportunityId: VALID_OPP_ID }, true);
  });

  it('prefills studentName/parentPhone/parentEmail from opportunityGet data', () => {
    renderWithProviders(<ReceiptCreatePage />, { route: `/finance/new?opportunityId=${VALID_OPP_ID}` });
    expect(screen.getByDisplayValue('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0912345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('a@example.com')).toBeInTheDocument();
  });

  it('queries classBatch.list with a searchable first page for the class picker', () => {
    renderWithProviders(<ReceiptCreatePage />);
    expect(classBatchSpy).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
  });

  it('does not call finance.receiptCreate.mutate when required fields are missing', () => {
    renderWithProviders(<ReceiptCreatePage />);
    submitForm();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('shows the classBatchId validation error when submitting without a class batch (finding: missing status prop)', () => {
    renderWithProviders(<ReceiptCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Trần Thị B' } });
    fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '5000000' } });
    // Deliberately skip selectClassBatch() — classBatchId stays empty.

    submitForm();

    expect(createMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng chọn lớp học')).toBeInTheDocument();
  });

  it('submits finance.receiptCreate.mutate with a byte-identical payload (no opportunityId)', async () => {
    renderWithProviders(<ReceiptCreatePage />);

    fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: '  Trần Thị B  ' } });
    fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: ' 0987654321 ' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '5000000' } });
    await selectClassBatch();

    submitForm();

    expect(createMutate).toHaveBeenCalledWith({
      studentName: 'Trần Thị B',
      parentPhone: '0987654321',
      parentEmail: 'ph@example.com',
      classBatchId: 'batch-1',
      amount: 5_000_000,
      opportunityId: undefined,
    });
  });

  it('submits with the opportunityId attached when deep-linked from an opportunity', async () => {
    renderWithProviders(<ReceiptCreatePage />, { route: `/finance/new?opportunityId=${VALID_OPP_ID}` });

    fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '3000000' } });
    await selectClassBatch();

    submitForm();

    expect(createMutate).toHaveBeenCalledWith({
      studentName: 'Nguyễn Văn A',
      parentPhone: '0912345678',
      parentEmail: 'a@example.com',
      classBatchId: 'batch-1',
      amount: 3_000_000,
      opportunityId: VALID_OPP_ID,
    });
  });

  it('renders an always-visible error banner when finance.receiptCreate fails', () => {
    createMutationState.error = { message: 'Trùng SĐT phụ huynh' };
    renderWithProviders(<ReceiptCreatePage />);
    expect(screen.getByText('Lỗi tạo phiếu thu')).toBeInTheDocument();
    expect(screen.getByText('Trùng SĐT phụ huynh')).toBeInTheDocument();
  });

  it('renders an always-visible warning banner when receiptCreate succeeds with a warning status', () => {
    createMutationState.data = { status: 'warning', message: 'SĐT đã có hồ sơ' };
    renderWithProviders(<ReceiptCreatePage />);
    expect(screen.getByText('Cảnh báo')).toBeInTheDocument();
    expect(screen.getByText('SĐT đã có hồ sơ')).toBeInTheDocument();
  });

  describe('post-create routing (finding #1: sale lacks finance.receiptGet)', () => {
    it('navigates to /finance/:id when the caller can open it (giam_doc_kinh_doanh)', async () => {
      sessionState.roles = ['giam_doc_kinh_doanh'];
      renderCreatePage();
      fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Lê Văn C' } });
      fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0900000009' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();
      expect(createMutate).toHaveBeenCalled();
      act(() => createOnSuccess?.({ status: 'success', receipt: { id: 'new-receipt-1', code: 'SO0001' } }));

      expect(screen.getByText('RECEIPT_DETAIL_PAGE')).toBeInTheDocument();
    });

    it('does NOT navigate a sale (no finance.receiptGet) to /finance/:id — shows the result in place instead', async () => {
      renderCreatePage();
      fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Lê Văn C' } });
      fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0900000009' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();
      expect(createMutate).toHaveBeenCalled();
      act(() => createOnSuccess?.({ status: 'success', receipt: { id: 'new-receipt-1', code: 'SO0001' } }));

      expect(screen.queryByText('RECEIPT_DETAIL_PAGE')).not.toBeInTheDocument();
      expect(screen.getByText('Đã tạo phiếu thu SO0001')).toBeInTheDocument();
    });

    it('sale success screen "Tạo phiếu khác" clears the result and re-enables the submit button', async () => {
      renderCreatePage();
      fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Lê Văn C' } });
      fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0900000009' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();
      act(() => createOnSuccess?.({ status: 'success', receipt: { id: 'new-receipt-1', code: 'SO0001' } }));
      expect(screen.getByRole('button', { name: 'Tạo phiếu thu' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu khác' }));

      expect(screen.queryByText('Đã tạo phiếu thu SO0001')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tạo phiếu thu' })).not.toBeDisabled();
    });

    it('sale success screen without an opportunityId routes "Về bảng kinh doanh" to /crm', async () => {
      renderCreatePage();
      fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Lê Văn C' } });
      fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0900000009' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();
      act(() => createOnSuccess?.({ status: 'success', receipt: { id: 'new-receipt-1', code: 'SO0001' } }));

      fireEvent.click(screen.getByRole('button', { name: 'Về bảng kinh doanh' }));

      expect(screen.getByText('CRM_PIPELINE_PAGE')).toBeInTheDocument();
    });

    it('sale success screen created from an opportunity routes "Xem cơ hội" to /crm/opportunities/:id', async () => {
      renderCreatePage(`/finance/new?opportunityId=${VALID_OPP_ID}`);
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();
      act(() => createOnSuccess?.({ status: 'success', receipt: { id: 'new-receipt-1', code: 'SO0001' } }));

      fireEvent.click(screen.getByRole('button', { name: 'Xem cơ hội' }));

      expect(screen.getByText('CRM_OPPORTUNITY_PAGE')).toBeInTheDocument();
    });
  });

  // Metric & Data Integrity remediation (scenario audit, PO round 3):
  // finance.receiptCreate now returns `status: 'needs_confirmation'` (no
  // receipt created) when the phone already owns ≥1 provisioned Student —
  // the UI must present a picker instead of crashing on `res.receipt.id`.
  describe('needs_confirmation (duplicate-student gate)', () => {
    it('does NOT navigate and shows a picker with the existing students + a "bé mới" option', async () => {
      renderWithProviders(<ReceiptCreatePage />);
      fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Bé Hai' } });
      fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0900000010' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();

      act(() =>
        createOnSuccess?.({
          status: 'needs_confirmation',
          message: 'Số điện thoại này đã có học sinh trong hệ thống.',
          existingStudents: [{ id: 'student-1', fullName: 'Bé Một' }],
        }),
      );

      expect(screen.getByText('Cần xác nhận học sinh')).toBeInTheDocument();
      expect(screen.getByText('Đây là bé đã có: Bé Một')).toBeInTheDocument();
      expect(screen.getByText('Đây là bé mới (khác với các bé ở trên)')).toBeInTheDocument();
    });

    it('picking an existing student resubmits with studentId', async () => {
      renderWithProviders(<ReceiptCreatePage />);
      fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Bé Hai' } });
      fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0900000011' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();
      act(() =>
        createOnSuccess?.({
          status: 'needs_confirmation',
          message: 'msg',
          existingStudents: [{ id: 'student-1', fullName: 'Bé Một' }],
        }),
      );
      createMutate.mockClear();

      fireEvent.click(screen.getByText('Đây là bé đã có: Bé Một'));

      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'student-1', studentName: 'Bé Hai', parentPhone: '0900000011' }),
      );
    });

    it('confirming a new student resubmits with confirmNewStudent:true', async () => {
      renderWithProviders(<ReceiptCreatePage />);
      fireEvent.change(screen.getByLabelText(/^Họ tên học viên/), { target: { value: 'Bé Hai' } });
      fireEvent.change(screen.getByLabelText(/^SĐT phụ huynh/), { target: { value: '0900000012' } });
    fireEvent.change(screen.getByLabelText(/^Email phụ huynh/), { target: { value: 'ph@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Học phí/), { target: { value: '1000000' } });
      await selectClassBatch();
      submitForm();
      act(() =>
        createOnSuccess?.({
          status: 'needs_confirmation',
          message: 'msg',
          existingStudents: [{ id: 'student-1', fullName: 'Bé Một' }],
        }),
      );
      createMutate.mockClear();

      fireEvent.click(screen.getByText('Đây là bé mới (khác với các bé ở trên)'));

      expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ confirmNewStudent: true }));
    });
  });
});
