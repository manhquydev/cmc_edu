import { trpc } from '../../lib/trpc.js';

/**
 * Shared `testAppointment` mutations — schedule / complete / no-show — used
 * by BOTH the pipeline card's schedule dialog (via `ScheduleTestDialog`,
 * shared with the opportunity-detail page) and the opportunity-detail page's
 * appointment list actions.
 *
 * Scheduling and completing an entrance appointment silently advance the
 * opportunity's stage server-side (O2->O3, O3->O4 — see
 * `apps/api/src/appointment/router.ts`), so every mutation here invalidates
 * BOTH `crm.opportunityList` (bare invalidate, matching the DRY-invalidate
 * pattern in `use-opportunity-actions.ts` — pipeline.tsx's own
 * `opportunityAdvance` optimistic-update path targets its own listInput-keyed
 * cache separately and is untouched by this) and `testAppointment.forOpportunity`
 * so an open detail page's appointment list stays in sync.
 */
export function useTestAppointmentActions() {
  const utils = trpc.useUtils();

  const invalidateAppointmentViews = () => {
    void utils.crm.opportunityList.invalidate();
    void utils.testAppointment.forOpportunity.invalidate();
  };

  const scheduleMutation = trpc.testAppointment.schedule.useMutation({
    onSuccess: invalidateAppointmentViews,
  });

  const completeMutation = trpc.testAppointment.complete.useMutation({
    onSuccess: invalidateAppointmentViews,
  });

  const noShowMutation = trpc.testAppointment.noShow.useMutation({
    onSuccess: invalidateAppointmentViews,
  });

  return { scheduleMutation, completeMutation, noShowMutation };
}
