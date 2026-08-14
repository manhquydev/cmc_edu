import { useState } from 'react';
import {
  CountBadge,
  DataTable,
  DateField,
  DateTimeField,
  EmptyState,
  FilterBar,
  Heading,
  HStack,
  LineIcon,
  MetricCard,
  PageHeader,
  Stack,
  StatCard,
  StatusBadge,
  Text,
  TimeField,
  WorkflowStatusbar,
} from '@cmc/ui';

/**
 * Living gallery for the four admin families + the DateTime/Workflow lab.
 * Route: /admin/design. Observation page — not Storybook.
 */
export default function DesignShowcasePage() {
  const [date, setDate] = useState('2026-08-10');
  const [time, setTime] = useState('08:30');
  const [dateTime, setDateTime] = useState('2026-08-10T08:30');
  const [stepIndex, setStepIndex] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({
    status: '',
    from: '',
    q: '',
  });

  const steps = [
    { id: 's1', label: 'Tiếp nhận' },
    { id: 's2', label: 'Xác nhận' },
    { id: 's3', label: 'Xử lý' },
    { id: 's4', label: 'Hoàn tất' },
  ];

  return (
    <div className="console-page">
      <PageHeader title="Design System — CMC Console" breadcrumbs={[{ label: 'Design' }]} />
      <Stack gap={4} padding={4}>
        <Stack gap={2}>
          <Heading level={2}>StatCard / MetricCard</Heading>
          <Text type="supporting" size="sm">
            StatCard = `.console-mc.console-mc--static` (không hover lift). MetricCard = `Link.console-mc`.
          </Text>
          <HStack gap={2} wrap="wrap">
            <StatCard label="Tổng doanh thu" value="12.400.000 đ" trend="so với tháng trước" />
            <MetricCard
              label="Phiếu thu"
              value={3}
              context="Mở sổ"
              icon="receipt"
              href="/finance"
            />
          </HStack>
        </Stack>

        <Stack gap={2}>
          <Heading level={2}>StatusBadge / CountBadge</Heading>
          <Text type="supporting" size="sm">
            StatusBadge default md (pin padding). sm/lg = CSS. CountBadge không gộp vào status.
          </Text>
          <HStack gap={2} wrap="wrap">
            <StatusBadge status="active" label="Đang mở" />
            <StatusBadge status="pending" label="Chờ" size="sm" />
            <StatusBadge status="approved" label="Duyệt" size="lg" />
            <CountBadge count={4} emphasize />
          </HStack>
        </Stack>

        <Stack gap={2}>
          <Heading level={2}>EmptyState</Heading>
          <Text type="supporting" size="sm">
            `density=ops` cho list/table. Default giữ cỡ Astryx (403/permission-gate).
          </Text>
          <EmptyState
            density="ops"
            title="Không có dữ liệu"
            description="Empty ops — list/table."
            icon={<LineIcon name="layers" size={22} />}
          />
        </Stack>

        <Stack gap={2}>
          <Heading level={2}>FilterBar + DataTable</Heading>
          <Text type="supporting" size="sm">
            Child width 160/180 từ CSS, không inline. Pin cùng ListPage Học viên.
          </Text>
          <FilterBar
            filters={[
              {
                key: 'status',
                label: 'Trạng thái',
                type: 'select',
                options: [{ value: 'a', label: 'A' }],
              },
              { key: 'from', label: 'Từ ngày', type: 'date' },
              { key: 'q', label: 'Tìm', type: 'text', placeholder: 'Search' },
            ]}
            value={filters}
            onChange={setFilters}
          />
          <DataTable
            columns={[
              { key: 'name', label: 'Tên' },
              { key: 'status', label: 'Trạng thái' },
            ]}
            data={[
              { id: '1', name: 'Alpha', status: 'active' },
              { id: '2', name: 'Beta', status: 'pending' },
            ]}
          />
        </Stack>

        <Stack gap={2}>
          <Heading level={2}>Workflow statusbar</Heading>
          <Text type="supporting" size="sm">
            Chevron ProgressSteps — seam fix + 38px/16px layout, purple state hierarchy.
          </Text>
          <WorkflowStatusbar steps={steps} activeIndex={stepIndex} onStepClick={setStepIndex} />
        </Stack>

        <Stack gap={2}>
          <Heading level={2}>Date / Time / DateTime fields</Heading>
          <Text type="supporting" size="sm">
            TimeField/DateTimeField mirror DateField's structure exactly (native input, Odoo
            density tokens, no picker library).
          </Text>
          <HStack gap={2} wrap="wrap">
            <DateField label="Ngày (YYYY-MM-DD)" value={date} onChange={setDate} />
            <TimeField label="Giờ (HH:mm)" value={time} onChange={setTime} />
            <DateTimeField label="Ngày giờ" value={dateTime} onChange={setDateTime} />
          </HStack>
        </Stack>
      </Stack>
    </div>
  );
}
