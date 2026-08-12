// Student home — star balance hero + exercise list (locked/unlocked).
//
// C5 invariants enforced here:
//   - No sibling list: student sees only their own data (studentId from session).
//   - No parent-only actions (consent toggle, reset-password, sibling links)
//     are rendered anywhere on this page.
//   - StudentLayout redirects to /student/change-password if mustChangePassword.
//
// exercise.openForStudent returns delivery slots open for THIS student
// (SessionExercise + dual-gate roster). Each item has sessionExerciseId —
// same catalog exercise re-delivered ⇒ a new list row / new submission target.
//
// Star balance comes from gift.listForStudent (combined endpoint: gifts + balance).

import { Navigate, useNavigate } from 'react-router-dom';
import { Badge, Banner, Button, Heading, HStack, Spinner, Stack, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

// Star balance hero — reads from gift.listForStudent (combined endpoint).
function StarBalanceHero() {
  const { data, isLoading } = trpc.gift.listForStudent.useQuery();
  const balance = data?.starBalance ?? 0;

  return (
    <div className="lms-star-hero">
      {isLoading ? (
        <Spinner shade="onMedia" size="sm" />
      ) : (
        <>
          <Text className="lms-star-hero__value">⭐ {balance}</Text>
          <Text className="lms-star-hero__label">Số sao hiện có</Text>
        </>
      )}
    </div>
  );
}

// Exercise list — one row per open delivery (backend-gated, SessionExercise).
function ExerciseList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = trpc.exercise.openForStudent.useQuery();

  if (isLoading) return <HStack justify="center"><Spinner /></HStack>;
  if (error) return <Banner status="error" title={error.message} />;

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <Banner
        status="info"
        title="Chưa có bài tập nào mở. Bài sẽ xuất hiện sau khi buổi học kết thúc và được phát bài."
      />
    );
  }

  // Same catalog exercise can appear more than once (re-delivery). Count by
  // exercise.id so we can label "lần 1 / lần 2" without sessionDate from API.
  const deliveryOrdinalBySe = new Map<string, number>();
  const countByExercise = new Map<string, number>();
  for (const item of items) {
    const n = (countByExercise.get(item.id) ?? 0) + 1;
    countByExercise.set(item.id, n);
    deliveryOrdinalBySe.set(item.sessionExerciseId, n);
  }

  return (
    <Stack gap={1.5}>
      {items.map((item) => {
        const totalForCatalog = countByExercise.get(item.id) ?? 1;
        const ordinal = deliveryOrdinalBySe.get(item.sessionExerciseId) ?? 1;
        const multi = totalForCatalog > 1;
        return (
          <div
            key={item.sessionExerciseId}
            style={{
              padding: 16,
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              background: 'var(--cmc-surface)',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/student/exercise/${item.sessionExerciseId}`)}
          >
            <HStack justify="between" style={{ marginBottom: 4 }}>
              <Text weight="bold" size="sm">{item.title}</Text>
              <Badge label={`Mở — ${item.starReward} sao`} variant="green" />
            </HStack>
            <Text type="supporting" size="2xs">
              Điểm tối đa: {item.maxScore}
              {multi
                ? ` · Lần phát ${ordinal}/${totalForCatalog} (làm mới, không phải bài cũ)`
                : ' · Bài đã phát cho buổi học'}
            </Text>
          </div>
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function StudentHomePage() {
  const { session, logout } = useSession();
  const navigate = useNavigate();

  // mustChangePassword gate. This is the ONLY effective mCP gate for
  // /student/home — the StudentOnly route guard (kind-guard.tsx) checks only
  // session.kind, not mustChangePassword. `<Navigate>` (not a render-body
  // navigate() call) — same side-effect-in-render hygiene as the P1-07 fix on
  // the login/change-password pages.
  if (session?.mustChangePassword) {
    return <Navigate to="/student/change-password" replace />;
  }

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Text className="lms-topbar__brand">CMC EDU — Học sinh</Text>
        <HStack gap={1}>
          <Button variant="ghost" size="sm" label="Đổi quà" onClick={() => navigate('/student/gifts')} />
          <Button
            size="sm"
            variant="ghost"
            label="Đăng xuất"
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
          />
        </HStack>
      </div>

      <div className="lms-page">
        <StarBalanceHero />

        <Heading level={4} className="lms-page__title">Bài tập của tôi</Heading>
        <ExerciseList />
      </div>
    </div>
  );
}
