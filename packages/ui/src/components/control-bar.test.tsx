import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ControlBar } from './control-bar.js';

describe('ControlBar', () => {
  it('renders header and sticky band class', () => {
    const { getByText, container } = render(
      <ControlBar header={<div>HDR</div>} />,
    );
    expect(getByText('HDR')).toBeInTheDocument();
    expect(container.querySelector('.console-control-bar')).toBeTruthy();
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
    expect(container.querySelector('.console-control-bar-filters')).toBeTruthy();
    expect(container.querySelector('.console-control-bar-footer')).toBeTruthy();
  });

  it('omits filter/footer wrappers when absent', () => {
    const { container } = render(<ControlBar header={<div>HDR</div>} />);
    expect(container.querySelector('.console-control-bar-filters')).toBeNull();
    expect(container.querySelector('.console-control-bar-footer')).toBeNull();
  });

  it('renders left/center/right aliases with dual zone classes', () => {
    const { getByText, container } = render(
      <ControlBar
        left={<div>LEFT</div>}
        center={<div>CENTER</div>}
        right={<div>RIGHT</div>}
      />,
    );
    expect(getByText('LEFT')).toBeInTheDocument();
    expect(getByText('CENTER')).toBeInTheDocument();
    expect(getByText('RIGHT')).toBeInTheDocument();
    expect(container.querySelector('.console-control-bar-header.console-control-bar-left')).toBeTruthy();
    expect(container.querySelector('.console-control-bar-filters.console-control-bar-center')).toBeTruthy();
    expect(container.querySelector('.console-control-bar-footer.console-control-bar-right')).toBeTruthy();
  });

  it('prefers left over header when both are passed', () => {
    const { getByText, queryByText } = render(
      <ControlBar header={<div>HDR</div>} left={<div>LEFT</div>} />,
    );
    expect(getByText('LEFT')).toBeInTheDocument();
    expect(queryByText('HDR')).toBeNull();
  });
});
