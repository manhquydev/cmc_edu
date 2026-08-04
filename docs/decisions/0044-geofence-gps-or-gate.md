# 0044 — Geofence GPS OR-gate for HR punch verification

Date: 2026-08-04

## Status

Accepted — implemented with plan `260804-2130-geofence-gps-punch-verification`.

## Context

ADR 0043 gates punch location only via `FacilityNetwork` CIDR match. When office
WiFi or public IP detection fails, staff at the site cannot punch without an
offsite reason ticket. Product wants GPS-in-radius as a second admission path,
without pretending web GPS is anti-fraud-hard.

Threat model (advise 2026-08-04): primarily prevent operational mistakes; active
fraud is handled with audit trails and visible labels, not hard blocks.

## Decision

1. **OR gate per configured branch**
   - `openMode` = 0 active network AND 0 active geofence → admit (legacy open).
   - IP branch only when ≥1 active network; GPS branch only when ≥1 active geofence.
   - `withinNetwork = openMode || ipMatch || geoMatch` (column name kept; payroll
     contract unchanged: all-within day → full credit without ticket).

2. **Four verification labels** on `TimePunch.verification`:
   - `network` — IP matched
   - `geo` — only geo matched
   - `open` — openMode (within but no check ran)
   - `none` — offsite
   - History backfill: `withinNetwork=true → open`, `false → none` (never claim
     network for pre-geo data).

3. **Per-geofence accuracy** (`FacilityGeofence.accuracyMaxM`, default 200,
   range 50–1000). geoMatch requires distance ≤ radius AND accuracy ≤ threshold.

4. **Anti-oracle errors**: `OFFSITE_REASON_REQUIRED` may carry only
   `appData.geoThresholdM` (= max of active accuracyMaxM). Never return distance
   or coordinates on the throw path (cooldown does not apply before punch write).

5. **Snapshot at write time**: `matchedGeofenceId`, `geofenceDistanceM`,
   `matchedRadiusM`, `matchedAccuracyMaxM` — no FK on matchedGeofenceId so
   geofences stay hard-deletable; review UI shows snapshot, not live recompute.

6. **GPS optional on client**: 8s timeout; denied/timeout → punch without geo.

7. **Setup permission**: reuse `facilityNetwork.manage` (super_admin-only).
   New geofences default `isActive=false`. Confirm when activating first fence
   with 0 networks (ends open mode) and when deactivating last fence.

8. **Review surfaces**
   - Ticket detail Dialog with minimized day punches (label + distance snapshot).
   - `geoPunchSummary` table for all-geo days without tickets.

9. **PII**: raw lat/lng/ip stored append-only as evidence; reviewer payload omits
   them.

10. **Trusted proxy**: prod `TRUSTED_PROXY_CIDRS` pinned to static nginx /32
    (not whole RFC1918). `ipMatchesCidr` remains IPv4-only (documented limit).

## Consequences

- Geo-verified days credit payroll/KPI without director approval — intentional.
- Web GPS spoofing remains possible; labels + summary surface make patterns visible.
- Deploy schema + API + UI in one PR to avoid mis-labeled historical punches.
- Rollback of geo-admitted punches needs ticket INSERT remediation (not only
  flipping `withinNetwork`), because `manualPunch.create` was removed in ADR 0043.

## Related

- ADR 0043 (daily in/out pairing)
- ADR 0039 (facility network IP match)
- Plan: `plans/260804-2130-geofence-gps-punch-verification/`
