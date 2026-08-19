// Student activity section — operational timeline for one Student
// (resource-depth Phase 6, module 2). Shows business-history events recorded
// since the Student rollout epoch. Uses the shared `RecordTimeline` component
// and `trpc.student.timeline`.

import { useState } from 'react';
import { RecordTimeline, SectionBlock } from '@cmc/ui';
import type { RecordTimelineItem } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

type TimelinePage = {
  items: Array<Omit<RecordTimelineItem, 'payload'> & { payload?: unknown }>;
};

/** Unknown kinds serialize payload as null; RecordTimelineItem requires the
 *  key, so normalize pages rather than widening the shared type. */
function toItems(page: TimelinePage): RecordTimelineItem[] {
  return page.items.map((it) => ({ ...it, payload: it.payload ?? null }));
}

export function StudentActivitySection({ studentId }: { studentId: string }) {
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reset paginated state synchronously when the student changes, so a
  // different student's first page never renders appended to stale pages.
  const [renderedStudentId, setRenderedStudentId] = useState(studentId);
  if (renderedStudentId !== studentId) {
    setRenderedStudentId(studentId);
    setMoreItems([]);
    setMoreNextCursor(null);
    setLoadError(null);
  }

  const {
    data: timeline,
    isFetching: timelineFetching,
  } = trpc.student.timeline.useQuery(
    { studentId },
    { enabled: Boolean(studentId) },
  );

  const utils = trpc.useUtils();

  const loadMore = async () => {
    const cursor = moreNextCursor ?? timeline?.nextCursor;
    if (!cursor || timelineFetching) return;
    setLoadError(null);
    try {
      const next = await utils.student.timeline.fetch({ studentId, cursor });
      const page = toItems(next);
      setMoreItems((prev) => [...prev, ...page]);
      setMoreNextCursor(next.nextCursor);
    } catch {
      setLoadError('Không tải được trang tiếp theo. Vui lòng thử lại.');
    }
  };

  const allItems = [...toItems(timeline ?? { items: [] }), ...moreItems];
  const effectiveNextCursor = moreNextCursor ?? timeline?.nextCursor ?? null;

  return (
    <SectionBlock
      title="Lịch sử hoạt động"
      description="Ghi nhận tạo hồ sơ, liên kết phụ huynh, xếp lớp, đổi trạng thái và đặt lại mật khẩu."
    >
      {loadError && <p role="alert">{loadError}</p>}
      <RecordTimeline
        items={allItems}
        nextCursor={effectiveNextCursor}
        onLoadMore={loadMore}
        pending={timelineFetching}
        historySince={timeline?.historySince ? new Date(timeline.historySince) : null}
      />
    </SectionBlock>
  );
}

export default StudentActivitySection;
