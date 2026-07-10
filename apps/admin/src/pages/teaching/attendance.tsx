import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Banner, Button, Grid, HStack, PageHeader, Skeleton, Stack, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

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
    <div
      style={{
        background: 'var(--cmc-surface)',
        border: '1px solid var(--cmc-border)',
        borderRadius: 4,
        padding: '12px 16px',
        textAlign: 'center',
      }}
    >
      {/* TODO(astryx-review): raw hex/CSS-var color per tile (count values use
          semantic red/green/orange from STATUS_CONFIG, not Text's fixed color
          enum) — kept as plain <span style> per the documented fallback for
          arbitrary-color text (same pattern as StatCard's value line). */}
      <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color }}>
        {count}
      </span>
      <Text type="supporting" size="xsm" style={{ marginTop: 2 }}>
        {label}
      </Text>
    </div>
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
    <HStack
      justify="between"
      style={{
        paddingInline: 16,
        paddingBlock: 8,
        borderBottom: '1px solid var(--cmc-border)',
        minHeight: TOUCH_MIN_HEIGHT,
        background: 'var(--cmc-surface)',
      }}
    >
      {/* Student identity — show truncated studentId; fullName/parentPhone
          requires a student.getById procedure not yet exposed by the API. */}
      <Stack gap={0.5}>
        <Text size="sm" weight="medium">
          {entry.studentId.slice(0, 8).toUpperCase()}
        </Text>
        <Text type="supporting" size="xsm">
          ID: {entry.enrollmentId.slice(0, 8)}…
        </Text>
      </Stack>

      {/* 3-state toggle — cycles present → late → absent → present.
          TODO(astryx-review): raw per-status hex bg/color/border (tablet
          touch-target status toggle, TL12 §7) has no Astryx Button variant
          equivalent — kept via style override on a secondary-variant Button,
          same escape hatch already accepted for Badge in opportunity-detail
          and crm/pipeline. */}
      <Button
        label={cfg.label}
        size="sm"
        variant="secondary"
        onClick={() => onToggle(entry.enrollmentId)}
        style={{
          minHeight: TOUCH_MIN_HEIGHT,
          minWidth: 96,
          background: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.color}`,
          fontWeight: 600,
        }}
      />
    </HStack>
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
        <div style={{ padding: 32 }}>
          <Banner
            status="warning"
            title="Chưa chọn buổi học"
            description={
              <>
                Vui lòng cung cấp tham số <code>?session=&lt;sessionId&gt;</code> trên URL.
              </>
            }
          />
        </div>
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
            label={saved ? '✓ Đã lưu' : 'Lưu điểm danh'}
            size="sm"
            variant="primary"
            isLoading={markAll.isPending}
            isDisabled={isLoading || total === 0}
            onClick={handleSave}
            style={{ minHeight: TOUCH_MIN_HEIGHT }}
          />
        }
      />

      {/* Count tiles */}
      <div
        style={{
          paddingInline: 16,
          paddingBlock: 8,
          background: 'var(--cmc-surface-2)',
          borderBottom: '1px solid var(--cmc-border)',
        }}
      >
        <Grid columns={{ minWidth: 140, max: 4 }} gap={2}>
          <CountTile label="Tổng" count={total} color="var(--cmc-text)" />
          <CountTile label="Có mặt" count={presentCount} color="#2f9e44" />
          <CountTile label="Vắng" count={absentCount} color="#e03131" />
          <CountTile label="Muộn" count={lateCount} color="#e67700" />
        </Grid>
      </div>

      {/* Error states */}
      {listError && (
        <div style={{ padding: 16 }}>
          <Banner status="error" title="Lỗi tải danh sách" description={listError.message} />
        </div>
      )}
      {markAll.error && (
        <div style={{ paddingInline: 16, paddingTop: 8 }}>
          <Banner status="error" title="Lưu thất bại" description={markAll.error.message} />
        </div>
      )}

      {/* Roster */}
      <div>
        {isLoading ? (
          <Stack gap={0}>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                style={{
                  paddingInline: 16,
                  paddingBlock: 8,
                  borderBottom: '1px solid var(--cmc-border)',
                  minHeight: TOUCH_MIN_HEIGHT,
                }}
              >
                <HStack justify="between">
                  <Skeleton height={14} width={120} radius={1} />
                  <Skeleton height={36} width={96} radius={1} />
                </HStack>
              </div>
            ))}
          </Stack>
        ) : roster.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Text type="supporting" size="sm" justify="center" display="block">
              Không có học sinh nào trong buổi học này.
            </Text>
          </div>
        ) : (
          <div>
            {roster.map((entry) => (
              <StudentRow key={entry.enrollmentId} entry={entry} onToggle={toggleStatus} />
            ))}
          </div>
        )}
      </div>

      {/* Session summary */}
      {saved && (
        <div style={{ paddingInline: 16, paddingBlock: 8 }}>
          <Badge
            label={`Điểm danh đã được lưu — ${presentCount} có mặt / ${lateCount} muộn / ${absentCount} vắng`}
            variant="success"
          />
        </div>
      )}
    </>
  );
}
