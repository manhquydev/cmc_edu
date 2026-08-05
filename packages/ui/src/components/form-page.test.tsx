import { render } from '@testing-library/react';
import { Button } from '@astryxdesign/core/Button';
import { describe, it, expect } from 'vitest';
import { FormPage } from './form-page.js';

describe('FormPage', () => {
  it('renders the field region and exactly one primary action in the action bar', () => {
    const { container, getByText } = render(
      <FormPage header={<div>HEADER</div>} actions={<Button label="Lưu" variant="primary" />}>
        <div>FIELDS</div>
      </FormPage>,
    );
    expect(getByText('HEADER')).toBeInTheDocument();
    expect(getByText('FIELDS')).toBeInTheDocument();

    const actionBar = container.querySelector('.o-actions');
    expect(actionBar).not.toBeNull();
    expect(actionBar!.querySelectorAll('button, a').length).toBe(1);
    expect(actionBar).toHaveTextContent('Lưu');
  });

  it('omits the result slot when not provided', () => {
    const { queryByText } = render(
      <FormPage header={<div>HEADER</div>} actions={<Button label="Lưu" variant="primary" />}>
        <div>FIELDS</div>
      </FormPage>,
    );
    expect(queryByText('RESULT')).toBeNull();
  });

  it('renders the result slot when provided', () => {
    const { getByText } = render(
      <FormPage
        header={<div>HEADER</div>}
        actions={<Button label="Lưu" variant="primary" />}
        result={<div>RESULT</div>}
      >
        <div>FIELDS</div>
      </FormPage>,
    );
    expect(getByText('RESULT')).toBeInTheDocument();
  });
});
