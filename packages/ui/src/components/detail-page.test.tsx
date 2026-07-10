import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetailPage } from './detail-page.js';

describe('DetailPage', () => {
  it('renders header + content', () => {
    const { getByText } = render(
      <DetailPage header={<div>HEADER</div>}>
        <div>CONTENT</div>
      </DetailPage>,
    );
    expect(getByText('HEADER')).toBeInTheDocument();
    expect(getByText('CONTENT')).toBeInTheDocument();
  });

  it('omits the tabs slot when not provided', () => {
    const { queryByText } = render(
      <DetailPage header={<div>HEADER</div>}>
        <div>CONTENT</div>
      </DetailPage>,
    );
    expect(queryByText('TABS')).toBeNull();
  });

  it('renders an optional tabs slot between header and content', () => {
    const { getByText } = render(
      <DetailPage header={<div>HEADER</div>} tabs={<div>TABS</div>}>
        <div>CONTENT</div>
      </DetailPage>,
    );
    expect(getByText('TABS')).toBeInTheDocument();
    expect(getByText('CONTENT')).toBeInTheDocument();
  });
});
