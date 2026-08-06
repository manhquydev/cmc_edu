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

  it('uses Odoo form sheet dual-layer: summary outside sheet, entity/tabs/body inside', () => {
    const { container, getByText } = render(
      <DetailPage
        header={<div>HEADER</div>}
        entity={<div>ENTITY</div>}
        summary={<div>SUMMARY</div>}
        statusbar={<div>STATUSBAR</div>}
        tabs={<div>TABS</div>}
      >
        <div>CONTENT</div>
      </DetailPage>,
    );
    const bg = container.querySelector('.o-form-sheet-bg');
    const sheet = container.querySelector('.o-form-sheet');
    expect(bg).toBeTruthy();
    expect(sheet).toBeTruthy();
    expect(bg!.contains(sheet!)).toBe(true);
    // summary + thin statusbar are siblings of sheet, not inside it
    expect(sheet!.contains(getByText('SUMMARY'))).toBe(false);
    expect(sheet!.contains(getByText('STATUSBAR'))).toBe(false);
    expect(bg!.contains(getByText('SUMMARY'))).toBe(true);
    expect(container.querySelector('.o-detail-statusbar')).toContainElement(getByText('STATUSBAR'));
    expect(sheet!.contains(getByText('ENTITY'))).toBe(true);
    expect(sheet!.contains(getByText('TABS'))).toBe(true);
    expect(sheet!.contains(getByText('CONTENT'))).toBe(true);
    // header stays outside sheet_bg
    expect(bg!.contains(getByText('HEADER'))).toBe(false);
  });

  it('omits statusbar slot when not provided', () => {
    const { container } = render(
      <DetailPage header={<div>HEADER</div>} summary={<div>SUMMARY</div>}>
        <div>CONTENT</div>
      </DetailPage>,
    );
    expect(container.querySelector('.o-detail-statusbar')).toBeNull();
    expect(container.querySelector('.o-detail-summary')).toBeTruthy();
  });

  it('omits body when children are absent', () => {
    const { container } = render(
      <DetailPage header={<div>HEADER</div>} tabs={<div>TABS</div>} />,
    );
    expect(container.querySelector('.o-detail-body')).toBeNull();
    expect(container.querySelector('.o-form-sheet')).toBeTruthy();
  });

  it('omits sheet when only header is provided', () => {
    const { container } = render(<DetailPage header={<div>HEADER</div>} />);
    expect(container.querySelector('.o-form-sheet-bg')).toBeTruthy();
    expect(container.querySelector('.o-form-sheet')).toBeNull();
  });
});
