import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityTimeline } from './activity-timeline.js';

describe('ActivityTimeline', () => {
  it('renders items in order', () => {
    render(
      <ActivityTimeline
        items={[
          { id: '1', title: 'Tạo lead', time: 'Hôm qua' },
          { id: '2', title: 'O4', meta: 'Sẵn sàng', tone: 'success' },
        ]}
      />,
    );
    expect(screen.getByText('Tạo lead')).toBeInTheDocument();
    expect(screen.getByText('O4')).toBeInTheDocument();
    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument();
  });
});
