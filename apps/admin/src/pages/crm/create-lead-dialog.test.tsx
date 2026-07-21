// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the create-lead modal (pipeline header action, phase-03): field
// validation, the non-blocking QD 0037 dedup warning on phone blur, and the
// `crm.opportunityCreate.mutate` payload shape.
const createMutate = vi.fn();
let createHookOnSuccess: (() => void) | undefined;
const lookupSpy = vi.fn();
const lookupState: { exists: boolean } = { exists: false };

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['sale'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'crm.opportunityLookup.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        lookupSpy(input, opts?.enabled);
        if (!opts?.enabled) return queryResult(undefined);
        return queryResult({ exists: lookupState.exists });
      },
      'crm.opportunityCreate.useMutation': (options: { onSuccess?: () => void }) => {
        createHookOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: createMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import { CreateLeadDialog } from './create-lead-dialog.js';

describe('CreateLeadDialog', () => {
  beforeEach(() => {
    createMutate.mockClear();
    lookupSpy.mockClear();
    lookupState.exists = false;
  });

  it('disables "Tạo" until both name and phone are filled', () => {
    renderWithProviders(<CreateLeadDialog opened onClose={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Tạo' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: 'Nguyễn Văn A' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Số điện thoại/), { target: { value: '0900000001' } });
    expect(submit).not.toBeDisabled();
  });

  it('does not query opportunityLookup for a short (<8 char) phone', () => {
    renderWithProviders(<CreateLeadDialog opened onClose={vi.fn()} />);
    const phoneInput = screen.getByLabelText(/^Số điện thoại/);
    fireEvent.change(phoneInput, { target: { value: '090' } });
    fireEvent.blur(phoneInput);
    expect(lookupSpy).toHaveBeenLastCalledWith({ phone: '090' }, false);
  });

  it('shows a non-blocking dedup warning on phone blur when opportunityLookup finds a match, but keeps "Tạo" enabled', () => {
    lookupState.exists = true;
    renderWithProviders(<CreateLeadDialog opened onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: 'Nguyễn Văn A' } });
    const phoneInput = screen.getByLabelText(/^Số điện thoại/);
    fireEvent.change(phoneInput, { target: { value: '0900000001' } });
    fireEvent.blur(phoneInput);
    expect(lookupSpy).toHaveBeenLastCalledWith({ phone: '0900000001' }, true);
    expect(screen.getByText('SĐT đã có hồ sơ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo' })).not.toBeDisabled();
  });

  it('submits opportunityCreate.mutate with trimmed contactName/phone and email:undefined when blank', () => {
    renderWithProviders(<CreateLeadDialog opened onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: '  Trần Thị B  ' } });
    fireEvent.change(screen.getByLabelText(/^Số điện thoại/), { target: { value: ' 0987654321 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }));
    expect(createMutate).toHaveBeenCalledWith(
      { contactName: 'Trần Thị B', phone: '0987654321', email: undefined },
      expect.anything(),
    );
  });

  it('invalidates crm.opportunityList when the create mutation settles successfully', () => {
    const invalidateSpy = trpc.useUtils().crm.opportunityList.invalidate;
    renderWithProviders(<CreateLeadDialog opened onClose={vi.fn()} />);
    expect(createHookOnSuccess).toBeDefined();
    act(() => createHookOnSuccess?.());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('closes the dialog (calls onClose) after a successful create', () => {
    const onClose = vi.fn();
    renderWithProviders(<CreateLeadDialog opened onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: 'Lê Văn C' } });
    fireEvent.change(screen.getByLabelText(/^Số điện thoại/), { target: { value: '0900000009' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }));
    const [, callOptions] = createMutate.mock.calls[0] as [unknown, { onSuccess?: () => void }];
    act(() => callOptions.onSuccess?.());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits opportunityCreate.mutate with source:undefined when no source is chosen (phase-10)', () => {
    renderWithProviders(<CreateLeadDialog opened onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByLabelText(/^Số điện thoại/), { target: { value: '0900000001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }));
    expect(createMutate).toHaveBeenCalledWith(
      { contactName: 'Nguyễn Văn A', phone: '0900000001', email: undefined, source: undefined },
      expect.anything(),
    );
  });

  it('submits opportunityCreate.mutate with the chosen source (phase-10)', () => {
    renderWithProviders(<CreateLeadDialog opened onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByLabelText(/^Số điện thoại/), { target: { value: '0900000001' } });
    fireEvent.click(screen.getByLabelText(/^Nguồn/));
    fireEvent.click(screen.getByRole('option', { name: 'Fanpage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }));
    expect(createMutate).toHaveBeenCalledWith(
      { contactName: 'Nguyễn Văn A', phone: '0900000001', email: undefined, source: 'fanpage' },
      expect.anything(),
    );
  });
});
