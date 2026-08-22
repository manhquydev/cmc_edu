import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';

/** Route-level fallback for unknown paths and unsupported detail sections. */
export default function RouteNotFoundPage() {
  return (
    <>
      <PageHeader title="Không tìm thấy trang" breadcrumbs={[{ label: 'Không tìm thấy trang' }]} />
      <EmptyState
        title="Liên kết không tồn tại"
        description="URL không trỏ tới một màn hình được đăng ký. Kiểm tra lại liên kết hoặc quay về trang trước."
        icon={<LineIcon name="globe" size={28} />}
      />
    </>
  );
}
