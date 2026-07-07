// Teacher: write class summary, upload photos, publish to parents.
// Flow: pick lớp → pick buổi → upsert evidence → add photos → publish.

import { useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Image,
  Loader,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { PageHeader } from '@cmc/ui';
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

  const sessionOptions = (sessions ?? []).map((s) => ({
    value: s.id,
    label: `${new Date(s.sessionDate).toLocaleDateString('vi-VN')} | ${s.status}`,
    disabled: s.status === 'cancelled',
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

      <Stack p="md" gap="md" maw={680}>
        {/* Step 1: pick class */}
        <Box>
          <Text fz="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>1. Chọn lớp</Text>
          {classLoading ? (
            <Skeleton height={36} />
          ) : (
            <Select
              placeholder="Chọn lớp học"
              data={classOptions}
              value={classBatchId}
              onChange={(v) => { setClassBatchId(v); resetSession(); }}
              searchable
              radius="xs"
            />
          )}
        </Box>

        {/* Step 2: pick session */}
        {classBatchId && (
          <Box>
            <Text fz="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>2. Chọn buổi học</Text>
            {sessionsLoading ? (
              <Skeleton height={36} />
            ) : (
              <Select
                placeholder="Chọn buổi"
                data={sessionOptions}
                value={sessionId}
                onChange={(v) => { setSessionId(v); setSummary(''); setEvidenceId(null); setPhotos([]); setPublished(false); setSaved(false); }}
                radius="xs"
              />
            )}
          </Box>
        )}

        {/* Step 3: write summary */}
        {sessionId && (
          <Box>
            <Text fz="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>3. Tóm tắt buổi học</Text>
            <Textarea
              placeholder="Hôm nay lớp học về…"
              value={summary}
              onChange={(e) => setSummary(e.currentTarget.value)}
              rows={4}
              radius="xs"
              disabled={published}
            />
            <Group mt="xs" gap="xs">
              <Button
                size="xs"
                radius="xs"
                onClick={handleSave}
                loading={evidenceQuery.isPending}
                disabled={published || !summary.trim()}
              >
                Lưu tóm tắt
              </Button>
              {saved && !published && (
                <Text fz="xs" c="green">✓ Đã lưu</Text>
              )}
              {published && (
                <Badge color="green" size="sm" radius="xs">Đã công bố</Badge>
              )}
            </Group>
          </Box>
        )}

        {/* Step 4: upload photos */}
        {evidenceId && !published && (
          <Box>
            <Text fz="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>4. Upload ảnh buổi học</Text>
            {uploadError && (
              <Alert color="red" mb="xs" p="xs">{uploadError}</Alert>
            )}
            <Button
              size="xs"
              radius="xs"
              variant="default"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              leftSection={uploading ? <Loader size="xs" /> : undefined}
            >
              {uploading ? 'Đang upload…' : 'Chọn ảnh'}
            </Button>
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
          </Box>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <Box>
            <Text fz="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Ảnh đã upload ({photos.length})</Text>
            <SimpleGrid cols={4} spacing="xs">
              {photos.map((p) => (
                <Image
                  key={p.id}
                  src={photoUrl(p.blobRef)}
                  h={80}
                  fit="cover"
                  radius="xs"
                  alt="Ảnh buổi học"
                />
              ))}
            </SimpleGrid>
          </Box>
        )}

        {/* Step 5: publish */}
        {evidenceId && !published && (
          <Box>
            <Text fz="xs" c="dimmed" mb={4}>
              Sau khi công bố, phụ huynh sẽ thấy tóm tắt và ảnh trong ứng dụng.
            </Text>
            <Button
              size="sm"
              radius="xs"
              color="green"
              onClick={handlePublish}
              loading={publishMut.isPending}
            >
              Công bố cho phụ huynh
            </Button>
          </Box>
        )}

        {published && (
          <Alert color="green" variant="light">
            Nhật ký buổi học đã được công bố. Phụ huynh có thể xem trong ứng dụng LMS.
          </Alert>
        )}
      </Stack>
    </>
  );
}
