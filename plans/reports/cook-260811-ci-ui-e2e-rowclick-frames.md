# Cook — CI typecheck frames + ui-e2e journey fixes

## Status after 08c4f1b
- **e2e API** + **security**: PASS
- **typecheck-and-test**: FAIL — `check:ui-frames --strict` dual-title (session-detail)
- **ui-e2e**: FAIL journeys (root causes below)

## Fixes this batch
1. **session-detail** — remove `PageHeader title=` on loading/error paths (EntityHeader owns title).
2. **DataTable onRowClick** — ignore clicks on button/input so list HITL (Tiếp nhận, Xác nhận…) does not navigate away.
3. **checkin journey** — tab label `Hàng chờ phiếu` (not `Duyệt chấm công`).
4. **createStaffViaAdminUi** — search users by name after create (page size 20).

## Next queue (after green)
- Optional: demote aftersale/KPI list HITL to form-only once journeys use form path.
