import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressSteps } from './progress-steps.js';

describe('ProgressSteps', () => {
  it('marks current step and allows click on past', () => {
    const onStepClick = vi.fn();
    const { container } = render(
      <ProgressSteps
        activeIndex={1}
        onStepClick={onStepClick}
        steps={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ]}
      />,
    );
    expect(container.querySelector('.is-current')).toBeTruthy();
    expect(container.querySelectorAll('.is-done').length).toBe(1);
    fireEvent.click(screen.getByText('A'));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
