# UI-UX-Pro-Max × CMC EDU — Nâng cấp UI / UX / DX (tập trung click · confirm · feedback)

**Ngày:** 2026-08-02  
**Skill:** `ck:ui-ux-pro-max` (design-system + domain ux/react)  
**Bằng chứng dự án:** screenshot local-sim + audit code `apps/admin`, `packages/ui`  
**Không thay palette hiện tại** — báo cáo tập trung tương tác, xác nhận, feedback, DX.

---

## 1. Định hướng skill (đã hiệu chỉnh cho ERP)

Pro-Max gợi ý **Data-Dense Dashboard / Operations** cho product type education ERP admin — khớp hơn consumer-minimal.

| Trục Pro-Max | Chuẩn skill | Ghi chú CMC |
|--------------|-------------|-------------|
| Style product | Data-dense, scannable, status colors | Giữ canvas ấm + Inter hiện tại; **tăng density ops**, không đổi brand radical |
| Interaction | Pressed state, cursor-pointer, 150–300ms | Cần chuẩn hóa state layer toàn app |
| Feedback | Success toast / loading >300ms / empty + CTA | **Thiếu toast global** — critical gap |
| Confirmation | Modal trước destructive / irreversible | Đã có `ConfirmDialog` — coverage chưa đều |
| Touch | ≥44×44, gap ≥8px | Attendance làm tốt; topbar/table chưa đồng nhất |
| A11y | focus-visible, keyboard, labels | Theme có focus-visible; skip-link / aria-live toast còn thiếu |
| Forms | blur validation, submit loading→success | Banner inline rải rác; không pattern thống nhất |
| Nav | active state, deep link | Active nav OK; deep-link query (điểm danh session) yếu |
| DX | Design system components reusable | Confirm/Banner có; Toast/EmptyState/ActionButton chưa “one-door” |

**Anti-pattern skill cấm (và CMC đang gần):** silent success · frozen UI · blank empty · delete without confirm · hover-only critical actions · 1 primary CTA bị cạnh tranh.

---

## 2. Bản đồ trải nghiệm click (journey micro-interaction)

Mỗi click phải trả lời 4 câu (Pro-Max + enterprise ops):

```text
1. Tôi vừa bấm cái gì?     → press/active feedback ≤100ms
2. Hệ thống đang làm gì?   → loading / pending ≥300ms
3. Xong hay lỗi?           → success / error visible
4. Làm gì tiếp?            → next affordance / CTA
```

### 2.1 Ma trận hiện trạng CMC

| Vùng / action | Click feel | Loading | Success | Error | Confirm | Ghi chú |
|---------------|------------|---------|---------|-------|---------|---------|
| Nav sidebar item | Active highlight OK | Instant route | — | — | — | Hover tree OK; subnav chỉ khi active parent (thêm 1 click) |
| Topbar **Ghi danh** | Primary pill | Modal load list | — | Empty list text | — | EnrollPicker có empty; không toast |
| Topbar **Đăng xuất** | Primary xanh (cạnh tranh CTA) | Full redirect | — | — | **Không** | Pro-Max: destructive/exit tách khỏi primary |
| Role badge | Non-click | — | — | — | — | Raw `giao_vien` — product language fail |
| MetricCard | Link hover shadow | Skeleton value | — | “—” + context | — | Full-width 1 card = weak click target hierarchy |
| TaskRow | Hover row | — | — | — | — | OK pattern |
| Table row / action | Row hover variable | isLoading từng nút | Thường silent + invalidate | Banner đôi chỗ | Confirm một số màn | Inconsistent |
| **Duyệt phiếu thu** | Primary → open dialog | `isActionLoading` | Close + refetch | onError đóng dialog? | **ConfirmDialog tốt** (message irreversible) | Best practice nội bộ |
| **Chấm công** | Nút xám mép phải | ? | ? | Banner info rule | Có thể thiếu confirm double-punch | Hierarchy CTA sai |
| **Điểm danh toggle** | Button 44px cycle màu | Local instant | “Đã lưu” label sau save | Banner + validation | Không cần confirm từng ô | **Gold pattern** touch ops |
| **Lưu điểm danh** | Primary header | isPending | saved state + icon | Banner error + validation | — | Unsaved: local dirty `saved=false` nhưng **không warn leave page** |
| **Chấm điểm** | isPending button | OK | Banner success + star | Banner error message | Không confirm re-grade | Re-grade silent overwrite — cân nhắc soft confirm |
| **Publish nhật ký / đóng BT** | isPending | OK | invalidate | Banner | Confirm? | Destructive publish cần confirm rõ |
| **KPI confirm / bulk** | ConfirmDialog | loading prop | invalidate | — | OK | |
| **Shift approve/cancel** | ConfirmDialog | — | — | — | OK | E2E covered |
| Modal dismiss | X / scrim | — | — | — | Unsaved? **không** | Pro-Max sheet-dismiss-confirm |
| Form login | isLoading | OK | redirect | ? | — | Label “Required” EN |

