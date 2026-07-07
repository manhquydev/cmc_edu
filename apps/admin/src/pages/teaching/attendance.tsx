import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttendanceStatus = 'present' | 'absent' | 'late';

interface RosterEntry {
  enrollmentId: string;
  studentId: string;
  status: AttendanceStatus | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  present: { label: 'Có mặt', color: '#2f9e44', bg: '#ebfbee' },
  absent: { label: 'Vắng', color: '#e03131', bg: '#fff5f5' },
  late: { label: 'Muộn', color: '#e67700', bg: '#fff9db' },
};

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent'];

/** Min-height for all interactive touch targets (tablet use). */
const TOUCH_MIN_HEIGHT = 44;

// ---------------------------------------------------------------------------
// Count tile
// ---------------------------------------------------------------------------

function CountTile({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <Box
      style={{
        background: 'var(--cmc-surface)',
        border: '1px solid var(--cmc-border)',
        borderRadius: 4,
        padding: '12px 16px',
        textAlign: 'center',
      }}
    >
      <Text fz={24} fw={700} style={{ color, lineHeight: 1.2 }}>
        {count}
      </Text>
      <Text fz="xs" c="dimmed" mt={2}>
        {label}
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Student row
// ---------------------------------------------------------------------------

function StudentRow({
  entry,
  onToggle,
}: {
  entry: RosterEntry;
  onToggle: (enrollmentId: string) => void;
}) {
  const currentStatus = entry.status ?? 'present';
  const cfg = STATUS_CONFIG[currentStatus];

  return (
    <Group
      justify="space-between"
      px="md"
      py="sm"
      style={{
        borderBottom: '1px solid var(--cmc-border)',
        minHeight: TOUCH_MIN_HEIGHT,
        background: 'var(--cmc-surface)',
      }}
    >
      {/* Student identity — show truncated studentId; fullName/parentPhone
          requires a student.getById procedure not yet exposed by the API. */}
      <Stack gap={2}>
        <Text fz="sm" fw={500}>
          {entry.studentId.slice(0, 8).toUpperCase()}
        </Text>
        <Text fz="xs" c="dimmed">
          ID: {entry.enrollmentId.slice(0, 8)}…
        </Text>
      </Stack>

      {/* 3-state toggle — cycles present → late → absent → present */}
      <Button
        size="sm"
        radius="xs"
        onClick={() => onToggle(entry.enrollmentId)}
        style={{
          minHeight: TOUCH_MIN_HEIGHT,
          minWidth: 96,
          background: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.color}`,
          fontWeight: 600,
        }}
        variant="default"
      >
        {cfg.label}
      </Button>
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session') ?? '';

  const [localStatus, setLocalStatus] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [saved, setSaved] = useState(false);

  const {
    data,
    isLoading,
    error: listError,
  } = trpc.attendance.listBySession.useQuery(
    { sessionId },
    { enabled: Boolean(sessionId) },
  );

  const markAll = trpc.attendance.markAll.useMutation({
    onSuccess: () => setSaved(true),
  });

  // Initialise local state when roster loads
  useEffect(() => {
    if (!data?.items) return;
    const init: Record<string, AttendanceStatus> = {};
    for (const item of data.items) {
      init[item.enrollmentId] = (item.status as AttendanceStatus) ?? 'present';
    }
    setLocalStatus(init);
    setSaved(false);
  }, [data]);

  function toggleStatus(enrollmentId: string) {
    setLocalStatus((prev) => {
      const current = prev[enrollmentId] ?? 'present';
      const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
      return { ...prev, [enrollmentId]: STATUS_CYCLE[nextIdx] };
    });
    setSaved(false);
  }

  function handleSave() {
    if (!sessionId || !data?.items.length) return;
    const entries = data.items.map((item) => ({
      enrollmentId: item.enrollmentId,
      status: localStatus[item.enrollmentId] ?? 'present',
    }));
    markAll.mutate({ sessionId, entries });
  }

  // Derive counts from local toggle state
  const roster: RosterEntry[] = (data?.items ?? []).map((item) => ({
    enrollmentId: item.enrollmentId,
    studentId: item.studentId,
    status: localStatus[item.enrollmentId] ?? null,
  }));

  const total = roster.length;
  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!sessionId) {
    return (
      <>
        <PageHeader
          title="Điểm danh"
          breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Điểm danh' }]}
        />
        <Box p="xl">
          <Alert color="yellow" title="Chưa chọn buổi học">
            Vui lòng cung cấp tham số <code>?session=&lt;sessionId&gt;</code> trên URL.
          </Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Điểm danh"
        subtitle={`Buổi học: ${sessionId.slice(0, 8)}…`}
        breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Điểm danh' }]}
        actions={
          <Button
            size="sm"
            radius="xs"
            loading={markAll.isPending}
            disabled={isLoading || total === 0}
            onClick={handleSave}
            style={{ minHeight: TOUCH_MIN_HEIGHT }}
          >
            {saved ? '✓ Đã lưu' : 'Lưu điểm danh'}
          </Button>
        }
      />

      {/* Count tiles */}
      <Box px="md" py="sm" style={{ background: 'var(--cmc-surface-2)', borderBottom: '1px solid var(--cmc-border)' }}>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <CountTile label="Tổng" count={total} color="var(--cmc-text)" />
          <CountTile label="Có mặt" count={presentCount} color="#2f9e44" />
          <CountTile label="Vắng" count={absentCount} color="#e03131" />
          <CountTile label="Muộn" count={lateCount} color="#e67700" />
        </SimpleGrid>
      </Box>

      {/* Error states */}
      {listError && (
        <Box p="md">
          <Alert color="red" title="Lỗi tải danh sách">
            {listError.message}
          </Alert>
        </Box>
      )}
      {markAll.error && (
        <Box px="md" pt="sm">
          <Alert color="red" title="Lưu thất bại">
            {markAll.error.message}
          </Alert>
        </Box>
      )}

      {/* Roster */}
      <Box>
        {isLoading ? (
          <Stack gap={0}>
            {Array.from({ length: 6 }, (_, i) => (
              <Box
                key={i}
                px="md"
                py="sm"
                style={{ borderBottom: '1px solid var(--cmc-border)', minHeight: TOUCH_MIN_HEIGHT }}
              >
                <Group justify="space-between">
                  <Skeleton height={14} width={120} radius="xs" />
                  <Skeleton height={36} width={96} radius="xs" />
                </Group>
              </Box>
            ))}
          </Stack>
        ) : roster.length === 0 ? (
          <Box p="xl">
            <Text c="dimmed" ta="center">
              Không có học sinh nào trong buổi học này.
            </Text>
          </Box>
        ) : (
          <Box>
            {roster.map((entry) => (
              <StudentRow key={entry.enrollmentId} entry={entry} onToggle={toggleStatus} />
            ))}
          </Box>
        )}
      </Box>

      {/* Session summary */}
      {saved && (
        <Box px="md" py="sm">
          <Badge color="green" size="md" radius="xs">
            Điểm danh đã được lưu — {presentCount} có mặt / {lateCount} muộn / {absentCount} vắng
          </Badge>
        </Box>
      )}
    </>
  );
}
