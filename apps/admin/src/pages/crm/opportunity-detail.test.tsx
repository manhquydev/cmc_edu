// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks opportunity-detail behavior: (1) a direct id query resolves records
// independently of pipeline pagination, and (2) the page's action
// bar (advance / mark-lost / reopen) wired to the real mutations with the
// exact payload shapes `apps/api/src/crm/router.ts` expects.
interface OpportunityRow {
  id: string;
  stage: string;
  closedAt: string | null;
  lostReason?: string | null;
  contact: { id: string; name: string; phone: string };
  source?: string | null;
  assignedTo?: { userId: string; fullName: string } | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
  isRotting?: boolean;
  rottingDays?: number | null;
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

// Error-visibility remediation: advance/reopen/complete/no-show previously had
// nowhere on the page to show a rejection — these states let a test simulate
// each mutation's `.error` the same way `assignState` already does below.
const advanceState: { error: { message: string } | null; isPending: boolean } = {
  error: null,
  isPending: false,
};
const markLostState: { error: { message: string } | null } = { error: null };
const completeState: { error: { message: string } | null } = { error: null };
const noShowState: { error: { message: string } | null } = { error: null };

// phase-10: owner assign. `sessionState.roles` toggles the manager-select vs
// sale-claim UI (mirrors `opportunityAssign`'s row-level rule, server-side
// source of truth). `assignState.error` simulates a FORBIDDEN rejection
// surfaced by the mutation object.
const sessionState: { roles: string[] } = { roles: ['sale'] };
const assignMutate = vi.fn();
const assignState: { isPending: boolean; error: { message: string } | null } = {
  isPending: false,
  error: null,
};
const assignableStaffState: { data: { userId: string; fullName: string }[] } = { data: [] };
const assignableStaffQuerySpy = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionState.roles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'crm.opportunityGet.useQuery': (input: { opportunityId: string }) => {
        listQuerySpy(input);
        return queryResult(listState.items.find((item) => item.id === input.opportunityId));
      },
      'crm.opportunityTimeline.useQuery': () =>
        queryResult({ items: [], nextCursor: null, historySince: null }),
      'crm.opportunityAddNote.useMutation': () => mutationResult(),
      'crm.opportunityAdvance.useMutation': () =>
        mutationResult({
          mutate: advanceMutate,
          error: advanceState.error,
          isPending: advanceState.isPending,
        }),
      'crm.opportunityMarkLost.useMutation': () =>
        mutationResult({ mutate: markLostMutate, error: markLostState.error }),
      'crm.opportunityAssign.useMutation': () =>
        mutationResult({ mutate: assignMutate, isPending: assignState.isPending, error: assignState.error }),
      'crm.assignableStaff.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        assignableStaffQuerySpy(opts?.enabled);
        if (!opts?.enabled) return queryResult(undefined);
        return queryResult(assignableStaffState.data);
      },
      'testAppointment.forOpportunity.useQuery': (input: unknown) => {
        appointmentsQuerySpy(input);
        return queryResult(appointmentsState.items);
      },
      'testAppointment.schedule.useMutation': () => mutationResult({ mutate: scheduleTestMutate }),
      'testAppointment.complete.useMutation': () =>
        mutationResult({ mutate: completeMutate, error: completeState.error }),
      'testAppointment.noShow.useMutation': () =>
        mutationResult({ mutate: noShowMutate, error: noShowState.error }),
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
    // Reset in case a phase-10 owner/source test below reassigned it.
    listState.items = [OPP_O1, OPP_O4, OPP_O5, OPP_LOST, OPP_O2];
    listQuerySpy.mockClear();
    appointmentsQuerySpy.mockClear();
    advanceMutate.mockClear();
    markLostMutate.mockClear();
    scheduleTestMutate.mockClear();
    completeMutate.mockClear();
    noShowMutate.mockClear();
    appointmentsState.items = [];
    sessionState.roles = ['sale'];
    assignMutate.mockClear();
    assignState.isPending = false;
    assignState.error = null;
    assignableStaffState.data = [];
    assignableStaffQuerySpy.mockClear();
    advanceState.error = null;
    advanceState.isPending = false;
    markLostState.error = null;
    completeState.error = null;
    noShowState.error = null;
  });

  it('queries crm.opportunityGet by route id so a lost or later-page opportunity resolves', () => {
    renderDetail(OPP_LOST.id);
    expect(listQuerySpy).toHaveBeenCalledWith({ opportunityId: OPP_LOST.id });
    expect(screen.getByRole('heading', { name: 'Phạm Thị D' })).toBeInTheDocument();
  });

  it('renders the record timeline chatter on the detail page', () => {
    renderDetail(OPP_O1.id);
    expect(screen.getByTestId('record-timeline')).toBeInTheDocument();
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

  describe('action-bar mutation errors (advance/reopen/complete/no-show)', () => {
    it('surfaces an opportunityAdvance error in the shared action banner', () => {
      advanceState.error = { message: 'Không thể chuyển giai đoạn.' };
      renderDetail(OPP_O1.id);
      fireEvent.click(screen.getByRole('button', { name: 'Chuyển lên' }));
      expect(screen.getByText('Thao tác thất bại')).toBeInTheDocument();
      expect(screen.getByText('Không thể chuyển giai đoạn.')).toBeInTheDocument();
    });

    it('maps English Invalid stage transition to Vietnamese stale-cache copy', () => {
      advanceState.error = {
        message: 'Invalid stage transition from O1_LEAD to O3_TEST_SCHEDULED; opportunities advance one stage at a time.',
      };
      renderDetail(OPP_O1.id);
      expect(screen.getByText('Thao tác thất bại')).toBeInTheDocument();
      expect(
        screen.getByText('Không thể chuyển giai đoạn — dữ liệu đã đổi, đang tải lại.'),
      ).toBeInTheDocument();
    });

    it('surfaces a reopen (opportunityMarkLost) error in the shared action banner', () => {
      markLostState.error = { message: 'Không thể mở lại cơ hội.' };
      renderDetail(OPP_LOST.id);
      fireEvent.click(screen.getByRole('button', { name: 'Mở lại cơ hội' }));
      expect(screen.getByText('Thao tác thất bại')).toBeInTheDocument();
      // MarkLostDialog (closed here — `markLostOpen` was never set) stays
      // mounted with its own `markLostMutation.error` span regardless of
      // `isOpen`, hidden only by the native <dialog>'s closed state — so the
      // message legitimately matches twice in the DOM; assert with
      // `getAllByText` instead of demanding a single match.
      expect(screen.getAllByText('Không thể mở lại cơ hội.').length).toBeGreaterThan(0);
    });

    it('does not duplicate a mark-lost error into the page banner while the dialog is open (dialog already shows it inline)', () => {
      markLostState.error = { message: 'Lỗi lưu lý do mất.' };
      renderDetail(OPP_O4.id);
      fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu mất' }));
      expect(screen.getAllByText('Lỗi lưu lý do mất.')).toHaveLength(1);
      expect(screen.queryByText('Thao tác thất bại')).not.toBeInTheDocument();
    });

    it('surfaces a testAppointment.complete error in the shared action banner', () => {
      completeState.error = { message: 'Không thể đánh dấu hoàn thành.' };
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
      expect(screen.getByText('Thao tác thất bại')).toBeInTheDocument();
      expect(screen.getByText('Không thể đánh dấu hoàn thành.')).toBeInTheDocument();
    });

    it('surfaces a testAppointment.noShow error in the shared action banner', () => {
      noShowState.error = { message: 'Không thể đánh dấu vắng mặt.' };
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
      expect(screen.getByText('Thao tác thất bại')).toBeInTheDocument();
      expect(screen.getByText('Không thể đánh dấu vắng mặt.')).toBeInTheDocument();
    });
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

  it('shows rotting days on the header badge', () => {
    listState.items = [{ ...OPP_O1, isRotting: true, rottingDays: 9 }];
    renderDetail(OPP_O1.id);
    expect(screen.getByTestId('crm-rotting-badge')).toHaveTextContent('Nguội 9 ngày');
  });

  it('colours the next-action date from the raw due instant', () => {
    listState.items = [
      {
        ...OPP_O1,
        nextActionAt: '2020-01-15T00:00:00.000Z',
        nextActionNote: 'Gọi lại',
      },
    ];
    renderDetail(OPP_O1.id);
    const block = screen.getByTestId('crm-next-action');
    expect(block.querySelector('.cmc-due-late')).not.toBeNull();
    expect(block).toHaveTextContent('Gọi lại');
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

  describe('owner + source (phase-10, crm.opportunityAssign)', () => {
    it('shows the owner fullName and "Chưa giao" when unassigned', () => {
      renderDetail(OPP_O2.id);
      // HighlightStrip + KeyValueList both surface owner.
      expect(screen.getAllByText('Chưa giao').length).toBeGreaterThanOrEqual(1);
    });

    it('shows the resolved owner fullName when assignedTo is set', () => {
      listState.items = [{ ...OPP_O2, assignedTo: { userId: 'u1', fullName: 'Nguyễn Văn Sale' } }];
      renderDetail(OPP_O2.id);
      expect(screen.getAllByText('Nguyễn Văn Sale').length).toBeGreaterThanOrEqual(1);
    });

    it('shows the mapped Vietnamese source label', () => {
      listState.items = [{ ...OPP_O2, source: 'fanpage' }];
      renderDetail(OPP_O2.id);
      expect(screen.getAllByText('Fanpage').length).toBeGreaterThanOrEqual(1);
    });

    it('shows "—" when source is null', () => {
      listState.items = [{ ...OPP_O2, source: null }];
      renderDetail(OPP_O2.id);
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    });

    it('a manager (giam_doc_kinh_doanh) sees a "Giao cho" owner select populated from assignableStaff', () => {
      sessionState.roles = ['giam_doc_kinh_doanh'];
      assignableStaffState.data = [{ userId: 'u2', fullName: 'Trần Thị Manager' }];
      renderDetail(OPP_O2.id);
      expect(assignableStaffQuerySpy).toHaveBeenCalledWith(true);
      expect(screen.getByRole('combobox', { name: 'Giao cho' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Nhận cơ hội' })).not.toBeInTheDocument();
    });

    it('a manager selecting a staff option calls opportunityAssign.mutate with {opportunityId, assigneeUserId}', () => {
      sessionState.roles = ['giam_doc_kinh_doanh'];
      assignableStaffState.data = [{ userId: 'u2', fullName: 'Trần Thị Manager' }];
      renderDetail(OPP_O2.id);
      fireEvent.click(screen.getByRole('combobox', { name: 'Giao cho' }));
      fireEvent.click(screen.getByRole('option', { name: 'Trần Thị Manager' }));
      expect(assignMutate).toHaveBeenCalledWith({ opportunityId: OPP_O2.id, assigneeUserId: 'u2' });
    });

    it('a manager selecting "— Chưa giao —" calls opportunityAssign.mutate with assigneeUserId: null', () => {
      sessionState.roles = ['giam_doc_kinh_doanh'];
      listState.items = [{ ...OPP_O2, assignedTo: { userId: 'u2', fullName: 'Trần Thị Manager' } }];
      assignableStaffState.data = [{ userId: 'u2', fullName: 'Trần Thị Manager' }];
      renderDetail(OPP_O2.id);
      fireEvent.click(screen.getByRole('combobox', { name: 'Giao cho' }));
      fireEvent.click(screen.getByRole('option', { name: '— Chưa giao —' }));
      expect(assignMutate).toHaveBeenCalledWith({ opportunityId: OPP_O2.id, assigneeUserId: null });
    });

    it('a sale sees "Nhận cơ hội" for an unassigned lead and claims it as themselves', () => {
      renderDetail(OPP_O2.id);
      expect(screen.queryByRole('combobox', { name: 'Giao cho' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Nhận cơ hội' }));
      expect(assignMutate).toHaveBeenCalledWith({ opportunityId: OPP_O2.id, assigneeUserId: 'u1' });
    });

    it('a sale sees "Nhận cơ hội" for a lead already assigned to themselves', () => {
      listState.items = [{ ...OPP_O2, assignedTo: { userId: 'u1', fullName: 'Nguyễn Văn Sale' } }];
      renderDetail(OPP_O2.id);
      expect(screen.getByRole('button', { name: 'Nhận cơ hội' })).toBeInTheDocument();
    });

    it('a sale does NOT see "Nhận cơ hội" for a lead already owned by someone else', () => {
      listState.items = [{ ...OPP_O2, assignedTo: { userId: 'u2', fullName: 'Người Khác' } }];
      renderDetail(OPP_O2.id);
      expect(screen.queryByRole('button', { name: 'Nhận cơ hội' })).not.toBeInTheDocument();
    });

    it('surfaces a FORBIDDEN opportunityAssign error inline without crashing the page', () => {
      assignState.error = { message: 'Bạn chỉ có thể nhận cơ hội cho chính mình.' };
      renderDetail(OPP_O2.id);
      expect(screen.getByText('Bạn chỉ có thể nhận cơ hội cho chính mình.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Hoàng Văn G' })).toBeInTheDocument();
    });
  });

  describe('statusbar one-step advance (canStepClick)', () => {
    it('enables the adjacent next step (O2), disables past/current and O5, and advances on click', () => {
      renderDetail(OPP_O1.id);
      const next = screen.getByRole('button', { name: /Đã liên hệ/ });
      const current = screen.getByRole('button', { name: /Tiếp cận/ });
      const enrolled = screen.getByRole('button', { name: 'Đã ghi danh' });
      expect(next).not.toBeDisabled();
      expect(current).toBeDisabled();
      expect(enrolled).toBeDisabled();

      fireEvent.click(next);
      expect(advanceMutate).toHaveBeenCalledWith({
        opportunityId: OPP_O1.id,
        toStage: 'O2_CONTACTED',
      });

      fireEvent.click(current);
      expect(advanceMutate).toHaveBeenCalledTimes(1);
    });

    it('disables the next step for a sale when the opportunity is owned by someone else', () => {
      listState.items = [
        { ...OPP_O1, assignedTo: { userId: 'u2', fullName: 'Người Khác' } },
      ];
      sessionState.roles = ['sale'];
      renderDetail(OPP_O1.id);
      expect(screen.getByRole('button', { name: /Đã liên hệ/ })).toBeDisabled();
    });

    it('enables the next step for a manager even when owned by someone else', () => {
      listState.items = [
        { ...OPP_O1, assignedTo: { userId: 'u2', fullName: 'Người Khác' } },
      ];
      sessionState.roles = ['giam_doc_kinh_doanh'];
      renderDetail(OPP_O1.id);
      const next = screen.getByRole('button', { name: /Đã liên hệ/ });
      expect(next).not.toBeDisabled();
      fireEvent.click(next);
      expect(advanceMutate).toHaveBeenCalledWith({
        opportunityId: OPP_O1.id,
        toStage: 'O2_CONTACTED',
      });
    });

    it('disables every statusbar step while advance is pending', () => {
      advanceState.isPending = true;
      renderDetail(OPP_O1.id);
      expect(screen.getByRole('button', { name: /Đã liên hệ/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Tiếp cận/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Đã ghi danh' })).toBeDisabled();
    });

    it('disables every statusbar step on a lost opportunity', () => {
      renderDetail(OPP_LOST.id);
      // Current/done steps append sr-only state ("Đang thực hiện" / "Đã hoàn thành")
      // to the accessible name — match by prefix like ProgressSteps tests.
      expect(screen.getByRole('button', { name: /Đã liên hệ/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Tiếp cận/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Đã ghi danh' })).toBeDisabled();
    });

    it('does not enable O5 on an O4 opportunity (money gate)', () => {
      renderDetail(OPP_O4.id);
      expect(screen.getByRole('button', { name: 'Đã ghi danh' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Đã kiểm tra/ })).toBeDisabled();
    });

    it('enables the next step for a sale who owns the opportunity', () => {
      listState.items = [
        { ...OPP_O1, assignedTo: { userId: 'u1', fullName: 'Chính mình' } },
      ];
      sessionState.roles = ['sale'];
      renderDetail(OPP_O1.id);
      expect(screen.getByRole('button', { name: /Đã liên hệ/ })).not.toBeDisabled();
    });
  });
});
