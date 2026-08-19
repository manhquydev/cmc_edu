// ParentAccount activity section — operational timeline for one parent.

import { useRef, useState } from 'react';
import { RecordTimeline, SectionBlock } from '@cmc/ui';
import type { RecordTimelineItem } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

type TimelinePage = {
  items: Array<Omit<RecordTimelineItem, 'payload'> & { payload?: unknown }>;
  nextCursor?: string | null;
  historySince?: string | Date | null;
};

function toItems(page: TimelinePage): RecordTimelineItem[] {
  return page.items.map((item) => ({ ...item, payload: item.payload ?? null }));
}

export function ParentActivitySection({ parentAccountId }: { parentAccountId: string }) {
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [renderedParentId, setRenderedParentId] = useState(parentAccountId);
  if (renderedParentId !== parentAccountId) {
    setRenderedParentId(parentAccountId);
    setMoreItems([]);
    setMoreNextCursor(undefined);
    setLoadError(null);
    requestGeneration.current += 1;
  }

  const {
    data: timeline,
    error: timelineError,
    isError: timelineIsError,
    isFetching: timelineFetching,
  } = trpc.parentAccount.timeline.useQuery(
    { parentAccountId },
    { enabled: Boolean(parentAccountId) },
  );
  const utils = trpc.useUtils();

  const loadMore = async () => {
    const cursor = moreNextCursor === undefined ? timeline?.nextCursor : moreNextCursor;
    if (!cursor || timelineFetching) return;
    const generation = requestGeneration.current;
    setLoadError(null);
    try {
      const next = await utils.parentAccount.timeline.fetch({ parentAccountId, cursor });
      if (generation !== requestGeneration.current) return;
      setMoreItems((previous) => [...previous, ...toItems(next)]);
      setMoreNextCursor(next.nextCursor);
    } catch {
      if (generation !== requestGeneration.current) return;
      setLoadError('Không tải được trang tiếp theo. Vui lòng thử lại.');
    }
  };

  const allItems = [...toItems(timeline ?? { items: [] }), ...moreItems];
  const effectiveNextCursor =
    moreNextCursor === undefined ? timeline?.nextCursor ?? null : moreNextCursor;

  return (
    <SectionBlock
      title="Lịch sử hoạt động"
      description="Ghi nhận liên kết con, cập nhật email và thay đổi trạng thái LMS."
    >
      {loadError ? <p role="alert">{loadError}</p> : null}
      {timelineIsError ? (
        <p role="alert">{timelineError?.message ?? 'Không tải được lịch sử hoạt động.'}</p>
      ) : (
        <RecordTimeline
          items={allItems}
          nextCursor={effectiveNextCursor}
          onLoadMore={loadMore}
          pending={timelineFetching}
          historySince={timeline?.historySince ? new Date(timeline.historySince) : null}
        />
      )}
    </SectionBlock>
  );
}

export default ParentActivitySection;
