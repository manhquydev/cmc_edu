import { trpc } from '../../lib/trpc.js';

/**
 * Shared parentMeeting mutations — schedule / complete / cancel — used by
 * the post-sale meeting list (post-sale-meeting.tsx) and its dialogs.
 * Lifecycle: scheduled -> done | cancelled (WF-P4-03). Every mutation
 * invalidates `parentMeeting.list` on success so the list picks up the change.
 */
export function useParentMeetingActions() {
  const utils = trpc.useUtils();

  const invalidateList = () => void utils.parentMeeting.list.invalidate();

  const scheduleMutation = trpc.parentMeeting.schedule.useMutation({ onSuccess: invalidateList });
  const completeMutation = trpc.parentMeeting.complete.useMutation({ onSuccess: invalidateList });
  const cancelMutation = trpc.parentMeeting.cancel.useMutation({ onSuccess: invalidateList });

  return { scheduleMutation, completeMutation, cancelMutation };
}
