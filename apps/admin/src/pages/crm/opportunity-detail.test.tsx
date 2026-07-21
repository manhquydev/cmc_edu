// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks phase-03's opportunity-detail remediation: (1) the list query now
// passes `lost: 'include'` so a lost opp's detail page still resolves
// (backend default flipped to `exclude` — F7), and (2) the page's new action
// bar (advance / mark-lost / reopen) wired to the real mutations with the
// exact payload shapes `apps/api/src/crm/router.ts` expects.
interface OpportunityRow {
  id: string;
  stage: string;
  closedAt: string | null;
  lostReason?: string | null;
  contact: { id: string; name: string; phone: string };
}

const OPP_O1: OpportunityRow = {
  id: 'opp-o1',
  stage: 'O1_LEAD',
  closedAt: null,
  contact: { id: 'c1', name: 'Nguyễn Văn A', phone: '0900000001' },
};
const OPP_O4: OpportunityRow = {
  id: 'opp-o4',
  stage: 'O4_TESTED',
  closedAt: null,
  contact: { id: 'c4', name: 'Trần Thị B', phone: '0900000004' },
};
const OPP_O5: OpportunityRow = {
  id: 'opp-o5',
  stage: 'O5_ENROLLED',
  closedAt: '2026-07-01T00:00:00.000Z',
  contact: { id: 'c5', name: 'Lê Văn C', phone: '0900000005' },
};
const OPP_LOST: OpportunityRow = {
  id: 'opp-lost',
  stage: 'O2_CONTACTED',
  closedAt: '2026-07-01T00:00:00.000Z',
  lostReason: 'no_response',
  contact: { id: 'c6', name: 'Phạm Thị D', phone: '0900000006' },
};
const OPP_O2: OpportunityRow = {
  id: 'opp-o2',
  stage: 'O2_CONTACTED',
  closedAt: null,
  contact: { id: 'c7', name: 'Hoàng Văn G', phone: '0900000007' },
};

interface AppointmentRow {
  id: string;
  type: string;
  opportunityId: string;
  studentId: string | null;
  scheduledAt: string;
  status: 'scheduled' | 'done' | 'no_show';
  notes: string | null;
}

