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
import { Banner, Button, Heading, HStack, Spinner, Stack, Text } from '@cmc/ui';
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

/** docs/17 §LMS experience: absent → "Nghỉ học", late → "Đi muộn". Present
 * (or not-yet-marked) sessions render the normal evidence view unchanged. */
const ATTENDANCE_LABEL: Record<string, string> = {
  absent: 'Nghỉ học',
  late: 'Đi muộn',
};

export default function SessionEvidencePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  // Defense-in-depth: route-level ParentOnly guard is the primary gate.
  // Photo consent enforcement is backend-authoritative (photos[] stripped when
  // photoConsent=false or photoConsentRevokedAt IS NOT NULL). Client renders
  // only what the backend returns; no bypass path exists.
  // TODO: add photoConsentEnabled field to listForChild response for dual-layer gate.
  if (!session || (session.kind !== 'parent' && session.kind !== 'family')) return null;

  const { data, isLoading, error } = trpc.sessionEvidence.listForChild.useQuery(
    { studentId: studentId! },
    { enabled: !!studentId },
  );
  // Gap-closure 260710-0005 Phase 2: merge per-session attendance status into
  // the evidence gallery, keyed by classSessionId — a session may have
  // evidence but no attendance mark yet (or vice versa), so this is a lookup,
  // not an assumed 1:1 join.
  const { data: attendanceData } = trpc.attendance.listForChild.useQuery(
    { studentId: studentId! },
    { enabled: !!studentId },
  );
  const attendanceBySession = new Map(
    (attendanceData?.items ?? []).map((a) => [a.classSessionId, a.status]),
  );

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Button variant="ghost" size="sm" label="← Trang chủ" onClick={() => navigate('/parent/home')} />
        <Text className="lms-topbar__brand">Ảnh buổi học</Text>
        <div style={{ width: 60 }} /> {/* spacer */}
      </div>

      <div className="lms-page">
        <Heading level={4} className="lms-page__title">Ảnh buổi học</Heading>

        {/* Consent-settings shortcut — parent can enable consent from here */}
        <Banner
          status="info"
          title={
            <>
              Ảnh chỉ hiển thị khi đồng ý chia sẻ ảnh đã được bật.{' '}
              <Button
                variant="ghost"
                size="sm"
                label="Quản lý đồng ý ảnh →"
                onClick={() => navigate(`/parent/consent/${studentId}`)}
              />
            </>
          }
          style={{ marginBottom: 16 }}
        />

        {isLoading && <HStack justify="center"><Spinner /></HStack>}

        {error && (
          <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
        )}

        {data && data.items.length === 0 && (
          <Banner status="info" title="Chưa có nhật ký buổi học nào được công bố." />
        )}

        <Stack gap={3}>
          {data?.items.map((item) => {
            const attendanceStatus = attendanceBySession.get(item.classSessionId);
            const isAbsent = attendanceStatus === 'absent';
            const attendanceLabel = attendanceStatus ? ATTENDANCE_LABEL[attendanceStatus] : undefined;

            return (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  border: '1px solid var(--cmc-border)',
                  borderRadius: 'var(--cmc-radius-xs)',
                }}
              >
                <HStack justify="between" style={{ marginBottom: 4 }}>
                  <Text type="supporting" size="2xs">
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleDateString('vi-VN')
                      : '—'}
                  </Text>
                  {attendanceLabel && (
                    // TODO(astryx-review): raw cmc-danger/cmc-warning CSS vars have no
                    // Astryx TextColor equivalent (enum is primary/secondary/disabled/
                    // placeholder/accent/inherit) — kept as a plain styled span.
                    <span
                      style={{
                        fontSize: 'var(--cmc-font-size-column, 12px)',
                        fontWeight: 600,
                        color: isAbsent ? 'var(--cmc-danger)' : 'var(--cmc-warning)',
                      }}
                    >
                      {attendanceLabel}
                    </span>
                  )}
                </HStack>
                <Text type="body" size="sm" display="block" style={{ marginBottom: 8 }}>{item.summary}</Text>

                {isAbsent ? (
                  <Text type="supporting" size="2xs">Con nghỉ buổi này.</Text>
                ) : item.photos.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                    }}
                  >
                    {item.photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photoUrl(photo.blobRef)}
                        alt="Ảnh buổi học"
                        style={{
                          width: '100%',
                          height: 100,
                          objectFit: 'cover',
                          borderRadius: 'var(--cmc-radius-xs)',
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Banner
                    status="info"
                    title={
                      <>
                        Ảnh không hiển thị — đồng ý chia sẻ ảnh chưa được bật hoặc chưa có ảnh
                        nào trong buổi này.{' '}
                        <Button
                          variant="ghost"
                          size="sm"
                          label="Bật đồng ý ảnh →"
                          onClick={() => navigate(`/parent/consent/${studentId}`)}
                        />
                      </>
                    }
                  />
                )}
              </div>
            );
          })}
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
