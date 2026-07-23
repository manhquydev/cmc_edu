---
phase: 1
title: "Nav cho màn chỉ vào được bằng URL"
status: done
priority: P1
dependencies: []
---

# Phase 1: Nav cho màn chỉ vào được bằng URL

## Overview

Bốn màn đã xây hiện **không có nav entry và không có link từ bất kỳ màn nào** — chỉ vào được bằng gõ URL. Hai trong số đó nằm ngay trong checklist UAT §5, nên luật §4.3 *"vào màn bằng menu"* đang rỗng nghĩa.

## Requirements

**Functional** — thêm 4 entry, mỗi entry gate bằng permission key **đã tồn tại**:

| Màn | Nhóm nav | Label | Key gate | Vai thấy | Key ở đâu |
|---|---|---|---|---|---|
| `/admin/engagement/gifts` | **Gắn kết** (mới) | Quà tặng | `gift.upsert` | GĐKD, GĐĐT | `index.ts:140` |
| `/admin/engagement/rewards` | **Gắn kết** (mới) | Đổi thưởng | `rewards.manage` | GĐKD, GĐĐT, sale | `index.ts:143` |
| `/admin/courses` | Lớp & Học sinh | Khoá học | `course.manage` | GĐĐT | `index.ts:82` |
| `/finance/class-placement` | Tài chính & Điều hành | Xếp lớp | `enrollment.enroll` | GĐKD, GĐĐT, sale | `index.ts:69` |

> **Vì sao gifts gate bằng `gift.upsert` chứ không `gift.list`** *(sửa sau red-team)*: `/admin/engagement/gifts` là màn **cấu hình** P4-02; mutation duy nhất trên đó là `gift.upsert` (2 GĐ). Manifest khai `actorRoles` P4-02 chỉ 2 GĐ, và runbook §5 cũng chỉ liệt P4-02 dưới 2 GĐ. Gate bằng `gift.list` sẽ đưa sale vào một màn mà mọi hành động đều 403 — phạm đúng quy ước file tự ghi hai lần: *"the menu entry follows the same key instead of inviting a 403"* (`nav-registry.ts:24`). Sale không mất gì: lối vào P4-01 của sale là `/admin/engagement/rewards`, gate `rewards.manage` **có** sale.

**Non-functional**
- Không thêm permission key mới. `packages/auth/src/index.ts` không đổi một dòng.
- Icon dùng key LineIcon có sẵn, không emoji (quy ước ghi ở đầu `nav-registry.ts`).
- **Module `engagement` phải có `path` trỏ tới một route thật.** `NavModule.path` là trường bắt buộc và `side-nav.tsx:40` điều hướng tới nó khi bấm hàng module. `/admin/engagement` **không có route** — rơi vào `path: '*'` ⇒ `ComingSoon`.

  > **Sửa 2026-07-23 sau code review — dùng `path: '/admin/engagement/rewards'`, KHÔNG phải `gifts`.** Bản đầu chọn `gifts` và như thế **tự phá D5**: hàng module là một nút điều hướng, và các mục con chỉ bung ra **sau khi** module active — nên `sale` (thấy nhóm nhờ `rewards.manage`) buộc phải bấm **Gắn kết**, rơi thẳng vào Quà tặng, qua được gate route `gift.list` rồi 403 ở mọi hành động. Đúng cái ngõ cụt D5 sinh ra để tránh, chỉ lùi lại một cấp. `rewards` là lựa chọn duy nhất đúng: ai có `gift.upsert` đều có `rewards.manage`, chiều ngược lại thì không.
  >
  > Bài học tổng quát: **gate mục con là chưa đủ — phải gate cả màn đáp của hàng module.** Đã khoá bằng test `lands every role on a module screen it can actually operate`.

### 🔴 `/finance/class-placement` KHÔNG có gate ở tầng route

*(Phát hiện red-team — bản đầu khẳng định ngược lại.)* `apps/admin/src/routes/finance.routes.tsx:36-43` bọc `ClassPlacementPage` trong `<Suspense>` trần, **không có `PermissionGate`**. Ba màn kia đều có (`admin.routes.tsx:71,84,94`). Nghĩa là với chính màn PO vừa duyệt, **nav entry sẽ là gate front-end duy nhất** — và `student.lookup` mở cho cả `giao_vien`, nên gõ URL vẫn tra được họ tên trẻ em.

