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

export function ShiftActivitySection({ registrationId }: { registrationId: string }) {
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [renderedId, setRenderedId] = useState(registrationId);
  if (renderedId !== registrationId) {
    setRenderedId(registrationId);
    setMoreItems([]);
    setMoreNextCursor(undefined);
    setLoadError(null);
    requestGeneration.current += 1;
  }

  const { data: timeline, error, isError, isFetching } = trpc.shift.timeline.useQuery(
    { registrationId },
    { enabled: Boolean(registrationId) },
  );
  const utils = trpc.useUtils();

  const loadMore = async () => {
    const cursor = moreNextCursor === undefined ? timeline?.nextCursor : moreNextCursor;
    if (!cursor || isFetching) return;
    const generation = requestGeneration.current;
    setLoadError(null);
    try {
      const next = await utils.shift.timeline.fetch({ registrationId, cursor });
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
    <SectionBlock title="Lịch sử vận hành" description="Ghi nhận nộp, duyệt, từ chối và huỷ đăng ký ca.">
      {loadError ? <p role="alert">{loadError}</p> : null}
      {isError ? (
        <p role="alert">{error?.message ?? 'Không tải được lịch sử đăng ký ca.'}</p>
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
