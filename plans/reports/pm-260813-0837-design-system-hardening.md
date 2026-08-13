# PM — design-system-hardening sync-back

**Date:** 2026-08-13 08:37 · **Plan:** `plans/260813-0120-design-system-hardening/`
**Plan status:** `in-progress` — **không** completed
**Docs impact:** không đổi authority docs (UI copy/badge only; no API/schema)

## Progress vs plan

| Phase | Status | AC | Evidence |
|-------|--------|---:|----------|
| A precedence pin | **xong** | 5/5 | [#124](https://github.com/manhquydev/cmc_edu/pull/124) merged 2026-08-13; CI `typecheck-and-test` + `ui-e2e` success |
| B docs + gates | **xong** | 6/6 | [#125](https://github.com/manhquydev/cmc_edu/pull/125) merged 2026-08-13; CI same 2 required checks success; typecheck 34/34 |
| C kanban nhịp-1 | **local, chờ PR** | 3/4 | worktree `fix/crm-kanban-count-truth` @ `87f6b30`; pipeline 32/32; admin 625/625; typecheck 34/34; review 9/10 |
| 03 kanban cũ | superseded bởi C | 0/5 | BA Q2 cắt nhịp 2; không tick AC cũ |
| 04 a11y keyboard | hoãn | 0/5 | BA Q4 — cột Mở `data-table.tsx:146-161` |
| 06 LMS primitives | đóng | 0/4 | BA Q5; lot 0 shipped in #125 |
| 01 / 02 / 05 | superseded | — | thay bằng A / A / B |

Plan-level AC: **1/7** `[x]` (doc authority). Còn 6 mở hoặc superseded.

## Completed this session (C)

- Badge cột = `stageItems.length`; funnel vẫn `stageCounts`
- Empty split: true-empty `"Chưa có"` vs off-page `"Không có trên trang này · N ở giai đoạn"`
- Diff chỉ `pipeline.tsx` + `pipeline.test.tsx`
- **Chưa:** PR + required CI (user cấm push)

## Backfill A/B

- A header: "sẵn sàng thi hành" → merged #124. AC đã `[x]` trước đó — không bịa thêm.
- B header → merged #125. Tick `pnpm typecheck` (trước ghi "không đạt worktree"): PR body 34/34 + CI job `94313949881` success.

## Scope change

| Change | Reason | Impact |
|--------|--------|--------|
| 03 → C nhịp-1-only | BA Q2 giữ `stageCounts` facility-wide | không per-stage query / pager cột |
| 01/02 → A | red-team: xóa 17 tên trùng đổi pixel +45% | collision giữ; pin bằng test |
| 05 + lot 06 rẻ → B | cổng chết + authority split | #125 |
| 04 hoãn / 06 đóng | BA Q4/Q5 | không làm lượt này |

## Risks

| Risk | State | Owner / unblock |
|------|-------|-----------------|
| C local, không PR | **mở** | owner cho phép push → main agent mở PR → CI 2 required checks |
| VRT absent | mở, chấp nhận | BA Q3 hoãn |
| Agent đổi `console.css` | giảm | `console-precedence.test.ts` |
| Nhịp 2 bỏ dở | **đóng** | cắt có chủ đích |
| Keyboard / focus | hoãn | phase 04 khi owner kéo lên |

## Next (owner + definition of done)

1. **Main agent — mở PR Phase C.** DoD: PR `fix/crm-kanban-count-truth` → `develop`; `typecheck-and-test` + `ui-e2e` xanh; tick AC cuối phase C; **không** đóng cả plan.
2. **Owner — quyết push.** User đã cấm push session này. DoD: yes/no rõ.
3. **Owner — phase 04?** DoD: kéo lên nếu có NV phụ thuộc bàn phím; không thì để hoãn.
4. **Không làm:** tick plan completed; thi hành 01/02/03/05 nguyên trạng; nhịp 2; VRT; LMS `<15` inline.

**Main agent: hoàn tất implementation plan còn dở. Phase C chưa xong khi chưa có PR + 2 required checks. Kết thúc plan quan trọng — đừng để `87f6b30` thối trên worktree.**

## Unresolved mappings

- Plan AC `decl(astryx) ∩ decl(console) === ∅` — **không map complete**. Red-team bác; A giữ collision.
- Plan AC cổng `check:css-vars` — **không làm** (phase 02 superseded). A chỉ diệt `--cmc-text-supporting`.
- Plan AC "số không mâu thuẫn thẻ" — C local only; **không** tick plan-level.
- Plan AC keyboard + `:focus-visible` — phase 04 hoãn.
- Plan AC LMS `<15` inline + `user-scalable=no` — compound; `user-scalable=no` xong ở #125, `<15` không. **Không tick.**
- Plan AC CI sau từng phase — A+B yes; C no.
- Phase 03 AC nhịp 2 (pager / search shrink / cả 2 nhịp merged) — cắt. **Không tick.**
- Phase 05 AC (doc-authority / rg / TL12 / Astryx) — shipped qua B/#125. **Không tick file superseded.**
- Phase 06 `user-scalable=no` — shipped #125 lot 0. **Không tick** vì phase đóng; `<15` inline còn.

## Unresolved questions

1. Owner cho phép push/PR Phase C lúc nào?
2. Có NV phụ thuộc bàn phím → kéo Q4 lên không?
3. Viết lại plan-level AC (token isolation / css-vars / LMS `<15`) cho khớp A+B, hay giữ làm lịch sử?
