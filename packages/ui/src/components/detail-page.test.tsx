import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetailPage } from './detail-page.js';

describe('DetailPage', () => {
  it('renders header + content', () => {
    const { getByText, container } = render(
      <DetailPage header={<div>HEADER</div>}>
        <div>CONTENT</div>
      </DetailPage>,
    );
    expect(getByText('HEADER')).toBeInTheDocument();
    expect(getByText('CONTENT')).toBeInTheDocument();
    expect(container.querySelector('.o-detail')).toBeTruthy();
  });

  it('omits the tabs slot when not provided', () => {
    const { queryByText } = render(
      <DetailPage header={<div>HEADER</div>}>
        <div>CONTENT</div>
      </DetailPage>,
    );
    expect(queryByText('TABS')).toBeNull();
  });

  it('renders entity, summary, tabs between header and body', () => {
    const { getByText, container } = render(
      <DetailPage
        header={<div>HEADER</div>}
        entity={<div>ENTITY</div>}
        summary={<div>SUMMARY</div>}
        tabs={<div>TABS</div>}
      >
        <div>CONTENT</div>
      </DetailPage>,
    );
    expect(getByText('ENTITY')).toBeInTheDocument();
    expect(getByText('SUMMARY')).toBeInTheDocument();
    expect(getByText('TABS')).toBeInTheDocument();
    expect(container.querySelector('.o-detail-entity')).toBeTruthy();
    expect(container.querySelector('.o-detail-summary')).toBeTruthy();
    expect(container.querySelector('.o-detail-tabs')).toBeTruthy();
  });

  it('omits body when children are absent', () => {
    const { container } = render(
      <DetailPage header={<div>HEADER</div>} tabs={<div>TABS</div>} />,
    );
    expect(container.querySelector('.o-detail-body')).toBeNull();
  });
});
