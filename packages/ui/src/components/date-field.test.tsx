import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateField } from './date-field.js';

describe('DateField', () => {
  it('renders labelled native date input', () => {
    render(<DateField label="Từ ngày" value="2026-08-01" onChange={() => {}} />);
    const input = screen.getByLabelText('Từ ngày');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-08-01');
  });

  it('fires onChange with YYYY-MM-DD', () => {
    const onChange = vi.fn();
    render(<DateField label="Ngày" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2026-08-06' } });
    expect(onChange).toHaveBeenCalledWith('2026-08-06');
  });

  it('hides visible label when isLabelHidden', () => {
    const { container } = render(
      <DateField label="Ẩn" value="" onChange={() => {}} isLabelHidden />,
    );
    expect(container.querySelector('.console-sr-only')).toBeTruthy();
    expect(screen.getByLabelText('Ẩn')).toBeInTheDocument();
  });
});
