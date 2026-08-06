import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './dashboard-page.js';

describe('DashboardPage', () => {
  it('renders title, subtitle, metrics, primary and secondary slots', () => {
    render(
      <DashboardPage
        title="Tổng quan"
        subtitle="Xin chào · Giáo viên"
        shortcuts={<div>SHORTCUTS</div>}
        metrics={<div>METRICS</div>}
        primary={<div>PRIMARY</div>}
        secondary={<div>SECONDARY</div>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(screen.getByText('Xin chào · Giáo viên')).toBeInTheDocument();
    expect(screen.getByText('SHORTCUTS')).toBeInTheDocument();
    expect(screen.getByText('METRICS')).toBeInTheDocument();
    expect(screen.getByText('PRIMARY')).toBeInTheDocument();
    expect(screen.getByText('SECONDARY')).toBeInTheDocument();
  });

  it('renders loading skeleton without title', () => {
    const { container, queryByRole } = render(
      <DashboardPage title="Tổng quan" primary={<div>P</div>} loading />,
    );
    expect(queryByRole('heading', { name: 'Tổng quan' })).toBeNull();
    expect(container.querySelector('.o-dash')).toBeTruthy();
  });

  it('omits optional slots when not provided', () => {
    render(<DashboardPage title="Tổng quan" primary={<div>ONLY</div>} />);
    expect(screen.getByText('ONLY')).toBeInTheDocument();
    expect(screen.queryByText('SHORTCUTS')).toBeNull();
  });
});
