// Parent home — child chips + recent assessments + navigation links.
//
// Children come from the stored session (set during login via verifyOtpEmail
// response). There is no guardian.getApprovedChildren tRPC procedure — the
// approved children list is returned at login time and cached in localStorage.
//
// Kind gate: this page is only reachable via ParentLayout (kind:'parent' check).
// No student-only actions are rendered here.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

// ---------------------------------------------------------------------------
// Child-specific quick-links (parent-only actions)
// ---------------------------------------------------------------------------

interface ChildLinksProps {
  studentId: string;
  fullName: string;
}

function ChildLinks({ studentId, fullName }: ChildLinksProps) {
  const navigate = useNavigate();
  return (
    <Box
      p="md"
      style={{
        border: '1px solid var(--cmc-border)',
        borderRadius: 'var(--cmc-radius-xs)',
        background: 'var(--cmc-surface-2)',
      }}
    >
      <Text fw={600} mb="xs">{fullName}</Text>
      <Stack gap="xs">
        <Anchor size="sm" onClick={() => navigate(`/parent/report-card/${studentId}`)}>
          Học bạ / nhận xét
        </Anchor>
        <Anchor size="sm" onClick={() => navigate(`/parent/evidence/${studentId}`)}>
          Ảnh buổi học
        </Anchor>
        <Anchor size="sm" onClick={() => navigate(`/parent/homework/${studentId}`)}>
          Bài tập & điểm
        </Anchor>
        {/* Parent-only: consent and password reset */}
        <Anchor size="sm" onClick={() => navigate(`/parent/consent/${studentId}`)}>
          Cài đặt đồng ý ảnh
        </Anchor>
        <Anchor size="sm" onClick={() => navigate(`/parent/reset-password/${studentId}`)}>
          Đặt lại mật khẩu học sinh
        </Anchor>
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Recent assessments for a selected child
// ---------------------------------------------------------------------------

function RecentAssessments({ studentId }: { studentId: string }) {
  const { data, isLoading, error } = trpc.assessment.listForChild.useQuery(
    { studentId },
    { enabled: !!studentId },
  );

  if (isLoading) return <Loader size="xs" />;
  if (error) return <Alert color="red" variant="light" title="Lỗi">{error.message}</Alert>;

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <Text size="sm" c="dimmed">Chưa có nhận xét nào được xác nhận.</Text>;
  }

  return (
    <Stack gap="xs">
      {items.slice(0, 5).map((item) => (
        <Box
          key={item.id}
          p="sm"
          style={{
            border: '1px solid var(--cmc-border)',
            borderRadius: 'var(--cmc-radius-xs)',
            background: 'var(--cmc-surface)',
          }}
        >
          <Text size="xs" c="dimmed" mb={4}>
            {item.confirmedAt
              ? new Date(item.confirmedAt).toLocaleDateString('vi-VN')
              : item.period ?? '—'}
          </Text>
          <Text size="sm">{item.content}</Text>
        </Box>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function ParentHomePage() {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const children = session?.children ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(
    children.length === 1 ? children[0]!.studentId : null,
  );

  if (!session || session.kind !== 'parent') return null;

  return (
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Text className="lms-topbar__brand">CMC EDU — Phụ huynh</Text>
        <Button size="xs" variant="subtle" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
          Đăng xuất
        </Button>
      </Box>

      <Box className="lms-page">
        <Title order={4} className="lms-page__title">Con của bạn</Title>

        {children.length === 0 ? (
          <Alert color="yellow" variant="light">
            Chưa có học sinh nào được liên kết với tài khoản. Liên hệ nhân viên để yêu cầu duyệt liên kết.
          </Alert>
        ) : (
          <Group gap="sm" mb="lg">
            {children.map((child) => (
              <button
                key={child.studentId}
                className={`lms-child-chip${selectedId === child.studentId ? ' lms-child-chip--active' : ''}`}
                onClick={() => setSelectedId(child.studentId)}
                type="button"
              >
                {child.fullName}
              </button>
            ))}
          </Group>
        )}

        {selectedId && (
          <>
            {children
              .filter((c) => c.studentId === selectedId)
              .map((child) => (
                <ChildLinks
                  key={child.studentId}
                  studentId={child.studentId}
                  fullName={child.fullName}
                />
              ))}

            <Divider my="lg" label="Nhận xét gần đây (đã xác nhận)" labelPosition="left" />
            <RecentAssessments studentId={selectedId} />
          </>
        )}
      </Box>
    </Box>
  );
}