⇒ Phase này **thêm `PermissionGate module="enrollment" action="enroll"`** vào `finance.routes.tsx`, cùng đợt. Không có nó thì câu "nav ẩn không thay thế gate" là câu nói suông.

## Architecture

Nav có **hai tầng gate**, và chỉ tầng hai mới thật sự ẩn một mục:

1. `visibleModulesFor(roles, canDo)` — quyết định **hàng module** hiện hay không. Một module còn hiện khi *bất kỳ* con nào của nó hiện.
2. `isNavChildVisible(child, canDo)` — quyết định **từng mục con**. `shell.tsx` chạy nó qua `isChildVisible`.

`visibleNavPathsFor(roles, canDo)` chạy cả hai bước, đúng như sidebar thật. **Test phải dùng hàm này với `can()` thật**, không dùng `visibleModulesFor` — comment `nav-registry.test.ts:127-130` đã ghi rõ vì sao: khẳng định qua `visibleModulesFor` sẽ báo một màn là "thấy được" bất cứ khi nào một mục anh em thấy được, che đúng loại lỗi này.

Nhóm **Gắn kết** là module mới, không có `roles` (không giới hạn cứng theo vai) — hiện/ẩn hoàn toàn theo key con, giống nhóm `finance-ops`. Với `giao_vien` (không có `gift.upsert` lẫn `rewards.manage`) **cả nhóm biến mất**. Với `sale` (có `rewards.manage`, không có `gift.upsert`) nhóm **hiện với đúng một mục**: Đổi thưởng. Cả hai ca đều phải có test.

## Related Code Files

- Modify: `apps/admin/src/shell/nav-registry.ts` — thêm module `engagement` + 2 entry vào nhóm có sẵn
- Modify: `apps/admin/src/shell/nav-registry.test.ts` — test trước (xem Implementation Steps)
- Modify: `apps/admin/src/routes/finance.routes.tsx` — thêm `PermissionGate` cho `class-placement`
- **Regenerate + commit: `apps/e2e/screen-role-matrix.json`** — xem §Ma trận e2e bên dưới
- Không sửa: `apps/admin/src/routes/admin.routes.tsx`, `packages/auth/src/index.ts`

### 🔴 Ma trận e2e đổi theo — bản đầu bỏ sót

*(Phát hiện red-team, cả 3 reviewer.)* `nav-registry.ts` có **consumer ngoài app admin**: `apps/e2e/src/scan-nav-entries.ts:17` **parse mã nguồn** file này bằng ts-morph để sinh `apps/e2e/screen-role-matrix.json` — một artifact **commit trong git**, không script/CI nào regenerate hay kiểm hạn.

Luật sinh (`screen-role-matrix.ts:66-73`): màn **không** có nav entry ⇒ mọi vai nghiệp vụ đều mở; màn **có** entry gate ⇒ chỉ vai qua gate. Cả 4 màn hiện thuộc nhóm đầu.

⇒ Thêm nav **thu hẹp** ma trận. Con số 102 chính là câu runbook §1 dùng làm bằng chứng (*"runtime capture 102 tổ hợp màn×vai, 0 denied"*) — không regenerate thì repo mang hai câu trả lời mâu thuẫn cho cùng câu hỏi "màn nào không có nav".

> **Kết quả đo 2026-07-23 — dự báo dưới đây đã SAI, giữ lại để không lặp.** Bản đầu ghi *"giảm 6, 102 → 96"*. Thực tế: `pairCount` **118 → 114**, không-tham-số **102 → 98**.
> - Mất **7** cặp, không phải 6: `gift.upsert` (D5) loại **cả `sale`** khỏi `gifts`, không chỉ `giao_vien`. Cụ thể: `courses`×{GĐKD, sale, GV}, `gifts`×{sale, GV}, `rewards`×{GV}, `class-placement`×{GV}.
> - **Thêm lại 3** cặp: artifact commit trong git đã **cũ sẵn từ trước đợt này** — vẫn khai `/finance/refund` có nav entry gate cho GĐKD, trong khi `24ef2e3` (2026-07-23) đã gỡ entry đó. Regenerate trả `/finance/refund` về "mọi vai nghiệp vụ".
> - ⇒ `102 − 7 + 3 = 98`. Bài học: artifact này trôi **âm thầm** (nợ N5) — dự báo dựa trên nội dung của nó mà không regenerate trước thì tính từ một điểm xuất phát đã sai.

