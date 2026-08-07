import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Panel } from './panel.js';

describe('Panel', () => {
  it('renders title + children, no icon by default', () => {
    const { container, getByText } = render(<Panel title="Việc cần xử lý"><div>body</div></Panel>);
    expect(getByText('Việc cần xử lý')).toBeInTheDocument();
    expect(getByText('body')).toBeInTheDocument();
    expect(container.querySelector('.console-pnl-icon')).toBeNull();
  });

  it('renders an optional monochrome icon', () => {
    const { container } = render(<Panel title="T" icon="filter">x</Panel>);
    const svg = container.querySelector('.console-pnl-icon svg')!;
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('fill', 'none');
  });
});
