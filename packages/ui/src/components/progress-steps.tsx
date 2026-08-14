/**
 * Horizontal stepper for multi-step flows / workflow statusbars.
 * Under `.o_web_client`, console.css applies console chevron clip-path skin.
 * Requires @cmc/ui/console.css (.console-steps*).
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
  /**
   * Per-step clickability. When omitted, past + current steps are clickable
   * (`i <= activeIndex`) — the default every non-CRM caller relies on.
   */
  canStepClick?: (index: number) => boolean;
}

export function ProgressSteps({
  steps,
  activeIndex,
  onStepClick,
  canStepClick,
}: ProgressStepsProps) {
  return (
    <ol className="console-steps" aria-label="Các bước">
      {steps.map((step, i) => {
        const state =
          i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'todo';
        const clickable = Boolean(
          onStepClick && (canStepClick ? canStepClick(i) : i <= activeIndex),
        );
        return (
          <li key={step.id} className={`console-steps-item is-${state}`}>
            {i > 0 ? <span className="console-steps-bridge" aria-hidden /> : null}
            <button
              type="button"
              className="console-steps-btn"
              disabled={!clickable}
              onClick={() => {
                if (!clickable) return;
                onStepClick?.(i);
              }}
              aria-current={state === 'current' ? 'step' : undefined}
              title={step.label}
            >
              <span className="console-steps-num" aria-hidden>
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="console-steps-label">{step.label}</span>
              {state !== 'todo' ? (
                <span className="console-sr-only">
                  {state === 'done' ? 'Đã hoàn thành' : 'Đang thực hiện'}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
