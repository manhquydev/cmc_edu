// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const { PARENT_ID, PARENT } = vi.hoisted(() => {
  const PARENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  return {
    PARENT_ID,
    PARENT: {
      id: PARENT_ID,
      phone: '0901234567',
      email: 'parent@example.com',
      isActive: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
      linkedChildrenCount: 1,
      children: [
        {
          guardianId: 'g1',
          relation: 'mother',
          studentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          studentName: 'Trẻ A',
        },
      ],
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ parentId: PARENT_ID }),
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: ['sale'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'parentAccount.get.useQuery': queryResult(PARENT),
      'parentAccount.updateEmail.useMutation': () => mutationResult({ mutate: vi.fn() }),
      'parentAccount.setActive.useMutation': () => mutationResult({ mutate: vi.fn() }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ParentDetailPage from './parent-detail.js';

describe('ParentDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders parent form from get', () => {
    renderWithProviders(<ParentDetailPage />, { route: `/admin/parents/${PARENT_ID}` });
    expect(screen.getAllByText('0901234567').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('parent@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Trẻ A')).toBeInTheDocument();
    // Console form grammar (strip + sheet)
    expect(screen.getByText('Thông tin phụ huynh')).toBeInTheDocument();
    expect(screen.getByText('Danh sách con')).toBeInTheDocument();
  });

  it('puts primary actions on entity header', () => {
    renderWithProviders(<ParentDetailPage />, { route: `/admin/parents/${PARENT_ID}` });
    expect(screen.getByRole('button', { name: 'Sửa email' })).toBeInTheDocument();
  });
});