### 2.2 Vấn đề click cụ thể (ưu tiên cảm nhận)

**P0 — “Bấm xong không biết đã xong”**  
Nhiều `useMutation({ onSuccess: invalidate })` **không toast / không success transient**. User chỉ thấy list đổi (hoặc không đổi nếu cache chậm) → distrust.

**P0 — Double-submit / no disable thống nhất**  
Một số nút `isLoading` + `isDisabled`; một số chỉ loading. Skill: **disable + spinner** luôn.

**P1 — Click hierarchy**  
Hai primary xanh topbar (Ghi danh + Đăng xuất). Skill: **1 primary / context**. Logout → secondary/ghost.

**P1 — Table action density**  
Nút “Đặt lại mật khẩu” lặp mỗi hàng → mis-click risk, visual noise. Skill overflow menu.

**P1 — MetricCard / TaskRow**  
Card full-width clickable với value 0: affordance yếu (không có pressed scale, chỉ hover shadow).

**P2 — Attendance cycle**  
Toggle 3-state (present→late→absent) **tốt cho tablet** nhưng thiếu hint “bấm để đổi” lần đầu; color-only status (có label text — OK color-not-only).

**P2 — Deep link**  
Điểm danh cần `?session=` nhưng entry nav không deep-link buổi hôm nay → dead start (chỉ dropdown). Skill deep-linking medium.

---

## 3. UX xác nhận (Confirmation) — taxonomy bắt buộc

### 3.1 Phân loại action (áp dụng product)

| Loại | Ví dụ CMC | Pattern bắt buộc | Undo? |
|------|-----------|------------------|-------|
| **Safe / reversible** | Lưu nháp nhận xét, filter, toggle điểm danh local | Instant; success nhẹ | Local undo optional |
| **Commit / hard to undo** | Lưu điểm danh server, chấm điểm, xếp lớp | Loading → **toast success** hoặc Banner inline | Không |
| **Irreversible money / provision** | Duyệt phiếu thu (tạo LMS + email) | **ConfirmDialog** + consequences list + loading | Không — message phải nói rõ |
| **Destructive** | Xóa IP range, reject link, close exercise | ConfirmDialog **destructive** variant | Prefer soft-delete + undo toast nếu API cho |
| **Publish / external visible** | Publish nhật ký buổi học cho PH | ConfirmDialog “PH sẽ thấy” | Unpublish nếu có |
| **Exit / leave dirty** | Rời màn điểm danh khi `saved===false` | **Leave guard** dialog | Giữ draft local |
| **Auth exit** | Đăng xuất | Optional confirm nhẹ HOẶC secondary button (không primary) | — |

### 3.2 Hiện trạng ConfirmDialog

**Đã có component chuẩn** (`packages/ui` → Astryx AlertDialog):

