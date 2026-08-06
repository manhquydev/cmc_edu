import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { MetricCard, type MetricCardProps } from './metric-card.js';

const base: MetricCardProps = { label: 'Phiếu thu', value: 3, context: 'Xem', icon: 'receipt', href: '/finance' };
const renderCard = (props: MetricCardProps) =>
  render(<MemoryRouter><MetricCard {...props} /></MemoryRouter>);

describe('MetricCard', () => {
  it('renders the value; a status shows a DOT and never recolours the value', () => {
    const { container } = renderCard({ ...base, attention: 'danger' });
    const value = container.querySelector('.o-mc-value')!;
    expect(value).toHaveTextContent('3');
    // Locked invariant: value node carries no inline colour/style from the tone.
    expect(value.getAttribute('style')).toBeNull();
    // Urgency is a separate dot element.
    expect(container.querySelector('.o-attn')).toBeInTheDocument();
  });

  it('renders no attention dot when omitted', () => {
    const { container } = renderCard(base);
    expect(container.querySelector('.o-attn')).toBeNull();
  });

  it('renders a monochrome outline icon (currentColor, no fill)', () => {
    const { container } = renderCard(base);
    const svg = container.querySelector('.o-mc-icon svg')!;
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('fill', 'none');
  });

  it('loading renders a skeleton instead of the value', () => {
    const { container } = renderCard({ ...base, loading: true });
    expect(container.querySelector('.o-mc-value')).toBeNull();
  });

  it('wraps the card in a link to href', () => {
    const { container } = renderCard(base);
    expect(container.querySelector('a[href="/finance"]')).toBeInTheDocument();
  });
});
