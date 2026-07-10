// Homework results page — parent view (gap-closure 260710-0005 Phase 2).
//
// Calls submission.listForChild — submitted/graded exercises for one child,
// with GV score + Exercise.starReward. Draft submissions never appear
// (backend excludes them). Kind gate: reachable under ParentLayout only.

import { useParams, useNavigate } from 'react-router-dom';
import { Badge, Banner, Button, Heading, HStack, Spinner, Stack, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

export default function HomeworkResultsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  // Defense-in-depth: route-level ParentOnly guard is the primary gate.
  if (!session || session.kind !== 'parent') return null;

  const { data, isLoading, error } = trpc.submission.listForChild.useQuery(
    { studentId: studentId! },
    { enabled: !!studentId },
  );

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Button variant="ghost" size="sm" label="← Trang chủ" onClick={() => navigate('/parent/home')} />
        <Text className="lms-topbar__brand">Bài tập & điểm</Text>
        <div style={{ width: 60 }} />
      </div>

      <div className="lms-page">
        <Heading level={4} className="lms-page__title">Bài tập & điểm</Heading>

        {isLoading && <HStack justify="center"><Spinner /></HStack>}

        {error && (
          <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
        )}

        {data && data.items.length === 0 && (
          <Banner status="info" title="Con chưa nộp bài tập nào." />
        )}

        <Stack gap={1.5}>
          {data?.items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 16,
                border: '1px solid var(--cmc-border)',
                borderRadius: 'var(--cmc-radius-xs)',
              }}
            >
              <HStack justify="between" style={{ marginBottom: 4 }}>
                <Text weight="bold">{item.exerciseTitle}</Text>
                {item.status === 'graded' ? (
                  <Badge label={`${item.score} điểm`} variant="green" />
                ) : (
                  <Badge label="Chờ chấm" variant="neutral" />
                )}
              </HStack>
              <Text type="supporting" size="2xs">
                {item.submittedAt
                  ? `Nộp ngày ${new Date(item.submittedAt).toLocaleDateString('vi-VN')}`
                  : 'Chưa nộp'}
                {item.status === 'graded' && item.gradedAt
                  ? ` · Chấm ngày ${new Date(item.gradedAt).toLocaleDateString('vi-VN')} · +${item.starReward} sao`
                  : ''}
              </Text>
            </div>
          ))}
        </Stack>

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
