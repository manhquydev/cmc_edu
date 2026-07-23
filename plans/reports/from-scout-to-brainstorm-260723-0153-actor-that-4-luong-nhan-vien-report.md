# Bằng chứng actor thật — 4 luồng khai `nhan_vien` (P3-01, P3-02, P4-01, P4-03)

Ngày: 2026-07-23 · Repo `cmc_edu`, branch `main` · **Chỉ đọc, không sửa code.**
Mục đích: cung cấp bằng chứng để PO chốt actor UAT. Báo cáo **không tự quyết** khi nguồn mâu thuẫn.

## 0. Phát hiện nền — `nhan_vien` không phải role sai, mà là **dịch sai từ tiếng Việt chung**

TL25 (tài liệu gốc) **không hề dùng chuỗi `nhan_vien`**. Nó dùng từ tiếng Việt **"nhân viên"** với
nghĩa *nhân sự nói chung*, không phải role key:

- `docs/25-ma-tran-truy-vet-p1.md:38` (P3-01), `:39` (P3-02), `:49` (P4-01), `:51` (P4-03) — cột "Vai trò" ghi `nhân viên`.
- `docs/25-ma-tran-truy-vet-p1.md:93` liệt kê "nhân viên (P3-01,02)" **song song** với sale/GĐKD/GĐĐT/giao_vien, rồi kết luận "Cả **4 vai trò active** + IT có story" — tức chính TL25 cũng **không đếm "nhân viên" là vai thứ 5**.
- `packages/auth/src/index.ts:10-20` — `ROLES` chỉ có 9 key, không có `nhan_vien`; `:27-33` `ACTIVE_ROLES` = 5.
- `docs/14-danh-muc-vai-tro-phan-quyen.md:19-27` — bảng 9 role chính thức. Role tên "Nhân sự" là `hr`, **dormant, 0 quyền**. `nhan_vien` không tồn tại ở đâu.

**Tiền lệ quyết định (mạnh nhất):** cùng cụm P3, `docs/27-workflow-spec-p3.md:88` viết
`**Actors:** nhân viên (sale/giáo viên)` cho WF-P3-03 — và manifest **đã dịch đúng** thành
`actorRoles: ['sale', 'giao_vien']` (`scripts/acceptance-report/flow-manifest.ts:323`).
Vậy 4 luồng còn lại là **lỗi dịch sót**, không phải yêu cầu nghiệp vụ về một vai mới.
Hệ quả: câu hỏi đúng cho PO không phải "vai `nhan_vien` là ai" mà **"tập vai nào thay thế cho mỗi luồng"**.

---

## 1. TL;DR

