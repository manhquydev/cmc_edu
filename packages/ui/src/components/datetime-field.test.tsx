import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateTimeField } from './datetime-field.js';

describe('DateTimeField', () => {
  it('renders labelled native datetime-local input', () => {
    render(<DateTimeField label="Thời gian test" value="2026-08-10T08:00" onChange={() => {}} />);
    const input = screen.getByLabelText('Thời gian test');
    expect(input).toHaveAttribute('type', 'datetime-local');
    expect(input).toHaveValue('2026-08-10T08:00');
  });

  it('fires onChange with the native datetime-local string', () => {
    const onChange = vi.fn();
    render(<DateTimeField label="Thời gian họp" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Thời gian họp'), {
      target: { value: '2026-08-11T14:30' },
    });
    expect(onChange).toHaveBeenCalledWith('2026-08-11T14:30');
  });

  it('hides visible label when isLabelHidden', () => {
    const { container } = render(
      <DateTimeField label="Ẩn" value="" onChange={() => {}} isLabelHidden />,
    );
    expect(container.querySelector('.console-sr-only')).toBeTruthy();
    expect(screen.getByLabelText('Ẩn')).toBeInTheDocument();
  });
});
