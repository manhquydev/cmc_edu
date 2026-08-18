// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@cmc/ui';
import { SessionProvider } from '../lib/session-context.js';
import ClassDetailPage from './classes/class-detail.js';
import StudentDetailPage from './students/student-detail.js';
import ReceiptDetailPage from './finance/receipt-detail.js';

const routingState = vi.hoisted(() => {
  const classId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const studentId = '11111111-2222-4333-8444-555555555555';
  const receiptId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  return {
    classId,
    studentId,
    receiptId,
    class: {
      id: classId,
      code: 'CB001',
      program: 'IELTS',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-06-01T00:00:00.000Z',
      roomId: null,
      teacherId: null,
      teacherAppUserId: null,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    student: {
      id: studentId,
      fullName: 'Roster Kid',
      lifecycle: 'active',
      parentPhone: null,
    },
    receipt: {
      id: receiptId,
      code: 'SO0001',
      status: 'draft',
      kind: 'new',
      opportunityId: null,
      parentPhone: '0912345678',
      studentName: 'Roster Kid',
      classBatchId: classId,
      classBatchCode: 'CB001',
      netAmount: 5_000_000,
      createdAt: '2026-07-01T00:00:00.000Z',
      canApprove: false,
      refunds: [] as { id: string; receiptId: string; amount: number; createdAt: string }[],
      refundedTotal: 0,
      remainingBalance: 5_000_000,
      viewerCanRefund: false,
      viewerCanCancel: false,
    },
    rosterRows: [
      {
        enrollmentId: 'e-1',
        studentId,
        fullName: 'Roster Kid',
        status: 'active',
      },
    ],
    classGetCalls: [] as Array<[unknown, { enabled?: boolean } | undefined]>,
    studentGetCalls: [] as Array<[unknown, { enabled?: boolean } | undefined]>,
    receiptGetCalls: [] as Array<[unknown, { enabled?: boolean } | undefined]>,
  };
});

const { classId: CLASS_ID, studentId: STUDENT_ID, receiptId: RECEIPT_ID } = routingState;

vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock, mutationResult, queryResult } = await import('../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_kinh_doanh'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'classBatch.get.useQuery': (input: unknown, options: { enabled?: boolean } | undefined) => {
        routingState.classGetCalls.push([input, options]);
        return queryResult(routingState.class);
      },
      'classBatch.listStudents.useQuery': queryResult(routingState.rosterRows),
      'classSession.list.useQuery': queryResult([]),
      'curriculumUnit.list.useQuery': queryResult({ items: [] }),
      'user.pickList.useQuery': queryResult({ items: [] }),
      'student.get.useQuery': (input: unknown, options: { enabled?: boolean } | undefined) => {
        routingState.studentGetCalls.push([input, options]);
        return queryResult(routingState.student);
      },
      'student.setLifecycle.useMutation': () => mutationResult(),
      'finance.receiptGet.useQuery': (input: unknown, options: { enabled?: boolean } | undefined) => {
        routingState.receiptGetCalls.push([input, options]);
        return queryResult(routingState.receipt);
      },
      'finance.receiptApprove.useMutation': () => mutationResult(),
      'finance.refundCreate.useMutation': () => mutationResult(),
      'finance.receiptCancel.useMutation': () => mutationResult(),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

function renderRouter(routes: RouteObject[], initialEntries: string[], initialIndex = initialEntries.length - 1) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries, initialIndex });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return router;
}

async function expectLocation(
  router: ReturnType<typeof createMemoryRouter>,
  pathname: string,
  search = '',
) {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(pathname);
    expect(router.state.location.search).toBe(search);
  });
}

