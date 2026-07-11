// Họp phụ huynh sau bán — residual item rolled in from
// `260707-0915-ui-implementation` phase-06 (2026-07-12). No backend
// procedure exists for this flow yet (only `parentMeeting.manage` permission
// key is registered — no router). Premium coming-soon EmptyState only;
// do NOT build the feature here (needs its own plan).
import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';

export default function PostSaleMeetingPage() {
  return (
    <>
      <PageHeader
        title="Họp phụ huynh sau bán"
        subtitle="Lên lịch và theo dõi họp phụ huynh sau khi ký hợp đồng"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Họp sau bán' }]}
      />
      <EmptyState
        title="Tính năng chưa áp dụng"
        description="Chưa có backend hỗ trợ lên lịch họp phụ huynh sau bán."
        icon={<LineIcon name="users" size={28} />}
      />
    </>
  );
}