- `title`, `message`, `confirmLabel`, `cancelLabel`, `loading`, `confirmColor` → actionVariant
- Default confirmColor `red` (destructive bias) — call site duyệt phiếu dùng `green` (map → primary, **mất semantic “an toàn nhưng irreversible”**)

**Coverage tốt:** receipt approve, shift approve/cancel, KPI, network-ip delete (e2e), student-detail.  
**Coverage yếu / thiếu (cần rà):**

| Action | Risk | Hiện trạng dự kiến |
|--------|------|--------------------|
| Publish session evidence | PH thấy ngay | Kiểm tra có ConfirmDialog không |
| exercise.close / publish | Học sinh không nộp được | isPending only? |
| guardian reject | Mất request | Có mutate — confirm? |
| Reset password (admin users) | User lock-out path | Nút lặp — confirm? |
| assessment.confirm (nhận xét) | Chốt nội dung | isPending — soft confirm? |
| Đăng xuất | Mất unsaved form | Không confirm |

### 3.3 Chuẩn copy confirm (DX + UX)

```text
Title:  [Động từ] + [đối tượng]     vd. "Xác nhận duyệt phiếu thu"
Body:   1) Tóm tắt đối tượng (mã, tên, số tiền)
        2) Hệ quả (bullet)
        3) “Không hoàn tác” nếu irreversible
Confirm: verb cụ thể (“Duyệt & Kích hoạt”) — không chỉ “OK”
Cancel:  “Hủy”
Loading: khóa Escape / scrim (đã có `!loading` on cancel)
```

Receipt approve **đã gần chuẩn** — dùng làm template toàn app.

### 3.4 Khi nào **không** confirm

- Toggle điểm danh từng HS (high frequency) — đúng  
- Filter / search / nav  
- Auto-save draft nếu có  

Confirm quá nhiều = skill anti-pattern (friction).

---

## 4. Feedback system — lỗ hổng lớn nhất (UI + DX)

### 4.1 Hiện tại

| Cơ chế | Có? | Vấn đề |
|--------|-----|--------|
| `Banner` inline | Có | Không global; dễ scroll out of view |
| `ConfirmDialog` | Có | Chỉ pre-action |
| `Button isLoading` | Có | Không hậu success |
| Skeleton Metric/Table | Có | OK loading >300ms |
| **Toast / snackbar** | **Không** (grep toàn repo) | Silent success hàng loạt |
| aria-live region | Gần như không cho mutation | A11y feedback fail |
| ResultPanel | Có trong UI pkg | Íp dụng rải |

### 4.2 Design đề xuất (one-door `@cmc/ui`)

```text
useFeedback() / toast()
  · success  — 3–5s auto-dismiss, aria-live polite
  · error    — sticky hơn hoặc 6–8s + Retry action
  · info     — optional
  · không steal focus

Quy tắc:
  · Mutation success ngắn + user ở nguyên màn → toast
  · Mutation success + navigate → toast trên màn đích HOẶC Banner
  · Mutation error → Banner gần control + toast optional
  · Irreversible sau confirm → toast “Đã duyệt SO0001”
```

### 4.3 State machine chuẩn cho mọi nút commit

```text
idle → pressed → pending (disabled+spinner)
     → success (toast / banner / label “Đã lưu”)
     → error (message + recovery)
     → idle
```

Attendance “Lưu điểm danh” → “Đã lưu” **gần chuẩn** — nhân rộng.

---

## 5. UI surface upgrades (không đổi “look brand”)

### 5.1 Button hierarchy (mọi màn)

| Role | Style |
|------|--------|
| Primary | 1/màn hoặc 1/section commit |
| Secondary | Hủy, phụ |
| Ghost / text | Logout, “Đặt lại”, overflow |
| Destructive | Đỏ, tách spatial |

**Fix ngay:** Logout ghost; Ghi danh primary; table row actions → `⋯`.

### 5.2 Empty + loading + error (3 sisters)

