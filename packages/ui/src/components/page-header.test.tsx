import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BreadcrumbHrefProvider, PageHeader } from './page-header.js';

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
    expect(parent.className).toMatch(/console-bc-link/);
    // Current page is not a link
    expect(screen.queryByRole('link', { name: 'Lịch dạy' })).toBeNull();
    expect(container.querySelector('.console-bc-current')?.textContent).toBe('Lịch dạy');
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

  it('resolves a missing parent href from application context without replacing an explicit destination', () => {
    render(
      <MemoryRouter>
        <BreadcrumbHrefProvider
          resolveHref={(breadcrumb) =>
            breadcrumb.label === 'Pipeline CRM' ? '/crm' : '/unexpected'
          }
        >
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/finance' },
              { label: 'Pipeline CRM' },
              { label: 'Nhập hàng loạt' },
            ]}
          />
        </BreadcrumbHrefProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Kinh doanh' })).toHaveAttribute('href', '/finance');
    expect(screen.getByRole('link', { name: 'Pipeline CRM' })).toHaveAttribute('href', '/crm');
    expect(screen.queryByRole('link', { name: 'Nhập hàng loạt' })).toBeNull();
  });

  it('keeps title before actions in the default main-row DOM (Detail/Form)', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Học viên" actions={<button type="button">Tạo mới</button>} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'Tạo mới' });
    const heading = screen.getByRole('heading', { name: 'Học viên' });
    expect(heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
