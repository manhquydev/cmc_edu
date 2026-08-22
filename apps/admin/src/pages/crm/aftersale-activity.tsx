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

export function AfterSaleActivitySection({ caseId }: { caseId: string }) {
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [renderedCaseId, setRenderedCaseId] = useState(caseId);
  if (renderedCaseId !== caseId) {
    setRenderedCaseId(caseId);
    setMoreItems([]);
    setMoreNextCursor(undefined);
    setLoadError(null);
    requestGeneration.current += 1;
  }

  const { data: timeline, error, isError, isFetching } = trpc.afterSale.timeline.useQuery(
    { caseId },
    { enabled: Boolean(caseId) },
  );
  const utils = trpc.useUtils();

  const loadMore = async () => {
    const cursor = moreNextCursor === undefined ? timeline?.nextCursor : moreNextCursor;
    if (!cursor || isFetching) return;
    const generation = requestGeneration.current;
    setLoadError(null);
    try {
      const next = await utils.afterSale.timeline.fetch({ caseId, cursor });
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
    <SectionBlock title="Lịch sử vận hành" description="Ghi nhận mở case và đổi trạng thái.">
      {loadError ? <p role="alert">{loadError}</p> : null}
      {isError ? (
        <p role="alert">{error?.message ?? 'Không tải được lịch sử case.'}</p>
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
