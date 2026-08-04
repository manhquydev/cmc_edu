// facilityGeofence CRUD + position test — geofence GPS punch verification.
// Mirrors facilityNetwork router: permission facilityNetwork.manage
// (super_admin-only by roster), create defaults isActive=false.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { haversineDistanceM } from '../checkin/geo-distance.js';
import { requirePermission, router, scoped } from '../trpc.js';

const latField = z.number().min(-90).max(90);
const lngField = z.number().min(-180).max(180);

const createInput = z.object({
  lat: latField,
  lng: lngField,
  radiusM: z.number().int().min(100).max(2000),
  accuracyMaxM: z.number().int().min(50).max(1000).default(200),
  label: z.string().max(200).default(''),
});

const updateInput = z.object({
  id: z.string().min(1),
  lat: latField.optional(),
  lng: lngField.optional(),
  radiusM: z.number().int().min(100).max(2000).optional(),
  accuracyMaxM: z.number().int().min(50).max(1000).optional(),
  label: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

const deleteInput = z.object({ id: z.string().min(1) });

const testPositionInput = z.object({
  lat: latField,
  lng: lngField,
  accuracyM: z.number().min(0).max(100_000),
});

export const facilityGeofenceRouter = router({
  list: requirePermission('facilityNetwork', 'manage').query(async ({ ctx }) => {
    const { facilityId } = scoped(ctx);
    return withFacility(ctx.db, facilityId, (tx) =>
      tx.facilityGeofence.findMany({ where: { facilityId }, orderBy: { createdAt: 'desc' } }),
    );
  }),

  create: requirePermission('facilityNetwork', 'manage')
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const geofence = await withFacility(ctx.db, facilityId, (tx) =>
        tx.facilityGeofence.create({
          data: {
            facilityId,
            lat: input.lat,
            lng: input.lng,
            radiusM: input.radiusM,
            accuracyMaxM: input.accuracyMaxM,
            label: input.label,
            isActive: false,
          },
        }),
      );

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facilityGeofence.create',
          entity: 'FacilityGeofence',
          entityId: geofence.id,
          data: {
            lat: geofence.lat,
            lng: geofence.lng,
            radiusM: geofence.radiusM,
            accuracyMaxM: geofence.accuracyMaxM,
            label: geofence.label,
            isActive: geofence.isActive,
          },
        },
      });

      return geofence;
    }),

  update: requirePermission('facilityNetwork', 'manage')
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const geofence = await withFacility(ctx.db, facilityId, (tx) =>
        tx.facilityGeofence.update({
          where: { id: input.id },
          data: {
            ...(input.lat !== undefined ? { lat: input.lat } : {}),
            ...(input.lng !== undefined ? { lng: input.lng } : {}),
            ...(input.radiusM !== undefined ? { radiusM: input.radiusM } : {}),
            ...(input.accuracyMaxM !== undefined ? { accuracyMaxM: input.accuracyMaxM } : {}),
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        }),
      );

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facilityGeofence.update',
          entity: 'FacilityGeofence',
          entityId: geofence.id,
          data: {
            lat: geofence.lat,
            lng: geofence.lng,
            radiusM: geofence.radiusM,
            accuracyMaxM: geofence.accuracyMaxM,
            label: geofence.label,
            isActive: geofence.isActive,
          },
        },
      });

      return geofence;
    }),

  delete: requirePermission('facilityNetwork', 'manage')
    .input(deleteInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      await withFacility(ctx.db, facilityId, (tx) =>
        tx.facilityGeofence.delete({ where: { id: input.id } }),
      );

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facilityGeofence.delete',
          entity: 'FacilityGeofence',
          entityId: input.id,
          data: {},
        },
      });

      return { id: input.id };
    }),

  /**
   * Server-side position check for admin "Kiểm tra" button.
   * `within` uses the SAME predicate as the punch gate (distance + accuracy).
   */
  testMyPosition: requirePermission('facilityNetwork', 'manage')
    .input(testPositionInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const geofences = await withFacility(ctx.db, facilityId, (tx) =>
        tx.facilityGeofence.findMany({ where: { facilityId }, orderBy: { createdAt: 'desc' } }),
      );

      return geofences.map((g) => {
        const distanceM = haversineDistanceM(input, { lat: g.lat, lng: g.lng });
        const accuracyOk = input.accuracyM <= g.accuracyMaxM;
        const within = distanceM <= g.radiusM && accuracyOk;
        return {
          id: g.id,
          label: g.label,
          isActive: g.isActive,
          radiusM: g.radiusM,
          accuracyMaxM: g.accuracyMaxM,
          distanceM: Math.round(distanceM * 10) / 10,
          accuracyOk,
          within,
        };
      });
    }),
});