| Luồng | Đề xuất vai thay `nhan_vien` | Độ tin cậy | Ghi chú chặn |
|---|---|---|---|
| **P3-01** Chấm công vào/ra | `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `sale`, `giao_vien` (4 vai active có `checkIn.punch`) | **CHẮC** — 4 nguồn khớp | Điều kiện thực thi thêm: phải có `AppUser` active trong cơ sở |
| **P3-02** Duyệt phiếu offsite | Nửa **chủ phiếu**: `sale`, `giao_vien` · Nửa **duyệt**: `giam_doc_kinh_doanh`, `giam_doc_dao_tao` (đã có trong manifest) | **NGỜ** | `resubmit` là **owner-check, KHÔNG phải vai cố định**; phiếu do GĐ sở hữu chỉ `super_admin` duyệt được — PO phải chốt có đưa `super_admin` vào phạm vi UAT không |
| **P4-01** Đổi quà bằng sao | `hoc_vien` (đổi, giữ nguyên) + `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `sale` (duyệt/giao/từ chối) | **CHẮC** về quyền; **NGỜ** về khả năng test | `/admin/engagement/rewards` **không có entry nào trong nav** → người test không tìm ra màn nếu không được đưa URL |
| **P4-03** Lên lịch & nhắc họp PH | `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `sale` | **NGỜ** | TL28 khai "nhân viên/**GV**" nhưng code + test **cấm** `giao_vien` → mâu thuẫn tài liệu↔code, PO phải phán quyết (cùng họ P2-04/P4-04). Ngoài ra vế "**& nhắc**" trong tên luồng **không có gì hiện thực** |

---

## 2. Chi tiết từng luồng theo 4 nguồn

### P3-01 — "Chấm công cặp vào/ra mỗi ngày"

Manifest: `scripts/acceptance-report/flow-manifest.ts:298-307` — `actorRoles: ['nhan_vien']`, trpc `['checkInOut.punch']`, uiRoutes `['/hr/checkin']`.

**(1) TL25 — tài liệu gốc**
`docs/25-ma-tran-truy-vet-p1.md:38` — Vai trò = `nhân viên`. Không có role key.
Nguồn cấp trên TL27: `docs/27-workflow-spec-p3.md:11` — `**Meta:** P3 · P0 · người (nhân viên). **Actors:** nhân viên.`
→ TL27 cũng chỉ nói "nhân viên" chung. `:37` Traceability lặp lại `nhân viên → WF-P3-01`.
**Không tài liệu nào liệt kê vai cụ thể cho P3-01.**

**(2) Registry quyền**
- `apps/api/src/checkin/router.ts:166` — `punch: requirePermission('checkIn', 'punch')`.
- `packages/auth/src/index.ts:117` — `'checkIn.punch': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien']`, kèm comment `:112` *"All active staff roles can punch in (ADR-D: dormant roles removed)"*.
- `packages/auth/src/index.ts:161` — `super_admin` bypass toàn bộ registry (không nằm trong hàng nào).
- **Điều kiện thực thi ngoài registry** (quan trọng cho UAT): `apps/api/src/checkin/router.ts:172-175` — phải resolve được `AppUser` theo `userId + facilityId`, và `:176` `isActive`. Một `super_admin` không có hồ sơ `AppUser` sẽ nhận `FORBIDDEN` dù bypass quyền.

**(3) Nav-registry**
`apps/admin/src/shell/nav-registry.ts:78` — `{ id: 'checkin', label: 'Chấm công', path: '/hr/checkin', icon: 'clock' }` — **không có `permission`**.
Comment `:67-72` nói rõ chủ ý: *"Chấm công / Đăng ký ca / Của tôi carry no `permission` gate — visible to every active role (self-scoped procedures, no dedicated permission key)."*
Route cũng không bọc `PermissionGate`: `apps/admin/src/routes/hr.routes.tsx:19-25`.

**(4) Màn hình**
`apps/admin/src/pages/attendance/check-in-out.tsx` — tab `'Tự chấm công'` được render **vô điều kiện** cho mọi người; tab `'Duyệt chấm công'` chỉ thêm khi `canDo('manualPunch','approve')` (khối `tabs` ở cuối file, hàm `CheckInOutPage`). Nội dung tab tự chấm công: đồng hồ ICT + nút "Chấm công" + "Phiếu của tôi".
→ Màn thiết kế cho **mọi nhân sự tự chấm công**.

**Kết luận P3-01 — CHẮC.** 4 nguồn khớp nhau và khớp tiền lệ P3-03.
Đề xuất: `actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien']`.
Không đề xuất thêm `super_admin` (registry cố tình bỏ nó ra, và manifest không có luồng nào liệt kê `super_admin` làm actor).

---

### P3-02 — "Duyệt phiếu chấm công offsite" *(khó nhất)*

Manifest: `flow-manifest.ts:309-318` — `actorRoles: ['nhan_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao']`, trpc `approve/reject/resubmit/list`.