**Bắt buộc trong phase này:** regenerate, commit, ghi `pairCount` trước/sau, và nêu rõ các cặp bị bỏ là những cặp nào cùng lý do chấp nhận (thực tế: **7 bỏ, 3 thêm lại** — xem khối trên). Phase 4 cập nhật con số ở runbook §1.

## Implementation Steps

**Bước 1 — viết test TRƯỚC, chạy để thấy chúng đỏ.**

Thêm vào `describe('nav entries a role really sees ...')` (dùng `pathsFor(role)`, tức `can()` thật):

```ts
it('shows the reward queue to the three roles that can manage rewards', () => {
  for (const role of ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] as Role[]) {
    expect(pathsFor(role), `${role} should see /admin/engagement/rewards`)
      .toContain('/admin/engagement/rewards');
  }
});

it('hides the engagement screens from giao_vien, who holds neither key', () => {
  expect(pathsFor('giao_vien')).not.toContain('/admin/engagement/rewards');
  expect(pathsFor('giao_vien')).not.toContain('/admin/engagement/gifts');
});

it('shows the course catalogue only to giam_doc_dao_tao', () => {
  expect(pathsFor('giam_doc_dao_tao')).toContain('/admin/courses');
  for (const role of ['giam_doc_kinh_doanh', 'sale', 'giao_vien'] as Role[]) {
    expect(pathsFor(role), `${role} must not see /admin/courses`).not.toContain('/admin/courses');
  }
});

it('shows class placement to the roles that can enrol, not to teachers', () => {
  for (const role of ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] as Role[]) {
    expect(pathsFor(role)).toContain('/finance/class-placement');
  }
  expect(pathsFor('giao_vien')).not.toContain('/finance/class-placement');
});
```

**Bước 2 — mở rộng test khoá màn giữ chỗ.** Test `points no menu entry at the unbuilt refund screen` (`:165-168`) hiện chỉ khoá một đường dẫn. Đổi thành danh sách, thêm `/admin/engagement/leaderboard`:

```ts
// Màn giữ chỗ (EmptyState "chưa áp dụng") không được có lối vào menu — sổ
// nghiệm thu đã hạ chúng khỏi `built` vì đúng lý do đó. Khôi phục entry khi
// màn được xây, cùng lúc luồng tương ứng quay lại `built`.
it('points no menu entry at a placeholder screen', () => {
  const placeholders = ['/finance/refund', '/admin/engagement/leaderboard'];
  const everyPath = NAV_MODULES.flatMap((mod) => [mod.path, ...(mod.children ?? []).map((c) => c.path)]);
  for (const path of placeholders) expect(everyPath).not.toContain(path);
});
```

**Bước 3 — chạy test, xác nhận đỏ đúng chỗ** (4 test mới đỏ; test placeholder xanh vì chưa ai thêm leaderboard).

**Bước 3b — sửa hai test có tên nói dối.** *(Thay cho dự báo sai ở bản đầu.)* `returns exactly 5 groups for sale` (`:14-20`) và bản sinh đôi cho `giao_vien` (`:22-28`) **không hề có assert đếm** — thân hàm chỉ có `toContain`/`not.toContain`. Thêm module mới, chúng **vẫn xanh** trong khi cái tên "5 groups" thành sai. Thêm `expect(ids).toHaveLength(N)` đúng số mới và sửa tên test, để hợp đồng số nhóm được **khẳng định** chứ không chỉ ngụ ý trong tên.

