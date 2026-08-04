import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageHeader } from './page-header.js';

describe('PageHeader breadcrumbs', () => {
  it('makes parent crumbs SPA links and keeps current plain', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader
          title="Lịch dạy"
          breadcrumbs={[
            { label: 'Giảng dạy', href: '/teaching' },
            { label: 'Lịch dạy' },
          ]}
        />
      </MemoryRouter>,
    );
    const parent = screen.getByRole('link', { name: 'Giảng dạy' });
    expect(parent.getAttribute('href')).toBe('/teaching');
    expect(parent.className).toMatch(/ck-bc-link/);
    // Current page is not a link
    expect(screen.queryByRole('link', { name: 'Lịch dạy' })).toBeNull();
    expect(container.querySelector('.ck-bc-current')?.textContent).toBe('Lịch dạy');
  });

  it('supports breadcrumbs-only chrome without a title heading (Detail + EntityHeader)', () => {
    render(
      <MemoryRouter>
        <PageHeader
          breadcrumbs={[
            { label: 'Học viên', href: '/admin/students' },
            { label: 'Chi tiết' },
          ]}
          actions={<button type="button">Sửa</button>}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('link', { name: 'Học viên' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
  });
});
