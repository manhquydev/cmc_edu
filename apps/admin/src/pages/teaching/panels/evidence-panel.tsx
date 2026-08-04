/**
 * Session-scoped session evidence (summary, photos, publish).
 */
import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  Grid,
  HStack,
  LineIcon,
  Stack,
  Text,
  TextArea,
} from '@cmc/ui';
import { trpc } from '../../../lib/trpc.js';

const API_URL = ((import.meta.env['VITE_API_URL'] as string | undefined) ?? '').trim();

function photoUrl(blobRef: string): string {
  if (blobRef.startsWith('http')) return blobRef;
  return `${API_URL}/upload/session-photo?ref=${encodeURIComponent(blobRef)}`;
}

export interface EvidencePanelProps {
  sessionId: string;
}

export function EvidencePanel({ sessionId }: EvidencePanelProps) {
  const [summary, setSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const evidenceQuery = trpc.sessionEvidence.upsert.useMutation();
  const addPhotoMut = trpc.sessionEvidence.addPhoto.useMutation();
  const publishMut = trpc.sessionEvidence.publish.useMutation();

  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; blobRef: string }>>([]);
  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // getBySession returns { status, photos } only (no id/summary) — same as
  // legacy session-evidence page: seed photos/status; id comes from upsert.
  const existing = trpc.sessionEvidence.getBySession.useQuery(
    { classSessionId: sessionId },
    { enabled: Boolean(sessionId) },
  );

  useEffect(() => {
    setEvidenceId(null);
    setSummary('');
    setPhotos([]);
    setPublished(false);
    setSaved(false);
  }, [sessionId]);

  useEffect(() => {
    if (!existing.data) return;
    setPhotos(existing.data.photos ?? []);
    setPublished(existing.data.status === 'published');
  }, [existing.data]);

  async function handleSave() {
    try {
      const result = await evidenceQuery.mutateAsync({ classSessionId: sessionId, summary });
      setEvidenceId(result.id);
      setPhotos(result.photos);
      setPublished(result.status === 'published');
      setSaved(true);
      void utils.sessionEvidence.invalidate();
      void utils.classSession.doneProgress.invalidate({ sessionId });
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
      void utils.sessionEvidence.invalidate();
      void utils.classSession.doneProgress.invalidate({ sessionId });
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!evidenceId) return;
    try {
      await publishMut.mutateAsync({ sessionEvidenceId: evidenceId });
      setPublished(true);
      setPublishConfirmOpen(false);
      void utils.sessionEvidence.invalidate();
      void utils.classSession.doneProgress.invalidate({ sessionId });
    } catch {
      // surface via mutation error if needed
    }
  }

  return (
    <>
      <ConfirmDialog
        opened={publishConfirmOpen}
        title="Công bố nhật ký cho phụ huynh?"
        message="Phụ huynh sẽ thấy tóm tắt và ảnh buổi học trên LMS. Kiểm tra nội dung trước khi công bố."
        confirmLabel="Công bố"
        confirmColor="green"
        loading={publishMut.isPending}
        onConfirm={() => {
          void handlePublish();
        }}
        onCancel={() => setPublishConfirmOpen(false)}
      />

      <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 680 }}>
        {published ? (
          <Banner
            status="success"
            title="Đã công bố"
            description="Nhật ký buổi học đã được công bố. Phụ huynh có thể xem trong ứng dụng LMS."
          />
        ) : (
          <HStack gap={2} style={{ flexWrap: 'wrap' }}>
            <Button
              label="Lưu tóm tắt"
              size="sm"
              variant="primary"
              onClick={() => void handleSave()}
              isLoading={evidenceQuery.isPending}
              isDisabled={!summary.trim()}
            />
            {evidenceId ? (
              <Button
                label="Công bố cho phụ huynh"
                size="sm"
                variant="secondary"
                onClick={() => setPublishConfirmOpen(true)}
                isLoading={publishMut.isPending}
              />
            ) : null}
          </HStack>
        )}

        <div>
          <Text
            type="supporting"
            size="xsm"
            weight="semibold"
            style={{ textTransform: 'uppercase', marginBottom: 4 }}
          >
            Tóm tắt buổi học
          </Text>
          <TextArea
            label="Tóm tắt buổi học"
            isLabelHidden
            placeholder="Hôm nay lớp học về…"
            value={summary}
            onChange={(value) => setSummary(value)}
            rows={4}
            isDisabled={published}
          />
          {saved && !published ? (
            <HStack gap={1} align="center" style={{ marginTop: 4 }}>
              <LineIcon name="check-circle" size={14} />
              <Text size="xsm" color="accent">
                Đã lưu
              </Text>
            </HStack>
          ) : null}
        </div>

        {evidenceId && !published ? (
          <div>
            <Text
              type="supporting"
              size="xsm"
              weight="semibold"
              style={{ textTransform: 'uppercase', marginBottom: 4 }}
            >
              Upload ảnh buổi học
            </Text>
            {uploadError ? (
              <div style={{ marginBottom: 8 }}>
                <Banner status="error" title="Lỗi upload ảnh" description={uploadError} />
              </div>
            ) : null}
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
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (file) await handleUploadPhoto(file);
                input.value = '';
              }}
            />
          </div>
        ) : null}

        {photos.length > 0 ? (
          <div>
            <Text
              type="supporting"
              size="xsm"
              weight="semibold"
              style={{ textTransform: 'uppercase', marginBottom: 4 }}
            >
              Ảnh đã upload ({photos.length})
            </Text>
            <Grid columns={4} gap={1}>
              {photos.map((p) => (
                <img
                  key={p.id}
                  src={photoUrl(p.blobRef)}
                  style={{
                    height: 80,
                    width: '100%',
                    objectFit: 'cover',
                    borderRadius: 'var(--cmc-radius-control)',
                  }}
                  alt="Ảnh buổi học"
                />
              ))}
            </Grid>
          </div>
        ) : null}

        {evidenceId && !published ? (
          <Text type="supporting" size="xsm">
            Sau khi công bố, phụ huynh sẽ thấy tóm tắt và ảnh trong ứng dụng.
          </Text>
        ) : null}

        {published ? <Badge label="Đã công bố" variant="success" /> : null}
      </Stack>
    </>
  );
}
