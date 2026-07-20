// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the shared mark-lost dialog (used by both pipeline card actions and
// the opportunity-detail action bar, phase-03): the lostReason select gates
// submit, and `crm.opportunityMarkLost.mutate` gets the exact
// {opportunityId, lostReason} payload the backend expects.
const markLostMutate = vi.fn();
let markLostHookOnSuccess: (() => void) | undefined;

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
      'crm.opportunityMarkLost.useMutation': (options: { onSuccess?: () => void }) => {
        markLostHookOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: markLostMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import { MarkLostDialog } from './mark-lost-dialog.js';

async function selectLostReason(label: RegExp = /Không phản hồi/) {
  fireEvent.click(screen.getByLabelText(/^Lý do mất/));
  const option = await screen.findByRole('option', { name: label });
  fireEvent.click(option);
}

describe('MarkLostDialog', () => {
  beforeEach(() => {
    markLostMutate.mockClear();
  });

  it('renders a closed (non-open) <dialog> when opportunityId is null', () => {
    // Astryx Dialog always renders its children into the native <dialog>
    // element (content stays in the DOM even closed) and toggles modal
    // visibility imperatively via `dialog.showModal()`/`close()` — so the
    // `open` attribute, not text presence, is the correct closed-state check.
    renderWithProviders(<MarkLostDialog opportunityId={null} onClose={vi.fn()} />);
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('disables "Xác nhận" until a lostReason is chosen', () => {
    renderWithProviders(<MarkLostDialog opportunityId="opp-1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
  });

  it('calls opportunityMarkLost.mutate({opportunityId, lostReason}) after choosing a reason and confirming', async () => {
    renderWithProviders(<MarkLostDialog opportunityId="opp-1" onClose={vi.fn()} />);
    await selectLostReason(/Học phí quá cao/);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(markLostMutate).toHaveBeenCalledWith(
      { opportunityId: 'opp-1', lostReason: 'price_too_high' },
      expect.anything(),
    );
  });

  it('invalidates crm.opportunityList when the mark-lost mutation settles successfully', () => {
    const invalidateSpy = trpc.useUtils().crm.opportunityList.invalidate;
    renderWithProviders(<MarkLostDialog opportunityId="opp-1" onClose={vi.fn()} />);
    expect(markLostHookOnSuccess).toBeDefined();
    act(() => markLostHookOnSuccess?.());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('closes the dialog (calls onClose) after a successful mark-lost', async () => {
    const onClose = vi.fn();
    renderWithProviders(<MarkLostDialog opportunityId="opp-1" onClose={onClose} />);
    await selectLostReason();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    const [, callOptions] = markLostMutate.mock.calls[0] as [unknown, { onSuccess?: () => void }];
    act(() => callOptions.onSuccess?.());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
