import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppFrame } from './app-frame.js';

describe('AppFrame', () => {
  it('renders the nav slot, topbar title/actions, and content children', () => {
    const { container, getByText } = render(
      <AppFrame
        nav={<div data-testid="nav-slot">NAV</div>}
        topbarTitle="Tổng quan"
        topbarActions={<button>Ghi danh</button>}
      >
        <p>page body</p>
      </AppFrame>,
    );
    expect(container.querySelector('.sh-root')).toBeInTheDocument();
    expect(getByText('NAV')).toBeInTheDocument();
    expect(container.querySelector('.sh-top-title')).toHaveTextContent('Tổng quan');
    expect(getByText('Ghi danh')).toBeInTheDocument();
    expect(container.querySelector('.sh-content')).toHaveTextContent('page body');
  });

  it('still renders the (empty) actions container when topbarActions is omitted', () => {
    const { container } = render(
      <AppFrame nav={<div />} topbarTitle="X">
        <span />
      </AppFrame>,
    );
    expect(container.querySelector('.sh-top-actions')).toBeInTheDocument();
    expect(container.querySelector('.sh-top-actions')).toBeEmptyDOMElement();
  });
});
