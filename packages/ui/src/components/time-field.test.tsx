import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeField } from './time-field.js';

describe('TimeField', () => {
  it('renders labelled native time input', () => {
    render(<TimeField label="Giờ bắt đầu (HH:mm)" value="08:00" onChange={() => {}} />);
    const input = screen.getByLabelText('Giờ bắt đầu (HH:mm)');
    expect(input).toHaveAttribute('type', 'time');
    expect(input).toHaveValue('08:00');
  });

  it('fires onChange with HH:mm (no seconds, no step prop)', () => {
    const onChange = vi.fn();
    render(<TimeField label="Giờ" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Giờ');
    expect(input).not.toHaveAttribute('step');
    fireEvent.change(input, { target: { value: '14:30' } });
    expect(onChange).toHaveBeenCalledWith('14:30');
  });

  it('hides visible label when isLabelHidden', () => {
    const { container } = render(
      <TimeField label="Ẩn" value="" onChange={() => {}} isLabelHidden />,
    );
    expect(container.querySelector('.console-sr-only')).toBeTruthy();
    expect(screen.getByLabelText('Ẩn')).toBeInTheDocument();
  });
});
