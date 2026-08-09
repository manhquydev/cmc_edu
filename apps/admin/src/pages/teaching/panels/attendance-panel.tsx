/**
 * Session-scoped attendance roster — no class/session pickers.
 */
import { useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  Grid,
  HStack,
  LineIcon,
  Skeleton,
  Stack,
  Text,
} from '@cmc/ui';
import { trpc } from '../../../lib/trpc.js';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface RosterEntry {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  status: AttendanceStatus | null;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present: { label: 'Có mặt', color: 'var(--cmc-success-ink)', bg: 'var(--cmc-success-soft)' },
  absent: { label: 'Vắng', color: 'var(--cmc-danger-ink)', bg: 'var(--cmc-danger-soft)' },
  late: { label: 'Muộn', color: 'var(--cmc-warning-ink)', bg: 'var(--cmc-warning-soft)' },
};

const UNMARKED_CONFIG = { label: 'Chưa điểm danh', color: '#868e96', bg: '#f1f3f5' };
const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent'];
const TOUCH_MIN_HEIGHT = 44;

function CountTile({ label, count, color }: { label: string; count: number; color: string }) {
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
      <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color }}>{count}</span>
      <Text type="supporting" size="xsm" style={{ marginTop: 2 }}>
        {label}
      </Text>
    </div>
  );
}

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
      <Button
        label={cfg.label}
        size="sm"
        variant="secondary"
        onClick={() => onToggle(entry.enrollmentId)}
        style={{
          minHeight: TOUCH_MIN_HEIGHT,
          minWidth: 96,
          color: cfg.color,
          background: cfg.bg,
          borderColor: cfg.color,
        }}
      />
    </HStack>
  );
}

export interface AttendancePanelProps {
  sessionId: string;
  classBatchId: string;
  embedded?: boolean;
}

export function AttendancePanel({ sessionId, classBatchId }: AttendancePanelProps) {
  const [localStatus, setLocalStatus] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);

  const { data: studentsData } = trpc.classBatch.listStudents.useQuery(
    { classBatchId },
    { enabled: Boolean(classBatchId) },
  );

  const {
    data,
    isLoading,
    error: listError,
  } = trpc.attendance.listBySession.useQuery({ sessionId }, { enabled: Boolean(sessionId) });

  const utils = trpc.useUtils();
  const markAll = trpc.attendance.markAll.useMutation({
    onSuccess: () => {
      setSaved(true);
      void utils.classSession.doneProgress.invalidate({ sessionId });
      void utils.attendance.listBySession.invalidate({ sessionId });
    },
  });

  useEffect(() => {
    if (!data?.items) return;
    const init: Record<string, AttendanceStatus> = {};
    for (const item of data.items) {
      if (item.status) init[item.enrollmentId] = item.status as AttendanceStatus;
    }
    setLocalStatus(init);
    setSaved(false);
    setSaveValidationError(null);
  }, [data]);

  function toggleStatus(enrollmentId: string) {
    setLocalStatus((prev) => {
      const current = prev[enrollmentId];
      if (!current) return { ...prev, [enrollmentId]: 'present' };
      const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
      return { ...prev, [enrollmentId]: STATUS_CYCLE[nextIdx]! };
    });
    setSaved(false);
    setSaveValidationError(null);
  }

  const nameByStudentId = new Map(
    ((studentsData ?? []) as Array<{ studentId: string; fullName: string }>).map((s) => [
      s.studentId,
      s.fullName,
    ]),
  );

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
    const entries = roster
      .filter((r): r is RosterEntry & { status: AttendanceStatus } => r.status !== null)
      .map((r) => ({ enrollmentId: r.enrollmentId, status: r.status }));

    if (entries.length === 0) {
      setSaveValidationError(
        'Chưa có học sinh nào được điểm danh. Vui lòng chọn trạng thái cho ít nhất một học sinh trước khi lưu.',
      );
      return;
    }
    setSaveValidationError(null);
    markAll.mutate({ sessionId, entries });
  }

  return (
    <>
      <div
        style={{
          paddingInline: 'var(--cmc-space-3)',
          paddingBlock: 'var(--cmc-space-2)',
          display: 'flex',
          justifyContent: 'flex-end',
          borderBottom: '1px solid var(--cmc-border)',
        }}
      >
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
      </div>

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
          <CountTile label="Có mặt" count={presentCount} color="var(--cmc-success-ink)" />
          <CountTile label="Vắng" count={absentCount} color="var(--cmc-danger-ink)" />
          <CountTile label="Muộn" count={lateCount} color="var(--cmc-warning-ink)" />
          <CountTile label="Chưa điểm danh" count={unmarkedCount} color="#868e96" />
        </Grid>
      </div>

      {listError ? (
        <div style={{ padding: 'var(--cmc-space-3)' }}>
          <Banner status="error" title="Lỗi tải danh sách" description={listError.message} />
        </div>
      ) : null}
      {markAll.error ? (
        <div style={{ paddingInline: 'var(--cmc-space-3)', paddingTop: 'var(--cmc-space-2)' }}>
          <Banner status="error" title="Lưu thất bại" description={markAll.error.message} />
        </div>
      ) : null}
      {saveValidationError ? (
        <div style={{ paddingInline: 'var(--cmc-space-3)', paddingTop: 'var(--cmc-space-2)' }}>
          <Banner status="warning" title="Chưa thể lưu" description={saveValidationError} />
        </div>
      ) : null}

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
          roster.map((entry) => (
            <StudentRow key={entry.enrollmentId} entry={entry} onToggle={toggleStatus} />
          ))
        )}
      </div>

      {saved ? (
        <div style={{ paddingInline: 'var(--cmc-space-3)', paddingBlock: 'var(--cmc-space-2)' }}>
          <Badge
            label={`Điểm danh đã được lưu — ${presentCount} có mặt / ${lateCount} muộn / ${absentCount} vắng`}
            variant="success"
          />
        </div>
      ) : null}
    </>
  );
}
