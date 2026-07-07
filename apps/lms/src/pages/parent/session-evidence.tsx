// Session evidence gallery — parent view.
//
// Consent gate (C2): the backend already strips photos[] when
// photoConsent=false OR photoConsentRevokedAt IS NOT NULL. The UI checks
// whether photos are present and surfaces a consent notice when they are not —
// it NEVER fetches or renders photos outside this consent-gated response.
//
// Kind gate: this route is only reachable under ParentLayout.
// Sibling gate: enforced on the backend; studentId comes from the URL, which
// the parent chose from their own children list.

import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

function photoUrl(blobRef: string): string {
  if (blobRef.startsWith('http')) return blobRef;
  if (blobRef.startsWith('session-photos/')) {
    return `${API_URL}/upload/session-photo?ref=${encodeURIComponent(blobRef)}`;
  }
  return blobRef;
}

export default function SessionEvidencePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  // Defense-in-depth: route-level ParentOnly guard is the primary gate.
  // Photo consent enforcement is backend-authoritative (photos[] stripped when
  // photoConsent=false or photoConsentRevokedAt IS NOT NULL). Client renders
  // only what the backend returns; no bypass path exists.
  // TODO: add photoConsentEnabled field to listForChild response for dual-layer gate.
  if (!session || session.kind !== 'parent') return null;

  const { data, isLoading, error } = trpc.sessionEvidence.listForChild.useQuery(
    { studentId: studentId! },
    { enabled: !!studentId },
  );

  return (
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Anchor size="sm" onClick={() => navigate('/parent/home')}>← Trang chủ</Anchor>
        <Text className="lms-topbar__brand">Ảnh buổi học</Text>
        <Box w={60} /> {/* spacer */}
      </Box>

      <Box className="lms-page">
        <Title order={4} className="lms-page__title">Ảnh buổi học</Title>

        {/* Consent-settings shortcut — parent can enable consent from here */}
        <Alert color="blue" variant="light" mb="md">
          Ảnh chỉ hiển thị khi đồng ý chia sẻ ảnh đã được bật.{' '}
          <Anchor size="sm" onClick={() => navigate(`/parent/consent/${studentId}`)}>
            Quản lý đồng ý ảnh →
          </Anchor>
        </Alert>

        {isLoading && <Group justify="center"><Loader /></Group>}

        {error && (
          <Alert color="red" variant="light" title="Lỗi tải dữ liệu">
            {error.message}
          </Alert>
        )}

        {data && data.items.length === 0 && (
          <Alert color="gray" variant="light">
            Chưa có nhật ký buổi học nào được công bố.
          </Alert>
        )}

        <Stack gap="lg">
          {data?.items.map((item) => (
            <Box
              key={item.id}
              p="md"
              style={{
                border: '1px solid var(--cmc-border)',
                borderRadius: 'var(--cmc-radius-xs)',
              }}
            >
              <Text size="xs" c="dimmed" mb={4}>
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString('vi-VN')
                  : '—'}
              </Text>
              <Text size="sm" mb="sm">{item.summary}</Text>

              {item.photos.length > 0 ? (
                <SimpleGrid cols={3} spacing="xs">
                  {item.photos.map((photo) => (
                    <Image
                      key={photo.id}
                      src={photoUrl(photo.blobRef)}
                      alt="Ảnh buổi học"
                      radius="sm"
                      h={100}
                      fit="cover"
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Alert color="gray" variant="light" p="xs">
                  <Text size="xs">
                    Ảnh không hiển thị — đồng ý chia sẻ ảnh chưa được bật hoặc chưa có ảnh
                    nào trong buổi này.{' '}
                    <Anchor size="xs" onClick={() => navigate(`/parent/consent/${studentId}`)}>
                      Bật đồng ý ảnh →
                    </Anchor>
                  </Text>
                </Alert>
              )}
            </Box>
          ))}
        </Stack>

        <Button variant="subtle" mt="lg" onClick={() => navigate('/parent/home')}>
          ← Quay lại
        </Button>
      </Box>
    </Box>
  );
}
