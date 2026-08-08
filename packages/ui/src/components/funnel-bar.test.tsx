import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FunnelBar, funnelFillWidth } from './funnel-bar.js';

describe('FunnelBar', () => {
  it('renders label + count and a full fill at value === max', () => {
    const { container, getByText } = render(<FunnelBar label="Đã ghi danh" value={6} max={6} />);
    expect(getByText('Đã ghi danh')).toBeInTheDocument();
    expect(getByText('6')).toBeInTheDocument();
    expect((container.querySelector('.console-fn-fill') as HTMLElement).style.width).toBe('100%');
  });

  it('fill is proportional (value/max = 0.5 → 50%)', () => {
    const { container } = render(<FunnelBar label="x" value={3} max={6} />);
    expect((container.querySelector('.console-fn-fill') as HTMLElement).style.width).toBe('50%');
  });

  it('zero value renders 0% width', () => {
    const { container } = render(<FunnelBar label="x" value={0} max={6} />);
    expect((container.querySelector('.console-fn-fill') as HTMLElement).style.width).toBe('0%');
  });

  it('shows step chip and share when requested', () => {
    const { getByText, container } = render(
      <FunnelBar label="Đã kiểm tra" value={3} max={8} step="O4" showShare emphasize />,
    );
    expect(getByText('Đã kiểm tra')).toBeInTheDocument();
    expect(getByText('38%')).toBeInTheDocument();
    expect(container.querySelector('.is-emphasize')).toBeTruthy();
    expect(container.querySelector('.console-fn-step')?.textContent).toBe('O4');
  });

  it('funnelFillWidth floors nonzero visibility', () => {
    expect(funnelFillWidth(0, 100)).toBe(0);
    expect(funnelFillWidth(1, 100)).toBe(6);
    expect(funnelFillWidth(50, 100)).toBe(50);
  });
});
