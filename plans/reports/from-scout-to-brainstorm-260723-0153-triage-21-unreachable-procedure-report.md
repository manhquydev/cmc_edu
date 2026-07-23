# Phân loại 21 `unreachable-procedure` — actor-audit CMC EDU v2

Ngày: 2026-07-23 · Branch `main` · Chỉ đọc, không sửa file nào.
Nguồn số liệu: `pnpm acceptance:report` → `acceptance-report/verification.json`,
`actorAudit.findings` lọc `kind === "unreachable-procedure"` (đúng 21 mục, 6 luồng).

---

## 1. TL;DR

**Không có mục nào thuộc hộp (c) "thiếu quyền thật".**
Với mọi procedure bị gắn cờ, registry `packages/auth/src/index.ts` **đã** có sẵn một roster
vai đang hoạt động đủ để gọi — trừ đúng một key (`audit.list = []`), và key đó thuộc luồng
khác (ADM-04, actor `super_admin`), tức là claim sai chỗ chứ không phải thiếu quyền.

⇒ **21 finding rút về 5 quyết định cho PO** (4 nhóm nguyên nhân, nhóm P1-05 tách đôi):

| # | Nhóm | Luồng | Số finding | Hộp | Hướng sửa |
|---|---|---|---|---|---|
| D1 | Vai `nhan_vien` không tồn tại trong `ROLES` | P3-01, P4-01, P4-03 | **9** | (a) | Thay `nhan_vien` bằng roster mà chính code đang gate |
| D2 | P1-05 chỉ khai `he_thong`, thiếu vai nhân sự | P1-05 | **3** | (a) | Thêm `giam_doc_kinh_doanh` + `giam_doc_dao_tao` |
| D3 | P1-05 claim 4 procedure **không màn nào gọi** | P1-05 | **4** | (b) | Bỏ khỏi manifest, hoặc chốt "sẽ xây UI" |
| D4 | P1-06 chỉ khai `phu_huynh`, thiếu vai duyệt | P1-06 | **4** | (a) | Thêm `giam_doc_kinh_doanh` (hoặc `sale`) |
| D5 | P1-09 claim `audit.list` — chủ thật là ADM-04 | P1-09 | **1** | (b) | Bỏ `audit.list` khỏi P1-09 |

Tổng 9 + 3 + 4 + 4 + 1 = **21** ✓

Cảnh báo điều kiện: **D5 sẽ trở thành (c)** nếu PO xác nhận GĐĐT phải mở được nhật ký
kiểm tra khi điều tra cờ đối soát — vì `audit.list` có roster **rỗng**
(`packages/auth/src/index.ts:81`), nghĩa là ngoài `super_admin` **không vai nào** gọi được.
Chi tiết ở §2.5.

---

## 2. Từng nhóm nguyên nhân

### D1 — `nhan_vien` không phải là vai (9 finding) → hộp (a)

`ROLES` chỉ có 9 giá trị (`packages/auth/src/index.ts:10-20`), `ACTIVE_ROLES` có 5
(`:27-33`). `nhan_vien` không nằm trong cả hai ⇒ audit đã báo riêng `invalid-actor`.
21 finding này **là hệ quả**, không phải 9 lỗi độc lập: luồng không có actor hợp lệ nào
thì mọi procedure có gate của nó tự động unreachable.

| Luồng | Manifest | Procedure bị cờ | Key + roster đã có sẵn |
|---|---|---|---|
| P3-01 Chấm công | `flow-manifest.ts:301` `['nhan_vien']` | `checkInOut.punch` | `checkIn.punch` = GĐKD/GĐĐT/sale/GV — `packages/auth/src/index.ts:117` |
| P4-01 Đổi quà | `flow-manifest.ts:440` `['hoc_vien','nhan_vien']` | `rewards.approve/deliver/reject/list` | `rewards.manage` = GĐKD/GĐĐT/sale — `:143` |
| P4-03 Họp PH | `flow-manifest.ts:464` `['nhan_vien']` | `parentMeeting.list/schedule/complete/cancel` | `parentMeeting.manage` = GĐKD/GĐĐT/sale — `:144` |

