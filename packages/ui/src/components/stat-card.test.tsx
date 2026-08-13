import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatCard } from './stat-card.js';

describe('StatCard', () => {
  it('uses static metric chrome, not a link', () => {
    const { container } = render(<StatCard label="Tổng" value={12} trend="so với tháng trước" />);
    const root = container.querySelector('.console-mc.console-mc--static');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('DIV');
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('.console-mc-value')).toHaveTextContent('12');
    expect(container.querySelector('.console-mc-ctx')).toHaveTextContent('so với tháng trước');
  });

  it('does not set inline fontSize on the value', () => {
    const { container } = render(<StatCard label="Tổng" value="1.000 đ" />);
    const value = container.querySelector('.console-mc-value');
    expect(value?.getAttribute('style')).toBeNull();
  });

  it('loading hides the value', () => {
    const { container } = render(<StatCard label="Tổng" value={0} loading />);
    expect(container.querySelector('.console-mc-value')).toBeNull();
  });
});
