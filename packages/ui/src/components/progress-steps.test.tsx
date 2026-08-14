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

  it('with canStepClick, only the allowed next step is enabled', () => {
    const onStepClick = vi.fn();
    const activeIndex = 1;
    render(
      <ProgressSteps
        activeIndex={activeIndex}
        onStepClick={onStepClick}
        canStepClick={(i) => i === activeIndex + 1}
        steps={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
          { id: 'd', label: 'D' },
        ]}
      />,
    );
    const past = screen.getByRole('button', { name: /A/ });
    const current = screen.getByRole('button', { name: /B/ });
    const next = screen.getByRole('button', { name: 'C' });
    const far = screen.getByRole('button', { name: 'D' });
    expect(past).toBeDisabled();
    expect(current).toBeDisabled();
    expect(next).not.toBeDisabled();
    expect(far).toBeDisabled();

    fireEvent.click(next);
    expect(onStepClick).toHaveBeenCalledTimes(1);
    expect(onStepClick).toHaveBeenCalledWith(2);

    fireEvent.click(past);
    expect(onStepClick).toHaveBeenCalledTimes(1);
  });

  it('exposes full label and state to assistive technology, incl. truncated labels', () => {
    render(
      <ProgressSteps
        activeIndex={1}
        steps={[
          { id: 'a', label: 'Thông tin tuyển sinh rất dài' },
          { id: 'b', label: 'Xác nhận' },
          { id: 'c', label: 'Xử lý' },
        ]}
      />,
    );
    const doneStep = screen.getByRole('button', {
      name: /thông tin tuyển sinh rất dài.*đã hoàn thành/i,
    });
    expect(doneStep).toHaveAttribute('title', 'Thông tin tuyển sinh rất dài');
    const currentStep = screen.getByRole('button', { name: /xác nhận.*đang thực hiện/i });
    expect(currentStep).toHaveAttribute('aria-current', 'step');
    // todo state: no extra SR announcement beyond the visible label
    const todoStep = screen.getByRole('button', { name: 'Xử lý' });
    expect(todoStep).not.toHaveAttribute('aria-current');
  });
});