const listState: { items: OpportunityRow[] } = { items: [OPP_O1, OPP_O4, OPP_O5, OPP_LOST, OPP_O2] };
const appointmentsState: { items: AppointmentRow[] } = { items: [] };
const listQuerySpy = vi.fn();
const appointmentsQuerySpy = vi.fn();
const advanceMutate = vi.fn();
const markLostMutate = vi.fn();
const scheduleTestMutate = vi.fn();
const completeMutate = vi.fn();
const noShowMutate = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['sale'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'crm.opportunityList.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(listState);
      },
      'crm.opportunityAdvance.useMutation': () => mutationResult({ mutate: advanceMutate }),
      'crm.opportunityMarkLost.useMutation': () => mutationResult({ mutate: markLostMutate }),
      'testAppointment.forOpportunity.useQuery': (input: unknown) => {
        appointmentsQuerySpy(input);
        return queryResult(appointmentsState.items);
      },
      'testAppointment.schedule.useMutation': () => mutationResult({ mutate: scheduleTestMutate }),
      'testAppointment.complete.useMutation': () => mutationResult({ mutate: completeMutate }),
      'testAppointment.noShow.useMutation': () => mutationResult({ mutate: noShowMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import OpportunityDetailPage from './opportunity-detail.js';

function renderDetail(opportunityId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/crm/opportunities/:id" element={<OpportunityDetailPage />} />
    </Routes>,
    { route: `/crm/opportunities/${opportunityId}` },
  );
}

async function selectLostReason(label: RegExp = /Không phản hồi/) {
  fireEvent.click(screen.getByLabelText(/^Lý do mất/));
  const option = await screen.findByRole('option', { name: label });
  fireEvent.click(option);
}

describe('OpportunityDetailPage', () => {
  beforeEach(() => {
    listQuerySpy.mockClear();
    appointmentsQuerySpy.mockClear();
    advanceMutate.mockClear();
    markLostMutate.mockClear();
    scheduleTestMutate.mockClear();
    completeMutate.mockClear();
    noShowMutate.mockClear();
    appointmentsState.items = [];
  });

  it('queries crm.opportunityList with lost: "include" so a lost opportunity still resolves', () => {
    renderDetail(OPP_LOST.id);
    expect(listQuerySpy).toHaveBeenCalledWith({ pageSize: 100, lost: 'include' });
    expect(screen.getByRole('heading', { name: 'Phạm Thị D' })).toBeInTheDocument();
  });

  it('shows a "Chuyển lên" action for an advanceable stage and calls opportunityAdvance.mutate with the next stage', () => {
    renderDetail(OPP_O1.id);
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển lên' }));
    expect(advanceMutate).toHaveBeenCalledWith({ opportunityId: OPP_O1.id, toStage: 'O2_CONTACTED' });
  });

  it('shows "Đánh dấu mất" for an open, non-O5 opportunity and submits with the chosen reason', async () => {
    renderDetail(OPP_O4.id);
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu mất' }));
    expect(screen.getByText('Đánh dấu mất cơ hội')).toBeInTheDocument();
    await selectLostReason();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(markLostMutate).toHaveBeenCalledWith(
      { opportunityId: OPP_O4.id, lostReason: 'no_response' },
      expect.anything(),
    );
  });

  it('shows "Mở lại cơ hội" for a lost opportunity and calls opportunityMarkLost.mutate({reopen: true})', () => {
    renderDetail(OPP_LOST.id);
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại cơ hội' }));
    expect(markLostMutate).toHaveBeenCalledWith({ opportunityId: OPP_LOST.id, reopen: true });
  });

  it('shows no advance/mark-lost/reopen actions for an O5_ENROLLED (won) opportunity', () => {
    renderDetail(OPP_O5.id);
    expect(screen.queryByRole('button', { name: 'Chuyển lên' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đánh dấu mất' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở lại cơ hội' })).not.toBeInTheDocument();
  });

  it('renders the lost banner with the mapped Vietnamese lostReason label', () => {
    renderDetail(OPP_LOST.id);
    expect(screen.getByText('Lý do: Không phản hồi')).toBeInTheDocument();
  });

  it('does not render pictographic emoji anywhere on the action bar', () => {
    const { container } = renderDetail(OPP_O1.id);
    // eslint-disable-next-line no-misleading-character-class
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  describe('"Đặt lịch test" action + appointment list (testAppointment.*)', () => {
    it('queries testAppointment.forOpportunity with the route opportunityId', () => {
      renderDetail(OPP_O2.id);
      expect(appointmentsQuerySpy).toHaveBeenCalledWith({ opportunityId: OPP_O2.id });
    });

    it('shows the action for an O2_CONTACTED opportunity and calls schedule.mutate with {type: "entrance", opportunityId, scheduledAt}', () => {
      renderDetail(OPP_O2.id);
      fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch test' }));
      expect(screen.getByText('Đặt lịch test đầu vào')).toBeInTheDocument();

      const datetimeInput = screen.getByLabelText('Thời gian test');
      fireEvent.change(datetimeInput, { target: { value: '2026-08-01T10:00' } });
      fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));

      expect(scheduleTestMutate).toHaveBeenCalledWith(
        {
          type: 'entrance',
          opportunityId: OPP_O2.id,
          scheduledAt: new Date('2026-08-01T10:00').toISOString(),
        },
        expect.anything(),
      );
    });

    it('does not show the action for an already-lost O2_CONTACTED opportunity', () => {
      renderDetail(OPP_LOST.id);
      expect(screen.queryByRole('button', { name: 'Đặt lịch test' })).not.toBeInTheDocument();
    });

    it('does not show the action for an O4_TESTED opportunity', () => {
      renderDetail(OPP_O4.id);
      expect(screen.queryByRole('button', { name: 'Đặt lịch test' })).not.toBeInTheDocument();
    });

    it('renders appointments returned by testAppointment.forOpportunity', () => {
      appointmentsState.items = [
        {
          id: 'appt-1',
          type: 'entrance',
          opportunityId: OPP_O2.id,
          studentId: null,
          scheduledAt: '2026-08-01T03:00:00.000Z',
          status: 'scheduled',
          notes: null,
        },
      ];
      renderDetail(OPP_O2.id);
      expect(screen.getByText('Đã đặt lịch')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hoàn thành' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vắng mặt' })).toBeInTheDocument();
    });

    it('calls testAppointment.complete.mutate({appointmentId}) when "Hoàn thành" is clicked', () => {
      appointmentsState.items = [
        {
          id: 'appt-1',
          type: 'entrance',
          opportunityId: OPP_O2.id,
          studentId: null,
          scheduledAt: '2026-08-01T03:00:00.000Z',
          status: 'scheduled',
          notes: null,
        },
      ];
      renderDetail(OPP_O2.id);
      fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
      expect(completeMutate).toHaveBeenCalledWith({ appointmentId: 'appt-1' });
    });

    it('calls testAppointment.noShow.mutate({appointmentId}) when "Vắng mặt" is clicked', () => {
      appointmentsState.items = [
        {
          id: 'appt-1',
          type: 'entrance',
          opportunityId: OPP_O2.id,
          studentId: null,
          scheduledAt: '2026-08-01T03:00:00.000Z',
          status: 'scheduled',
          notes: null,
        },
      ];
      renderDetail(OPP_O2.id);
      fireEvent.click(screen.getByRole('button', { name: 'Vắng mặt' }));
      expect(noShowMutate).toHaveBeenCalledWith({ appointmentId: 'appt-1' });
    });

    it('does not show complete/no-show actions for a "done" appointment', () => {
      appointmentsState.items = [
        {
          id: 'appt-1',
          type: 'entrance',
          opportunityId: OPP_O2.id,
          studentId: null,
          scheduledAt: '2026-08-01T03:00:00.000Z',
          status: 'done',
          notes: null,
        },
      ];
      renderDetail(OPP_O2.id);
      expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Hoàn thành' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Vắng mặt' })).not.toBeInTheDocument();
    });
  });
});
