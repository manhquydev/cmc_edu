# Review độc lập + scout toàn diện — wave form-depth / Console densify

**Ngày:** 2026-08-11  
**Phương pháp:** tester agent + 2× explore scout + local unit suite + PR #110 CI snapshot  
**Branch tip:** `c9fab9e` (+ frames test fix pending push)  
**PR:** https://github.com/manhquydev/cmc_edu/pull/110 → `develop`

---

## 1. Tình trạng thật (đo, không chép tài liệu)

| Đo | Giá trị |
|----|---------|
| Commits form-depth ERP (sau develop merge-base) | **~19** tip `c9fab9e` (ahead 19 / behind 1 develop) |
| LMS foundation unit-range | **Đã merge develop** qua PR #109 — **ngoài** blast form-depth UI |
| Local densify unit (12–15 file admin) | **115–150 PASS** (tester + orchestrator) |
| `@cmc/links` unit | **30 PASS** (src+dist) |
| `check:ui-frames --strict` | **PASS** (dual-title 0) |
| `test:ui-frames` | Fail trên CI vì expect student = standard; **đã densify full** → fix test |
| CI e2e API | **PASS** (curriculum axis 1–4) |
| CI ui-e2e | **PASS** trên `c9fab9e` (sau DataTable + journey labels) |
| CI typecheck-and-test | **FAIL** chỉ còn `test:ui-frames` assertion cũ |
| UAT người | **Chưa** |
| GitNexus index | **Stale** (branch khác) |

---

## 2. Review test độc lập — verdict

### **PASS_WITH_CONCERNS**

**Mạnh (lock tốt)**

| Bề mặt | Lock chính |
|--------|------------|
| Shifts list | Index-only inbox; không Duyệt/Từ chối list; e2e form + `/go` |
| Shifts compose | Payload matrix submit |
| Receipt form | Refund/cancel confirm + payload; viewerCan* API |
| KPI list | Confirm/override/bulk gating + flags |
| Check-in | Punch + tab Hàng chờ phiếu |
| Links | 9 entity + resolveGo + UUID |

**Yếu (false-green risk)**

| Gap | Rủi ro |
|-----|--------|
| **Không** `aftersale-detail.test.tsx` | Form path có thể hỏng, list e2e vẫn xanh |
| Form unit (shifts/kpi/parent detail) chủ yếu **presence** nút | Không lock mutate payload |
| Aftersale + KPI e2e còn **list HITL** | Dual-path: form densify chưa được journey khóa |
| Receipt refund/cancel **không** e2e journey | P1-08 UI có, proven journey thiếu |
| API integration local | Cần DB — không re-run full trong review |

**Báo cáo tester:** `plans/reports/tester-260811-form-depth-densify-test-review.md`

---

## 3. Inventory sản phẩm (scout)

### 3.1 Form chứng từ — chrome

| Form | URL form | Grade | List HITL |
|------|----------|-------|-----------|
| Ca | `/hr/shifts/:id` | Full | Inbox index-only ✓ |
| KPI | `/hr/kpi/:id` | Full | Vẫn Xác nhận/Ghi đè list + bulk kỳ |
| Phiếu thu | `/finance/:id` | Full | Không (đúng) |
| Aftersale | `/crm/aftersale/:id` | Full | Vẫn Tiếp nhận/Giải quyết/Đóng list |
| Opportunity | `/crm/opportunities/:id` | Full | Board/form |
| Student | `/admin/students/:id` | Full | Navigate |
| Class | `/admin/classes/:id` | Full | Navigate |
| Parent | `/admin/parents/:id` | Standard | Dir open; **link request list Duyệt** (e2e lock) |
| Session | `/teaching/sessions/:id` | Standard | Hub tabs |

### 3.2 `@cmc/links` (9 go)

`opportunity` · `receipt` · `student` · `classBatch` · `shiftRegistration` · `kpiScore` · `afterSaleCase` · `parentAccount` · `classSession`

### 3.3 Authority

