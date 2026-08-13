# VERDICT: FAIL

bc986bd / PR #127 hết nói dối **badge ↔ thẻ**. Empty-state **vẫn nói dối** khi lý do cột trống không phải phân trang. `stageCounts` API là funnel facility-wide, luôn exclude lost, độc lập search/lost/stage/page — UI mới nhét số đó vào câu “không có trên trang này”.

Đối tượng: `pipeline.tsx` + `pipeline.test.tsx` vs `router.ts:442-519`. Không đọc `plans/reports/` hay `plans/260813-*`. Reviewer: `/ak-engineer:ak-code-review` → `ak-engineer:code-reviewer` FAIL. Scout: `explore` DONE_WITH_CONCERNS. GitNexus `detect_changes(compare, af85b78)`: HIGH trên `CrmPipelinePage` (hub trang, không phải vì đụng action).

HEAD: `bc986bdbe6ea0010b315746046d9f353d64c878d` (detached develop).

---

## Lỗ hổng

### 1. Empty copy dùng funnel `N` như thể “còn trên trang khác”

```507:512:apps/admin/src/pages/crm/pipeline.tsx
facilityCount > 0 ? (
  <div className="console-kanban-empty">
    Không có trên trang này · {facilityCount} ở giai đoạn
```

`facilityCount = stageCounts[stage]`. Server:

```483:489:apps/api/src/crm/router.ts
// Funnel counts are facility-wide and ALWAYS exclude lost (F7) …
// independent of the current page's stage/search/lost filters.
tx.opportunity.groupBy({
  by: ['stage'],
  where: { AND: [{ facilityId }, NOT_LOST_WHERE] },
```

`items`/`total` thì lọc search + lost + stage + page. Cùng màn: footer `Trang 1/1 — 0 cơ hội` vs cột `5 ở giai đoạn`.

Không có kéo-thả. Advance = nút “Chuyển lên” + optimistic `items.stage` only (`pipeline.tsx:301-307`), không đụng `stageCounts`.

### 2. Tổ hợp vẫn mâu thuẫn — RTL tự viết, chạy, revert

Thêm 6 case + 1 case `lost=only` page 2 vào `pipeline.test.tsx`, chạy, `git checkout --`.

| Combo | Hành vi đo được | Nói dối? |
|---|---|---|
| Search, items=`[O1]`, `stageCounts.O3=2` | Badge O1=`1` (khớp thẻ). Empty O3 = `Không có trên trang này · 2 ở giai đoạn` | Có — 2 không khớp search, không phải trang khác |
| `lost=only`, 1 lost O2, `stageCounts.O1=5` | Badge O2=`1`. Empty O1 = `· 5 ở giai đoạn` | Có — 5 là **open**, filter đang “Đã mất” |
| `lost=only` page 2, `items=[]`, `total=20`, `stageCounts.* = 0` | Empty O1 = `Chưa có` | Có — đảo ngược mục tiêu PR: 20 lost nằm trang 1 |
| Optimistic: O1 card đã `stage=O2`, `stageCounts.O1=1` | Badge O1=`0`, O2=`1` (thẻ A ở O2). Empty O1 = `· 1 ở giai đoạn` | Có — thẻ đó đang trên **cùng board** |
| `?stage=O1_LEAD` (cockpit `cockpit.tsx:88,274,279`) | O2 empty = `· 1 ở giai đoạn` | Có — bị URL lọc, không phải page |
| Pagination page 2, `items=[]`, identity filter | O1 `· 5`, O4 `Chưa có`, badge toàn `0` | Không — đây là case đúng |
| `lost=include`, 2 open + 1 lost O2 | Badge O2=`3` = thẻ. Funnel O2=`1` | Badge OK; funnel F7 cố ý |

```
$ pnpm --filter @cmc/admin exec vitest run src/pages/crm/pipeline.test.tsx
 ✓ src/pages/crm/pipeline.test.tsx (38 tests) 3368ms
 Test Files  1 passed (1)
      Tests  38 passed (38)
```

