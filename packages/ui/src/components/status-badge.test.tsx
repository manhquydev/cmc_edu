import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from './status-badge.js';
import type { SoftTone } from './status-badge.js';

describe('StatusBadge', () => {
  it('default md has tone class and no size modifier', () => {
    const { container } = render(<StatusBadge status="active" label="Đang mở" />);
    const el = container.querySelector('.console-badge-soft');
    expect(el).toHaveClass('console-badge-soft--success');
    expect(el).not.toHaveClass('console-badge-soft--sm');
    expect(el).not.toHaveClass('console-badge-soft--lg');
    expect(el).toHaveTextContent('Đang mở');
  });

  it('sm and lg are CSS modifiers, not inline fontSize', () => {
    const { container, rerender } = render(<StatusBadge status="pending" size="sm" />);
    const sm = container.querySelector('.console-badge-soft')!;
    expect(sm).toHaveClass('console-badge-soft--sm');
    expect(sm.getAttribute('style')).toBeNull();

    rerender(<StatusBadge status="pending" size="lg" />);
    const lg = container.querySelector('.console-badge-soft')!;
    expect(lg).toHaveClass('console-badge-soft--lg');
    expect(lg.getAttribute('style')).toBeNull();
  });

  it('maps done-family statuses onto the success tone', () => {
    const { container, rerender } = render(<StatusBadge status="draft" />);
    expect(container.querySelector('.console-badge-soft')).toHaveClass('console-badge-soft--neutral');
    rerender(<StatusBadge status="confirmed" />);
    expect(container.querySelector('.console-badge-soft')).toHaveClass('console-badge-soft--success');
    rerender(<StatusBadge status="done" />);
    expect(container.querySelector('.console-badge-soft')).toHaveClass('console-badge-soft--success');
  });

  it('maps waiting-family statuses onto the brand tone', () => {
    const { container, rerender } = render(<StatusBadge status="waiting" />);
    expect(container.querySelector('.console-badge-soft')).toHaveClass('console-badge-soft--brand');
    rerender(<StatusBadge status="queued" />);
    expect(container.querySelector('.console-badge-soft')).toHaveClass('console-badge-soft--brand');
    rerender(<StatusBadge status="processing" />);
    expect(container.querySelector('.console-badge-soft')).toHaveClass('console-badge-soft--brand');
  });

  it('honours explicit tone override over status map', () => {
    const tone: SoftTone = 'brand';
    const { container } = render(<StatusBadge status="pending" tone={tone} label="Chờ hệ thống" />);
    expect(container.querySelector('.console-badge-soft')).toHaveClass('console-badge-soft--brand');
    expect(container.querySelector('.console-badge-soft')).not.toHaveClass('console-badge-soft--warning');
  });
});
