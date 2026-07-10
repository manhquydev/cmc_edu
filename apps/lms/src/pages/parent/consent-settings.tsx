// Photo consent settings — parent-only (kind:'parent').
//
// C2 / docs/08 §7: toggles Guardian.photoConsent for the parent→child link.
// A student session MUST NOT reach this page — enforced by:
//   1. ParentLayout (route-level kind check → redirect)
//   2. Runtime guard inside this component (defence in depth)
//
// The current consent state is not readable from a separate GET procedure;
// the page lets the parent explicitly set it to enabled or disabled.
// After setting, a success message confirms the new state.

import { useParams, useNavigate } from 'react-router-dom';
import { Banner, Button, Heading, HStack, Stack, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

export default function ConsentSettingsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  // Runtime kind gate (defence in depth — ParentLayout already redirects).
  if (!session || session.kind !== 'parent') return null;

  return <ConsentForm studentId={studentId!} onBack={() => navigate('/parent/home')} />;
}

function ConsentForm({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const mutation = trpc.guardian.setPhotoConsent.useMutation();

  function set(consent: boolean) {
    mutation.mutate({ studentId, consent });
  }

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Button variant="ghost" size="sm" label="← Trang chủ" onClick={onBack} />
        <Text className="lms-topbar__brand">Đồng ý ảnh</Text>
        <div style={{ width: 60 }} />
      </div>

      <div className="lms-page">
        <Heading level={4} className="lms-page__title">Cài đặt đồng ý ảnh</Heading>

        <Banner
          status="info"
          title="Khi bật đồng ý, ảnh chụp trong các buổi học của con sẽ được hiển thị trong mục &quot;Ảnh buổi học&quot;. Khi tắt, ảnh sẽ bị ẩn ngay lập tức."
          style={{ marginBottom: 24 }}
        />

        {mutation.isSuccess && (
          <Banner
            status="success"
            title={
              mutation.data.photoConsent
                ? 'Đã bật đồng ý chia sẻ ảnh. Ảnh buổi học sẽ hiển thị.'
                : 'Đã tắt đồng ý chia sẻ ảnh. Ảnh buổi học sẽ không hiển thị.'
            }
            style={{ marginBottom: 16 }}
          />
        )}

        {mutation.isError && (
          <Banner status="error" title={mutation.error.message} style={{ marginBottom: 16 }} />
        )}

        <Stack gap={2}>
          <Button
            style={{ width: '100%' }}
            variant="primary"
            label="Bật đồng ý chia sẻ ảnh"
            isLoading={mutation.isPending}
            onClick={() => set(true)}
          />
          <Button
            style={{ width: '100%' }}
            variant="destructive"
            label="Tắt đồng ý chia sẻ ảnh"
            isLoading={mutation.isPending}
            onClick={() => set(false)}
          />
        </Stack>

        <HStack style={{ marginTop: 24 }}>
          <Button
            variant="ghost"
            size="sm"
            label="Xem ảnh buổi học →"
            onClick={() => navigate(`/parent/evidence/${studentId}`)}
          />
        </HStack>

        <Button
          variant="ghost"
          style={{ marginTop: 24 }}
          label="← Quay lại"
          onClick={onBack}
        />
      </div>
    </div>
  );
}
