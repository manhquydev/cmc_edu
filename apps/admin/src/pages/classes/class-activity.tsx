// Class activity section — operational timeline for one ClassBatch
// (resource-depth Phase 6, module 1). Shows business-history events recorded
// since the Class rollout epoch. Uses the shared `RecordTimeline` component
// and `trpc.classBatch.timeline`.

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

export function ClassActivitySection({ classBatchId }: { classBatchId: string }) {
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reset paginated state synchronously when the class changes, so a
  // different class's first page never renders appended to stale pages.
  const [renderedClassId, setRenderedClassId] = useState(classBatchId);
  if (renderedClassId !== classBatchId) {
    setRenderedClassId(classBatchId);
    setMoreItems([]);
    setMoreNextCursor(null);
    setLoadError(null);
  }

  const {
    data: timeline,
    isFetching: timelineFetching,
  } = trpc.classBatch.timeline.useQuery(
    { classBatchId },
    { enabled: Boolean(classBatchId) },
  );

  const utils = trpc.useUtils();

  const loadMore = async () => {
    const cursor = moreNextCursor ?? timeline?.nextCursor;
    if (!cursor || timelineFetching) return;
    setLoadError(null);
    try {
      const next = await utils.classBatch.timeline.fetch({ classBatchId, cursor });
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
      description="Ghi nhận mở lớp, đổi giáo viên, khung giờ, buổi học và học viên vào lớp."
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

export default ClassActivitySection;
