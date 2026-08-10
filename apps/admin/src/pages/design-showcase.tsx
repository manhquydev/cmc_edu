import { useState } from 'react';
import {
  DateField,
  DateTimeField,
  Heading,
  HStack,
  PageHeader,
  Stack,
  Text,
  TimeField,
  WorkflowStatusbar,
} from '@cmc/ui';

/**
 * Design-system showcase lab (observation page; deletable after review).
 *
 * REDUCED SCOPE — not the full original showcase. The earlier version of
 * this page (built in a prior session, ~1000 lines / 23 sections covering
 * every @cmc/ui export) never made it into version control before this
 * worktree was created from a fresh `develop` checkout, and its full
 * content could not be reconstructed faithfully from memory. Rather than
 * fabricate an approximation of that page and misrepresent it as verified,
 * this rebuild is intentionally scoped to what this session's Phase 1 work
 * actually needs to demonstrate: the new TimeField/DateTimeField components
 * and the redesigned WorkflowStatusbar. Restoring full ~23-section coverage
 * is tracked as follow-up work, not assumed done here.
 */
export default function DesignShowcasePage() {
  const [date, setDate] = useState('2026-08-10');
  const [time, setTime] = useState('08:30');
  const [dateTime, setDateTime] = useState('2026-08-10T08:30');
  const [stepIndex, setStepIndex] = useState(1);

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
