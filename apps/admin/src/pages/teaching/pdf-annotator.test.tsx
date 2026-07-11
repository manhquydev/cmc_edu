// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { render } from '@testing-library/react';

// Locks `submission.saveTeacherAnnotation.mutate` BYTE-IDENTICAL BEFORE the
// premium-framing pass (TDD per phase-07 batch B). pdf-annotator.tsx is an
// EMBEDDED WIDGET inside grading.tsx's detail pane (not a routed page) — the
// refactor only swaps the raw-styled containers for `Card`; it must NOT
// adopt `FormPage`/`PageHeader` (would double the page shell) and must keep
// the student read-only layer + teacher editable layer + save button intact.
const saveMutate = vi.fn();
let saveOnSuccess: (() => void) | undefined;
const saveState: { error: { message: string } | null; isSuccess: boolean } = {
  error: null,
  isSuccess: false,
};

vi.mock('../../lib/trpc.js', () => ({
  trpc: {
    submission: {
      saveTeacherAnnotation: {
        useMutation: (options: { onSuccess?: () => void }) => {
          saveOnSuccess = options?.onSuccess;
          return {
            mutate: saveMutate,
            isPending: false,
            error: saveState.error,
            isSuccess: saveState.isSuccess,
          };
        },
      },
    },
  },
}));

import { PdfAnnotator } from './pdf-annotator.js';

describe('PdfAnnotator', () => {
  beforeEach(() => {
    saveMutate.mockClear();
    saveState.error = null;
    saveState.isSuccess = false;
  });

  it('renders the read-only student layer and the editable teacher layer (annotator surface intact)', () => {
    render(
      <PdfAnnotator
        submissionId="sub-1"
        studentLayer={{ strokes: ['a'] }}
        teacherLayer={null}
      />,
    );
    expect(screen.getByText('Lớp vẽ của học sinh')).toBeInTheDocument();
    expect(screen.getByText('Chỉ xem')).toBeInTheDocument();
    // "Chú thích của giáo viên" renders twice: the section heading AND the
    // (visually hidden) TextArea field label sharing the same text.
    expect(screen.getAllByText('Chú thích của giáo viên')).toHaveLength(2);
    expect(screen.getByText('Có thể chỉnh sửa')).toBeInTheDocument();
    expect(screen.getByText(/"strokes"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu chú thích' })).toBeInTheDocument();
  });

  it('pre-fills the teacher textarea from an existing teacherLayer prop', () => {
    render(
      <PdfAnnotator
        submissionId="sub-1"
        studentLayer={null}
        teacherLayer={{ note: 'Bài làm tốt' }}
      />,
    );
    expect(screen.getByDisplayValue(/"note": "Bài làm tốt"/)).toBeInTheDocument();
  });

  it('calls submission.saveTeacherAnnotation.mutate with a byte-identical {submissionId, teacherAnnotationLayer} payload', () => {
    render(<PdfAnnotator submissionId="sub-1" studentLayer={null} teacherLayer={null} />);
    fireEvent.change(screen.getByLabelText('Chú thích của giáo viên'), {
      target: { value: '{"notes": "Tốt"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chú thích' }));
    expect(saveMutate).toHaveBeenCalledWith({
      submissionId: 'sub-1',
      teacherAnnotationLayer: { notes: 'Tốt' },
    });
  });

  it('shows an error banner (does not call mutate) on invalid JSON', () => {
    render(<PdfAnnotator submissionId="sub-1" studentLayer={null} teacherLayer={null} />);
    fireEvent.change(screen.getByLabelText('Chú thích của giáo viên'), {
      target: { value: '{not valid json' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chú thích' }));
    expect(screen.getByText('JSON không hợp lệ — vui lòng kiểm tra lại nội dung.')).toBeInTheDocument();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('rejects a teacher layer payload over the 1MB size cap without calling mutate', () => {
    render(<PdfAnnotator submissionId="sub-1" studentLayer={null} teacherLayer={null} />);
    const bigValue = 'x'.repeat(1_100_000);
    fireEvent.change(screen.getByLabelText('Chú thích của giáo viên'), {
      target: { value: JSON.stringify({ notes: bigValue }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chú thích' }));
    expect(screen.getByText(/vượt quá giới hạn 1MB/)).toBeInTheDocument();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('calls onSaved after a successful save', () => {
    const onSaved = vi.fn();
    render(<PdfAnnotator submissionId="sub-1" studentLayer={null} teacherLayer={null} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Chú thích của giáo viên'), {
      target: { value: '{"notes": "Tốt"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chú thích' }));
    expect(saveOnSuccess).toBeDefined();
    act(() => saveOnSuccess?.());
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('renders an always-visible error banner (title) when the save mutation fails', () => {
    saveState.error = { message: 'Payload rejected by server' };
    render(<PdfAnnotator submissionId="sub-1" studentLayer={null} teacherLayer={null} />);
    expect(screen.getByText('Payload rejected by server')).toBeInTheDocument();
  });
});