**(1) TL25**
`docs/25-ma-tran-truy-vet-p1.md:39` — Vai trò = `nhân viên / GĐ track`. API ghi `(manualPunch.approve)`.
TL27 chi tiết hơn: `docs/27-workflow-spec-p3.md:46-47` —
`**Actors:** nhân viên (tạo tự động qua WF-P3-01), GĐ Kinh doanh (phiếu của sale) hoặc GĐ Đào tạo (phiếu của giáo viên), **super_admin (mọi phiếu)**.`
`:81-83` nói rõ resubmit: *"chỉ chủ phiếu, chỉ khi `rejected`, cập nhật dòng cũ"*.
→ TL27 **có** nêu `super_admin`; TL25 **không**. Manifest theo TL25.

**(2) Registry + code — TRẢ LỜI CÂU HỎI "AI RESUBMIT ĐƯỢC"**

`manualPunch.resubmit` — `apps/api/src/checkin/router.ts:368-392`:
- `:368` `resubmit: protectedProcedure` — **không `requirePermission`, không permission key**.
- `:378-383` owner-check:
  ```ts
  const caller = await tx.appUser.findFirst({ where: { userId: ctx.subject!.userId, facilityId } });
  if (!caller || caller.id !== ticket.appUserId) {
    throw forbidden('Only the ticket owner can resubmit it.');
  }
  ```
- `:385-389` chỉ đổi được từ trạng thái `rejected` (`where: { ..., status: 'rejected' }`, `count === 0 → badRequest('Ticket is not rejected.')`).
- Chủ ý được ghi ở `packages/auth/src/index.ts:113-116`: *"`manualPunch.resubmit` uses an owner check instead of a permission key (protectedProcedure), same posture as `shift.cancel`"*.

⇒ **Actor của `resubmit` KHÔNG phải một vai cố định.** Đó là **bất kỳ nhân sự nào đang sở hữu một phiếu ở trạng thái `rejected`**. Vai chỉ quyết định gián tiếp qua *ai có thể sở hữu phiếu*.

**Ai có thể sở hữu phiếu?** Phiếu chỉ sinh ra từ `ensureDayTicket` (`router.ts:78-124`), chạy trong `checkInOut.punch`, khi: (a) ngày đó có đăng ký ca `submitted` hoặc `approved` (`:83` `if (!hasShift) return;`) **và** (b) có ít nhất một punch offsite (`:92-93`).
`shift.submit` = `['giam_doc_dao_tao', 'giam_doc_kinh_doanh', 'giao_vien', 'sale']` (`packages/auth/src/index.ts:120`) ⇒ **cả 4 vai active đều có thể sở hữu phiếu**, kể cả 2 GĐ.

`manualPunch.approve` / `reject` — `router.ts:264` và `:325`, cùng `requirePermission('manualPunch','approve')` = `['giam_doc_kinh_doanh','giam_doc_dao_tao']` (`packages/auth/src/index.ts:118`). **Cộng thêm** gate thứ hai `assertCanReviewTicket` (`router.ts:137-153`):
- `:145-147` cấm tự duyệt phiếu của chính mình (kể cả kiêm nhiệm 2 role);
- `:148` `super_admin` bypass;
- `:149-152` **track phải khớp**: `trackDirectorRole(resolveTargetRole(ownerRoles))` — chủ phiếu `sale` → **chỉ** `giam_doc_kinh_doanh`; chủ phiếu `giao_vien` → **chỉ** `giam_doc_dao_tao` (`apps/api/src/attendance/resolve-target-role.ts:22-31`);
- chủ phiếu **không có track** (GĐ / super_admin thuần) → `requiredDirectorRole === null` ⇒ **chỉ `super_admin` duyệt được** (comment `:140-143` xác nhận đúng chủ ý này).

`manualPunch.list` — `router.ts:398` `protectedProcedure`, không permission key. `scope:'mine'` self-scoped (`:408-414`); `scope:'inbox'` lọc theo track GĐ (`:416-433`), `trackRoles.length === 0 → return []` (`:433`) nên vai khác nhận mảng rỗng thay vì lỗi.

