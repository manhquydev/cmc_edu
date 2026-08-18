// Staff activity section — operational timeline for one AppUser (Phase 4A).
//
// Shows business-history events recorded since the Staff rollout epoch
// (2026-08-18). Uses shared `RecordTimeline` component and `trpc.user.timeline`.

import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RecordTimeline, SectionBlock } from '@cmc/ui';
import type { RecordTimelineItem } from '@cmc/ui';
import { trpc } from '../../../lib/trpc.js';

interface StaffOutletContext {
  staff: { id: string };
  backPath: string;
}

type TimelinePage = {
  items: Array<Omit<RecordTimelineItem, 'payload'> & { payload?: unknown }>;
};

/** Unknown kinds serialize payload as null; RecordTimelineItem requires the
 *  key, so normalize pages rather than widening the shared type. */
function toItems(page: TimelinePage): RecordTimelineItem[] {
  return page.items.map((it) => ({ ...it, payload: it.payload ?? null }));
}

function StaffActivitySection() {
  const { staff } = useOutletContext<StaffOutletContext>();
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reset paginated state synchronously when the staff record changes, so a
  // different staff's first page never renders appended to stale pages.
  const [renderedStaffId, setRenderedStaffId] = useState(staff.id);
  if (renderedStaffId !== staff.id) {
    setRenderedStaffId(staff.id);
    setMoreItems([]);
    setMoreNextCursor(null);
    setLoadError(null);
  }

  const {
    data: timeline,
    isFetching: timelineFetching,
  } = trpc.user.timeline.useQuery(
    { appUserId: staff.id },
    { enabled: Boolean(staff.id) },
  );

  const utils = trpc.useUtils();

  const loadMore = async () => {
    const cursor = moreNextCursor ?? timeline?.nextCursor;
    if (!cursor || timelineFetching) return;
    setLoadError(null);
    try {
      const next = await utils.user.timeline.fetch({
        appUserId: staff.id,
        cursor,
      });
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
      description="Ghi nhận các thay đổi hồ sơ, phân quyền và trạng thái nhân viên."
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

export default StaffActivitySection;
