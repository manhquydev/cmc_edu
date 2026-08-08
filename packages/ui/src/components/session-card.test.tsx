import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionCard, resolveSessionFoot } from './session-card.js';

describe('SessionCard', () => {
  it('renders title time and link CTA', () => {
    const { container } = render(
      <MemoryRouter>
        <SessionCard
          title="ENG-A1"
          timeLabel="08:00 – 09:30"
          status="live"
          href="/teaching/attendance"
          actionLabel="Điểm danh"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('ENG-A1')).toBeInTheDocument();
    expect(screen.getByText('08:00 – 09:30')).toBeInTheDocument();
    expect(screen.getByText('Đang học')).toBeInTheDocument();
    expect(container.querySelector('a.console-sc[href="/teaching/attendance"]')).toBeTruthy();
  });

  it('reserves secondary and cta slots when optional text is missing', () => {
    const { container } = render(<SessionCard title="X" status="planned" />);
    expect(container.querySelector('.console-sc-secondary')).toBeTruthy();
    expect(container.querySelector('.console-sc-cta-slot')).toBeTruthy();
    expect(container.querySelector('.console-sc-cta-spacer')).toBeTruthy();
  });

  it('default density shows program and meta on separate lines', () => {
    const { container } = render(
      <SessionCard
        title="ENG-A1"
        subtitle="English Advanced"
        meta="P.301 · GV Mai"
        density="default"
      />,
    );
    expect(container.querySelectorAll('.console-sc-line').length).toBe(2);
    expect(screen.getByText('English Advanced')).toBeInTheDocument();
    expect(screen.getByText('P.301 · GV Mai')).toBeInTheDocument();
  });
});

describe('resolveSessionFoot', () => {
  it('compact actionable prefers meta over subtitle', () => {
    const f = resolveSessionFoot('English Long Program', 'P.301', 'compact', 'actionable');
    expect(f.line1).toBe('P.301');
    expect(f.tooltip).toContain('English');
  });

  it('compact identity prefers subtitle', () => {
    const f = resolveSessionFoot('English', 'P.301', 'compact', 'identity');
    expect(f.line1).toBe('English');
  });
});
