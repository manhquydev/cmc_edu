import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from './empty-state.js';
import { LineIcon } from './line-icon.js';
import { Panel } from './panel.js';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { TaskRow, type TaskRowProps } from './task-row.js';

export interface WorkInboxSection {
  id: string;
  label: string;
  items: TaskRowProps[];
}

export interface WorkInboxProps {
  title?: string;
  /** Total items for header badge. */
  count?: number;
  /** Optional “view all” link in header. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Flat list (used when no sections). */
  items?: TaskRowProps[];
  /** Grouped sections (Khẩn / Hôm nay / …). Prefer over flat when set. */
  sections?: WorkInboxSection[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

function flatFromSections(sections: WorkInboxSection[]): TaskRowProps[] {
  return sections.flatMap((s) => s.items);
}

/** Work queue panel: count badge, optional sections, TaskRows, empty CTA. */
export function WorkInbox({
  title = 'Việc cần bạn xử lý',
  count,
  viewAllHref,
  viewAllLabel = 'Xem tất cả',
  items,
  sections,
  loading,
  emptyTitle = 'Không có nhiệm vụ chờ xử lý',
  emptyDescription = 'Khi có việc mới, danh sách sẽ hiện tại đây.',
  emptyAction,
}: WorkInboxProps) {
  const rows = sections ? flatFromSections(sections) : (items ?? []);
  const total = count ?? rows.length;
  const titleWithCount = total > 0 ? `${title} · ${total}` : title;

  const headerAction =
    viewAllHref && total > 0 ? (
      <Link to={viewAllHref} className="console-pnl-action">
        {viewAllLabel}
        <LineIcon name="chevron" size={14} />
      </Link>
    ) : undefined;

  return (
    <Panel title={titleWithCount} action={headerAction}>
      {loading ? (
        <div className="console-inbox-skel">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={40} radius={1} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="console-inbox-empty">
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={<LineIcon name="check-circle" size={22} />}
            action={emptyAction}
          />
        </div>
      ) : sections && sections.length > 0 ? (
        <div className="console-inbox">
          {sections.map((sec) =>
            sec.items.length === 0 ? null : (
              <div key={sec.id} className="console-inbox-section">
                <div className="console-inbox-section-label">{sec.label}</div>
                {sec.items.map((item, i) => (
                  <TaskRow key={`${sec.id}-${i}`} {...item} />
                ))}
              </div>
            ),
          )}
        </div>
      ) : (
        <div>
          {rows.map((item, i) => (
            <TaskRow key={i} {...item} />
          ))}
        </div>
      )}
    </Panel>
  );
}
