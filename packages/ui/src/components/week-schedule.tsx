import type { ReactNode } from 'react';
import { SessionCard, type SessionCardProps } from './session-card.js';
import { EmptyState } from './empty-state.js';
import { Skeleton } from '@astryxdesign/core/Skeleton';

export interface WeekDayColumn {
  key: string;
  /** Short weekday e.g. T2 */
  weekday: string;
  /** Date number e.g. 3 */
  dayNum: string;
  /** Optional full date caption */
  caption?: string;
  isToday?: boolean;
  isWeekend?: boolean;
  sessions: SessionCardProps[];
}

export interface WeekScheduleProps {
  /** Monday-first recommended for VN ops. */
  days: WeekDayColumn[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Show legend under grid. */
  showLegend?: boolean;
  density?: 'default' | 'compact';
  /** Optional week title strip (e.g. "Tuần 03/08 – 09/08"). */
  title?: string;
  /** Optional trailing controls (prev/next buttons from parent). */
  toolbar?: ReactNode;
}

/**
 * Modern education week board — floating day columns, soft today, session pills.
 * Not classical hard-grid calendars. Requires @cmc/ui/premium.css (.ck-week*).
 */
export function WeekSchedule({
  days,
  loading,
  emptyTitle = 'Không có buổi trong tuần',
  emptyDescription = 'Khi có lớp / buổi học, các cột ngày sẽ hiện thẻ buổi.',
  emptyAction,
  showLegend = true,
  density = 'compact',
  title,
  toolbar,
}: WeekScheduleProps) {
  if (loading) {
    return (
      <div className="ck-week">
        {(title || toolbar) && (
          <div className="ck-week-toolbar">
            <div className="ck-week-toolbar-title">{title ?? 'Đang tải…'}</div>
          </div>
        )}
        <div className="ck-week-grid">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="ck-week-col">
              <div className="ck-week-head">
                <Skeleton height={44} radius={1} />
              </div>
              <div className="ck-week-body">
                <Skeleton height={80} radius={1} />
                <Skeleton height={80} radius={1} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const total = days.reduce((n, d) => n + d.sessions.length, 0);
  if (total === 0) {
    return (
      <div className="ck-week-empty">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className="ck-week">
      {(title || toolbar) && (
        <div className="ck-week-toolbar">
          {title ? <div className="ck-week-toolbar-title">{title}</div> : <span />}
          {toolbar ? <div className="ck-week-toolbar-actions">{toolbar}</div> : null}
        </div>
      )}
      <div className="ck-week-grid" role="grid" aria-label="Lịch tuần">
        {days.map((day) => (
          <div
            key={day.key}
            className={[
              'ck-week-col',
              day.isToday ? 'is-today' : '',
              day.isWeekend ? 'is-weekend' : '',
              day.sessions.length === 0 ? 'is-empty' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="gridcell"
          >
            <div className="ck-week-head">
              <span className="ck-week-wd">{day.weekday}</span>
              <span className="ck-week-num">{day.dayNum}</span>
              {day.isToday ? <span className="ck-week-today-pill">Hôm nay</span> : null}
              {!day.isToday && day.caption ? (
                <span className="ck-week-cap">{day.caption}</span>
              ) : null}
              {day.sessions.length > 0 ? (
                <span className="ck-week-count">{day.sessions.length}</span>
              ) : null}
            </div>
            <div className="ck-week-body">
              {day.sessions.length === 0 ? (
                <div className="ck-week-gap">
                  <span className="ck-week-gap-dot" />
                  <span>Trống</span>
                </div>
              ) : (
                day.sessions.map((s, i) => (
                  <SessionCard
                    key={`${day.key}-${s.title}-${i}`}
                    {...s}
                    density={density}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      {showLegend ? (
        <div className="ck-week-legend" aria-hidden>
          <span className="ck-week-leg ck-week-leg--live">Đang học</span>
          <span className="ck-week-leg ck-week-leg--active">Trong kỳ</span>
          <span className="ck-week-leg ck-week-leg--attention">Chưa điểm danh</span>
          <span className="ck-week-leg ck-week-leg--planned">Sắp mở</span>
          <span className="ck-week-leg ck-week-leg--done">Kết thúc</span>
        </div>
      ) : null}
    </div>
  );
}
