// Astryx spike sandbox (Phase 1 go/no-go gate) — dev-only route, registered
// behind import.meta.env.DEV in routes/index.tsx. Not linked from any nav.
// Exercises gate tests (a)-(e) from phase-01-spike-go-no-go-astryx-sandbox.md.
// Deleted at the end of Phase 1 (GO) or Phase 1 rollback (NO-GO).
import { useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Breadcrumbs, BreadcrumbItem } from '@astryxdesign/core/Breadcrumbs';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Selector } from '@astryxdesign/core/Selector';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Table } from '@astryxdesign/core/Table';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import './astryx-spike.css';

interface ReceiptRow extends Record<string, unknown> {
  id: string;
  code: string;
  studentName: string;
  className: string;
  amountVnd: number;
  status: 'paid' | 'pending' | 'overdue';
}

const VN_NAMES = [
  'Nguyễn Thị Minh Anh', 'Trần Văn Đức', 'Lê Hoàng Long', 'Phạm Thị Thu Hà',
  'Vũ Đình Khánh', 'Đặng Ngọc Bảo Trâm', 'Bùi Xuân Thắng', 'Đỗ Thị Quỳnh Nga',
  'Hồ Minh Triết', 'Ngô Thị Kiều Oanh', 'Dương Công Hiếu', 'Lý Gia Bảo',
  'Phan Thị Ánh Tuyết', 'Trịnh Văn Phúc', 'Đinh Thị Ngọc Diệp',
];
const CLASSES = ['Toán 6A1', 'Anh văn 7B2', 'Lý 8C1', 'Hóa 9A3', 'Văn 6B1'];
const STATUSES: ReceiptRow['status'][] = ['paid', 'pending', 'overdue'];

const receiptRows: ReceiptRow[] = Array.from({ length: 54 }, (_, i) => ({
  id: `r${i}`,
  code: `PT-2026-${String(1000 + i)}`,
  studentName: VN_NAMES[i % VN_NAMES.length],
  className: CLASSES[i % CLASSES.length],
  amountVnd: 850_000 + (i % 7) * 125_000,
  status: STATUSES[i % STATUSES.length],
}));

const statusBadge: Record<ReceiptRow['status'], { label: string; variant: 'success' | 'warning' | 'error' }> = {
  paid: { label: 'Đã thu', variant: 'success' },
  pending: { label: 'Chờ thu', variant: 'warning' },
  overdue: { label: 'Quá hạn', variant: 'error' },
};

function formatVnd(v: number): string {
  return new Intl.NumberFormat('vi-VN').format(v) + ' đ';
}

export function AstryxSpikePage() {
  const [density, setDensity] = useState<'compact' | 'balanced' | 'spacious'>('compact');
  const [feeAmount, setFeeAmount] = useState<number | null>(1_500_000);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  return (
    <AppShell
      contentPadding={0}
      topNav={
        <TopNav>
          <TopNavHeading>CMC Astryx Spike</TopNavHeading>
          <TopNavItem label="Tài chính" isSelected />
          <TopNavItem label="Học vụ" />
        </TopNav>
      }
      sideNav={
        <SideNav>
          <SideNavSection title="Tài chính">
            <SideNavItem label="Biên lai" isSelected />
            <SideNavItem label="Đối soát" />
          </SideNavSection>
        </SideNav>
      }
    >
      <div className="cmc-spike-root">
        <Breadcrumbs>
          <BreadcrumbItem href="#">Tài chính</BreadcrumbItem>
          <BreadcrumbItem isCurrent>Danh sách biên lai</BreadcrumbItem>
        </Breadcrumbs>

        {/* (c) Token mapping: brand button/badge/tab should reflect CMC
            --color-accent override defined in astryx-spike.css. */}
        <section className="cmc-spike-section">
          <h2>(c) Token mapping — CMC brand</h2>
          <div className="cmc-spike-row">
            <Button label="Duyệt & Kích hoạt" variant="primary" />
            <Button label="Gửi mã OTP qua email phụ huynh" variant="secondary" />
            <Button label="Xoá vĩnh viễn" variant="destructive" />
            <Badge label="Đã thu" variant="success" />
            <Badge label="Chờ thu" variant="warning" />
            <Badge label="Quá hạn" variant="error" />
          </div>
          <TabList value={activeTab} onChange={setActiveTab}>
            <Tab value="all" label="Tất cả" />
            <Tab value="pending" label="Chờ thu" />
            <Tab value="overdue" label="Quá hạn" />
          </TabList>
        </section>

        {/* (d) Vietnamese diacritics: long labels above must not overflow
            buttons; verify visually via dev route + screenshot. */}
        <section className="cmc-spike-section">
          <h2>(d) Form controls — số + chọn</h2>
          <div className="cmc-spike-row">
            <NumberInput
              label="Học phí tháng (VND)"
              value={feeAmount}
              onChange={setFeeAmount}
              units="đ"
              min={0}
              step={50000}
            />
            <Selector
              label="Mật độ bảng"
              value={density}
              onChange={(v) => setDensity(v as typeof density)}
              options={['compact', 'balanced', 'spacious']}
            />
          </div>
        </section>

        {/* (b) DataTable ERP density: >=50 VN rows, header uppercase via
            theme CSS, hover/selected/skeleton/empty states. */}
        <section className="cmc-spike-section">
          <h2>(b) DataTable ERP density ({receiptRows.length} dòng)</h2>
          <div className="cmc-spike-row">
            <Button
              label={showSkeleton ? 'Ẩn skeleton' : 'Xem skeleton loading'}
              variant="secondary"
              size="sm"
              onClick={() => setShowSkeleton((s) => !s)}
            />
            <Button
              label={showEmpty ? 'Xem dữ liệu' : 'Xem empty state'}
              variant="secondary"
              size="sm"
              onClick={() => setShowEmpty((s) => !s)}
            />
          </div>

          {showSkeleton ? (
            <Skeleton height={320} radius={2} />
          ) : showEmpty ? (
            <EmptyState
              title="Không có biên lai nào"
              description="Chưa có biên lai nào khớp với bộ lọc hiện tại."
            />
          ) : (
            <Table<ReceiptRow>
              data={receiptRows}
              idKey="id"
              density={density}
              dividers="rows"
              isStriped
              hasHover
              textOverflow="truncate"
              columns={[
                { key: 'code', header: 'Mã biên lai', width: { type: 'pixel', value: 140 } },
                { key: 'studentName', header: 'Học sinh', width: { type: 'proportional', value: 2 } },
                { key: 'className', header: 'Lớp', width: { type: 'proportional', value: 1 } },
                {
                  key: 'amountVnd',
                  header: 'Số tiền',
                  width: { type: 'pixel', value: 140 },
                  align: 'end',
                  renderCell: (row: ReceiptRow) => formatVnd(row.amountVnd),
                },
                {
                  key: 'status',
                  header: 'Trạng thái',
                  width: { type: 'pixel', value: 120 },
                  renderCell: (row: ReceiptRow) => {
                    const s = statusBadge[row.status];
                    return <Badge label={s.label} variant={s.variant} />;
                  },
                },
              ]}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
