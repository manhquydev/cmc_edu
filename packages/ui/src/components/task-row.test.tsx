import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { TaskRow } from './task-row.js';

describe('TaskRow', () => {
  it('tone colours only the dot; title/meta stay default ink; chevron + link present', () => {
    const { container, getByText } = render(
      <MemoryRouter>
        <TaskRow title="Duyệt SO1" meta="5.000.000 đ" href="/finance/1" tone="warning" />
      </MemoryRouter>,
    );
    expect(getByText('Duyệt SO1')).toBeInTheDocument();
    expect(getByText('5.000.000 đ')).toBeInTheDocument();
    // Title has only a layout style, never a tone colour.
    expect(container.querySelector('.ck-row-title')!.getAttribute('style')).toBe('display: block;');
    expect(container.querySelector('.ck-dot')).toBeInTheDocument();
    expect(container.querySelector('.ck-chev svg')).toBeInTheDocument();
    expect(container.querySelector('a[href="/finance/1"]')).toBeInTheDocument();
  });
});
