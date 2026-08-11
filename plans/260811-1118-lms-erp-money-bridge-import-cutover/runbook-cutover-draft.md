# Cutover runbook draft — Plan 3 (skeleton)

**Status:** draft  
**Last updated:** 2026-08-11

## Preconditions

- [x] Plan 1 foundation (unit ranges, dual-gate, grant surface)
- [x] Plan 2 teaching spines (create/cancel stamp, delivery, family)
- [ ] Staging teaching day smoke for pilot facility
- [ ] Owner package table (3–5 gói) accepted — interim default: `LMS_DEFAULT_UNIT_COUNT_ON_RECEIPT=4`

## Mapping (interim)

| Receipt field | Grant behavior |
|---------------|----------------|
| `unitCount` null | Default env count (4) from class current unit |
| `unitCount` N≥1 | Continuous range of N units |
| `unitCount` 0 | Break-glass: active enrollment, **no** range |
| Full refund | Delete ranges with `sourceReceiptId = receiptId` |

## Steps (later phases)

1. Dry-run import counts from live `cmc-lms` (read-only)
2. Shadow dual-write optional window
3. Freeze old LMS writes
4. Cutover SoT to monorepo
5. Close old LMS

## Rollback

- Money stays on monorepo Receipt (0041 never rolls back)
- Disable default unit grant: set all new receipts `unitCount=0` or stop provision grant via feature flag if added
- Ranges can be admin-revoked via `revokeFromNext` / refund