Pro-Max empty: message + action.  
CMC empty: text xám, không CTA (cockpit, grading, finance search empty).

Component `EmptyState { icon, title, description, primaryAction?, secondaryAction? }`.  
Component `QueryState` wrap loading/error/empty cho list pages (DX: 1 pattern).

### 5.3 Pressed / hover tokens

- Nav item, MetricCard, TaskRow, table row: `:active` opacity/bg ≤100ms  
- `cursor: pointer` trên mọi clickable (skill checklist)  
- Focus-visible đã có theme — **đừng** outline-none custom buttons

### 5.4 Unsaved guard (điểm danh, form dài)

`beforeunload` + in-app route block khi `dirty && !saved`.  
ConfirmDialog: “Rời trang? Thay đổi điểm danh chưa lưu sẽ mất.”

### 5.5 Density tier (từ research trước + Pro-Max data-dense)

- `.cmc-density-comfortable` — dashboard  
- `.cmc-density-compact` — table/list/ops (padding row ↓)

---

## 6. DX (Developer Experience) — để UX không regress

| Gap DX | Hệ quả UX | Cải thiện |
|--------|-----------|-----------|
| Không toast primitive | Mỗi màn invent Banner | `@cmc/ui` Toast + hook |
| Mutation pattern copy-paste | Quên loading/error | Helper `useActionMutation` (onSuccess toast, onError map TRPC) |
| ConfirmDialog color map mất green/blue | Semantic confirm mờ | Thêm `intent: 'danger' \| 'primary' \| 'neutral'` |
| Empty ad-hoc | Empty chết | `EmptyState` required trong ListPage API |
| Role raw string UI | Product unprofessional | `formatRole(role)` central `@cmc/auth` or ui |
| Status EN `active` | Lệch i18n | `statusLabel()` map |
| E2E covers confirm một số flow | Regression OK | Mở rộng: toast assert, leave-guard, double-click submit |
| Storybook/docs interaction states? | Agent/dev không thấy | Doc `packages/ui` Interaction states |

**DX golden path cho agent/dev:**

```tsx
// Pseudo — target pattern
const approve = useActionMutation(trpc.finance.receiptApprove, {
  successMessage: (d) => `Đã duyệt ${d.code}`,
  confirm: { title, message, confirmLabel, intent: 'primary' },
  invalidate: [['finance', 'receiptList']],
});
// Button: onClick={() => approve.run(input)} isLoading={approve.isPending}
```

---

## 7. Checklist Pro-Max áp vào CMC (audit score)

| # | Rule skill | CMC status | Action |
|---|------------|------------|--------|
| 1 | Touch ≥44px | Attendance OK; table/topbar mixed | Audit topbar buttons, table actions |
| 2 | Active/pressed feedback | Partial (hover more than press) | Add pressed tokens |
| 3 | Loading >300ms | Skeleton partial; mutations partial | Universal isPending |
| 4 | Success confirmation | **Weak (no toast)** | Toast system |
| 5 | Confirm destructive | Partial good | Matrix §3 coverage |
| 6 | Empty + action | Weak | EmptyState |
| 7 | 1 primary CTA | Fail topbar | Logout secondary |
| 8 | Focus visible | Theme OK | Verify custom buttons |
| 9 | Inline validation | Mixed | blur + near field |
| 10 | Error recovery | Some Banner only | + Retry |
| 11 | Unsaved dismiss confirm | Missing | Leave guard attendance/forms |
| 12 | Deep link state | Weak session flows | Preselect today session |
| 13 | cursor-pointer | Unknown complete | Global CSS interactive |
| 14 | reduced-motion | Token transition only | Honor prefers-reduced-motion |
| 15 | Keyboard nav forms/dialogs | AlertDialog likely trap OK | Manual QA |
| 16 | Color not only status | Attendance has labels | Keep |
| 17 | No emoji as structure | LineIcon OK | Keep |
| 18 | Toast a11y polite | N/A | When adding toast |

