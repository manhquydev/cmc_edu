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
import { Badge, Banner, Button, HStack, Text, TextArea } from '@cmc/ui';

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
    <div>
      {/* Student layer — read-only display */}
      <div style={{ marginBottom: 16 }}>
        <HStack gap={1} style={{ marginBottom: 4 }}>
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Lớp vẽ của học sinh
          </Text>
          <Badge label="Chỉ xem" variant="neutral" />
        </HStack>
        <div
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
            type="supporting"
            size="xsm"
            style={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {serializeLayer(studentLayer) || '(chưa có lớp vẽ)'}
          </Text>
        </div>
      </div>

      {/* Teacher layer — editable textarea */}
      <div>
        <HStack gap={1} style={{ marginBottom: 4 }}>
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Chú thích của giáo viên
          </Text>
          <Badge label="Có thể chỉnh sửa" variant="blue" />
        </HStack>
        {/* TODO(astryx-review): Astryx TextArea has no confirmed autosize/
            minRows/maxRows API (unused elsewhere in the migrated codebase) —
            using a fixed `rows` instead of the prior autosize(4–10) behavior;
            flagged for reviewer to confirm visual parity. `label` is
            required by TextArea's props but the heading above already
            names the field (with an inline Badge it can't render) — passed
            as an empty string to satisfy the type without a duplicate
            visible heading; flagged for reviewer to confirm it renders
            without adding empty label spacing. */}
        <TextArea
          label="Chú thích của giáo viên"
          isLabelHidden
          value={teacherText}
          onChange={(value) => {
            setTeacherText(value);
            setParseError(null);
          }}
          placeholder='{"notes": "Bài làm tốt, cần chú ý…"}'
          rows={6}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        {parseError && (
          <div style={{ marginTop: 8 }}>
            <Banner status="error" title={parseError} />
          </div>
        )}
        {saveAnnotation.error && (
          <div style={{ marginTop: 8 }}>
            <Banner status="error" title={saveAnnotation.error.message} />
          </div>
        )}
        {saveAnnotation.isSuccess && (
          <div style={{ marginTop: 8 }}>
            <Banner status="success" title="Đã lưu chú thích giáo viên." />
          </div>
        )}
        <HStack justify="end" style={{ marginTop: 8 }}>
          <Button
            label="Lưu chú thích"
            size="sm"
            variant="primary"
            isLoading={saveAnnotation.isPending}
            onClick={handleSave}
          />
        </HStack>
      </div>
    </div>
  );
}
