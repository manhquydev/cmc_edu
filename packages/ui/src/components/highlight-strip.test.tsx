import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HighlightStrip } from './highlight-strip.js';

describe('HighlightStrip', () => {
  it('renders labels and values', () => {
    const { container } = render(
      <HighlightStrip
        items={[
          { key: 'amount', label: 'Số tiền', value: '5.000.000 đ', tabular: true },
          { key: 'status', label: 'Trạng thái', value: 'Nháp' },
        ]}
      />,
    );
    expect(screen.getByText('Số tiền')).toBeInTheDocument();
    expect(screen.getByText('5.000.000 đ')).toBeInTheDocument();
    expect(container.querySelector('.ck-highlight')).toBeTruthy();
    expect(container.querySelector('.ck-highlight-value--tabular')).toBeTruthy();
  });

  it('renders nothing when items empty', () => {
    const { container } = render(<HighlightStrip items={[]} />);
    expect(container.querySelector('.ck-highlight')).toBeNull();
  });
});
