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
  className?: string;
}

export function WorkflowStatusbar({
  steps,
  activeIndex,
  onStepClick,
  className,
}: WorkflowStatusbarProps) {
  const cls = className ? `o-workflow-statusbar ${className}` : 'o-workflow-statusbar';
  return (
    <div className={cls}>
      <ProgressSteps steps={steps} activeIndex={activeIndex} onStepClick={onStepClick} />
    </div>
  );
}
