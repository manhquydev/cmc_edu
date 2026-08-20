// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { links } from '@cmc/links';
import { RecordLink } from './record-link.js';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

function renderLink(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RecordLink', () => {
  it('renders a links.* href for a valid UUID', () => {
    renderLink(
      <RecordLink entity="student" id={STUDENT_ID}>
        An
      </RecordLink>,
    );
    const anchor = screen.getByRole('link', { name: 'An' });
    expect(anchor.getAttribute('href')).toBe(links.student(STUDENT_ID));
    expect(anchor.getAttribute('href')).not.toMatch(/^\/go\//);
  });

  it('accepts label when children are omitted', () => {
    renderLink(<RecordLink entity="student" id={STUDENT_ID} label="Bình" />);
    expect(screen.getByRole('link', { name: 'Bình' }).getAttribute('href')).toBe(
      links.student(STUDENT_ID),
    );
  });

  it('renders plain text when id is missing or not a UUID', () => {
    const { rerender } = renderLink(<RecordLink entity="student">An</RecordLink>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('An')).toBeTruthy();

    rerender(
      <MemoryRouter>
        <RecordLink entity="student" id="not-a-uuid">
          An
        </RecordLink>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('An')).toBeTruthy();
  });

  it('renders plain text when canView is false even with a valid UUID', () => {
    renderLink(
      <RecordLink entity="student" id={STUDENT_ID} canView={false}>
        An
      </RecordLink>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('An')).toBeTruthy();
  });
});
