import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { EmptyState } from './empty-state.js';
import { FunnelBar } from './funnel-bar.js';
import { LineIcon } from './line-icon.js';
import { Panel } from './panel.js';

export interface StageFunnelStage {
  key: string;
  label: string;
  value: number;
  /** Deep link when value > 0 (e.g. /crm?stage=O4_TESTED). */
  href?: string;
  /** Emphasize action stage (e.g. O4 ready to enroll). */
  emphasize?: boolean;
  /** Optional quiet hint under label (stack layout). */
  hint?: string;
}

export type StageFunnelLayout = 'stack' | 'rail' | 'split';

export interface StageFunnelProps {
  title?: string;
  stages: StageFunnelStage[];
  loading?: boolean;
  /**
   * Visual layout:
   * - `stack` — modern bar rows (default, upgraded FunnelBar)
   * - `rail` — horizontal stage pipeline (CRM 2024+ feel)
   * - `split` — single multi-segment conversion strip + legend
   */
  layout?: StageFunnelLayout;
  /** Show % of peak on stack bars. Default true for stack. */
  showShare?: boolean;
  /** Show step chips O1… / 1… on stack. Default true. */
  showSteps?: boolean;
  /** Footer CTA when actionCount > 0. */
  footer?: { label: string; href: string; count?: number };
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

function stageStepLabel(stage: StageFunnelStage, index: number): string {
  // Prefer key when short (O1, O4…); else 1-based index.
  if (stage.key && stage.key.length <= 4) return stage.key;
  return String(index + 1);
}

/** CRM-style stage distribution — stack / rail / split. */
export function StageFunnel({
  title = 'Pipeline O1 → O5',
  stages,
  loading,
  layout = 'stack',
  showShare = true,
  showSteps = true,
  footer,
  viewAllHref,
  viewAllLabel = 'Mở CRM',
  emptyTitle = 'Chưa có cơ hội trong pipeline',
  emptyDescription = 'Khi có lead mới, các giai đoạn sẽ hiện tại đây.',
  emptyAction,
}: StageFunnelProps) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const total = stages.reduce((s, x) => s + x.value, 0);

  const headerAction = viewAllHref ? (
    <Link to={viewAllHref} className="console-pnl-action">
      {viewAllLabel}
      <LineIcon name="chevron" size={14} />
    </Link>
  ) : undefined;

  return (
    <Panel title={title} action={headerAction}>
      {loading ? (
        <div className="console-fn-skel">
          <Skeleton height={layout === 'rail' ? 72 : 120} radius={1} />
        </div>
      ) : total === 0 ? (
        <div className="console-inbox-empty">
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={<LineIcon name="filter" size={22} />}
            action={emptyAction}
            density="ops"
          />
        </div>
      ) : (
        <>
          {total > 0 ? (
            <div className="console-fn-summary" aria-live="polite">
              <span className="console-fn-summary-total">{total}</span>
              <span className="console-fn-summary-label">cơ hội trong pipeline</span>
              {footer?.count != null && footer.count > 0 ? (
                <span className="console-fn-summary-pill">{footer.count} cần xử lý</span>
              ) : null}
            </div>
          ) : null}

          {layout === 'rail' ? (
            <div className="console-rail" role="list">
              {stages.map((stage, i) => {
                const clickable = Boolean(stage.href && stage.value > 0);
                const cls = [
                  'console-rail-stage',
                  stage.value === 0 ? 'is-muted' : '',
                  stage.emphasize && stage.value > 0 ? 'is-emphasize' : '',
                  clickable ? 'is-link' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const body = (
                  <>
                    <span className="console-rail-idx" aria-hidden>
                      {stageStepLabel(stage, i)}
                    </span>
                    <span className="console-rail-val">{stage.value}</span>
                    <span className="console-rail-label">{stage.label}</span>
                    {i < stages.length - 1 ? <span className="console-rail-bridge" aria-hidden /> : null}
                  </>
                );
                if (clickable) {
                  return (
                    <Link key={stage.key} to={stage.href!} className={cls} role="listitem">
                      {body}
                    </Link>
                  );
                }
                return (
                  <div key={stage.key} className={cls} role="listitem">
                    {body}
                  </div>
                );
              })}
            </div>
          ) : null}

          {layout === 'split' ? (
            <div className="console-cstrip">
              <div className="console-cstrip-track" role="img" aria-label="Phân bố pipeline">
                {stages.map((stage) => {
                  if (stage.value <= 0) return null;
                  const flex = stage.value;
                  const cls = [
                    'console-cstrip-seg',
                    stage.emphasize ? 'is-emphasize' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const segment = (
                    <span className={cls} title={`${stage.label}: ${stage.value}`}>
                      <span className="console-cstrip-seg-val">{stage.value}</span>
                    </span>
                  );
                  if (stage.href) {
                    return (
                      <Link
                        key={stage.key}
                        to={stage.href}
                        className="console-cstrip-seg-link"
                        style={{ flex }}
                      >
                        {segment}
                      </Link>
                    );
                  }
                  return (
                    <span key={stage.key} className="console-cstrip-seg-wrap" style={{ flex }}>
                      {segment}
                    </span>
                  );
                })}
              </div>
              <ul className="console-cstrip-legend">
                {stages.map((stage) => (
                  <li
                    key={stage.key}
                    className={[
                      'console-cstrip-legend-item',
                      stage.value === 0 ? 'is-muted' : '',
                      stage.emphasize && stage.value > 0 ? 'is-emphasize' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="console-cstrip-swatch" aria-hidden />
                    <span className="console-cstrip-legend-label">{stage.label}</span>
                    <span className="console-cstrip-legend-val">{stage.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {layout === 'stack' ? (
            <div className="console-fn">
              {stages.map((stage, i) => {
                const clickable = Boolean(stage.href && stage.value > 0);
                const bar = (
                  <FunnelBar
                    label={stage.label}
                    value={stage.value}
                    max={max}
                    muted={stage.value === 0}
                    emphasize={Boolean(stage.emphasize && stage.value > 0)}
                    showChevron={clickable}
                    showShare={showShare && stage.value > 0}
                    step={showSteps ? stageStepLabel(stage, i) : undefined}
                    hint={stage.hint}
                  />
                );
                if (!clickable) {
                  return (
                    <div key={stage.key} className="console-fn-static">
                      {bar}
                    </div>
                  );
                }
                return (
                  <Link key={stage.key} to={stage.href!} className="console-fn-link">
                    {bar}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {footer && footer.count !== 0 && (
            <div className="console-fn-footer">
              <span className="console-fn-footer-text">
                {footer.count != null ? `${footer.label}: ${footer.count}` : footer.label}
              </span>
              <Link to={footer.href} className="console-fn-footer-cta">
                Xử lý
                <LineIcon name="chevron" size={14} />
              </Link>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
