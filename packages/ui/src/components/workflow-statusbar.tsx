import { ProgressSteps, type ProgressStep } from './progress-steps.js';

/**
 * Record-page workflow strip — thin wrapper over ProgressSteps
 * (Odoo statusbar / Lightning Path analogue).
 */
export interface WorkflowStatusbarProps {
  steps: ProgressStep[];
  /** 0-based active index. */
  activeIndex: number;
  onStepClick?: (index: number) => void;
  canStepClick?: (index: number) => boolean;
  className?: string;
}

export function WorkflowStatusbar({
  steps,
  activeIndex,
  onStepClick,
  canStepClick,
  className,
}: WorkflowStatusbarProps) {
  const cls = className ? `console-workflow-statusbar ${className}` : 'console-workflow-statusbar';
  return (
    <div className={cls}>
      <ProgressSteps
        steps={steps}
        activeIndex={activeIndex}
        onStepClick={onStepClick}
        canStepClick={canStepClick}
      />
    </div>
  );
}
