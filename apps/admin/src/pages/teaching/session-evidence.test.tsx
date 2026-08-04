// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks `classBatch.list`/`classSession.list` query bindings + the
// `sessionEvidence.upsert`/`addPhoto`/`publish` mutate payloads (BYTE-IDENTICAL)
// + the raw-fetch photo upload flow BEFORE the FormPage refactor (TDD per
// phase-07 batch B). This screen writes student-session media/PII — the
// upload target (`/upload/session-photo`) and published visibility must not
// change; the refactor only relocates the forward-step buttons into the
// FormPage bottom action bar.
const CLASS_A = { id: 'batch-1', code: 'CB001', program: 'IELTS Foundation' };
const SESSION_A = { id: 'sess-1', sessionDate: '2026-07-10T00:00:00.000Z', status: 'scheduled' };

const classBatchSpy = vi.fn();
const classSessionSpy = vi.fn();
const upsertMutateAsync = vi.fn();
const addPhotoMutateAsync = vi.fn();
const publishMutateAsync = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giao_vien'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'classBatch.list.useQuery': (input: unknown) => {
        classBatchSpy(input);
        return queryResult({ items: [CLASS_A] });
      },
      'classSession.list.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        classSessionSpy(input, opts?.enabled);
        if (!opts?.enabled) return queryResult(undefined);
        return queryResult([SESSION_A]);
      },
      'sessionEvidence.upsert.useMutation': () =>
        mutationResult({ mutateAsync: upsertMutateAsync, isPending: false }),
      'sessionEvidence.addPhoto.useMutation': () =>
        mutationResult({ mutateAsync: addPhotoMutateAsync, isPending: false }),
      'sessionEvidence.publish.useMutation': () =>
        mutationResult({ mutateAsync: publishMutateAsync, isPending: false }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import SessionEvidencePage from './session-evidence.js';

async function pickClassAndSession() {
  // The class Selector's `label` and `placeholder` are both "Chọn lớp học"
  // (unchanged from the pre-refactor component) — target the trigger button
  // by role/name rather than getByLabelText to avoid the resulting ambiguous
  // text match.
  fireEvent.click(screen.getByRole('button', { name: 'Chọn lớp học' }));
  fireEvent.click(await screen.findByRole('option', { name: /CB001/ }));

  // The session Selector omits `hasSearch` — its trigger renders with an
  // explicit `role="combobox"` (unlike the class Selector's `hasSearch`
  // trigger, which keeps the implicit button role).
  fireEvent.click(await screen.findByRole('combobox', { name: 'Chọn buổi học' }));
  fireEvent.click(await screen.findByRole('option', { name: /scheduled/ }));
}

describe('SessionEvidencePage', () => {
  beforeEach(() => {
    classBatchSpy.mockClear();
    classSessionSpy.mockClear();
    upsertMutateAsync.mockReset().mockResolvedValue({ id: 'ev-1', photos: [], status: 'draft' });
    addPhotoMutateAsync.mockReset().mockResolvedValue({ id: 'photo-1', blobRef: 'session-photo/abc123' });
    publishMutateAsync.mockReset().mockResolvedValue(undefined);
  });

  it('queries classBatch.list with the unchanged {page:1, pageSize:100} input', () => {
    renderWithProviders(<SessionEvidencePage />);
    expect(classBatchSpy).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
  });

  it('does not query classSession.list until a class is selected', () => {
    renderWithProviders(<SessionEvidencePage />);
    expect(classSessionSpy).toHaveBeenCalledWith({ classBatchId: null }, false);
  });

  it('queries classSession.list({classBatchId}) once a class is selected', async () => {
    renderWithProviders(<SessionEvidencePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lớp học' }));
    fireEvent.click(await screen.findByRole('option', { name: /CB001/ }));
    expect(classSessionSpy).toHaveBeenCalledWith({ classBatchId: 'batch-1' }, true);
  });

  it('calls sessionEvidence.upsert.mutateAsync with a byte-identical {classSessionId, summary} payload', async () => {
    renderWithProviders(<SessionEvidencePage />);
    await pickClassAndSession();

    fireEvent.change(screen.getByLabelText('Tóm tắt buổi học'), { target: { value: 'Hôm nay học Unit 3.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tóm tắt' }));

    await waitFor(() =>
      expect(upsertMutateAsync).toHaveBeenCalledWith({ classSessionId: 'sess-1', summary: 'Hôm nay học Unit 3.' }),
    );
  });

  it('shows the saved indicator (LineIcon check-circle) after a successful save', async () => {
    renderWithProviders(<SessionEvidencePage />);
    await pickClassAndSession();
    fireEvent.change(screen.getByLabelText('Tóm tắt buổi học'), { target: { value: 'Nội dung.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tóm tắt' }));

    await screen.findByText('Đã lưu');
    expect(document.querySelector('svg[data-icon="check-circle"]')).toBeInTheDocument();
  });

  describe('upload flow (nhạy — student session media)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ blobRef: 'session-photo/abc123' }),
      });
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    async function saveAndRevealUpload() {
      renderWithProviders(<SessionEvidencePage />);
      await pickClassAndSession();
      fireEvent.change(screen.getByLabelText('Tóm tắt buổi học'), { target: { value: 'Nội dung.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu tóm tắt' }));
      await screen.findByRole('button', { name: 'Chọn ảnh' });
    }

    it('uploads to the unchanged /upload/session-photo target and calls addPhoto.mutateAsync with byte-identical args', async () => {
      await saveAndRevealUpload();

      const file = new File(['binary-image-data'], 'photo.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      // Assert the target PATH (env-independent): API_URL comes from VITE_API_URL,
      // which is unset in the jsdom test env, so the built URL is relative here.
      expect(url).toMatch(/\/upload\/session-photo$/);
      expect(opts.method).toBe('POST');
      expect(opts.credentials).toBe('include');
      expect((opts.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg');

      await waitFor(() =>
        expect(addPhotoMutateAsync).toHaveBeenCalledWith({
          sessionEvidenceId: 'ev-1',
          blobRef: 'session-photo/abc123',
        }),
      );
      // Flush the trailing microtask in the unchanged onChange handler
      // (`e.currentTarget.value = ''`, which runs after `await
      // handleUploadPhoto(file)` resolves) before RTL unmounts the tree.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('renders the uploaded photo in the grid after addPhoto resolves', async () => {
      await saveAndRevealUpload();
      const file = new File(['binary-image-data'], 'photo.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await screen.findByAltText('Ảnh buổi học');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('shows an always-visible error banner (description) when the upload HTTP call fails', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Lỗi máy chủ' }) });
      await saveAndRevealUpload();
      const file = new File(['binary-image-data'], 'photo.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await screen.findByText('Lỗi upload ảnh');
      expect(screen.getByText('Lỗi máy chủ')).toBeInTheDocument();
      expect(addPhotoMutateAsync).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('calls sessionEvidence.publish.mutateAsync with a byte-identical {sessionEvidenceId} payload and invalidates sessionEvidence', async () => {
    const invalidateSpy = trpc.useUtils().sessionEvidence.invalidate;
    renderWithProviders(<SessionEvidencePage />);
    await pickClassAndSession();
    fireEvent.change(screen.getByLabelText('Tóm tắt buổi học'), { target: { value: 'Nội dung.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tóm tắt' }));
    await screen.findByRole('button', { name: 'Công bố cho phụ huynh' });

    expect(invalidateSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Công bố cho phụ huynh' }));
    expect(publishMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Công bố' }));

    await waitFor(() => expect(publishMutateAsync).toHaveBeenCalledWith({ sessionEvidenceId: 'ev-1' }));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(1));
    // "Đã công bố" renders twice once published: the always-visible result
    // Banner's title AND the action-bar status Badge.
    expect(await screen.findAllByText('Đã công bố')).toHaveLength(2);
    expect(
      screen.getByText('Nhật ký buổi học đã được công bố. Phụ huynh có thể xem trong ứng dụng LMS.'),
    ).toBeInTheDocument();
  });

  it('does not query classBatch.list with any changed pagination shape (no page-size drift)', () => {
    renderWithProviders(<SessionEvidencePage />);
    const [input] = classBatchSpy.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(input).sort()).toEqual(['page', 'pageSize']);
  });
});
