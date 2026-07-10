import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FunnelBar } from './funnel-bar.js';

describe('FunnelBar', () => {
  it('renders label + count and a full fill at value === max', () => {
    const { container, getByText } = render(<FunnelBar label="Đã ghi danh" value={6} max={6} />);
    expect(getByText('Đã ghi danh')).toBeInTheDocument();
    expect(getByText('6')).toBeInTheDocument();
    expect((container.querySelector('.ck-fn-fill') as HTMLElement).style.width).toBe('100%');
  });

  it('fill is proportional (value/max = 0.5 → 50%)', () => {
    const { container } = render(<FunnelBar label="x" value={3} max={6} />);
    expect((container.querySelector('.ck-fn-fill') as HTMLElement).style.width).toBe('50%');
  });

  it('zero value renders 0% width', () => {
    const { container } = render(<FunnelBar label="x" value={0} max={6} />);
    expect((container.querySelector('.ck-fn-fill') as HTMLElement).style.width).toBe('0%');
  });
});
