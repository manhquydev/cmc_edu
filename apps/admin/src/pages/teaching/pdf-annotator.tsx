/**
 * PdfAnnotator — MVP canvas-less implementation (V1).
 *
 * Displays the student's annotation layer as read-only JSON (their own work,
 * must not be modified by the teacher). Provides a textarea for the teacher
 * to write their own annotation layer, saved via `submission.saveTeacherAnnotation`
 * (the phase-01a protectedProcedure).
 *
 * V2 scope: replace JSON textarea with a real canvas overlay rendered on top
 * of the pdfjs page — one read-only layer for the student, one editable layer
 * for the teacher.
 *
 * Size invariant: the teacher's layer payload must stay under 1MB (mirrored
 * from the server cap). This component validates before calling save.
 */

import { useEffect, useState } from 'react';
import { trpc } from '../../lib/trpc.js';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Text,
  Textarea,
} from '@mantine/core';

export interface PdfAnnotatorProps {
  submissionId: string;
  /** Student's annotation layer — read-only at the teacher view. */
  studentLayer: unknown;
  /** Teacher's existing annotation layer (null until first annotation). */
  teacherLayer: unknown;
  /** Called after a successful save so parent can refresh submission data. */
  onSaved?: () => void;
}

const MAX_LAYER_BYTES = 1_000_000;

function serializeLayer(layer: unknown): string {
  if (layer === null || layer === undefined) return '';
  try {
    return JSON.stringify(layer, null, 2);
  } catch {
    return '';
  }
}

function parseLayer(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function PdfAnnotator({
  submissionId,
  studentLayer,
  teacherLayer,
  onSaved,
}: PdfAnnotatorProps) {
  const [teacherText, setTeacherText] = useState(() =>
    serializeLayer(teacherLayer),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync when parent refreshes the submission (e.g. after grade)
  useEffect(() => {
    setTeacherText(serializeLayer(teacherLayer));
  }, [teacherLayer]);

  const saveAnnotation = trpc.submission.saveTeacherAnnotation.useMutation({
    onSuccess: () => {
      setParseError(null);
      onSaved?.();
    },
  });

  function handleSave() {
    setParseError(null);

    const parsed = parseLayer(teacherText);
    if (parsed === null) {
      setParseError('JSON không hợp lệ — vui lòng kiểm tra lại nội dung.');
      return;
    }

    const byteLen = new TextEncoder().encode(JSON.stringify(parsed)).length;
    if (byteLen > MAX_LAYER_BYTES) {
      setParseError(
        `Lớp chú thích vượt quá giới hạn 1MB (${byteLen.toLocaleString()} bytes). ` +
          'Hãy rút gọn nội dung trước khi lưu.',
      );
      return;
    }

    saveAnnotation.mutate({
      submissionId,
      teacherAnnotationLayer: parsed,
    });
  }

  return (
    <Box>
      {/* Student layer — read-only display */}
      <Box mb="md">
        <Group mb={4} gap="xs">
          <Text fz="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
            Lớp vẽ của học sinh
          </Text>
          <Badge color="gray" size="xs" radius="xs" variant="outline">
            Chỉ xem
          </Badge>
        </Group>
        <Box
          style={{
            background: 'var(--cmc-surface-2)',
            border: '1px solid var(--cmc-border)',
            borderRadius: 4,
            padding: '8px 12px',
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          <Text
            fz="xs"
            style={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'var(--cmc-text-muted)',
            }}
          >
            {serializeLayer(studentLayer) || '(chưa có lớp vẽ)'}
          </Text>
        </Box>
      </Box>

      {/* Teacher layer — editable textarea */}
      <Box>
        <Group mb={4} gap="xs">
          <Text fz="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
            Chú thích của giáo viên
          </Text>
          <Badge color="blue" size="xs" radius="xs" variant="outline">
            Có thể chỉnh sửa
          </Badge>
        </Group>
        <Textarea
          value={teacherText}
          onChange={(e) => {
            setTeacherText(e.currentTarget.value);
            setParseError(null);
          }}
          placeholder='{"notes": "Bài làm tốt, cần chú ý…"}'
          autosize
          minRows={4}
          maxRows={10}
          fz="xs"
          styles={{
            input: {
              fontFamily: 'monospace',
              fontSize: 12,
              background: 'var(--cmc-surface)',
            },
          }}
        />
        {parseError && (
          <Alert color="red" mt="xs" p="xs" fz="xs">
            {parseError}
          </Alert>
        )}
        {saveAnnotation.error && (
          <Alert color="red" mt="xs" p="xs" fz="xs">
            {saveAnnotation.error.message}
          </Alert>
        )}
        {saveAnnotation.isSuccess && (
          <Alert color="green" mt="xs" p="xs" fz="xs">
            Đã lưu chú thích giáo viên.
          </Alert>
        )}
        <Group mt="xs" justify="flex-end">
          <Button
            size="xs"
            radius="xs"
            loading={saveAnnotation.isPending}
            onClick={handleSave}
          >
            Lưu chú thích
          </Button>
        </Group>
      </Box>
    </Box>
  );
}
