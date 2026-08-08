import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StageFunnel } from './stage-funnel.js';

const stages = [
  { key: 'O1', label: 'Tiếp cận', value: 0 },
  { key: 'O4', label: 'Đã kiểm tra', value: 3, href: '/crm?stage=O4', emphasize: true },
  { key: 'O5', label: 'Đã ghi danh', value: 1, href: '/crm?stage=O5' },
];

describe('StageFunnel', () => {
  it('links non-zero stages and mutes zeros (stack)', () => {
    const { container } = render(
      <MemoryRouter>
        <StageFunnel stages={stages} layout="stack" />
      </MemoryRouter>,
    );
    expect(container.querySelector('a[href="/crm?stage=O4"]')).toBeTruthy();
    expect(container.querySelector('.is-muted')).toBeTruthy();
    expect(container.querySelector('.is-emphasize')).toBeTruthy();
    expect(container.querySelector('.console-fn-summary-total')?.textContent).toBe('4');
  });

  it('renders rail layout stages', () => {
    const { container } = render(
      <MemoryRouter>
        <StageFunnel stages={stages} layout="rail" />
      </MemoryRouter>,
    );
    expect(container.querySelector('.console-rail')).toBeTruthy();
    expect(container.querySelector('a.console-rail-stage[href="/crm?stage=O4"]')).toBeTruthy();
    expect(container.querySelector('.console-fn')).toBeNull();
  });

  it('renders split conversion strip', () => {
    const { container } = render(
      <MemoryRouter>
        <StageFunnel stages={stages} layout="split" />
      </MemoryRouter>,
    );
    expect(container.querySelector('.console-cstrip-track')).toBeTruthy();
    expect(container.querySelectorAll('.console-cstrip-legend-item').length).toBe(3);
  });

  it('shows empty state when all zeros', () => {
    render(
      <MemoryRouter>
        <StageFunnel
          stages={[
            { key: 'O1', label: 'A', value: 0 },
            { key: 'O2', label: 'B', value: 0 },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Chưa có cơ hội trong pipeline')).toBeInTheDocument();
  });

  it('renders footer CTA when provided', () => {
    render(
      <MemoryRouter>
        <StageFunnel
          stages={stages}
          footer={{ label: 'Sẵn sàng ghi danh', href: '/crm?stage=O4', count: 3 }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Sẵn sàng ghi danh: 3/)).toBeInTheDocument();
    expect(document.querySelector('a[href="/crm?stage=O4"]')).toBeTruthy();
  });
});
