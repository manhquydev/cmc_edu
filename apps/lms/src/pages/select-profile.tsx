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
    <div className="lms-shell lms-page">
      <Stack gap={4} hAlign="center">
        <Heading level={2} className="lms-page__title">
          Ai đang học hôm nay?
        </Heading>
        <Text type="supporting">Chọn hồ sơ — không cần đăng nhập lại.</Text>
        <div className="lms-profile-grid">
          {children.map((child) => (
            <button
              key={child.studentId}
              type="button"
              className="lms-profile-card"
              onClick={() => {
                setActiveStudentId(child.studentId);
                navigate('/parent/home', { replace: true });
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