```
$ pnpm --filter @cmc/admin exec vitest run src/pages/crm/pipeline.test.tsx -t "LOST=only page 2"
 ✓ src/pages/crm/pipeline.test.tsx (33 tests | 32 skipped) 140ms
      Tests  1 passed | 32 skipped (33)
```

(1 passed = code hiện tại **in** `Chưa có` khi 20 lost off-page.)

**Câu (1):** Badge không còn lệch thẻ ở combo nào đã đo. Empty/chữ thì lệch ở search, lost only/include (false-empty + ghost open N), `?stage=`, optimistic. Chỉ pagination identity là trung thực.

**Câu (4):** Copy search `N ở giai đoạn` **là hiểu lầm mới**. `N` = tổng open facility, bỏ search. Sale lật trang tìm 5 thẻ không nằm trong result set. Bản cũ `"Chưa có"` thiếu phân trang nhưng không bịa ma.

### 3. Test xanh giả một phần — đột biến

**Badge `count={stageItems.length}` → `count={stageCounts[stage.key] ?? 0}` — ĐỎ (chốt chặt):**

```
$ … vitest run src/pages/crm/pipeline.test.tsx
 ❯ src/pages/crm/pipeline.test.tsx (32 tests | 1 failed)
 × renders the O1 column badge from visible cards… 67ms
 AssertionError: expected [ '5', '1', '2', '0', '3' ] to deeply equal [ '1', '2', '0', '0', '0' ]
 Tests  1 failed | 31 passed (32)
```

**Empty luôn `"Chưa có"` — ĐỎ:**

```
 FAIL  … shows a page-scoped empty copy…
 Expected: "Không có trên trang này · 2 ở giai đoạn"
 Received: "Chưa có"
 Tests  1 failed | 31 passed (32)
```

**Đảo nhánh empty — ĐỎ 2 test (O3 + O4).**

**`facilityCount > 0` → `> 1` — XANH GIẢ:**

```
 ✓ src/pages/crm/pipeline.test.tsx (32 tests) 3418ms
 Tests  32 passed (32)
```

Suite chỉ mock O3=2 / O4=0. Không khóa ngưỡng `1`. Không search, không `lost=only`, không page 2, không `?stage=`. Header test cấm nhét funnel vào badge — empty copy vẫn nhét cùng số đó.

### 4. Advance / mark-lost / schedule-test

Diff chỉ comment `byStage` + `count` + empty JSX. `handleAdvance`, `MarkLostDialog`, `ScheduleTestDialog`, payload `opportunityAdvance` / `testAppointment.schedule` không đổi. Sau đột biến hoàn nguyên, 32 test action vẫn xanh. Mark-lost / schedule không optimistic cache (invalidate sau dialog) → không dính stale `stageCounts`. Không regression hành vi action.

---

## Vững

- Badge `count={stageItems.length}` — bắt buộc: empty-div con sẽ làm `KanbanColumn` đếm `1` nếu bỏ `count` (`console-kanban.tsx:29`).
- Funnel vẫn `stageCounts`; test funnel `['5','1','2','0','3']` vs badge `['1','2','0','0','0']` — đúng tách F7.
- Xóa test cũ khóa `count={stageCounts}` (lie đảo chiều).
- API `opportunityList` không đụng. `list.test.ts:129-146` khóa `stageCounts` exclude lost.

Sửa đúng hướng: empty chỉ khi `!search && lost==='exclude' && !stageFilter && facilityCount>0`; dưới filter, nếu `total<=items.length` thì “Không khớp”/“Chưa có”; nếu `total>items.length` thì “Không có trên trang này” **không** nội suy funnel `N`. Filtered per-stage count mới là hết nói dối.

---

## Nghiệm thu

```
$ git checkout -- apps/admin/src/pages/crm/pipeline.tsx apps/admin/src/pages/crm/pipeline.test.tsx
$ pnpm --filter @cmc/admin exec vitest run src/pages/crm/pipeline.test.tsx
 ✓ src/pages/crm/pipeline.test.tsx (32 tests) 4234ms
 Test Files  1 passed (1)
      Tests  32 passed (32)
 Duration  6.21s
```

**32/32 pass** trên code merge. Worktree sạch sau thí nghiệm.

LANE DONE crm
