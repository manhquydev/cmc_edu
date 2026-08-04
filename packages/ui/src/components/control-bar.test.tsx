import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ControlBar } from './control-bar.js';

describe('ControlBar', () => {
  it('renders header and sticky band class', () => {
    const { getByText, container } = render(
      <ControlBar header={<div>HDR</div>} />,
    );
    expect(getByText('HDR')).toBeInTheDocument();
    expect(container.querySelector('.tpl-control-bar')).toBeTruthy();
  });

  it('renders filters and footer slots when provided', () => {
    const { getByText, container } = render(
      <ControlBar
        header={<div>HDR</div>}
        filters={<div>FILTERS</div>}
        footer={<div>PAGER</div>}
      />,
    );
    expect(getByText('FILTERS')).toBeInTheDocument();
    expect(getByText('PAGER')).toBeInTheDocument();
    expect(container.querySelector('.tpl-control-bar-filters')).toBeTruthy();
    expect(container.querySelector('.tpl-control-bar-footer')).toBeTruthy();
  });

  it('omits filter/footer wrappers when absent', () => {
    const { container } = render(<ControlBar header={<div>HDR</div>} />);
    expect(container.querySelector('.tpl-control-bar-filters')).toBeNull();
    expect(container.querySelector('.tpl-control-bar-footer')).toBeNull();
  });
});
