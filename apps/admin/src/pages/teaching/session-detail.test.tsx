// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers.js';

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
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giao_vien'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'classSession.get.useQuery': (_input: unknown, opts?: { enabled?: boolean }) =>
        opts?.enabled === false ? queryResult(undefined) : queryResult(SESSION),
      'classSession.doneProgress.useQuery': (_i: unknown, opts?: { enabled?: boolean }) =>
        opts?.enabled === false ? queryResult(undefined) : queryResult(PROGRESS),
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
});