Bằng chứng vai thật (code đã gate đúng, chỉ manifest ghi sai):

- `/hr/checkin` gọi `checkInOut.punch` tại `apps/admin/src/pages/attendance/check-in-out.tsx:463`;
  nav entry **không có** `permission` gate (`apps/admin/src/shell/nav-registry.ts:78`) —
  cố ý, mọi vai đang hoạt động đều chấm công.
- `/admin/engagement/rewards` bọc `PermissionGate module="rewards" action="manage"`
  (`apps/admin/src/routes/admin.routes.tsx:94`); trang gọi `rewards.list/approve/deliver/reject`
  tại `apps/admin/src/pages/engagement/rewards.tsx:60,71,72,73`.
- `/crm/post-sale-meeting` nav gate `parentMeeting.manage`
  (`apps/admin/src/shell/nav-registry.ts:57`); trang gọi `parentMeeting.list`
  (`apps/admin/src/pages/crm/post-sale-meeting.tsx:66`) và `schedule/complete/cancel`
  qua hook `apps/admin/src/pages/crm/use-parent-meeting-actions.ts:14,15,16`.

TL25 ghi actor bằng chữ thường tiếng Việt "nhân viên"
(`docs/25-ma-tran-truy-vet-p1.md:38,49,51`) — manifest phiên âm thẳng thành `nhan_vien`
thay vì map sang vai registry. Đó là nguồn gốc.

**Sửa đề xuất:** trong `flow-manifest.ts`, thay `'nhan_vien'` bằng roster tương ứng
(P3-01 → 4 vai `ACTIVE_ROLES` không phải super_admin; P4-01/P4-03 → GĐKD/GĐĐT/sale).
Không nới quyền — registry đã đúng.

**Cần PO chốt:** đây là quyết định *ai đóng vai khi UAT*, không phải quyết định kỹ thuật.
Đã treo từ 2026-07-22 (`docs/runbook-uat-golive.md:279` mục 1) và **chặn lịch UAT**.

---

### D2 — P1-05 chỉ khai `he_thong`, mất phần người làm (3 finding) → hộp (a)

`flow-manifest.ts:82` khai `actorRoles: ['he_thong']`. `he_thong` là actor phi-nhân-viên
(`scripts/acceptance-report/actor-audit.ts:21`) ⇒ luồng không còn vai nhân sự nào,
mọi procedure có gate đều unreachable.

Nhưng P1-05 **không** thuần side-effect như P1-04 (`flow-manifest.ts:70-76`, `trpc: []`):
nó khai 7 procedure và 2 route màn hình. 3 trong số đó có người thật bấm:

| Procedure | Key (roster) | Ai gọi thật |
|---|---|---|
| `enrollment.enroll` | `enrollment.enroll` = GĐKD/GĐĐT/sale (`auth:69`) | `apps/admin/src/pages/enrollment/class-placement.tsx:54` |
| `finance.receiptApprove` | = GĐKD/GĐĐT (`auth:67`) | Cùng bước duyệt phiếu của P1-03 (`flow-manifest.ts:57,61`) |
| `student.lookup` | = GĐKD/GĐĐT/sale/GV (`auth:77`) | `apps/admin/src/pages/students/index.tsx:34` |

Một vai duy nhất phủ được **cả 3**: `giam_doc_kinh_doanh` hoặc `giam_doc_dao_tao`.

**Sửa đề xuất:** `actorRoles: ['he_thong', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao']`
— giữ `he_thong` cho phần tự động (ADR-A, `docs/25-ma-tran-truy-vet-p1.md:25`), thêm vai
duyệt/ghi danh cho phần người.

Ghi chú lệch route (không phải finding, nhưng PO nên biết): `enrollment.enroll` chỉ được
gọi ở `/finance/class-placement` (`apps/admin/src/routes/finance.routes.tsx:38`), trong khi
`expected.uiRoutes` của P1-05 là `/admin/students`, `/admin/students/:id`
(`flow-manifest.ts:96`). Route `/finance/class-placement` hiện **không** thuộc `uiRoutes`
của bất kỳ luồng nào.

