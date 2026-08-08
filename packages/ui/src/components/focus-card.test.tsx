import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FocusCard } from './focus-card.js';

describe('FocusCard', () => {
  it('renders focus CTA link', () => {
    const { container } = render(
      <MemoryRouter>
        <FocusCard
          kicker="Việc ưu tiên"
          title="Duyệt 4 phiếu thu nháp"
          description="Tổng 18.2tr đang chờ"
          href="/finance?status=draft"
          cta="Mở hàng đợi"
          meta="Cập nhật vừa xong"
          tone="danger"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Việc ưu tiên')).toBeInTheDocument();
    expect(screen.getByText('Duyệt 4 phiếu thu nháp')).toBeInTheDocument();
    expect(screen.getByText('Mở hàng đợi')).toBeInTheDocument();
    expect(container.querySelector('a.console-fc[href="/finance?status=draft"]')).toBeTruthy();
  });
});
