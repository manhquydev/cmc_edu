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

export function ParentMeetingActivitySection({ meetingId }: { meetingId: string }) {
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [renderedMeetingId, setRenderedMeetingId] = useState(meetingId);
  if (renderedMeetingId !== meetingId) {
    setRenderedMeetingId(meetingId);
    setMoreItems([]);
    setMoreNextCursor(undefined);
    setLoadError(null);
    requestGeneration.current += 1;
  }

  const { data: timeline, error, isError, isFetching } = trpc.parentMeeting.timeline.useQuery(
    { meetingId },
    { enabled: Boolean(meetingId) },
  );
  const utils = trpc.useUtils();

  const loadMore = async () => {
    const cursor = moreNextCursor === undefined ? timeline?.nextCursor : moreNextCursor;
    if (!cursor || isFetching) return;
    const generation = requestGeneration.current;
    setLoadError(null);
    try {
      const next = await utils.parentMeeting.timeline.fetch({ meetingId, cursor });
      if (generation !== requestGeneration.current) return;
      setMoreItems((previous) => [...previous, ...toItems(next)]);
      setMoreNextCursor(next.nextCursor);
    } catch {
      if (generation !== requestGeneration.current) return;
      setLoadError('Không tải được trang tiếp theo. Vui lòng thử lại.');
    }
  };

  const allItems = [...toItems(timeline ?? { items: [] }), ...moreItems];
  const nextCursor = moreNextCursor === undefined ? timeline?.nextCursor ?? null : moreNextCursor;
  return (
    <SectionBlock title="Lịch sử vận hành" description="Ghi nhận đặt lịch, hoàn thành và huỷ cuộc họp.">
      {loadError ? <p role="alert">{loadError}</p> : null}
      {isError ? (
        <p role="alert">{error?.message ?? 'Không tải được lịch sử cuộc họp.'}</p>
      ) : (
        <RecordTimeline
          items={allItems}
          nextCursor={nextCursor}
          onLoadMore={loadMore}
          pending={isFetching}
          historySince={timeline?.historySince ? new Date(timeline.historySince) : null}
        />
      )}
    </SectionBlock>
  );
}
