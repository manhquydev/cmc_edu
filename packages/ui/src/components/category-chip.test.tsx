import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CategoryChip } from './category-chip.js';

describe('CategoryChip', () => {
  it('renders data-category and category class', () => {
    const { container } = render(<CategoryChip category="a" label="UCREA" />);
    const el = container.querySelector('.console-category-chip');
    expect(el).toHaveAttribute('data-category', 'a');
    expect(el).toHaveClass('console-category-chip--a');
    expect(el).toHaveTextContent('UCREA');
    expect(el).not.toHaveClass('console-badge-soft');
  });

  it('supports size modifiers without inline styles', () => {
    const { container } = render(<CategoryChip category="b" label="BRIGHT_IG" size="sm" />);
    const el = container.querySelector('.console-category-chip')!;
    expect(el).toHaveClass('console-category-chip--sm');
    expect(el.getAttribute('style')).toBeNull();
  });

  it('keeps categories distinct from each other', () => {
    const { rerender, container } = render(<CategoryChip category="c" label="BLACK_HOLE" />);
    expect(container.querySelector('[data-category="c"]')).toBeTruthy();
    rerender(<CategoryChip category="d" label="Other" />);
    expect(container.querySelector('[data-category="d"]')).toHaveClass('console-category-chip--d');
  });
});
