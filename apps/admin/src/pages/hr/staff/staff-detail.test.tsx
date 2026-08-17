// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render-with-providers.js';
import StaffDetailLayout from './staff-detail.js';

// D1: the shell cold-starts the record via user.get (no list cache) and
// renders loading / invalid-id / not-found / forbidden states; the profile
// and access tabs are route-owned sections.

const STAFF_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let paramStaffId: string = STAFF_UUID;

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ staffId: paramStaffId }),
  };
});

let getResult: unknown;
let getError: unknown;
let getLoading = false;
let sessionRoles: string[] = ['giam_doc_kinh_doanh'];

vi.mock('../../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'user.get.useQuery': () =>
        queryResult(getResult, {
          isLoading: getLoading,
          ...(getError ? { error: getError } : {}),
        }),
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionRoles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

function makeStaff() {
  return {
    id: STAFF_UUID,
    facilityId: 'f1',
    userId: 'u-staff',
    email: 'staff@test.cmc',
    fullName: 'Nhân Viên Mẫu',
    position: 'sale',
    managerId: null,
    employeeCode: 'CMC0007',
    roles: ['sale'],
    isActive: true,
    manager: null,
  };
}

describe('StaffDetailLayout', () => {
  beforeEach(() => {
    getResult = makeStaff();
    getError = null;
    getLoading = false;
    sessionRoles = ['giam_doc_kinh_doanh'];
    paramStaffId = STAFF_UUID;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('cold-starts the record and renders the identity strip', () => {
    renderWithProviders(<StaffDetailLayout />);
    // Name appears in both the breadcrumb and the EntityHeader title.
    expect(screen.getAllByText('Nhân Viên Mẫu').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/CMC0007/)).toBeInTheDocument();
  });

  it('renders the invalid-id state without an API call for a malformed id', () => {
    getResult = undefined;
    paramStaffId = 'not-a-uuid';
    renderWithProviders(<StaffDetailLayout />);
    expect(screen.getByText('ID không hợp lệ')).toBeInTheDocument();
  });

  it('renders not-found for a NOT_FOUND error', () => {
    // Real tRPC error shape: code lives at error.data.code (TRPCClientError).
    getError = { data: { code: 'NOT_FOUND' }, message: 'AppUser not found.' };
    renderWithProviders(<StaffDetailLayout />);
    expect(screen.getByText('Không tìm thấy hồ sơ')).toBeInTheDocument();
  });

  it('renders the generic error state for other errors', () => {
    getError = { data: { code: 'INTERNAL_SERVER_ERROR' }, message: 'boom' };
    renderWithProviders(<StaffDetailLayout />);
    expect(screen.getByText('Không mở được hồ sơ')).toBeInTheDocument();
  });

  it('renders a gated EmptyState when the user lacks user.manage', () => {
    sessionRoles = ['giao_vien'];
    renderWithProviders(<StaffDetailLayout />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
  });
});
