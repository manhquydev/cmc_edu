// After-sale case — residual item rolled in from `260707-0915-ui-implementation`
// phase-06 (2026-07-12). No backend procedure exists for this flow yet (only
// `afterSale.manage` permission key is registered — no router). Premium
// coming-soon EmptyState only; do NOT build the feature here (needs its own
// plan).
import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';

export default function AfterSalePage() {
  return (
    <>
      <PageHeader
        title="Chăm sóc sau bán"
        subtitle="Theo dõi các case chăm sóc khách hàng sau bán"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Sau bán' }]}
      />
      <EmptyState
        title="Tính năng chưa áp dụng"
        description="Chưa có backend hỗ trợ quản lý case chăm sóc sau bán."
        icon={<LineIcon name="alert" size={28} />}
      />
    </>
  );
}