**(3) Nav-registry**
Cùng entry `/hr/checkin` không permission (`nav-registry.ts:78`). Tách vai xảy ra **bên trong màn**, không ở menu.

**(4) Màn hình**
`apps/admin/src/pages/attendance/check-in-out.tsx`:
- `MyTicketsSection` (khối "Phiếu của tôi") gọi `manualPunch.list({scope:'mine'})`, nút **"Gửi lại"** chỉ hiện khi `row.status === 'rejected'` → `manualPunch.resubmit`. Nằm trong tab tự chấm công ⇒ **mọi nhân sự đều thấy**.
- `ApproveTicketsTab` gọi `manualPunch.list({scope:'inbox'})` + approve/reject, chỉ render khi `canDo('manualPunch','approve')`.
- Header comment `:14-17` mô tả đúng hai nửa này.

**(5) Test — vai nào thực sự được chạy**
`apps/api/src/checkin/manual-punch-approval-track.test.ts` dùng `sale` (`:50, 100, 110, ...`), `giao_vien` (`:64, 91, 152`), `giam_doc_kinh_doanh` (`:215`), và ca kiêm nhiệm `['sale','giam_doc_kinh_doanh']` (`:80`).
`apps/api/src/checkin/punch-offsite.test.ts:20` chỉ dựng context `roles: ['sale']`.
→ **Không test nào** dùng `nhan_vien`.

**Kết luận P3-02 — NGỜ.**
Đề xuất tách rõ hai nửa thay cho `nhan_vien`:
- nửa **chủ phiếu** (`resubmit`, `list scope:'mine'`): `sale`, `giao_vien` — đây là tập *thực tế test được*, vì phiếu của họ có GĐ duyệt được.
- nửa **duyệt** (`approve`, `reject`, `list scope:'inbox'`): `giam_doc_kinh_doanh`, `giam_doc_dao_tao` — đã có sẵn trong manifest.

Lý do để **NGỜ** (không tự chốt):
- a. GĐ cũng đăng ký ca được ⇒ cũng sở hữu phiếu được, nhưng phiếu đó **chỉ `super_admin`** duyệt. Đưa GĐKD/GĐĐT vào "nửa chủ phiếu" sẽ kéo `super_admin` thành actor bắt buộc của luồng. TL27:47 **có** nêu `super_admin`; TL25:39 **không**. Đây là quyết định phạm vi UAT của PO, không suy được từ code.
- b. Actor `resubmit` về bản chất là *thuộc tính trạng thái* (chủ một phiếu bị từ chối), không phải vai. Bất kỳ danh sách `actorRoles` nào cũng chỉ là xấp xỉ; nên ghi kèm điều kiện tiền đề trong kịch bản UAT (phải có phiếu `rejected` trước).

---

### P4-01 — "Đổi quà bằng sao"

Manifest: `flow-manifest.ts:437-447` — `actorRoles: ['hoc_vien', 'nhan_vien']`, uiRoutes `['/admin/engagement/rewards', '/student/gifts']`.

**(1) TL25**
`docs/25-ma-tran-truy-vet-p1.md:49` — Vai trò = `học viên / nhân viên`, UI chỉ ghi `/admin/engagement/rewards`.
TL28: `docs/28-workflow-spec-p4.md:10` — `**Actors:** học viên (đổi), **nhân viên/GĐ (duyệt)**.` `:27` UI/URL = `/admin/engagement/rewards · LMS /student/gifts`.
→ TL28 tách bước rõ hơn TL25 và có nhắc "GĐ".

**(2) Registry — tách theo bước**