**Rough interaction quality:** ~5.5/10 (component có, hệ feedback chưa thành product).

---

## 8. Roadmap nâng cấp (executable)

### Sprint A — Feedback foundation (UI+DX) — 3–5 ngày

1. `ToastProvider` + `toast.success/error` trong `@cmc/ui`  
2. `useActionMutation` helper admin  
3. Áp 5 màn high-traffic: chấm điểm, lưu điểm danh, duyệt phiếu, chấm công, xếp lớp  
4. Logout → secondary; role labels Việt  

### Sprint B — Confirm matrix — 3 ngày

5. Inventory mọi mutation irreversible/publish/delete  
6. Wire ConfirmDialog + copy chuẩn  
7. Leave-guard điểm danh (và form tạo phiếu nếu dirty)  
8. E2E: confirm + prevent double submit  

### Sprint C — Click polish + empty — 3–5 ngày

9. EmptyState component + cockpit/grading/list  
10. Pressed/hover states shell + cards  
11. Table overflow menu  
12. Teacher home shortcuts (giảm click path)  
13. Preselect lớp/buổi hôm nay cho điểm danh  

### Sprint D — Density + a11y — ongoing

14. Compact density list pages  
15. aria-live toast, focus main on route change  
16. prefers-reduced-motion  
17. Storybook/docs interaction states for DX  

---

## 9. “Định nghĩa xong” cho 1 click (acceptance)

Ví dụ **Duyệt phiếu** (đã gần):

- [x] Primary “Duyệt” mở confirm  
- [x] Message có mã + tiền + hệ quả + không hoàn tác  
- [x] Loading khóa dialog  
- [ ] Toast “Đã duyệt SOxxxx” sau success  
- [ ] Error không chỉ đóng dialog im lặng  

Ví dụ **Lưu điểm danh** (đã gần):

- [x] Toggle 44px + màu + label  
- [x] Validation empty entries  
- [x] isPending + “Đã lưu”  
- [ ] Leave guard dirty  
- [ ] Toast optional nếu scroll xa Banner  

Ví dụ **Publish nhật ký**:

- [ ] Confirm “PH sẽ thấy”  
- [ ] Loading  
- [ ] Toast success  
- [ ] Error Banner + retry  

---

## 10. Kết luận

1. **UI visual** đã có nền; **UX tương tác** chưa đủ “enterprise feedback loop”.  
2. **ConfirmDialog** là asset tốt — mở rộng coverage + chuẩn copy; fix semantic color.  
3. **Thiếu Toast** = nguyên nhân #1 silent UX / silent success.  
4. **Điểm danh** là reference pattern (touch + pending + validation + saved label) — nhân bản.  
5. **DX** (helper mutation + EmptyState + formatRole) là cách giữ UX khi AI/solo dev ship nhanh.  
6. Skill Pro-Max ưu tiên CRITICAL: touch, loading, confirm destructive, focus — CMC fail chủ yếu ở **feedback sau click**, không phải ở layout vỡ.

**Next step đề xuất:** implement Sprint A (Toast + useActionMutation + 5 màn + logout secondary) — ROI cảm nhận cao nhất / scope kiểm soát.

---

## Appendix — Pro-Max search raw (tóm tắt)

- Confirmation Messages: brief success — Don't silent success  
- Active States: pressed visual — Don't no feedback  
- Empty States: message + action — Don't blank  
- Loading: skeleton/spinner >300ms — Don't frozen  
- Confirmation Dialogs: before delete/irreversible — High  
- Submit Feedback: loading → success/error — High  
- Touch 44×44, gap 8px — High  
- Toast auto-dismiss 3–5s  
- Disabled: opacity + cursor  
- Hover ≠ sole primary path on touch  

---

*Related: `research-ui-ux-product-eval.md` (layout/density/product language). File này = interaction layer.*
