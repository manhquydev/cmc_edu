// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Work Schedule list/form split (plan 260811-1408).
// Compose is tested via exported SubmitTab (lives on /hr/shifts/new).
// List is workspace + inbox; open form via "Mở phiếu".

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
const TEMPLATE_B = '22222222-2222-4222-8222-222222222223';
const REG_ID = '33333333-3333-4333-8333-333333333333';
const REG_CANCEL = '44444444-4444-4444-8444-444444444444';

const { GROUPS, MY_REGS, PENDING } = vi.hoisted(() => ({
  GROUPS: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Sale ca ngày',
      type: 'KINH_DOANH',
      selectionMode: 'SINGLE',
      templates: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Ca 1',
          startTime: '08:30',
          endTime: '18:00',
        },
        {
          id: '22222222-2222-4222-8222-222222222223',
          name: 'Ca 2',
          startTime: '10:00',
          endTime: '20:00',
        },
        {
          id: '22222222-2222-4222-8222-222222222224',
          name: 'Ca 3',
          startTime: '13:00',
          endTime: '21:00',
        },
      ],
    },
  ],
  MY_REGS: [
    {
      id: 'reg-1',
      fromDate: '2099-01-01T00:00:00.000Z',
      toDate: '2099-01-31T00:00:00.000Z',
      status: 'rejected',
      rejectReason: 'Trùng lịch nghỉ',
      shiftGroupId: '11111111-1111-4111-8111-111111111111',
      entries: [
        {
          id: 'e1',
          date: '2099-01-05',
          shiftTemplateId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      fromDate: '2099-03-01T00:00:00.000Z',
      toDate: '2099-03-07T00:00:00.000Z',
      status: 'submitted',
      rejectReason: null,
      shiftGroupId: '11111111-1111-4111-8111-111111111111',
      entries: [
        {
          id: 'e2',
          date: '2099-03-02',
          shiftTemplateId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    },
  ],
  PENDING: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      fromDate: '2099-02-01T00:00:00.000Z',
      toDate: '2099-02-28T00:00:00.000Z',
      entries: [
        {
          id: 'e1',
          date: '2099-02-03',
          shiftTemplateId: '22222222-2222-4222-8222-222222222222',
        },
        {
          id: 'e2',
          date: '2099-02-04',
          shiftTemplateId: '22222222-2222-4222-8222-222222222222',
        },
      ],
      appUser: { fullName: 'Nguyễn Văn A' },
      shiftGroup: { name: 'Sale ca ngày', type: 'KINH_DOANH' },
    },
  ],
}));

let sessionRoles: string[] = ['giam_doc_kinh_doanh'];

let submitOnSuccess: ((data?: { id: string }) => void) | undefined;
let submitOnError: ((err: { message: string }) => void) | undefined;
const submitMutate = vi.fn();

const cancelMutate = vi.fn();
const approveMutate = vi.fn();
const rejectMutate = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionRoles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'shift.listGroups.useQuery': queryResult(GROUPS),
      'shift.myRegistrations.useQuery': queryResult(MY_REGS),
      'shift.pendingForApproval.useQuery': queryResult(PENDING),
      'shift.submit.useMutation': (options: {
        onSuccess?: (data?: { id: string }) => void;
        onError?: (err: { message: string }) => void;
      }) => {
        submitOnSuccess = options?.onSuccess;
        submitOnError = options?.onError;
        return mutationResult({ mutate: submitMutate });
      },
      'shift.cancel.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({
          mutate: (...a: unknown[]) => {
            cancelMutate(...a);
            opts?.onSuccess?.();
          },
        }),
      'shift.approve.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({
          mutate: (...a: unknown[]) => {
            approveMutate(...a);
            opts?.onSuccess?.();
          },
        }),
      'shift.reject.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({
          mutate: (...a: unknown[]) => {
            rejectMutate(...a);
            opts?.onSuccess?.();
          },
        }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ShiftsPage, { SubmitTab } from './shifts.js';

function tabButton(name: string | RegExp) {
  return within(screen.getByRole('navigation', { name: 'Tabs' })).getByRole('button', { name });
}

async function fillSubmitForm(opts?: { day?: string; template?: string }) {
  const day = opts?.day ?? '2099-01-05';
  const tpl = opts?.template ?? 'Ca 1';
  fireEvent.click(screen.getByRole('combobox', { name: 'Nhóm ca' }));
  fireEvent.click(await screen.findByRole('option', { name: /Sale ca ngày/ }));
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2099-01-01' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2099-01-31' } });
  const cell = await screen.findByRole('checkbox', { name: `${day} ${tpl}` });
  fireEvent.click(cell);
}

function submitForm() {
  fireEvent.submit(document.querySelector('form')!);
}

