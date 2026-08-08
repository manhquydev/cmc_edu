import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './toast.js';

function Probe() {
  const t = useToast();
  return (
    <div>
      <button type="button" onClick={() => t.success('Đã lưu')}>
        ok
      </button>
      <button type="button" onClick={() => t.error('Lỗi', 'Thử lại')}>
        err
      </button>
    </div>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders success toast with polite live region', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu');
    expect(document.querySelector('.console-toast-viewport')).toHaveAttribute('aria-live', 'polite');
  });

  it('auto-dismisses success after default duration', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('error toast uses alert role and dismiss button', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('err'));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Lỗi');
    expect(alert).toHaveTextContent('Thử lại');
    fireEvent.click(screen.getByLabelText('Đóng thông báo'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('throws when useToast is outside provider', () => {
    expect(() => render(<Probe />)).toThrow(/ToastProvider/);
  });
});
