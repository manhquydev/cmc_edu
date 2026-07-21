import { trpc } from '../../lib/trpc.js';

/**
 * Shared afterSale mutations — create / advance / resolve / close — used by
 * the after-sale case list (aftersale.tsx) and its dialogs. Lifecycle:
 * open -> in_progress -> resolved -> closed (WF-P4-05). Every mutation
 * invalidates `afterSale.list` on success so the list picks up the change.
 */
export function useAfterSaleActions() {
  const utils = trpc.useUtils();

  const invalidateList = () => void utils.afterSale.list.invalidate();

  const createMutation = trpc.afterSale.create.useMutation({ onSuccess: invalidateList });
  const advanceMutation = trpc.afterSale.advance.useMutation({ onSuccess: invalidateList });
  const resolveMutation = trpc.afterSale.resolve.useMutation({ onSuccess: invalidateList });
  const closeMutation = trpc.afterSale.close.useMutation({ onSuccess: invalidateList });

  return { createMutation, advanceMutation, resolveMutation, closeMutation };
}
