/**
 * Horizontal stepper for multi-step flows (ghi danh, onboarding).
 * Modern: numbered soft chips + connector, not chevron wizard 2015.
 * Requires @cmc/ui/premium.css (.ck-steps*).
 */
export interface ProgressStep {
  id: string;
  label: string;
}

export interface ProgressStepsProps {
  steps: ProgressStep[];
  /** 0-based active index. */
  activeIndex: number;
  /** Click step (optional navigation back). */
  onStepClick?: (index: number) => void;
}

export function ProgressSteps({ steps, activeIndex, onStepClick }: ProgressStepsProps) {
  return (
    <ol className="ck-steps" aria-label="Các bước">
      {steps.map((step, i) => {
        const state =
          i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'todo';
        const clickable = Boolean(onStepClick && i <= activeIndex);
        return (
          <li key={step.id} className={`ck-steps-item is-${state}`}>
            {i > 0 ? <span className="ck-steps-bridge" aria-hidden /> : null}
            <button
              type="button"
              className="ck-steps-btn"
              disabled={!clickable}
              onClick={() => onStepClick?.(i)}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="ck-steps-num" aria-hidden>
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="ck-steps-label">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
