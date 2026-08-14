// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const confirmMutate = vi.fn();
const overrideMutate = vi.fn();

const { SCORE_ID, SCORE } = vi.hoisted(() => {
  const SCORE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return {
    SCORE_ID,
    SCORE: {
      id: SCORE_ID,
      appUserId: 'au1',
      period: '2026-08',
      status: 'submitted',
      value: 1_500_000,
      override: false,
      overrideReason: null,
      tierMissing: false,
      viewerCanConfirm: true,
      viewerCanOverride: true,
      fullName: 'Nguyễn Văn A',
      position: 'Sale',
      appUser: {
        id: 'au1',
        fullName: 'Nguyễn Văn A',
        userId: 'u-owner',
        managerId: 'au-mgr',
        roles: ['sale'],
        position: 'Sale',
      },
    },
  };
});

const scoreState: { data: typeof SCORE } = { data: SCORE };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ scoreId: SCORE_ID }),
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u-director',
          roles: ['giam_doc_kinh_doanh'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'kpi.get.useQuery': () => queryResult(scoreState.data),
      'kpi.confirm.useMutation': () => mutationResult({ mutate: confirmMutate }),
      'kpi.override.useMutation': () => mutationResult({ mutate: overrideMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import KpiDetailPage from './kpi-detail.js';

describe('KpiDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scoreState.data = SCORE;
  });

  it('renders form from kpi.get', () => {
    renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    expect(screen.getAllByText(/Phiếu KPI|Nguyễn Văn A/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1\.500\.000|1,500,000|1500000/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Xác nhận for director on submitted', () => {
    renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();
  });

  it('calls kpi.confirm.mutate({kpiScoreId}) only after ConfirmDialog confirm', () => {
    renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(confirmMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    expect(confirmMutate).toHaveBeenCalledWith({ kpiScoreId: SCORE_ID });
  });

  it('calls kpi.override.mutate with value and reason from form', () => {
    renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    fireEvent.click(screen.getByRole('button', { name: 'Ghi đè' }));
    // Prefer dialog field labels — sheet also shows "Giá trị" in HighlightStrip/KeyValueList.
    fireEvent.change(screen.getByLabelText(/^Giá trị mới \(VND\)/), {
      target: { value: '1800000' },
    });
    fireEvent.change(screen.getByLabelText(/^Lý do ghi đè/), {
      target: { value: 'Điều chỉnh E2E' },
    });
    const submitButtons = screen.getAllByRole('button', { name: 'Ghi đè' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    expect(overrideMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        kpiScoreId: SCORE_ID,
        overrideReason: 'Điều chỉnh E2E',
      }),
    );
  });

  it('gives every submitted status badge the brand tone (manager is the one waiting)', () => {
    const { container } = renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    const badges = Array.from(container.querySelectorAll('.console-badge-soft')).filter(
      (el) => el.textContent === 'Chờ xác nhận',
    );
    // EntityHeader badge + HighlightStrip + KeyValueList all show the status.
    expect(badges.length).toBeGreaterThanOrEqual(3);
    for (const badge of badges) {
      expect(badge).toHaveClass('console-badge-soft--brand');
    }
  });

  it('leaves a draft phiếu KPI on the neutral map — the employee is still editing it', () => {
    scoreState.data = { ...SCORE, status: 'draft' };
    const { container } = renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    const badges = Array.from(container.querySelectorAll('.console-badge-soft')).filter(
      (el) => el.textContent === 'Nháp',
    );
    expect(badges.length).toBeGreaterThanOrEqual(1);
    for (const badge of badges) {
      expect(badge).toHaveClass('console-badge-soft--neutral');
      expect(badge).not.toHaveClass('console-badge-soft--brand');
    }
  });

  it('shows Odoo-like statusbar steps and dense sheet fields (no chatter)', () => {
    renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    expect(screen.getByRole('list', { name: 'Các bước' })).toBeInTheDocument();
    expect(screen.getByText('Thông tin phiếu')).toBeInTheDocument();
    expect(screen.getAllByText('Nhân viên').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kỳ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Giá trị/).length).toBeGreaterThanOrEqual(1);
    // No chatter product surface.
    expect(screen.queryByText(/Send message|Log note|Follow/i)).toBeNull();
  });
});
