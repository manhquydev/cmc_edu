import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Badge, Banner, Button, Grid, HStack, LineIcon, ListPage, PageHeader, Selector, Skeleton, Stack, Text, useToast } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useUnsavedBlocker } from '../../lib/use-unsaved-blocker.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttendanceStatus = 'present' | 'absent' | 'late';

interface RosterEntry {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  /** `null` = chưa điểm danh — distinct from any of the 3 real statuses, so
   * an untouched roster never gets silently persisted as "present". */
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

/** Shown for a roster row that has not been toggled yet (and had no prior
 * Attendance row) — distinct styling from `present` so a teacher can tell
 * "not marked" apart from "marked present" at a glance. */
const UNMARKED_CONFIG = { label: 'Chưa điểm danh', color: '#868e96', bg: '#f1f3f5' };

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
        borderRadius: 'var(--cmc-radius-control)',
        padding: 'var(--cmc-space-3) var(--cmc-keyline-x)',
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
  const cfg = entry.status ? STATUS_CONFIG[entry.status] : UNMARKED_CONFIG;

  return (
    <HStack
      justify="between"
      style={{
        paddingInline: 'var(--cmc-space-3)',
        paddingBlock: 'var(--cmc-space-2)',
        borderBottom: '1px solid var(--cmc-border)',
        minHeight: TOUCH_MIN_HEIGHT,
        background: 'var(--cmc-surface)',
      }}
    >
      <Text size="sm" weight="medium">
        {entry.fullName}
      </Text>

      {/* 3-state toggle — cycles present → late → absent → present. A row
          starting "Chưa điểm danh" moves to present on its first click.
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
  // Deep-link with session → Session Detail hub (RCWS). Keep picker page for bare /attendance.
  const deepSession = searchParams.get('session');

  // Deep-link: ?classBatch= preselects class once on mount; user can still change Selector.
  const [classBatchId, setClassBatchId] = useState<string | null>(
    () => searchParams.get('classBatch'),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Optional ?session= applied once sessions for the class have loaded.
  const initialSessionParamRef = useRef(searchParams.get('session'));
  const sessionHydratedRef = useRef(false);

  const [localStatus, setLocalStatus] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [saved, setSaved] = useState(false);
  /** True only after a user toggle — seed from server must not block navigation. */
  const [dirty, setDirty] = useState(false);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);
  const { dialog: leaveDialog } = useUnsavedBlocker({
    dirty,
    title: 'Rời trang điểm danh?',
    message: 'Thay đổi điểm danh chưa lưu sẽ bị mất. Bạn có chắc muốn rời đi?',
    confirmLabel: 'Rời trang',
    cancelLabel: 'Ở lại',
  });

  const { data: classData, isLoading: classLoading } = trpc.classBatch.list.useQuery({
    page: 1,
    pageSize: 100,
  });
  const { data: sessions, isLoading: sessionsLoading } = trpc.classSession.list.useQuery(
    { classBatchId: classBatchId! },
    { enabled: Boolean(classBatchId) },
  );
  const { data: studentsData } = trpc.classBatch.listStudents.useQuery(
    { classBatchId: classBatchId! },
    { enabled: Boolean(classBatchId) },
  );

  const {
    data,
    isLoading,
    error: listError,
  } = trpc.attendance.listBySession.useQuery(
    { sessionId: sessionId! },
    { enabled: Boolean(sessionId) },
  );

  const { success: toastSuccess } = useToast();
  const markAll = trpc.attendance.markAll.useMutation({
    onSuccess: () => {
      setSaved(true);
      setDirty(false);
      toastSuccess('Đã lưu điểm danh');
    },
  });

  // Hydrate session from URL only when that session exists in the loaded list.
  // Apply once so later Selector changes / leave-guard dirty state are not overwritten.
  useEffect(() => {
    if (sessionHydratedRef.current) return;
    const wanted = initialSessionParamRef.current;
    if (!wanted || !sessions) return;
    if (sessions.some((s) => s.id === wanted)) {
      setSessionId(wanted);
      sessionHydratedRef.current = true;
    }
  }, [sessions]);

  // Initialise local state when roster loads — only entries with an ALREADY
  // marked status are seeded; anything else stays absent from the map
  // (= "chưa điểm danh"), never defaulted to 'present'.
  useEffect(() => {
    if (!data?.items) return;
    const init: Record<string, AttendanceStatus> = {};
    for (const item of data.items) {
      if (item.status) init[item.enrollmentId] = item.status as AttendanceStatus;
    }
    setLocalStatus(init);
    setSaved(false);
    setDirty(false);
    setSaveValidationError(null);
  }, [data]);

  function selectClass(id: string | null) {
    setClassBatchId(id);
    setSessionId(null);
    setLocalStatus({});
    setSaved(false);
    setDirty(false);
    setSaveValidationError(null);
  }

  function selectSession(id: string | null) {
    setSessionId(id);
    setLocalStatus({});
    setSaved(false);
    setDirty(false);
    setSaveValidationError(null);
  }

  function toggleStatus(enrollmentId: string) {
    setLocalStatus((prev) => {
      const current = prev[enrollmentId];
      if (!current) return { ...prev, [enrollmentId]: 'present' };
      const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
      return { ...prev, [enrollmentId]: STATUS_CYCLE[nextIdx] };
    });
    setSaved(false);
    setDirty(true);
    setSaveValidationError(null);
  }

  const classOptions = (classData?.items ?? []).map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.program}`,
  }));
  const sessionOptions = (sessions ?? []).map((s) => ({
    value: s.id,
    label: `${new Date(s.sessionDate).toLocaleDateString('vi-VN')} | ${s.status}`,
  }));

  const nameByStudentId = new Map(
    ((studentsData ?? []) as Array<{ studentId: string; fullName: string }>).map((s) => [
      s.studentId,
      s.fullName,
    ]),
  );

  // Derive roster + counts from local toggle state
  const roster: RosterEntry[] = (data?.items ?? []).map((item) => ({
    enrollmentId: item.enrollmentId,
    studentId: item.studentId,
    fullName: nameByStudentId.get(item.studentId) ?? item.studentId.slice(0, 8),
    status: localStatus[item.enrollmentId] ?? null,
  }));

  const total = roster.length;
  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;
  const unmarkedCount = roster.filter((r) => r.status === null).length;

  function handleSave() {
    if (!sessionId) return;
    const entries = roster
      .filter((r): r is RosterEntry & { status: AttendanceStatus } => r.status !== null)
      .map((r) => ({ enrollmentId: r.enrollmentId, status: r.status }));

    // Bug fix: never silently mark the whole class 'present' just because
    // Save was clicked — require at least one row to have been explicitly
    // toggled, and tell the teacher when nothing was.
    if (entries.length === 0) {
      setSaveValidationError('Chưa có học sinh nào được điểm danh. Vui lòng chọn trạng thái cho ít nhất một học sinh trước khi lưu.');
      return;
    }
    setSaveValidationError(null);
    markAll.mutate({ sessionId, entries });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // After hooks: deep-link with session id opens the Session Detail hub.
  if (deepSession) {
    return <Navigate to={`/teaching/sessions/${deepSession}?tab=attendance`} replace />;
  }

  return (
    <>
    {leaveDialog}
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Điểm danh"
          subtitle={
            sessionId
              ? `Buổi học: ${sessionOptions.find((s) => s.value === sessionId)?.label ?? sessionId.slice(0, 8)}`
              : undefined
          }
          breadcrumbs={[{ label: 'Giảng dạy', href: '/teaching' }, { label: 'Điểm danh' }]}
          actions={
            sessionId ? (
              <Button
                label={saved ? 'Đã lưu' : 'Lưu điểm danh'}
                icon={saved ? <LineIcon name="check-circle" size={16} /> : undefined}
                size="sm"
                variant="primary"
                isLoading={markAll.isPending}
                isDisabled={isLoading || total === 0}
                onClick={handleSave}
                style={{ minHeight: TOUCH_MIN_HEIGHT }}
              />
            ) : undefined
          }
        />
      }
    >
      {/* Step 1+2: pick class -> session (same picker pattern as session-assessment.tsx) */}
      <div style={{ paddingInline: 'var(--cmc-space-3)', paddingBlock: 'var(--cmc-space-3)', borderBottom: '1px solid var(--cmc-border)' }}>
        <Stack gap={3}>
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
              1. Chọn lớp
            </Text>
            {classLoading ? (
              <Skeleton height={36} radius={1} />
            ) : (
              <Selector
                label="Chọn lớp học"
                isLabelHidden
                placeholder="Chọn lớp học"
                options={classOptions}
                value={classBatchId ?? undefined}
                onChange={(v) => selectClass(v ?? null)}
                hasSearch
                hasClear={false}
              />
            )}
          </div>

          {classBatchId && (
            <div>
              <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                2. Chọn buổi học
              </Text>
              {sessionsLoading ? (
                <Skeleton height={36} radius={1} />
              ) : (
                <Selector
                  label="Chọn buổi học"
                  isLabelHidden
                  placeholder="Chọn buổi"
                  options={sessionOptions}
                  value={sessionId ?? undefined}
                  onChange={(v) => selectSession(v ?? null)}
                  hasClear={false}
                />
              )}
            </div>
          )}
        </Stack>
      </div>

      {sessionId && (
        <>
          {/* Count tiles */}
          <div
            style={{
              paddingInline: 'var(--cmc-space-3)',
              paddingBlock: 'var(--cmc-space-2)',
              background: 'var(--cmc-surface-2)',
              borderBottom: '1px solid var(--cmc-border)',
            }}
          >
            <Grid columns={{ minWidth: 140, max: 5 }} gap={2}>
              <CountTile label="Tổng" count={total} color="var(--cmc-text)" />
              <CountTile label="Có mặt" count={presentCount} color="#2f9e44" />
              <CountTile label="Vắng" count={absentCount} color="#e03131" />
              <CountTile label="Muộn" count={lateCount} color="#e67700" />
              <CountTile label="Chưa điểm danh" count={unmarkedCount} color="#868e96" />
            </Grid>
          </div>

          {/* Error states */}
          {listError && (
            <div style={{ padding: 'var(--cmc-space-3)' }}>
              <Banner status="error" title="Lỗi tải danh sách" description={listError.message} />
            </div>
          )}
          {markAll.error && (
            <div style={{ paddingInline: 'var(--cmc-space-3)', paddingTop: 'var(--cmc-space-2)' }}>
              <Banner status="error" title="Lưu thất bại" description={markAll.error.message} />
            </div>
          )}
          {saveValidationError && (
            <div style={{ paddingInline: 'var(--cmc-space-3)', paddingTop: 'var(--cmc-space-2)' }}>
              <Banner status="warning" title="Chưa thể lưu" description={saveValidationError} />
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
                      paddingInline: 'var(--cmc-space-3)',
                      paddingBlock: 'var(--cmc-space-2)',
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
              <div style={{ padding: 'var(--cmc-space-4)' }}>
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
            <div style={{ paddingInline: 'var(--cmc-space-3)', paddingBlock: 'var(--cmc-space-2)' }}>
              <Badge
                label={`Điểm danh đã được lưu — ${presentCount} có mặt / ${lateCount} muộn / ${absentCount} vắng`}
                variant="success"
              />
            </div>
          )}
        </>
      )}
    </ListPage>
    </>
  );
}
