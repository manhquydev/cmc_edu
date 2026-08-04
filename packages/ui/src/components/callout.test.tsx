import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Callout } from './callout.js';

describe('Callout', () => {
  it('renders title and tone class', () => {
    const { container } = render(
      <Callout tone="warning" title="Chú ý">
        Nội dung tip
      </Callout>,
    );
    expect(screen.getByText('Chú ý')).toBeInTheDocument();
    expect(screen.getByText('Nội dung tip')).toBeInTheDocument();
    expect(container.querySelector('.ck-callout--warning')).toBeTruthy();
  });
});