| Bước | Procedure | Gate | Vai |
|---|---|---|---|
| HV đổi quà | `rewards.redeem` | `apps/api/src/rewards/reward-router.ts:53` `lmsProcedure` | phiên LMS học viên (ngoài registry) |
| HV xem quà đổi được | `rewards.listForStudent` | `reward-router.ts:281` `lmsProcedure` | phiên LMS học viên |
| NV duyệt | `rewards.approve` | `reward-router.ts:119` `requirePermission('rewards','manage')` | GĐKD, GĐĐT, sale |
| NV giao quà | `rewards.deliver` | `reward-router.ts:146` cùng key | GĐKD, GĐĐT, sale |
| NV từ chối (+hoàn sao) | `rewards.reject` | `reward-router.ts:188` cùng key | GĐKD, GĐĐT, sale |
| NV xem hàng đợi | `rewards.list` | `reward-router.ts:256` cùng key | GĐKD, GĐĐT, sale |

`packages/auth/src/index.ts:143` — `'rewards.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale']`, kèm comment `:141` *"Gift/reward/meeting/appointment — directors + sale (ADR-D: hr removed)"*.
→ Câu này là bằng chứng trực tiếp: vai "hr" (Nhân sự) **đã bị gỡ khỏi** nhóm quyền này theo ADR-D.

**(3) Nav-registry — 🟠 KHOẢNG TRỐNG**
`apps/admin/src/shell/nav-registry.ts` **không có bất kỳ entry nào chứa `engagement`** (kiểm bằng grep, 0 kết quả). `/admin/engagement/rewards` và `/admin/engagement/gifts` **không xuất hiện trong menu của bất kỳ vai nào**.
Route vẫn có bảo vệ riêng: `apps/admin/src/routes/admin.routes.tsx:90-98` bọc `<PermissionGate module="rewards" action="manage" ... requirementLabel="quản lý đổi thưởng (rewards.manage)">`.
⇒ Nguồn 3 **không xác nhận được** vai nào cho P4-01, vì màn không nằm trên menu. Trong UAT, người test phải được đưa URL trực tiếp.

**(4) Màn hình**
- ERP: `apps/admin/src/pages/engagement/rewards.tsx` — header comment `:15-20` ghi *"Staff redemption queue"*, gọi `rewards.list` + approve/deliver/reject. Rõ ràng là màn của nhân sự.
- LMS: `apps/lms/src/pages/student/gifts.tsx:1` header ghi *"Gift catalog + redeem — student only (kind:'student')"*, gọi `gift.listForStudent` (`:19`) + `rewards.redeem` (`:21`). Route `apps/lms/src/routes/index.tsx:26`.

**(5) Test**
`apps/api/src/rewards/redeem-refund.test.ts:40` dùng `giam_doc_kinh_doanh`; `:103` dùng `sale`. Không có `giao_vien`, không có `nhan_vien`.

**Kết luận P4-01 — CHẮC (về quyền).**
Đề xuất: `actorRoles: ['hoc_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale']`, kèm ghi chú tách bước: `hoc_vien` làm `redeem`/`listForStudent` trên `/student/gifts`; 3 vai còn lại làm `approve`/`deliver`/`reject`/`list` trên `/admin/engagement/rewards`.
Cờ **NGỜ** riêng cho khả năng test: thiếu nav entry (mục 4.2 dưới).
Lệch nhỏ đáng ghi: manifest liệt `rewards.listForStudent` nhưng màn LMS thật gọi `gift.listForStudent` (`apps/lms/src/pages/student/gifts.tsx:19`) — cả hai procedure đều tồn tại; đây là lệch manifest↔UI, không chặn actor.

---

### P4-03 — "Lên lịch & nhắc họp PH"

Manifest: `flow-manifest.ts:461-473` — `actorRoles: ['nhan_vien']`, trpc `parentMeeting.list/schedule/complete/cancel`, uiRoutes `['/crm/post-sale-meeting']`.

**(1) TL25**
`docs/25-ma-tran-truy-vet-p1.md:51` — Vai trò = `nhân viên`.
TL28: `docs/28-workflow-spec-p4.md:54-55` — `**Meta:** P4 · P1 · **HITL** (nhân viên/GV lên lịch). **Actors:** nhân viên/**GV**, phụ huynh, Communication agent (nhắc).` `:62` Traceability lại chỉ ghi `nhân viên → WF-P4-03`.
→ **TL28 khai `giao_vien` (GV) là actor.**

