// Parent home — child chips + recent assessments + navigation links.
//
// Children come from the stored session (set during login via verifyOtpEmail
// response). There is no guardian.getApprovedChildren tRPC procedure — the
// approved children list is returned at login time and cached in localStorage.
//
// Kind gate: this page is only reachable via ParentLayout (kind:'parent' check).
// No student-only actions are rendered here.

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Banner, Button, Divider, Heading, Spinner, Stack, Text } from '@cmc/ui';
import { isParentDoorKind } from '../../lib/lms-kind.js';
import { getActiveStudentId, setActiveStudentId, trpc } from '../../lib/trpc.js';
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
    <div
      style={{
        padding: 16,
        border: '1px solid var(--cmc-border)',
        borderRadius: 'var(--cmc-radius-xs)',
        background: 'var(--cmc-surface-2)',
      }}
    >
      <Text weight="bold" display="block" style={{ marginBottom: 8 }}>{fullName}</Text>
      <Stack gap={1}>
        <Button
          variant="ghost"
          size="sm"
          label="Học bạ / nhận xét"
          onClick={() => navigate(`/parent/report-card/${studentId}`)}
        />
        <Button
          variant="ghost"
          size="sm"
          label="Ảnh buổi học"
          onClick={() => navigate(`/parent/evidence/${studentId}`)}
        />
        <Button
          variant="ghost"
          size="sm"
          label="Bài tập & điểm"
          onClick={() => navigate(`/parent/homework/${studentId}`)}
        />
        {/* Parent-only: consent and password reset */}
        <Button
          variant="ghost"
          size="sm"
          label="Cài đặt đồng ý ảnh"
          onClick={() => navigate(`/parent/consent/${studentId}`)}
        />
        <Button
          variant="ghost"
          size="sm"
          label="Đặt lại mật khẩu học sinh"
          onClick={() => navigate(`/parent/reset-password/${studentId}`)}
        />
      </Stack>
    </div>
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

  if (isLoading) return <Spinner size="sm" />;
  if (error) return <Banner status="error" title="Lỗi" description={error.message} />;

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <Text type="supporting" size="sm">Chưa có nhận xét nào được xác nhận.</Text>;
  }

  return (
    <Stack gap={1}>
      {items.slice(0, 5).map((item) => (
        <div
          key={item.id}
          style={{
            padding: 12,
            border: '1px solid var(--cmc-border)',
            borderRadius: 'var(--cmc-radius-xs)',
            background: 'var(--cmc-surface)',
          }}
        >
          <Text type="supporting" size="2xs" display="block" style={{ marginBottom: 4 }}>
            {item.confirmedAt
              ? new Date(item.confirmedAt).toLocaleDateString('vi-VN')
              : item.period ?? '—'}
          </Text>
          <Text type="body" size="sm">{item.content}</Text>
        </div>
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
  const storedActive = getActiveStudentId();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (children.length === 1) return children[0]!.studentId;
    if (storedActive && children.some((c) => c.studentId === storedActive)) return storedActive;
    return null;
  });

  if (!session || !isParentDoorKind(session.kind)) return null;

  if (session.kind === 'family' && children.length >= 2 && !selectedId) {
    return <Navigate to="/select-profile" replace />;
  }

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Text className="lms-topbar__brand">CMC EDU — Phụ huynh</Text>
        <Button
          size="sm"
          variant="ghost"
          label="Đăng xuất"
          onClick={() => { logout(); navigate('/login', { replace: true }); }}
        />
      </div>

      <div className="lms-page">
        <Heading level={4} className="lms-page__title">Con của bạn</Heading>

        {children.length === 0 ? (
          <Banner
            status="warning"
            title="Chưa có học sinh nào được liên kết với tài khoản. Liên hệ nhân viên để yêu cầu duyệt liên kết."
          />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {children.map((child) => (
              <button
                key={child.studentId}
                className={`lms-child-chip${selectedId === child.studentId ? ' lms-child-chip--active' : ''}`}
                onClick={() => {
                  setSelectedId(child.studentId);
                  if (session.kind === 'family') setActiveStudentId(child.studentId);
                }}
                type="button"
              >
                {child.fullName}
              </button>
            ))}
          </div>
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

            <Divider label="Nhận xét gần đây (đã xác nhận)" style={{ marginTop: 24, marginBottom: 24 }} />
            <RecentAssessments studentId={selectedId} />
          </>
        )}
      </div>
    </div>
  );
}
