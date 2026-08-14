// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

interface MutationOpts {
  onSuccess?: () => void;
}

const captured: {
  schedule?: MutationOpts;
  complete?: MutationOpts;
  noShow?: MutationOpts;
} = {};

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'testAppointment.schedule.useMutation': (opts: MutationOpts) => {
        captured.schedule = opts;
        return mutationResult();
      },
      'testAppointment.complete.useMutation': (opts: MutationOpts) => {
        captured.complete = opts;
        return mutationResult();
      },
      'testAppointment.noShow.useMutation': (opts: MutationOpts) => {
        captured.noShow = opts;
        return mutationResult();
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import { useTestAppointmentActions } from './use-test-appointment-actions.js';

function spies() {
  const utils = trpc.useUtils();
  return {
    list: utils.crm.opportunityList.invalidate as ReturnType<typeof vi.fn>,
    get: utils.crm.opportunityGet.invalidate as ReturnType<typeof vi.fn>,
    timeline: utils.crm.opportunityTimeline.invalidate as ReturnType<typeof vi.fn>,
    appts: utils.testAppointment.forOpportunity.invalidate as ReturnType<typeof vi.fn>,
  };
}

describe('useTestAppointmentActions invalidation', () => {
  beforeEach(() => {
    const s = spies();
    s.list.mockClear();
    s.get.mockClear();
    s.timeline.mockClear();
    s.appts.mockClear();
    captured.schedule = undefined;
    captured.complete = undefined;
    captured.noShow = undefined;
  });

  it.each([
    ['schedule', () => captured.schedule],
    ['complete', () => captured.complete],
    ['noShow', () => captured.noShow],
  ] as const)('%s invalidates list + detail + timeline + forOpportunity', (_name, getOpts) => {
    renderHook(() => useTestAppointmentActions());
    const s = spies();
    expect(getOpts()?.onSuccess).toBeTypeOf('function');
    act(() => getOpts()!.onSuccess!());
    expect(s.list).toHaveBeenCalledTimes(1);
    expect(s.get).toHaveBeenCalledTimes(1);
    expect(s.timeline).toHaveBeenCalledTimes(1);
    expect(s.appts).toHaveBeenCalledTimes(1);
  });
});
