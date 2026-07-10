// Report card page — parent view.
//
// Calls reportCard.getForChild (confirmed assessments + final grade +
// attendance rate for a specific period). Defaults to the current month.
//
// Kind gate: reachable under ParentLayout only.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  Heading,
  HStack,
  ProgressBar,
  Selector,
  Spinner,
  Stack,
  Text,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

function currentPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Last 12 months as { value, label } for the period selector. */
function recentPeriods(): Array<{ value: string; label: string }> {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' });
    result.push({ value, label });
  }
  return result;
}

export default function ReportCardPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const [period, setPeriod] = useState(currentPeriod());

  // Defense-in-depth: route-level ParentOnly guard is the primary gate.
  if (!session || session.kind !== 'parent') return null;

  const { data, isLoading, error } = trpc.reportCard.getForChild.useQuery(
    { studentId: studentId!, period },
    { enabled: !!studentId && !!period },
  );

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Button variant="ghost" size="sm" label="← Trang chủ" onClick={() => navigate('/parent/home')} />
        <Text className="lms-topbar__brand">Học bạ</Text>
        <div style={{ width: 60 }} />
      </div>

      <div className="lms-page">
        <Heading level={4} className="lms-page__title">Kết quả học tập</Heading>

        <div style={{ marginBottom: 24 }}>
          <Selector
            label="Kỳ học"
            options={recentPeriods()}
            value={period}
            onChange={(v) => v && setPeriod(v)}
          />
        </div>

        {isLoading && <HStack justify="center"><Spinner /></HStack>}

        {error && <Banner status="error" title="Lỗi" description={error.message} />}

        {data && (
          <Stack gap={3}>
            {/* Attendance rate */}
            <div
              style={{ padding: 16, border: '1px solid var(--cmc-border)', borderRadius: 'var(--cmc-radius-xs)' }}
            >
              <Text weight="bold" display="block" style={{ marginBottom: 8 }}>Tỷ lệ chuyên cần</Text>
              <ProgressBar
                label="Tỷ lệ chuyên cần"
                isLabelHidden
                value={Math.round(data.attendanceRate * 100)}
                max={100}
                variant={data.attendanceRate >= 0.8 ? 'success' : 'warning'}
              />
              <Text type="supporting" size="sm" style={{ marginTop: 4 }}>
                {(data.attendanceRate * 100).toFixed(1)}%
              </Text>
            </div>

            {/* Final grade */}
            {data.finalGrade ? (
              <div
                style={{ padding: 16, border: '1px solid var(--cmc-border)', borderRadius: 'var(--cmc-radius-xs)' }}
              >
                <Text weight="bold" display="block" style={{ marginBottom: 8 }}>Điểm tổng kết</Text>
                {/* TODO(astryx-review): raw cmc-brand CSS var has no Astryx TextColor
                    equivalent (enum is primary/secondary/disabled/placeholder/accent/inherit) —
                    kept as a plain styled span to preserve the exact brand color. */}
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--cmc-brand)' }}>
                  {data.finalGrade.score.toFixed(1)}
                </span>
              </div>
            ) : (
              <Banner status="info" title="Chưa có điểm tổng kết trong kỳ này." />
            )}

            {/* Confirmed assessments */}
            <div>
              <Text weight="bold" display="block" style={{ marginBottom: 8 }}>Nhận xét đã xác nhận</Text>
              {data.assessments.length === 0 ? (
                <Text type="supporting" size="sm">Chưa có nhận xét nào.</Text>
              ) : (
                <Stack gap={1}>
                  {data.assessments.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: 12,
                        border: '1px solid var(--cmc-border)',
                        borderRadius: 'var(--cmc-radius-xs)',
                        background: 'var(--cmc-surface-2)',
                      }}
                    >
                      <Text type="supporting" size="2xs" display="block" style={{ marginBottom: 4 }}>
                        {a.confirmedAt
                          ? new Date(a.confirmedAt).toLocaleDateString('vi-VN')
                          : '—'}
                      </Text>
                      <Text type="body" size="sm">{a.content}</Text>
                    </div>
                  ))}
                </Stack>
              )}
            </div>
          </Stack>
        )}

        <Button
          variant="ghost"
          style={{ marginTop: 24 }}
          label="← Quay lại"
          onClick={() => navigate('/parent/home')}
        />
      </div>
    </div>
  );
}