---

### D3 — P1-05 claim 4 procedure không màn nào gọi (4 finding) → hộp (b)

Comment `flow-manifest.ts:85-86` khẳng định 4 procedure này là "màn quản lý học viên
`/admin/students` (chi tiết, tra cứu, reset mật khẩu, chặn LMS)". **Kiểm bằng code: sai.**

Toàn bộ `apps/admin/src` + `apps/lms/src` chỉ tồn tại 2 lời gọi thuộc namespace `student`:
`trpc.student.lookup` và `trpc.student.setLifecycle`. Không có lời gọi nào cho:

| Procedure claim | Định nghĩa router | Lời gọi UI |
|---|---|---|
| `student.get` | `apps/api/src/student/router.ts:165` | **không có** ở admin lẫn lms |
| `student.getManyByIds` | `apps/api/src/student/router.ts:208` | **không có** |
| `student.resetPassword` | `apps/api/src/student/router.ts:70` | **không có** |
| `enrollment.blockLms` | `apps/api/src/enrollment/router.ts:83` | **không có** |

Màn `/admin/students/:id` (`apps/admin/src/pages/students/student-detail.tsx`) không nạp
học viên qua `student.get` — nó đọc từ `location.state` (`:43`) và chỉ gọi
`student.setLifecycle` (`:49`). "Chặn LMS" trên màn đó đi qua `student.setLifecycle`
(lifecycle `blocked_lms`, `:31-32`), **không** qua `enrollment.blockLms` — chính router
cũng ghi rõ hai đường là khác nhau (`apps/api/src/student/router.ts:117`).

⇒ Đây là (b): manifest staple 4 procedure vào một màn không gọi chúng. Chúng là bề mặt
backend chưa nối UI, không phải bước của luồng P1-05. TL25 cho P1-05 cũng chỉ liệt kê
`enrollment.enroll` + `finance.receiptApprove` (`docs/25-ma-tran-truy-vet-p1.md:25`).

**Sửa đề xuất:** bỏ 4 procedure khỏi `expected.trpc` của P1-05. Hệ quả: chúng rơi vào
`orphans.untriaged` của sổ nghiệm thu ⇒ phải ghi lý do vào `documented` (cùng dạng
`course.create` hiện tại) hoặc PO chốt xây UI.

**Cần PO:** `student.resetPassword` và `enrollment.blockLms` là hành vi nghiệp vụ có thật
(reset mật khẩu học viên, khoá LMS ở tầng ghi danh). Câu hỏi là *có định xây màn cho chúng
trước go-live không*, hay chấp nhận là năng lực backend chưa dùng.

---

### D4 — P1-06 thiếu vai nhân viên duyệt (4 finding) → hộp (a)

Nghi ngờ trong đề bài **đúng và có căn cứ tài liệu**.

`flow-manifest.ts:104` khai `actorRoles: ['phu_huynh']`. TL25 khai actor là
**"PH / nhân viên"** (`docs/25-ma-tran-truy-vet-p1.md:26`) — manifest bỏ mất vế nhân viên.

Phân vai theo code, rất rõ ràng:

- Phía phụ huynh: `guardian.requestLink` là `lmsProcedure`
  (`apps/api/src/guardian/router.ts:71`) — không qua registry, nên **không** bị cờ.
- Phía nhân viên: cả 4 procedure còn lại đều ở màn `/admin/parents`
  (`apps/admin/src/pages/parents/index.tsx:76,82,90,96`):

| Procedure | Key | Roster |
|---|---|---|
| `guardian.listPendingLinks` | `guardian.listPendingLinks` | GĐKD/GĐĐT/sale/GV (`auth:76`) |
| `guardian.approveLink` | `guardian.approveLink` | GĐKD/GĐĐT/sale/GV (`auth:71`) |
| `guardian.rejectLink` | `guardian.approveLink` | như trên |
| `parentAccount.updateEmail` | `parentAccount.updateEmail` | GĐKD/sale (`auth:99`) |

