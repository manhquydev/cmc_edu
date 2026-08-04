import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityHeader } from './entity-header.js';

describe('EntityHeader', () => {
  it('renders title initials and back link', () => {
    const { container } = render(
      <MemoryRouter>
        <EntityHeader
          title="Nguyễn A"
          subtitle="Lead"
          initials="NA"
          backHref="/crm"
          badges={<span>O4</span>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nguyễn A')).toBeInTheDocument();
    expect(screen.getByText('NA')).toBeInTheDocument();
    expect(container.querySelector('a.ck-eh-back[href="/crm"]')).toBeTruthy();
  });
});
