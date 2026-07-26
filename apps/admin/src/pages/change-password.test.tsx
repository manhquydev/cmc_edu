// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test/render-with-providers.js';

// Locks the staff password rotation contract: user.changeOwnPassword payload,
// client-side confirm/min-length validation before any network call.

const changeMutate = vi.fn();

vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock, mutationResult } = await import('../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'user.changeOwnPassword.useMutation': () => mutationResult({ mutate: changeMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ChangePasswordPage from './change-password.js';

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/^Mật khẩu hiện tại/), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu mới/), {
    target: { value: confirm },
  });
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    changeMutate.mockReset();
  });

  it('submits {currentPassword, newPassword} when inputs are valid', () => {
    renderWithProviders(<ChangePasswordPage />);
    fill('temp-password-1', 'brand-new-pass-2', 'brand-new-pass-2');
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(changeMutate).toHaveBeenCalledWith({
      currentPassword: 'temp-password-1',
      newPassword: 'brand-new-pass-2',
    });
  });

  it('blocks a too-short new password before any network call', () => {
    renderWithProviders(<ChangePasswordPage />);
    fill('temp-password-1', 'short', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(changeMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/ít nhất 8 ký tự/)).toBeInTheDocument();
  });

  it('blocks a mismatched confirmation before any network call', () => {
    renderWithProviders(<ChangePasswordPage />);
    fill('temp-password-1', 'brand-new-pass-2', 'brand-new-pass-DIFFERENT');
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(changeMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Xác nhận mật khẩu không khớp.')).toBeInTheDocument();
  });
});
