// Hoàn tiền — residual item rolled in from `260707-0915-ui-implementation`
// phase-06 (2026-07-12). UNLIKE post-sale-meeting/aftersale, a real mutation
// already exists: `finance.refundCreate` (apps/api/src/finance/router.ts,
// permission `finance.refundCreate` — giam_doc_kinh_doanh only, append-only
// ledger capped at Receipt.netAmount). Flagged reason for staying an
// EmptyState (skip-build branch, per plan's residual note): no receipt-
// search/pick UX exists yet to resolve a `receiptId` for the mutation, and
// there is no refund-request queue/approval review screen — building a real
// form here would either hardcode a receiptId lookup UX (out of this
// phase's UI-nav scope) or invent an approval flow with no spec. Needs its
// own plan.
import { EmptyState, LineIcon, ListPage, PageHeader } from '@cmc/ui';

export default function RefundPage() {
  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Hoàn tiền"
          breadcrumbs={[{ label: 'Tài chính' }, { label: 'Hoàn tiền' }]}
        />
      }
      isEmpty
      empty={
        <EmptyState
          title="Tính năng chưa áp dụng"
          description="Hoàn tiền đã hỗ trợ ở backend nhưng chưa có màn tìm phiếu thu / duyệt hoàn tiền trên giao diện — cần plan UX riêng."
          icon={<LineIcon name="card" size={28} />}
        />
      }
    >
      {null}
    </ListPage>
  );
}
