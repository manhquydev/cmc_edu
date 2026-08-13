// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers.js';

const meState = vi.hoisted(() => ({
  roles: ['giao_vien'] as string[],
}));

const deliverMutate = vi.hoisted(() => vi.fn());
const deliverState = vi.hoisted(() => ({
  delivered: false,
  ended: true,
  hasUnit: true,
  cancelled: false,
  hasDelivery: false,
  sequenceLength: 1,
  nextPositionExists: true,
}));
const SESSION = {
  id: 'sess-1',
  classBatchId: 'batch-1',
  scheduleSlotId: null,
  sessionDate: '2026-08-03T00:00:00.000Z',
  startTime: '2026-08-03T11:00:00.000Z',
  endTime: '2026-08-03T12:30:00.000Z',
  status: 'confirmed',
  curriculumUnitId: null,
  batchCode: 'CMC-UCREA-001',
  program: 'UCREA',
  teacherId: 't1',
  courseId: 'c1',
  batchStatus: 'active',
};

const PROGRESS = {
  sessionId: 'sess-1',
  status: 'confirmed',
  attendanceOk: true,
  presentCount: 2,
  assessmentOk: false,
  assessmentsConfirmed: 0,
  assessmentsRequired: 2,
  evidenceOk: false,
  photoCount: 0,
  evidencePublished: false,
  timeGatePassed: false,
  eligible: false,
};

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: meState.roles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'classSession.get.useQuery': (_input: unknown, opts?: { enabled?: boolean }) =>
        opts?.enabled === false ? queryResult(undefined) : queryResult(SESSION),
      'classSession.doneProgress.useQuery': (_i: unknown, opts?: { enabled?: boolean }) =>
        opts?.enabled === false ? queryResult(undefined) : queryResult(PROGRESS),
      'lmsOps.sessionDeliveryStatus.useQuery': (_input: unknown, opts?: { enabled?: boolean }) =>
        opts?.enabled === false ? queryResult(undefined) : queryResult({ classSessionId: 'sess-1', classBatchId: 'batch-1', ...deliverState }),
      'lmsOps.deliverSessionExercise.useMutation': (opts?: {
        onSuccess?: (res: { delivered: boolean; reason?: string }) => void;
      }) =>
        mutationResult({
          mutate: (...args: unknown[]) => {
            deliverMutate(...args);
            void opts?.onSuccess?.({ delivered: false, reason: 'no_sequence_or_exhausted' });
          },
          isSuccess: false,
        }),
      'classBatch.listStudents.useQuery': queryResult([]),
      'attendance.listBySession.useQuery': queryResult({ items: [] }),
      'attendance.markAll.useMutation': () => mutationResult({ mutate: vi.fn() }),
      'assessment.listBySession.useQuery': queryResult({ items: [] }),
      'assessment.draftComment.useMutation': () => mutationResult({ mutate: vi.fn() }),
      'assessment.confirm.useMutation': () => mutationResult({ mutate: vi.fn() }),
      'sessionEvidence.getBySession.useQuery': queryResult(null),
      'sessionEvidence.upsert.useMutation': () => mutationResult({ mutate: vi.fn() }),
      'sessionEvidence.addPhoto.useMutation': () => mutationResult({ mutate: vi.fn() }),
      'sessionEvidence.publish.useMutation': () => mutationResult({ mutate: vi.fn() }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import SessionDetailPage from './session-detail.js';

function renderSession(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/teaching/sessions/:sessionId" element={<SessionDetailPage />} />
    </Routes>,
    { route },
  );
}

describe('SessionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meState.roles = ['giao_vien'];
    deliverState.hasDelivery = false;
    deliverState.ended = true;
    deliverState.hasUnit = true;
    deliverState.cancelled = false;
    deliverState.sequenceLength = 1;
    deliverState.nextPositionExists = true;
  });

  it('renders session identity and hub tabs', async () => {
    renderSession('/teaching/sessions/sess-1?tab=overview');

    expect(await screen.findByRole('heading', { name: 'CMC-UCREA-001' })).toBeTruthy();
    expect(screen.getAllByText(/UCREA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tổng quan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Điểm danh').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nhận xét').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nhật ký').length).toBeGreaterThan(0);
    // Console form grammar on overview
    expect(screen.getByText('Thông tin buổi học')).toBeInTheDocument();
  });

  it('default tab is attendance when tab query omitted', async () => {
    renderSession('/teaching/sessions/sess-1');
    expect(await screen.findByRole('button', { name: /Lưu điểm danh|Đã lưu/ })).toBeTruthy();
  });

  it('exposes Copy link for classSession deep share', async () => {
    renderSession('/teaching/sessions/sess-1?tab=overview');
    expect(await screen.findByRole('button', { name: /Copy link|Đã copy/ })).toBeTruthy();
  });

  it('hides Phát bài for giao_vien on the default attendance tab', async () => {
    renderSession('/teaching/sessions/sess-1');
    expect(await screen.findByRole('heading', { name: 'CMC-UCREA-001' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Phát bài' })).toBeNull();
  });

  it('hides Phát bài for giao_vien on the overview tab', async () => {
    renderSession('/teaching/sessions/sess-1?tab=overview');
    expect(await screen.findByRole('heading', { name: 'CMC-UCREA-001' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Phát bài' })).toBeNull();
  });

  it('shows Phát bài on EntityHeader for GĐĐT even on attendance tab', async () => {
    meState.roles = ['giam_doc_dao_tao'];
    renderSession('/teaching/sessions/sess-1');
    expect(await screen.findByRole('button', { name: 'Phát bài' })).toBeTruthy();
  });

  it('shows error Banner, not success, when deliver returns delivered:false', async () => {
    meState.roles = ['giam_doc_dao_tao'];
    renderSession('/teaching/sessions/sess-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Phát bài' }));
    expect(await screen.findByText('Không phát được bài')).toBeTruthy();
    expect(screen.getByText('Dãy bài trống hoặc đã hết vị trí.')).toBeTruthy();
    expect(screen.queryByText('Đã phát bài')).toBeNull();
  });
});
