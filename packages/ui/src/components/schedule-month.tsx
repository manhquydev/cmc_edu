import { SessionCard, type SessionCardProps, type SessionStatus } from './session-card.js';
import { EmptyState } from './empty-state.js';
import { Skeleton } from '@astryxdesign/core/Skeleton';

export interface ScheduleMonthGroup {
  key: string;
  label: string;
  items: SessionCardProps[];
}

export interface ScheduleMonthProps {
  groups: ScheduleMonthGroup[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Month-grouped agenda of class batches / long-running courses.
 * Warmer alternative to plain Card grid used previously on Lịch dạy.
 */
export function ScheduleMonth({
  groups,
  loading,
  emptyTitle = 'Chưa có lớp học',
  emptyDescription = 'Lớp theo kỳ sẽ được nhóm theo tháng bắt đầu.',
}: ScheduleMonthProps) {
  if (loading) {
    return (
      <div className="console-smon">
        {[1, 2].map((i) => (
          <div key={i} className="console-smon-block">
            <Skeleton height={18} width="30%" radius={1} />
            <div className="console-smon-grid">
              <Skeleton height={96} radius={1} />
              <Skeleton height={96} radius={1} />
              <Skeleton height={96} radius={1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="console-smon-empty">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="console-smon">
      {groups.map((g) => (
        <section key={g.key} className="console-smon-block">
          <header className="console-smon-head">
            <h3 className="console-smon-label">{g.label}</h3>
            <span className="console-smon-n">{g.items.length} lớp</span>
          </header>
          <div className="console-smon-grid">
            {g.items.map((item, i) => (
              <SessionCard key={`${g.key}-${item.title}-${i}`} {...item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Map batch status string → SessionStatus. */
export function batchStatusToSession(status: string, opts?: { attention?: boolean }): SessionStatus {
  if (opts?.attention) return 'attention';
  switch (status) {
    case 'active':
      return 'active';
    case 'completed':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    case 'planned':
      return 'planned';
    default:
      return 'planned';
  }
}