Một vai phủ cả 4: **`giam_doc_kinh_doanh`** hoặc **`sale`** (GĐĐT và GV thiếu
`parentAccount.updateEmail`).

**Sửa đề xuất:** `actorRoles: ['phu_huynh', 'giam_doc_kinh_doanh']` (hoặc `'sale'` nếu
thực tế sale là người nhập email PH lúc ghi danh — comment `auth:98` gợi ý đúng như vậy).

**Cần PO:** ai ngồi hàng đợi `/admin/parents` — GĐKD hay sale?

Quan sát phụ (ảnh hưởng UAT, không thuộc 21 finding): `/admin/parents` **không có nav
entry** trong `apps/admin/src/shell/nav-registry.ts` và **không có** `PermissionGate` ở
route (`apps/admin/src/routes/admin.routes.tsx:58`) — chỉ vào được bằng gõ URL. Người được
phân công UAT sẽ không tìm thấy màn này.

---

### D5 — P1-09 claim `audit.list` (1 finding) → hộp (b)

Kiểm đúng cách đề bài yêu cầu — đọc page file của `/ops/recon`:

- Route `/ops/recon` → `apps/admin/src/routes/ops.routes.tsx:23` →
  `apps/admin/src/pages/finance/reconciliation.tsx`.
- Trang đó gọi **đúng 3** procedure: `reconciliation.listFlags` (`:181`),
  `reconciliation.dismiss` (`:189`), `reconciliation.action` (`:190`).
  **Không** gọi `audit.list`.
- `audit.list` chỉ có **một** lời gọi trong toàn repo:
  `apps/admin/src/pages/admin/audit-log.tsx:66`, thuộc route `/admin/audit-log`
  (`apps/admin/src/routes/admin.routes.tsx:107`), nav gate `audit.list`
  (`apps/admin/src/shell/nav-registry.ts:101`, nằm trong nhóm `roles: ['super_admin']`).
- Luồng ADM-04 đã claim đúng nó: `flow-manifest.ts:548-556`
  (`trpc: ['audit.list']`, `uiRoutes: ['/admin/audit-log']`, actor `super_admin`).

⇒ `audit.list` chỉ được gọi ở màn thuộc luồng KHÁC ⇒ **(b)**, P1-09 claim nhầm.

Ba procedure `reconciliation.*` còn lại của P1-09 **không** bị cờ: `giam_doc_dao_tao` có
`reconciliation.review` (`auth:148`), khớp nav gate `/ops/recon`
(`apps/admin/src/shell/nav-registry.ts:54`). Luồng vẫn chạy được.

Nguồn nhầm: TL25 P1-09 ghi bề mặt là `finance.*` + `audit.*` **"(read-only, MCP)"**
(`docs/25-ma-tran-truy-vet-p1.md:29`) — tức phần `audit.*` thuộc actor `agent` đọc qua MCP,
không phải màn nhân viên. Và MCP hiện **chưa có** tool audit: `packages/mcp-server/src/tools.ts:12-51`
chỉ định nghĩa 3 tool (`crm_opportunity_lookup`, `finance_receipt_list`,
`reconciliation_list_flags`), và `callTool` vẫn là skeleton (`:57-70`).

**Sửa đề xuất:** bỏ `audit.list` khỏi `expected.trpc` của P1-09 (`flow-manifest.ts:153`).
ADM-04 đã giữ nó nên không tạo orphan.

⚠️ **Điều kiện lật thành (c):** nếu PO nói GĐĐT phải mở được nhật ký khi điều tra một cờ
đối soát, thì đây là thiếu quyền thật — `audit.list` roster là `[]`
(`packages/auth/src/index.ts:81`), nghĩa là ngoài bypass `super_admin` trong `can()`
(`:161`) không vai nào gọi được, và nav entry cũng nằm trong nhóm `super_admin`. Lúc đó
phải sửa registry chứ không sửa manifest.

---

## 3. Mục không xếp được → cần PO

Không có finding nào trong 21 mục thiếu bằng chứng để xếp hộp. Mỗi mục đều có
`file:line` cho cả claim (manifest), gate (registry) và lời gọi thật (UI hoặc "không có").

