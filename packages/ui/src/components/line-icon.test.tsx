import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LineIcon } from './line-icon.js';

describe('LineIcon', () => {
  it('renders a monochrome outline svg (currentColor stroke, no fill/tint)', () => {
    const { container } = render(<LineIcon name="grid" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // Monochrome invariant: no child path/shape may carry its own colour/fill/tint.
    svg.querySelectorAll('path, rect, circle').forEach((el) => {
      // target/user icons use a filled centre dot deliberately? No — none here.
      const fill = el.getAttribute('fill');
      expect(fill === null || fill === 'none').toBe(true);
      expect(el.getAttribute('stroke')).toBeNull(); // inherits from <svg>
      expect(el.getAttribute('color')).toBeNull();
    });
  });

  it('renders the expected geometry for a known name (grid = 4 rects)', () => {
    const { container } = render(<LineIcon name="grid" />);
    expect(container.querySelectorAll('svg rect')).toHaveLength(4);
  });

  it('honours size + strokeWidth props', () => {
    const { container } = render(<LineIcon name="chevron" size={32} strokeWidth={2.5} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('stroke-width', '2.5');
  });

  // Additive keys (globe/clock/trophy/gift/star) must render and hold the
  // monochrome outline invariant — no filled star/gift polygons.
  const newKeys = ['globe', 'clock', 'trophy', 'gift', 'star'] as const;
  it.each(newKeys)('renders %s as a monochrome outline svg', (name) => {
    const { container } = render(<LineIcon name={name} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeInTheDocument();
    expect(svg.querySelectorAll('path, rect, circle').length).toBeGreaterThan(0);
    svg.querySelectorAll('path, rect, circle').forEach((el) => {
      const fill = el.getAttribute('fill');
      expect(fill === null || fill === 'none').toBe(true);
      expect(el.getAttribute('stroke')).toBeNull();
      expect(el.getAttribute('color')).toBeNull();
    });
  });
});
