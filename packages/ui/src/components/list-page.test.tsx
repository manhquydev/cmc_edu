import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ListPage } from './list-page.js';

describe('ListPage', () => {
  it('renders header + filters slots + children', () => {
    const { getByText } = render(
      <ListPage header={<div>HEADER</div>} filters={<div>FILTERS</div>}>
        <div>TABLE</div>
      </ListPage>,
    );
    expect(getByText('HEADER')).toBeInTheDocument();
    expect(getByText('FILTERS')).toBeInTheDocument();
    expect(getByText('TABLE')).toBeInTheDocument();
  });

  it('renders without filters when omitted', () => {
    const { getByText } = render(
      <ListPage header={<div>HEADER</div>}>
        <div>TABLE</div>
      </ListPage>,
    );
    expect(getByText('HEADER')).toBeInTheDocument();
    expect(getByText('TABLE')).toBeInTheDocument();
  });

  it('renders the default EmptyState instead of children when isEmpty', () => {
    const { queryByText, getByText } = render(
      <ListPage header={<div>HEADER</div>} isEmpty>
        <div>TABLE</div>
      </ListPage>,
    );
    expect(queryByText('TABLE')).toBeNull();
    expect(getByText('Không có dữ liệu')).toBeInTheDocument();
    expect(document.querySelector('.console-empty-ops')).not.toBeNull();
  });

  it('renders a custom empty node when provided', () => {
    const { getByText, queryByText } = render(
      <ListPage header={<div>HEADER</div>} isEmpty empty={<div>CUSTOM EMPTY</div>}>
        <div>TABLE</div>
      </ListPage>,
    );
    expect(getByText('CUSTOM EMPTY')).toBeInTheDocument();
    expect(queryByText('TABLE')).toBeNull();
  });

  it('renders console-wrap--ops when density is ops', () => {
    const { container } = render(
      <ListPage density="ops" header={<div>HEADER</div>}>
        <div>TABLE</div>
      </ListPage>,
    );
    expect(container.querySelector('.console-wrap--ops')).not.toBeNull();
  });

  it('wraps chrome in ControlBar and supports controlFooter', () => {
    const { getByText, container } = render(
      <ListPage
        header={<div>HEADER</div>}
        filters={<div>FILTERS</div>}
        controlFooter={<div>PAGER</div>}
      >
        <div>TABLE</div>
      </ListPage>,
    );
    expect(container.querySelector('.console-control-bar')).toBeTruthy();
    expect(getByText('PAGER')).toBeInTheDocument();
  });
});
