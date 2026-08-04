import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkInbox } from './work-inbox.js';

describe('WorkInbox', () => {
  it('shows count in title and renders rows', () => {
    render(
      <MemoryRouter>
        <WorkInbox
          count={2}
          items={[
            { title: 'A', meta: 'm', href: '/a', tone: 'brand' },
            { title: 'B', meta: 'n', href: '/b', tone: 'warning' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Việc cần bạn xử lý · 2/)).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders section labels', () => {
    render(
      <MemoryRouter>
        <WorkInbox
          sections={[
            {
              id: 'u',
              label: 'Khẩn',
              items: [{ title: 'X', meta: 'y', href: '/x', tone: 'warning', tag: 'Vượt ngưỡng' }],
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Khẩn')).toBeInTheDocument();
    expect(screen.getByText('Vượt ngưỡng')).toBeInTheDocument();
  });
});