**(2) Registry — MÂU THUẪN VỚI TL28**
Cả 4 procedure cùng một gate:
- `apps/api/src/meeting/router.ts:40` `list: requirePermission('parentMeeting','manage')`
- `:75` `schedule:` · `:114` `complete:` · `:134` `cancel:` — cùng key.
- `packages/auth/src/index.ts:144` — `'parentMeeting.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale']`.
⇒ **`giao_vien` KHÔNG có quyền.**
Và điều này được **khoá bằng test có chủ đích**, không phải sơ suất:
`apps/api/src/meeting/parent-meeting.test.ts:65-70`
```ts
it('list forbids a role without parentMeeting.manage', async () => {
  const teacher = appRouter.createCaller(
    buildStaffContext({ facilityId: facility.id, userId: 'teacher-meeting-1', roles: ['giao_vien'] }),
  );
  await expect(teacher.parentMeeting.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
```

**(3) Nav-registry**
`apps/admin/src/shell/nav-registry.ts:57` —
`{ id: 'post-sale-meeting', label: 'Họp sau bán', path: '/crm/post-sale-meeting', icon: 'users', permission: { module: 'parentMeeting', action: 'manage' } }`
⇒ Menu hiện đúng cho GĐKD / GĐĐT / sale, ẩn với giao_vien. **Khớp registry, lệch TL28.**
(Route `apps/admin/src/routes/crm.routes.tsx:34-41` không bọc `PermissionGate` — khác cách làm của rewards — nhưng procedure vẫn `FORBIDDEN` nên không phải lỗ hổng quyền, chỉ là màn trống + lỗi thay vì thông báo "không đủ quyền".)

**(4) Màn hình**
`apps/admin/src/pages/crm/post-sale-meeting.tsx` — màn CRM đầy đủ: `trpc.parentMeeting.list.useQuery` (`:65`), `ScheduleParentMeetingDialog`, `CompleteParentMeetingDialog`, `useParentMeetingActions` (cancel). Ngôn ngữ màn ("Học viên", bộ lọc trạng thái, đặt lịch/hoàn thành/hủy) là màn vận hành CRM — hợp với sale + 2 GĐ.

**Kết luận P4-03 — NGỜ (mâu thuẫn tài liệu ↔ code).**
Ba nguồn code (registry, nav, màn) **thống nhất**: `['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale']`.
Một nguồn tài liệu (TL28:54) khai thêm `giao_vien`, và code **cố tình chặn** vai đó.
Không tự chọn bên — đây đúng dạng đã có tiền lệ phán quyết PO (P2-04, xem `docs/runbook-uat-golive.md:230-232`) và đang chờ phán quyết (P4-04, `:243`).

---

## 3. Mâu thuẫn bằng chứng (không tự chọn bên)