describe('Phase 5 durable detail routing', () => {
  beforeEach(() => {
    routingState.classGetCalls.length = 0;
    routingState.studentGetCalls.length = 0;
    routingState.receiptGetCalls.length = 0;
  });

  it('class tabs push history and Back/Forward preserve the query string', async () => {
    const search = '?q=HN-UCREA&page=2';
    const router = renderRouter(
      [{ path: '/admin/classes/:id/:section', element: <ClassDetailPage /> }],
      [`/admin/classes/${CLASS_ID}/overview${search}`],
    );

    expect(routingState.classGetCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ enabled: true }));
    fireEvent.click(screen.getByRole('link', { name: 'Học viên' }));
    await expectLocation(router, `/admin/classes/${CLASS_ID}/students`, search);

    await act(async () => {
      await router.navigate(-1);
    });
    await expectLocation(router, `/admin/classes/${CLASS_ID}/overview`, search);

    await act(async () => {
      await router.navigate(1);
    });
    await expectLocation(router, `/admin/classes/${CLASS_ID}/students`, search);
  });

  it('student tabs push history and Back/Forward preserve the query string', async () => {
    const search = '?view=compact&page=2';
    const router = renderRouter(
      [{ path: '/admin/students/:id/:section', element: <StudentDetailPage /> }],
      [`/admin/students/${STUDENT_ID}/profile${search}`],
    );

    expect(routingState.studentGetCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ enabled: true }));
    fireEvent.click(screen.getByRole('link', { name: 'Lớp học' }));
    await expectLocation(router, `/admin/students/${STUDENT_ID}/enrollments`, search);

    await act(async () => {
      await router.navigate(-1);
    });
    await expectLocation(router, `/admin/students/${STUDENT_ID}/profile`, search);

    await act(async () => {
      await router.navigate(1);
    });
    await expectLocation(router, `/admin/students/${STUDENT_ID}/enrollments`, search);
  });

  it('receipt tabs push history and Back/Forward preserve the query string', async () => {
    const search = '?status=draft&page=3';
    const router = renderRouter(
      [{ path: '/finance/:id/:section', element: <ReceiptDetailPage /> }],
      [`/finance/${RECEIPT_ID}/overview${search}`],
    );

    expect(routingState.receiptGetCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ enabled: true }));
    fireEvent.click(screen.getByRole('link', { name: 'Chi tiết thanh toán' }));
    await expectLocation(router, `/finance/${RECEIPT_ID}/order-lines`, search);

    await act(async () => {
      await router.navigate(-1);
    });
    await expectLocation(router, `/finance/${RECEIPT_ID}/overview`, search);

    await act(async () => {
      await router.navigate(1);
    });
    await expectLocation(router, `/finance/${RECEIPT_ID}/order-lines`, search);
  });

  it('class roster -> student -> explicit return restores the exact class query', async () => {
    const search = '?q=HN-UCREA&page=2';
    const router = renderRouter(
      [
        { path: '/admin/classes/:id/:section', element: <ClassDetailPage /> },
        { path: '/admin/students/:id/:section', element: <StudentDetailPage /> },
      ],
      [`/admin/classes/${CLASS_ID}/students${search}`],
    );

    fireEvent.click(screen.getByRole('link', { name: routingState.student.fullName }));
    await expectLocation(router, `/admin/students/${STUDENT_ID}/profile`);
    expect(router.state.location.state).toEqual({
      from: {
        pathname: `/admin/classes/${CLASS_ID}/students`,
        search,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Về danh sách học viên của lớp' }));
    await expectLocation(router, `/admin/classes/${CLASS_ID}/students`, search);
  });

  it('does not enable the class detail query for a malformed id', () => {
    const router = renderRouter(
      [{ path: '/admin/classes/:id/:section', element: <ClassDetailPage /> }],
      ['/admin/classes/not-a-uuid/overview'],
    );

    expect(router.state.location.pathname).toBe('/admin/classes/not-a-uuid/overview');
    expect(routingState.classGetCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ enabled: false }));
    expect(screen.getAllByText('ID không hợp lệ').length).toBeGreaterThanOrEqual(1);
  });

  it('does not enable the student detail query for a malformed id', () => {
    renderRouter(
      [{ path: '/admin/students/:id/:section', element: <StudentDetailPage /> }],
      ['/admin/students/not-a-uuid/profile'],
    );

    expect(routingState.studentGetCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ enabled: false }));
    expect(screen.getAllByText('ID không hợp lệ').length).toBeGreaterThanOrEqual(1);
  });

  it('does not enable the receipt detail query for a malformed id', () => {
    renderRouter(
      [{ path: '/finance/:id/:section', element: <ReceiptDetailPage /> }],
      ['/finance/not-a-uuid/overview'],
    );

    expect(routingState.receiptGetCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ enabled: false }));
    expect(screen.getAllByText('ID không hợp lệ').length).toBeGreaterThanOrEqual(1);
  });
});
