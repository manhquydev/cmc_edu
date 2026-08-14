// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

interface MutationOpts {
  onSuccess?: () => void;
}

const captured: {
  create?: MutationOpts;
  markLost?: MutationOpts;
  assign?: MutationOpts;
  setNext?: MutationOpts;
  clearNext?: MutationOpts;
} = {};

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, mutationResult: mut } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'crm.opportunityCreate.useMutation': (opts: MutationOpts) => {
        captured.create = opts;
        return mut();
      },
      'crm.opportunityMarkLost.useMutation': (opts: MutationOpts) => {
        captured.markLost = opts;
        return mut();
      },
      'crm.opportunityAssign.useMutation': (opts: MutationOpts) => {
        captured.assign = opts;
        return mut();
      },
      'crm.opportunitySetNextAction.useMutation': (opts: MutationOpts) => {
        captured.setNext = opts;
        return mut();
      },
      'crm.opportunityClearNextAction.useMutation': (opts: MutationOpts) => {
        captured.clearNext = opts;
        return mut();
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import { useOpportunityActions } from './use-opportunity-actions.js';

function spies() {
  const utils = trpc.useUtils();
  return {
    list: utils.crm.opportunityList.invalidate as ReturnType<typeof vi.fn>,
    get: utils.crm.opportunityGet.invalidate as ReturnType<typeof vi.fn>,
    due: utils.crm.opportunityDueFollowUps.invalidate as ReturnType<typeof vi.fn>,
    timeline: utils.crm.opportunityTimeline.invalidate as ReturnType<typeof vi.fn>,
  };
}

describe('useOpportunityActions invalidation', () => {
  beforeEach(() => {
    const s = spies();
    s.list.mockClear();
    s.get.mockClear();
    s.due.mockClear();
    s.timeline.mockClear();
    captured.create = undefined;
    captured.markLost = undefined;
    captured.assign = undefined;
    captured.setNext = undefined;
    captured.clearNext = undefined;
  });

  it('create invalidates list + detail, not due-follow-ups', () => {
    renderHook(() => useOpportunityActions());
    const s = spies();
    expect(captured.create?.onSuccess).toBeTypeOf('function');
    act(() => captured.create!.onSuccess!());
    expect(s.list).toHaveBeenCalledTimes(1);
    expect(s.get).toHaveBeenCalledTimes(1);
    expect(s.timeline).toHaveBeenCalledTimes(1);
    expect(s.due).not.toHaveBeenCalled();
  });

  it('markLost invalidates list + detail + due-follow-ups', () => {
    renderHook(() => useOpportunityActions());
    const s = spies();
    act(() => captured.markLost!.onSuccess!());
    expect(s.list).toHaveBeenCalledTimes(1);
    expect(s.get).toHaveBeenCalledTimes(1);
    expect(s.timeline).toHaveBeenCalledTimes(1);
    expect(s.due).toHaveBeenCalledTimes(1);
  });

  it('assign invalidates list + detail + due-follow-ups', () => {
    renderHook(() => useOpportunityActions());
    const s = spies();
    act(() => captured.assign!.onSuccess!());
    expect(s.list).toHaveBeenCalledTimes(1);
    expect(s.get).toHaveBeenCalledTimes(1);
    expect(s.timeline).toHaveBeenCalledTimes(1);
    expect(s.due).toHaveBeenCalledTimes(1);
  });

  it('setNextAction invalidates list + detail + due-follow-ups', () => {
    renderHook(() => useOpportunityActions());
    const s = spies();
    act(() => captured.setNext!.onSuccess!());
    expect(s.list).toHaveBeenCalledTimes(1);
    expect(s.get).toHaveBeenCalledTimes(1);
    expect(s.timeline).toHaveBeenCalledTimes(1);
    expect(s.due).toHaveBeenCalledTimes(1);
  });

  it('clearNextAction invalidates list + detail + due-follow-ups', () => {
    renderHook(() => useOpportunityActions());
    const s = spies();
    act(() => captured.clearNext!.onSuccess!());
    expect(s.list).toHaveBeenCalledTimes(1);
    expect(s.get).toHaveBeenCalledTimes(1);
    expect(s.timeline).toHaveBeenCalledTimes(1);
    expect(s.due).toHaveBeenCalledTimes(1);
  });
});