describe('SubmitTab — compose Work Schedule', () => {
  beforeEach(() => {
    sessionRoles = ['giam_doc_kinh_doanh'];
    submitMutate.mockClear();
    submitOnSuccess = undefined;
    submitOnError = undefined;
  });

  it('renders Work Schedule chrome and group dropdown (no UUID text input)', async () => {
    renderWithProviders(<SubmitTab />);
    expect(screen.getAllByText(/Work Schedule/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('combobox', { name: 'Nhóm ca' })).toBeInTheDocument();
    expect(screen.getAllByText('Soạn').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Đăng ký lịch làm việc')).toBeInTheDocument();
  });

  it('does not call shift.submit.mutate when required fields are missing', () => {
    renderWithProviders(<SubmitTab />);
    const form = document.querySelector('form');
    if (form) fireEvent.submit(form);
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it('submits shift.submit.mutate with a byte-identical payload from matrix cells', async () => {
    renderWithProviders(<SubmitTab />);
    await fillSubmitForm();
    submitForm();
    expect(submitMutate).toHaveBeenCalledWith({
      shiftGroupId: GROUP_ID,
      fromDate: '2099-01-01',
      toDate: '2099-01-31',
      entries: [{ date: '2099-01-05', shiftTemplateId: TEMPLATE_ID }],
    });
  });

  it('SINGLE mode: toggling a second template on the same day replaces the first', async () => {
    renderWithProviders(<SubmitTab />);
    await fillSubmitForm({ template: 'Ca 1' });
    fireEvent.click(await screen.findByRole('checkbox', { name: '2099-01-05 Ca 2' }));
    submitForm();
    expect(submitMutate).toHaveBeenCalledWith({
      shiftGroupId: GROUP_ID,
      fromDate: '2099-01-01',
      toDate: '2099-01-31',
      entries: [{ date: '2099-01-05', shiftTemplateId: TEMPLATE_B }],
    });
  });

  it('renders an always-visible success banner after shift.submit succeeds', async () => {
    renderWithProviders(<SubmitTab />);
    await fillSubmitForm();
    submitForm();
    expect(submitOnSuccess).toBeDefined();
    act(() => submitOnSuccess?.({ id: REG_ID }));
    expect(
      screen.getByText('Đăng ký ca đã gửi — trạng thái Chờ duyệt (submitted).'),
    ).toBeInTheDocument();
  });

  it('renders an always-visible error banner when shift.submit fails', async () => {
    renderWithProviders(<SubmitTab />);
    await fillSubmitForm();
    submitForm();
    expect(submitOnError).toBeDefined();
    act(() => submitOnError?.({ message: 'Đã có đăng ký chờ duyệt' }));
    expect(screen.getByText('Đã có đăng ký chờ duyệt')).toBeInTheDocument();
  });
});

describe('ShiftsPage — list / inbox', () => {
  beforeEach(() => {
    sessionRoles = ['giam_doc_kinh_doanh'];
    cancelMutate.mockClear();
    approveMutate.mockClear();
    rejectMutate.mockClear();
  });

  it('shows "Đăng ký của tôi" with rejectReason for a rejected registration', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(tabButton('Đăng ký của tôi'));
    expect(screen.getByText('Trùng lịch nghỉ')).toBeInTheDocument();
    expect(screen.getByText('Từ chối')).toBeInTheDocument();
  });

  it('cancels a submitted registration only after the ConfirmDialog confirm click', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(tabButton('Đăng ký của tôi'));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(cancelMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy ca' }));
    expect(cancelMutate).toHaveBeenCalledWith({ registrationId: REG_CANCEL });
  });

  it('shows Mở phiếu on my registrations (form deep link)', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(tabButton('Đăng ký của tôi'));
    expect(screen.getAllByRole('button', { name: 'Mở phiếu' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the Duyệt / Từ chối tab for a role with shift.approve permission', () => {
    renderWithProviders(<ShiftsPage />);
    expect(tabButton('Duyệt / Từ chối')).toBeInTheDocument();
  });

  it('hides the Duyệt / Từ chối tab for a role without shift.approve permission', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<ShiftsPage />);
    expect(
      within(screen.getByRole('navigation', { name: 'Tabs' })).queryByRole('button', {
        name: 'Duyệt / Từ chối',
      }),
    ).toBeNull();
    expect(screen.getAllByText(/Work Schedule/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Soạn phiếu mới' })).toBeInTheDocument();
  });

  it('lists pending registrations in the GĐ inbox with group name', () => {
    renderWithProviders(<ShiftsPage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText(/Sale ca ngày/)).toBeInTheDocument();
  });

  it('shows Mở phiếu in inbox for form depth navigation', () => {
    renderWithProviders(<ShiftsPage />);
    expect(screen.getAllByRole('button', { name: 'Mở phiếu' }).length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT call shift.approve.mutate on the trigger click alone (confirm gating)', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it('calls shift.approve.mutate({registrationId}) only after the ConfirmDialog confirm click', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).toHaveBeenCalledWith({ registrationId: REG_ID });
  });

  it('requires a reject reason of at least 3 chars before enabling the reject-modal button', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    const rejectButtons = screen.getAllByRole('button', { name: 'Từ chối' });
    const modalRejectBtn = rejectButtons[rejectButtons.length - 1];
    expect(modalRejectBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Lý do từ chối'), { target: { value: 'oke' } });
    expect(modalRejectBtn).not.toBeDisabled();
  });

  it('does NOT call shift.reject.mutate before the reason is filled and the modal button clicked', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    expect(rejectMutate).not.toHaveBeenCalled();
  });

  it('calls shift.reject.mutate({registrationId, reason}) after filling the reason and confirming', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    fireEvent.change(screen.getByLabelText('Lý do từ chối'), {
      target: { value: 'Trùng lịch nghỉ lễ' },
    });
    const rejectButtons = screen.getAllByRole('button', { name: 'Từ chối' });
    fireEvent.click(rejectButtons[rejectButtons.length - 1]);
    expect(rejectMutate).toHaveBeenCalledWith({
      registrationId: REG_ID,
      reason: 'Trùng lịch nghỉ lễ',
    });
  });
});