**Bước 4 — sửa `nav-registry.ts`:**
- Thêm module `engagement`: `{ id: 'engagement', label: 'Gắn kết', icon: <key LineIcon có sẵn>, path: '/admin/engagement/gifts', children: [gifts, rewards] }`. **`path` phải là route thật** — `/admin/engagement` không tồn tại và sẽ rơi vào `ComingSoon`.
- Thêm `{ id: 'courses', label: 'Khoá học', path: '/admin/courses', permission: { module: 'course', action: 'manage' } }` vào `classes-students`.
- Thêm `{ id: 'class-placement', label: 'Xếp lớp', path: '/finance/class-placement', permission: { module: 'enrollment', action: 'enroll' } }` vào `finance-ops`.
- Mỗi entry kèm comment giải thích **vì sao chọn key đó** (văn phong file: giải thích bất biến, không ghi mã phase).

**Bước 4b — thêm `PermissionGate` cho `class-placement`** trong `finance.routes.tsx`, theo đúng khuôn ba màn ở `admin.routes.tsx:68-99`: `module="enrollment" action="enroll"`, kèm `title`, `breadcrumbs`, `requirementLabel`.

**Bước 4c — kiểm mọi `path` trong nav đều giải được thành route.** Thêm một test đối chiếu tập `path` của `NAV_MODULES` (cả module lẫn con) với tập route đã đăng ký. Lớp lỗi này hiện **không có test nào** — đó là lý do module không route lọt qua tới tận red-team.

**Bước 5 — chạy lại test, xanh.** Rồi `pnpm --filter @cmc/admin test` toàn bộ.

**Bước 5b — regenerate ma trận e2e:** `pnpm --filter @cmc/e2e exec tsx src/generate-screen-role-matrix.ts`, commit `apps/e2e/screen-role-matrix.json`, ghi `pairCount` trước/sau vào báo cáo phase.

**Bước 6 — `pnpm typecheck && pnpm lint`.**

## Success Criteria

- [ ] 4 test mới xanh, mỗi test khẳng định cả vai **thấy** lẫn vai **không thấy**
- [ ] Test màn giữ chỗ phủ cả `/finance/refund` lẫn `/admin/engagement/leaderboard`
- [ ] Hai test "5 groups" có assert đếm thật và tên khớp số mới
- [ ] Có test khẳng định **mọi `path` trong `NAV_MODULES` giải được thành route đã đăng ký**
- [ ] `finance.routes.tsx` có `PermissionGate` cho `class-placement`
- [ ] `apps/e2e/screen-role-matrix.json` đã regenerate + commit; `pairCount` trước/sau được ghi lại kèm danh sách cặp bị bỏ
- [ ] `git diff packages/auth/src/index.ts` rỗng
- [ ] `pnpm --filter @cmc/admin test` · `pnpm typecheck` · `pnpm lint` xanh

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Nav mới lộ màn cho vai không có quyền | TB | Test dùng `can()` thật qua `visibleNavPathsFor`, khẳng định cả chiều phủ định; **và** bước 4b bổ sung `PermissionGate` cho màn duy nhất thiếu |
| Hai test "5 groups" **vẫn xanh** trong khi tên thành sai | **Cao** | Bước 3b thêm assert đếm thật. *(Bản đầu dự báo ngược — nói chúng "gần như chắc chắn vỡ"; thân hàm không có assert đếm nào nên chúng không thể vỡ.)* |
| Module `engagement` trỏ vào route không tồn tại ⇒ bấm ra `ComingSoon` | **Cao** | `path: '/admin/engagement/gifts'`; bước 4c thêm test đối chiếu path↔route cho toàn bộ nav |
| `screen-role-matrix.json` cũ đi, runbook §1 "102 tổ hợp" thành sai | **Cao** | Bước 5b regenerate + commit; Phase 4 sửa con số ở §1 |
| Chọn nhầm key gate | TB | Bảng key ở §Requirements ghi **vị trí từng key** (`:69`, `:82`, `:140`, `:143`) — *(bản đầu trích gộp `:140-143`, chỉ đúng 2 trong 4)*; test khẳng định đúng tập vai |
| Icon key không tồn tại trong LineIcon | Thấp | typecheck bắt được; tra danh sách key trong `@cmc/ui` trước khi đặt |