- `docs/ux-resource-centric-structure.md` **LOCKED**
- `docs/design-system-console.md` **shipped**
- Gate: `check-ui-frames --strict` + matrix regen

### 3.4 Blast radius (vs develop)

**MEDIUM** — nhiều surface admin; **mutation write** phần lớn giữ; **GET/DTO/viewer flags + list→form** mới; densify presentation-only trên spine form-depth.

---

## 4. Đã làm từ đầu wave → nay (timeline BA)

```
1. Authority resource-centric (không app “Duyệt …”)
2. Form-depth pilot: ca + links + /go
3. KPI shared workspace + viewerCan*
4. Aftersale + parents form-depth
5. Receipt refund + cancel form
6. Console densify: chấm · KPI · ca · aftersale · PH · session · HV · lớp
7. List density: ListPage ops · Hàng chờ · onRowClick
8. CI recovery: orderGlobal · matrix · FormPage · DataTable · frames dual-title · staff search
9. e2e API enrollment + ui-e2e journeys (sau fix) xanh; typecheck kẹt test frames tier
```

---

## 5. Hướng implement tiếp (có thứ tự)

### P0 — Ship gate (ngay)

1. **Cập nhật `scripts/check-ui-frames.test.mjs`** — student-detail = **full** tier (đã densify statusbar).  
2. Push → typecheck-and-test xanh → PR #110 mergeable (required checks).  
3. Rebase/merge develop 1 commit behind nếu cần.

### P1 — Test debt form-depth (chất lượng)

1. **`aftersale-detail.test.tsx`** — render + advance/resolve/close mutate.  
2. Form mutate unit: **shifts-detail**, **kpi-detail**, **parent-detail** (confirm → payload).  
3. e2e form/`/go` cho KPI confirm + aftersale (list path secondary).

### P2 — Policy dual-path (product + UX)

| Option | Hành động |
|--------|-----------|
| A (khuyến nghị structure) | Demote list HITL aftersale/KPI → form-only; **giữ bulk KPI kỳ** |
| B | Giữ dual-path nhưng **contract test** cả hai |

Thứ tự an toàn demote: e2e form-first → unit form → strip list buttons → rewrite list unit.

### P3 — Product backlog (không trộn ship #110)

- Bảng công tháng / TEKY kanban / chatter — **cấm/defer**  
- Receipt refund/cancel **journey e2e**  
- UAT người: ca · KPI · chấm · hoàn/huỷ  
- LMS teaching spine (plans 1118) — track riêng  
- GitNexus re-analyze tip branch  

### P4 — Ops

- Dependabot/security weekly glance  
- `pnpm acceptance:report` trước phát biểu nghiệm thu  

---

## 6. Ma trận luật nghiệp vụ (tóm)

| Luật | Kết luận |
|------|----------|
| Resource-centric, không “Duyệt …” app | **Khớp** |
| Ca approve form-only (inbox index) | **Khớp** |
| KPI confirm = manager; bulk approved | **Khớp** (+ dual list UI) |
| Punch / cấm bù ngày / cấm kanban TEKY | **Khớp** |
| Hoàn/huỷ trên form phiếu | **Khớp UI** · **Chưa UAT/e2e journey** |
| Design Console | **Khớp một phần** → densify đã kéo |

---

## 7. Chốt một câu

**Wave form-depth + densify đã dựng xương “chứng từ mở được, đúng vỏ Console, multi-module”; unit densify xanh và e2e/ui-e2e gần xanh — còn test debt form (đặc biệt aftersale), dual-path list HITL, và 1 assertion frames tier chặn typecheck. Hướng tiếp: fix frames test → ship #110 → form unit + form e2e → (tuỳ product) demote list HITL.**

---

## 8. Agents used

| Agent | Output |
|-------|--------|
| **tester** | PASS_WITH_CONCERNS + 150 unit densify + investment list |
| **explore** inventory | Full form/list/HITL/links tables |
| **explore** blast | MEDIUM risk; GET/DTO vs write contracts |
| Orchestrator | Local 115 unit, frames strict, CI decode, frames test fix |
