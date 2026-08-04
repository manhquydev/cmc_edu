import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InsightMetric } from './insight-metric.js';

describe('InsightMetric', () => {
  it('renders value, delta, and spark', () => {
    const { container } = render(
      <MemoryRouter>
        <InsightMetric
          label="Lead mới"
          value={12}
          delta="+18%"
          deltaTone="up"
          spark={[0.2, 0.4, 0.5, 0.8, 1]}
          href="/crm"
          context="7 ngày"
          icon="target"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Lead mới')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+18%')).toBeInTheDocument();
    expect(container.querySelectorAll('.ck-im-spark-bar').length).toBe(5);
    expect(container.querySelector('a.ck-im[href="/crm"]')).toBeTruthy();
  });
});