| # | Mâu thuẫn | Nguồn A | Nguồn B | Cần ai quyết |
|---|---|---|---|---|
| M1 | **P4-03: giáo viên có được lên lịch họp PH không?** | `docs/28-workflow-spec-p4.md:54` khai `nhân viên/**GV**` | `packages/auth/src/index.ts:144` không cho `giao_vien`; `apps/api/src/meeting/parent-meeting.test.ts:65-70` khoá cứng bằng test FORBIDDEN; `nav-registry.ts:57` ẩn menu | **PO** — cùng họ P2-04/P4-04 |
| M2 | **P3-02: `super_admin` có nằm trong phạm vi luồng không?** | `docs/27-workflow-spec-p3.md:47` khai `super_admin (mọi phiếu)` | `docs/25-ma-tran-truy-vet-p1.md:39` chỉ ghi `nhân viên / GĐ track`; manifest theo TL25 | **PO** (phạm vi UAT) |
| M3 | **P4-03: comment manifest nói màn là EmptyState — SAI (stale)** | `flow-manifest.ts:466-468` *"page /crm/post-sale-meeting hiện là EmptyState CHƯA gọi API"*; `docs/25:51` *"(UI EmptyState — chưa gọi API)"*; `docs/28:59` *"EmptyState stub — API implemented, UI not yet wired"* | Màn đã wire thật: `apps/admin/src/pages/crm/post-sale-meeting.tsx:65` gọi `parentMeeting.list`; commit `5408ad2 feat(crm): wire after-sale and parent-meeting screens to their backends` | Sửa doc/manifest (không phải quyết định nghiệp vụ) |
| M4 | **P4-01: màn `/admin/engagement/rewards` không có trên nav** | `nav-registry.ts` — 0 entry `engagement` | Route có tồn tại + có `PermissionGate` (`admin.routes.tsx:90-98`); manifest và TL25:49 đều khai đây là UI chính của luồng | Kỹ thuật + PO (thiếu menu ⇒ không giao được cho người test) |
| M5 | **P4-03: vế "& nhắc" của tên luồng không có hiện thực** | Tên luồng `flow-manifest.ts:462` "Lên lịch **& nhắc** họp PH"; TL28:55 khai `Communication agent (nhắc)` | Cột `remindedAt` đã bị bỏ: `packages/db/prisma/schema.prisma:1535` *"phase-10: `remindedAt` dropped — never read or written by any code path"*; `apps/api/src/meeting/router.ts:38`; test khoá `parent-meeting.test.ts:59`; UI test khoá `post-sale-meeting.test.tsx:134-136` | **PO** — luồng có còn bao gồm "nhắc" không? |

Ghi chú không mâu thuẫn nhưng nên biết: `docs/runbook-uat-golive.md:211-228` đã nêu vấn đề này từ 2026-07-22 (F6 của plan `260722-0908`), và §9:270 đặt nó thành điều kiện Go/No-Go. Báo cáo này bổ sung bằng chứng file:line còn thiếu ở runbook, đặc biệt phần **tiền lệ dịch "nhân viên"→role ở P3-03** (mục 0) mà runbook chưa nêu.

---

## 4. Rủi ro kèm theo phát hiện được (không nằm trong 4 luồng nhưng ảnh hưởng UAT)

**4.1** `docs/runbook-uat-golive.md:211-215` nói *"2 luồng KHÔNG có actor hợp lệ: P3-01, P4-03"* và cảnh báo chúng **không có dòng nào trong §5 checklist** ⇒ tiêu chí "mọi dòng §5 PASS" có thể thoả trong khi **chưa ai chấm công lần nào**. Chốt actor cho P3-01/P4-03 phải kèm việc **thêm dòng vào §5**, không chỉ sửa manifest.

**4.2** P4-01 thiếu nav entry (M4). Kể cả sau khi chốt actor, người test không tự tìm được `/admin/engagement/rewards`. Cần hoặc thêm entry nav, hoặc ghi URL trực tiếp vào checklist §5 (`docs/runbook-uat-golive.md:169` hiện đã liệt URL — chấp nhận được nếu PO đồng ý test bằng URL thủ công).

**4.3** P3-01 có điều kiện tiền đề ngoài quyền: người test phải có `AppUser` active trong cơ sở (`apps/api/src/checkin/router.ts:172-176`). Theo `docs/runbook-uat-golive.md:74`, chỉ `super_admin` tạo được nhân viên và seed không tạo `AppUser` nào ⇒ phải cấp hồ sơ trước khi giao kịch bản chấm công.

**4.4** P3-02 cần **dữ liệu tiền đề nhiều bước** mới test được `resubmit`: đăng ký ca (P3-03) → punch offsite có lý do (P3-01) → GĐ đúng track từ chối → mới có phiếu `rejected` để gửi lại. Nếu kịch bản UAT không nối chuỗi này, nhánh `resubmit` sẽ không bao giờ được chạy dù luồng ghi PASS.

