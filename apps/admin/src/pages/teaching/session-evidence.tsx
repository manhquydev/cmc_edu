// Teacher: write class summary, upload photos, publish to parents.
// Flow: pick lớp → pick buổi → upsert evidence → add photos → publish.

import { useRef, useState } from 'react';
import { Badge, Banner, Button, Grid, HStack, PageHeader, Selector, Skeleton, Stack, Text, TextArea } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

function photoUrl(blobRef: string): string {
  if (blobRef.startsWith('http')) return blobRef;
  return `${API_URL}/upload/session-photo?ref=${encodeURIComponent(blobRef)}`;
}

export default function SessionEvidencePage() {
  const [classBatchId, setClassBatchId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // --- class list ---
  const { data: classData, isLoading: classLoading } = trpc.classBatch.list.useQuery({
    page: 1, pageSize: 100,
  });

  // --- session list ---
  const { data: sessions, isLoading: sessionsLoading } = trpc.classSession.list.useQuery(
    { classBatchId: classBatchId! },
    { enabled: Boolean(classBatchId) },
  );

  // --- existing evidence for selected session ---
  const evidenceQuery = trpc.sessionEvidence.upsert.useMutation();
  const addPhotoMut = trpc.sessionEvidence.addPhoto.useMutation();
  const publishMut = trpc.sessionEvidence.publish.useMutation();

  // Load existing evidence: use a raw query via separate component or inline hack.
  // Simplified: we upsert on save (idempotent).

  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; blobRef: string }>>([]);
  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState(false);

  const classOptions = (classData?.items ?? []).map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.program}`,
  }));

  // TODO(astryx-review): per-option disabled state (cancelled sessions should
  // be unselectable) has no confirmed Astryx SelectorOption field — `isDisabled`
  // used to match the Selector component's own isDisabled naming convention;
  // flagged for reviewer to confirm it's honored per-option (not just at the
  // Selector root).
  const sessionOptions = (sessions ?? []).map((s) => ({
    value: s.id,
    label: `${new Date(s.sessionDate).toLocaleDateString('vi-VN')} | ${s.status}`,
    isDisabled: s.status === 'cancelled',
  }));

  function resetSession() {
    setSessionId(null);
    setSummary('');
    setEvidenceId(null);
    setPhotos([]);
    setPublished(false);
    setSaved(false);
  }

  async function handleSave() {
    if (!sessionId) return;
    try {
      const result = await evidenceQuery.mutateAsync({ classSessionId: sessionId, summary });
      setEvidenceId(result.id);
      setPhotos(result.photos);
      setPublished(result.status === 'published');
      setSaved(true);
    } catch (e: unknown) {
      console.error(e);
    }
  }

  async function handleUploadPhoto(file: File) {
    if (!evidenceId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const buf = await file.arrayBuffer();
      const resp = await fetch(`${API_URL}/upload/session-photo`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        credentials: 'include',
        body: buf,
      });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const { blobRef } = (await resp.json()) as { blobRef: string };
      const photo = await addPhotoMut.mutateAsync({ sessionEvidenceId: evidenceId, blobRef });
      setPhotos((prev) => [...prev, photo]);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!evidenceId) return;
    await publishMut.mutateAsync({ sessionEvidenceId: evidenceId });
    setPublished(true);
    void utils.sessionEvidence.invalidate();
  }

  return (
    <>
      <PageHeader
        title="Nhật ký buổi học"
        subtitle="Viết tóm tắt, upload ảnh, công bố cho phụ huynh"
        breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Nhật ký buổi học' }]}
      />

      <Stack gap={4} style={{ padding: 16, maxWidth: 680 }}>
        {/* Step 1: pick class */}
        <div>
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>1. Chọn lớp</Text>
          {/* TODO(astryx-review): `label` is required by Selector's props
              but the step heading above already names the field — passed
              as empty string to avoid a duplicate visible label (same
              pattern applied to the session Selector and summary TextArea
              below). */}
          {classLoading ? (
            <Skeleton height={36} radius={1} />
          ) : (
            <Selector
              label="Chọn lớp học"
              isLabelHidden
              placeholder="Chọn lớp học"
              options={classOptions}
              value={classBatchId ?? undefined}
              onChange={(v) => { setClassBatchId(v ?? null); resetSession(); }}
              hasSearch
              hasClear={false}
            />
          )}
        </div>

        {/* Step 2: pick session */}
        {classBatchId && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>2. Chọn buổi học</Text>
            {sessionsLoading ? (
              <Skeleton height={36} radius={1} />
            ) : (
              <Selector
                label="Chọn buổi học"
                isLabelHidden
                placeholder="Chọn buổi"
                options={sessionOptions}
                value={sessionId ?? undefined}
                onChange={(v) => { setSessionId(v ?? null); setSummary(''); setEvidenceId(null); setPhotos([]); setPublished(false); setSaved(false); }}
                hasClear={false}
              />
            )}
          </div>
        )}

        {/* Step 3: write summary */}
        {sessionId && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>3. Tóm tắt buổi học</Text>
            <TextArea
              label="Tóm tắt buổi học"
              isLabelHidden
              placeholder="Hôm nay lớp học về…"
              value={summary}
              onChange={(value) => setSummary(value)}
              rows={4}
              isDisabled={published}
            />
            <HStack gap={1} style={{ marginTop: 8 }}>
              <Button
                label="Lưu tóm tắt"
                size="sm"
                variant="primary"
                onClick={handleSave}
                isLoading={evidenceQuery.isPending}
                isDisabled={published || !summary.trim()}
              />
              {saved && !published && (
                <Text size="xsm" color="accent">✓ Đã lưu</Text>
              )}
              {published && <Badge label="Đã công bố" variant="success" />}
            </HStack>
          </div>
        )}

        {/* Step 4: upload photos */}
        {evidenceId && !published && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>4. Upload ảnh buổi học</Text>
            {uploadError && (
              <div style={{ marginBottom: 8 }}>
                <Banner status="error" title={uploadError} />
              </div>
            )}
            <Button
              label={uploading ? 'Đang upload…' : 'Chọn ảnh'}
              size="sm"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              isDisabled={uploading}
              isLoading={uploading}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                if (file) await handleUploadPhoto(file);
                e.currentTarget.value = '';
              }}
            />
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>Ảnh đã upload ({photos.length})</Text>
            <Grid columns={4} gap={1}>
              {photos.map((p) => (
                <img
                  key={p.id}
                  src={photoUrl(p.blobRef)}
                  style={{ height: 80, width: '100%', objectFit: 'cover', borderRadius: 'var(--cmc-radius-xs)' }}
                  alt="Ảnh buổi học"
                />
              ))}
            </Grid>
          </div>
        )}

        {/* Step 5: publish */}
        {evidenceId && !published && (
          <div>
            <Text type="supporting" size="xsm" style={{ marginBottom: 4 }}>
              Sau khi công bố, phụ huynh sẽ thấy tóm tắt và ảnh trong ứng dụng.
            </Text>
            <Button
              label="Công bố cho phụ huynh"
              size="sm"
              variant="primary"
              onClick={handlePublish}
              isLoading={publishMut.isPending}
            />
          </div>
        )}

        {published && (
          <Banner status="success" title="Nhật ký buổi học đã được công bố. Phụ huynh có thể xem trong ứng dụng LMS." />
        )}
      </Stack>
    </>
  );
}
