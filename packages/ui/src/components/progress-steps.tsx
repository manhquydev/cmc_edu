/**
 * Horizontal stepper for multi-step flows / workflow statusbars.
 * Under `.o_web_client`, odoo.css applies Odoo chevron clip-path skin.
 * Requires @cmc/ui/odoo.css (.o-steps*).
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
    <ol className="o-steps" aria-label="Các bước">
      {steps.map((step, i) => {
        const state =
          i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'todo';
        const clickable = Boolean(onStepClick && i <= activeIndex);
        return (
          <li key={step.id} className={`o-steps-item is-${state}`}>
            {i > 0 ? <span className="o-steps-bridge" aria-hidden /> : null}
            <button
              type="button"
              className="o-steps-btn"
              disabled={!clickable}
              onClick={() => onStepClick?.(i)}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="o-steps-num" aria-hidden>
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="o-steps-label">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