---

## 5. Câu hỏi cần PO quyết

1. **(M1, chặn P4-03)** Giáo viên có được lên lịch/hoàn thành họp phụ huynh không?
   - Nếu **không** → sửa `docs/28-workflow-spec-p4.md:54` cho khớp code; actor P4-03 = `[giam_doc_kinh_doanh, giam_doc_dao_tao, sale]`. (Cùng dạng phán quyết P2-04.)
   - Nếu **có** → phải nới `'parentMeeting.manage'` (`packages/auth/src/index.ts:144`) và sửa test `parent-meeting.test.ts:65-70` — đây là **nới quyền**, cần quyết định có ý thức.
2. **(M2, chặn P3-02)** `super_admin` có nằm trong phạm vi luồng P3-02 không? Cụ thể: **phiếu chấm công của chính 2 GĐ** có được đưa vào UAT không? Nếu có, chỉ `super_admin` duyệt được (`apps/api/src/checkin/router.ts:149-152`) và phải có người đóng vai đó.
3. **(P3-02)** Chấp nhận cách khai actor "xấp xỉ" cho `resubmit` không? Actor thật là *"chủ của một phiếu bị từ chối"* — không phải vai. Đề xuất ghi `sale`, `giao_vien` + thêm **điều kiện tiền đề** vào kịch bản UAT thay vì cố ép thành role.
4. **(M5, P4-03)** Luồng "Lên lịch **& nhắc** họp PH" có còn bao gồm phần *nhắc* không? Nếu **không** → đổi tên luồng (bỏ "& nhắc") ở `flow-manifest.ts:462`, TL25:51, TL28. Nếu **có** → đây là tính năng **chưa xây**, phải loại khỏi UAT có ghi lý do (`remindedAt` đã bị xoá ở phase 10).
5. **(M4, P4-01)** `/admin/engagement/rewards` và `/admin/engagement/gifts` cố tình không lên menu, hay là sót? Ảnh hưởng trực tiếp tới việc giao kịch bản UAT cho người test.
6. **(chung)** Có đưa `super_admin` vào `actorRoles` của manifest như một quy ước chung không? Hiện manifest **không luồng nào** liệt `super_admin`, dù nó bypass mọi quyền (`packages/auth/src/index.ts:161`). Giữ nguyên quy ước = nhất quán; nhưng P3-02 là luồng duy nhất có nhánh **chỉ** `super_admin` chạy được.

---

## 6. Ghi chú phạm vi

- Không sửa file nào. Chỉ đọc.
- `docs/runbook-uat-golive.md:246` tự nêu giới hạn: 26 procedure nằm **ngoài tầm registry** (owner-check, LMS, public) nên `actor-audit` không kết luận được về chúng — `manualPunch.resubmit` và `manualPunch.list` (P3-02), `rewards.redeem`/`listForStudent` (P4-01) đều thuộc nhóm này. Báo cáo này bù bằng cách đọc trực tiếp owner-check trong router, nhưng vẫn không thay được phán quyết nghiệp vụ.
- Không kiểm chứng bằng chạy thử (không có DB/UAT env trong phiên này); mọi kết luận dựa trên đọc mã, test đã viết, và tài liệu.

---

Status: DONE_WITH_CONCERNS
Summary: Đã đối chiếu đủ 4 nguồn cho P3-01/P3-02/P4-01/P4-03 và xác định `nhan_vien` là lỗi dịch từ chữ "nhân viên" chung trong TL25/TL27/TL28 (có tiền lệ P3-03 dịch đúng thành `['sale','giao_vien']`), với đề xuất vai kèm file:line cho từng luồng. Còn 5 điểm mâu thuẫn/khoảng trống phải để PO quyết — nổi bật là P4-03 (TL28 khai giáo viên nhưng code + test chặn cứng) và P3-02 (`resubmit` là owner-check, không phải vai; phiếu của GĐ chỉ `super_admin` duyệt được).
