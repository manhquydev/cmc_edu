// Netflix-style child picker. Only for kind:'family'. Changing child is
// client state — no token remint.

import { Navigate, useNavigate } from 'react-router-dom';
import { Heading, Stack, Text } from '@cmc/ui';
import { isParentDoorKind } from '../lib/lms-kind.js';
import { setActiveStudentId } from '../lib/trpc.js';
import { useSession } from '../lib/session-context.js';

export default function SelectProfilePage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const children = session?.children ?? [];

  if (!session || session.kind !== 'family') {
    return <Navigate to={isParentDoorKind(session?.kind) ? '/parent/home' : '/login'} replace />;
  }

  if (children.length <= 1) {
    if (children[0]) setActiveStudentId(children[0].studentId);
    return <Navigate to="/parent/home" replace />;
  }

  return (
    <div className="lms-shell" style={{ padding: '2rem 1rem' }}>
      <Stack gap={4} hAlign="center">
        <Heading level={2} style={{ color: 'var(--cmc-brand)' }}>
          Ai đang học hôm nay?
        </Heading>
        <Text type="supporting">Chọn hồ sơ — không cần đăng nhập lại.</Text>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'center',
            maxWidth: 720,
          }}
        >
          {children.map((child) => (
            <button
              key={child.studentId}
              type="button"
              onClick={() => {
                setActiveStudentId(child.studentId);
                navigate('/parent/home', { replace: true });
              }}
              style={{
                width: 160,
                minHeight: 160,
                borderRadius: 16,
                border: '1px solid var(--cmc-border)',
                background: 'var(--cmc-surface-2)',
                color: 'var(--cmc-text)',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {child.fullName}
            </button>
          ))}
        </div>
      </Stack>
    </div>
  );
}