Cái cần PO là **quyết định nghiệp vụ sau khi đã biết sự thật**, không phải thêm bằng chứng:
D1 (ai đóng vai), D3 (có xây UI cho 4 procedure không), D4 (GĐKD hay sale), D5 (GĐĐT có
cần nhật ký không).

---

## 4. Phát hiện phụ (ngoài 21 finding, nhưng chạm sổ nghiệm thu)

1. **Comment "P4-03 là EmptyState chưa gọi API" đã cũ.** Ghi ở 3 chỗ —
   `scripts/acceptance-report/flow-manifest.ts:467-468`,
   `docs/25-ma-tran-truy-vet-p1.md:51`, `docs/28-workflow-spec-p4.md:61`. Thực tế trang đã
   nối đủ 4 procedure (`apps/admin/src/pages/crm/post-sale-meeting.tsx:66,187,188` +
   `use-parent-meeting-actions.ts:14-16`). Nếu P4-03 đang bị hạ hạng vì lý do này thì lý do
   không còn đúng.
2. **Hai màn có route nhưng không có nav entry:** `/admin/parents`
   (`apps/admin/src/routes/admin.routes.tsx:58`) và `/admin/engagement/rewards` (`:91`).
   Rewards ít nhất có `PermissionGate` (`:94`); parents thì không có gate nào. Cả hai đều
   là màn của luồng đang chờ chốt actor (D4, D1) — người UAT sẽ không tìm ra đường vào.
3. **Giới hạn của audit vẫn nguyên:** 26 procedure ngoài tầm registry
   (`verification.json` → `actorAudit.ungatedProcedureCount`). Không mục nào trong 21
   finding phụ thuộc vào chúng, nhưng "không bị cờ" ≠ "đã kiểm và sạch".

---

## 5. Câu hỏi cần PO

1. **D1** — actor thật của P3-01 (chấm công), P4-01 (đổi quà), P4-03 (họp PH)? Registry gợi
   ý sẵn: P3-01 = 4 vai đang hoạt động; P4-01/P4-03 = GĐKD/GĐĐT/sale. Đang **chặn lịch UAT**
   (`docs/runbook-uat-golive.md:279`).
2. **D2** — P1-05 ngoài phần tự động thì ai là người ghi danh/duyệt: GĐKD, GĐĐT, hay cả hai?
3. **D3** — `student.resetPassword`, `enrollment.blockLms`, `student.get`,
   `student.getManyByIds`: xây màn trước go-live, hay ghi nhận là năng lực backend chưa dùng
   (như `course.create`)?
4. **D4** — hàng đợi duyệt liên kết PH ở `/admin/parents` do GĐKD hay sale vận hành?
   (chọn vai nào cũng phủ đủ 4 procedure; GĐĐT/GV thì thiếu `parentAccount.updateEmail`)
5. **D5** — GĐĐT có cần đọc nhật ký kiểm tra khi xử lý cờ đối soát không? *Không* ⇒ bỏ
   `audit.list` khỏi P1-09 (sửa manifest). *Có* ⇒ đây là thiếu quyền thật, phải mở
   `audit.list` trong registry — đổi hộp từ (b) sang (c).
6. Phụ — có sửa lại 3 chỗ ghi P4-03 là "EmptyState chưa gọi API" không, và có thêm nav entry
   cho `/admin/parents` + `/admin/engagement/rewards` trước UAT không?

---

Status: DONE
Summary: Phân loại đủ 21 `unreachable-procedure` về 5 quyết định — **không có hộp (c)**;
16 mục là (a) manifest thiếu/sai actor (`nhan_vien` không tồn tại, P1-05 chỉ khai `he_thong`,
P1-06 mất vế nhân viên) và 5 mục là (b) claim nhầm procedure (4 procedure không màn nào gọi
ở P1-05, `audit.list` thuộc ADM-04). Rủi ro duy nhất có thể lật sang (c) là `audit.list`
(roster rỗng) nếu PO xác nhận GĐĐT cần nhật ký khi điều tra đối soát.
