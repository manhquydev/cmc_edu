# Audit — thay đổi tài liệu Phase 4 (đợt `260723-0913-don-tien-uat-truoc-phase-4`)

**Ngày:** 2026-07-23 · **Phạm vi:** `docs/runbook-uat-golive.md`, `docs/27-workflow-spec-p3.md`,
`docs/25-ma-tran-truy-vet-p1.md` (uncommitted, branch `main`) · **Chế độ:** read-only, không sửa file nào.

Số dòng trích là của bản **đang có trong working tree**.

---

## 0. Kết luận ngắn

Bốn trong sáu điểm kiểm cụ thể **đạt và kiểm được bằng số**: số học §1 đúng tuyệt đối, bảng nav §5
khớp roster quyền, §9 không đánh rơi gate nào còn mở, §8 giữ được bài học `nhan_vien`.

Nhưng tiêu chí thật của phase — *"đọc một mạch không phải dừng lại hỏi ai"* — **chưa đạt**. Có 5 chỗ
người chạy UAT sẽ dừng, trong đó 3 chỗ do chính diff này tạo ra, và 2 chỗ là câu đúng-nửa sẽ khiến
người test ghi FAIL cho hệ thống đang chạy đúng thiết kế.

---

## 1. Điểm kiểm được yêu cầu — kết quả

### 1.1 §1: 98 tổ hợp — **số học ĐÚNG tuyệt đối**

```
NEW  pairCount 114 · non-param 98      (generatedAt 2026-07-23T03:51:05Z)
HEAD pairCount 118 · non-param 102     (generatedAt 2026-07-22T13:21:33Z)
```

Diff cặp non-param, đếm chính xác **−7 / +3**:

| Mất (7) | Thêm (3) |
|---|---|
| `/admin/courses` × GĐKD, GV, sale | `/finance/refund` × GĐĐT |
| `/admin/engagement/gifts` × GV, sale | `/finance/refund` × GV |
| `/admin/engagement/rewards` × GV | `/finance/refund` × sale |
| `/finance/class-placement` × GV | |

⇒ `102 − 7 + 3 = 98` ✓ · `118 → 114` ✓ · "chủ yếu `giao_vien` và `sale`" ✓ (GV 4, sale 2, GĐKD 1).
Cơ chế mô tả ở dòng 11 khớp `apps/e2e/src/screen-role-matrix.ts:67-74`. Commit `24ef2e3` có thật,
tiêu đề *"stop pointing a menu entry at the unbuilt refund screen"*, ngày 2026-07-23 01:42 ICT — sau
lần sinh artifact cũ (2026-07-22 20:21 ICT). Mọi mắt xích của lời giải thích đều đứng vững.

Con số thì đúng; **cụm `0 denied` đi kèm nó thì không** — xem F2.

### 1.2 §8: không còn tuyên bố chặn, bài học còn nguyên — **ĐẠT** (một sai số, F1)

Tiêu đề 247 đã thành `✅ ĐÃ GIẢI QUYẾT`; toàn văn bản cũ nằm trong `<details>` 253-275, giữ nguyên
đoạn `nhan_vien` **không tồn tại** trong `ROLES` (262) và bảng suy actor (268-273). Không chỗ nào
trong file còn ghi 🔴 CHẶN ở dạng đang hiệu lực. ✓

### 1.3 §9: không đánh rơi gate nào còn mở — **ĐẠT**

HEAD có 12 ô tick, bản mới có 10. Đối chiếu từng dòng: 3 dòng biến mất đúng bằng 3 dòng phase-04 bước 2
liệt kê; 2 vào bảng "Đã đóng trước UAT" (335-336), 1 chuyển thể thành ô tick 26-procedure (325-326).
Chín dòng còn lại (§5 PASS, email, e2e, PII-guard, Entra, redeploy, bước 9, bước 7–8, biên bản) **giữ
nguyên từng chữ**. Không có gate nào còn mở bị xoá lặng. ✓

Một sắc thái đáng ghi: gate cũ đòi P3-01/P4-03 *"**đã test** hoặc được PO loại khỏi phạm vi"*. Vế
"đã test" nay do ô tick §5-toàn-PASS gánh — hợp lệ, vì §5 giờ đã có dòng cho hai luồng đó.

### 1.4 §5: bảng nav khớp thực tế — **ĐẠT** (roster đúng 4/4)

| Màn | Doc nói | `nav-registry.ts` | `packages/auth/src/index.ts` | Khớp |
|---|---|---|---|---|
| `/admin/courses` | GĐĐT | `:44` `course.manage` | `:82` `['giam_doc_dao_tao']` | ✓ |
| `/finance/class-placement` | GĐKD/GĐĐT/sale | `:66` `enrollment.enroll` | `:69` `[GĐKD, GĐĐT, sale]` | ✓ |
| `/admin/engagement/gifts` | 2 GĐ | `:92` `gift.upsert` | `:140` `[GĐKD, GĐĐT]` | ✓ |
| `/admin/engagement/rewards` | GĐKD/GĐĐT/sale | `:93` `rewards.manage` | `:143` `[GĐKD, GĐĐT, sale]` | ✓ |

Nhãn menu khớp từng chữ (`Lớp & Học sinh › Khoá học`, `Tài chính & Điều hành › Xếp lớp`,
`Gắn kết › Quà tặng`, `Gắn kết › Đổi thưởng`).

**"sale không thấy Quà tặng" — ĐÚNG ở tầng entry con**, `gift.upsert` không có `sale`.
Nhưng sai ở tầng thao tác thật của người dùng — xem **F5**.

`/admin/engagement/leaderboard` là `EmptyState` thật (`leaderboard.tsx:18-22`), không có nav entry,
không có dòng nào trong §5. ✓

### 1.5 TL27 WF-P3-02 — mã nguồn khớp, **§Exceptions thì không** (F6)

Kiểm từng trích dẫn mới:
- `checkin/router.ts` §`assertCanReviewTicket` — hàm ở `:147-163`, `super_admin` return sớm ở `:158` ✓
- `trackDirectorRole` trả `null` cho roleset chỉ-giám-đốc/super_admin — `attendance/resolve-target-role.ts:28-32` ✓
- "test khoá ca 10" — `manual-punch-approval-track.test.ts:212` *"10. chủ phiếu role null (không
  sale/giao_vien) → chỉ super_admin duyệt được"*, chủ phiếu seed `giam_doc_kinh_doanh`, GĐĐT nhận
  FORBIDDEN, super_admin approve OK ✓

Nội dung D1′ được bảo toàn đúng như PO chốt. Vấn đề nằm ở câu *"cùng nội dung"* — F6.

### 1.6 TL25 P3-02 khớp TL27 — **ĐẠT ở dòng 39, hỏng ở dòng 93** (F7, F8)

### 1.7 Trích dẫn `file:line` mới thêm — kiểm hết

| Trích dẫn | Kết quả |
|---|---|
| `receipt-list.tsx:133` | ✓ dòng `navigate('/finance/new')`; nhãn nút thật là `+ Tạo phiếu thu` (`:130`) — F15 |
| `apps/api/src/boot-checks.ts` | ✓ `assertNoMalformedSecretsForProd` có trong working tree |
| `checkin/router.ts` §`assertCanReviewTicket` | ✓ |
| `manual-punch-approval-track.test.ts` ca 10 | ✓ `:212` |
| commit `a754edf` | ✓ tiêu đề và nội dung khớp mô tả |
| commit `24ef2e3` | ✓ ngày và nội dung khớp |
| `plans/.../phase-03-brevo-host-uat-email-that.md` | ✓ tồn tại — nhưng **untracked** (F14) |

---

## 2. Đọc runbook một mạch — mọi chỗ phải dừng lại hỏi

### F1 — HIGH · §8:249 và §9:335 nói "cả 4 vai", P4-03 chỉ có 3

> `:249` — *"P3-01 và P4-03 **đã có đủ dòng trong §5 ở cả 4 vai nghiệp vụ**"*
> `:335` — *"§5 đã có dòng cho cả hai luồng ở 4 vai"*

`flow-manifest.ts` P4-03 `actorRoles: ['giam_doc_kinh_doanh','giam_doc_dao_tao','sale']` — **3 vai**,
đúng vì `parentMeeting.manage` (`auth:144`) không có `giao_vien`. Chính §5 xác nhận: P4-03 ở dòng 131
(sale), 152 (GĐKD), 175 (GĐĐT); mục Giáo viên (178-191) **không có** P4-03. Và bảng nguyên văn còn giữ
trong `<details>` ở `:273` cũng ghi *"P4-03 | 3 vai có `parentMeeting.manage`"* — mâu thuẫn với `:249`
cách nó 24 dòng, trong cùng một mục.

Cả hai câu đều do diff này viết mới. Người kiểm chéo sẽ dừng ngay tại đây vì §8 tự cãi chính nó.

**Sửa:** *"P3-01 ở cả 4 vai nghiệp vụ; P4-03 ở 3 vai có `parentMeeting.manage`."*

### F2 — HIGH · §1:8 ghép số của ma trận mới với kết quả của lần đo cũ

> `:8` — *"runtime capture **98** tổ hợp màn×vai (`0 denied`)"*

`apps/e2e/capture-output/screen-role-capture.json`:

```
generatedAt  2026-07-22T12:27:06Z
pairsInMatrix 118 · pairsRun 102 · callsObserved 189 · denied []
```

`98` là số cặp của **kế hoạch đo** vừa sinh lại (2026-07-23); `0 denied` là **kết quả** của lần chạy
2026-07-22 trên 102 cặp khác. Ba cặp trong 98 (`/finance/refund` × sale/GV/GĐĐT) **chưa lần nào được
mở**. Câu hiện tại khẳng định một kết quả đo cho tập chưa từng đo — đúng loại tín hiệu xanh vô nghĩa
mà §3.1 của chính runbook này tồn tại để chống.

Ghi chú `:15` có cảnh báo artifact trôi, nhưng cảnh báo về **lần regenerate**, không về **lần capture**.

**Sửa:** tách hai vế — *"ma trận hiện 98 cặp; lần capture gần nhất (2026-07-22) chạy 102 cặp, 0 denied
— chưa chạy lại sau khi thêm nav"* — hoặc chạy lại capture trước UAT.

### F3 — HIGH · `docs/codebase-summary.md:10` vẫn ghi 102

> *"runtime capture 102 tổ hợp màn×vai **0 denied**"*

Diff sửa runbook mà không sửa sổ tóm tắt hiện trạng. Repo giờ có hai câu trả lời cho cùng một câu hỏi —
đúng thứ Phase 1 nêu là lý do phải regenerate. Đây là file ngoài phạm vi khai báo của phase, nhưng
không sửa thì tiêu chí "không mâu thuẫn" chỉ đúng trong biên một file.

### F4 — HIGH · §5:112 chỉ cho `sale` một lối vào `/finance/new` mà `sale` không đi được

> `:112` — *"`/finance/new` | Nút **Tạo phiếu** trên `/finance` (`receipt-list.tsx:133`) | Vào bằng nút đó, không gõ URL"*

`/finance` = `ReceiptListPage`, entry nav gate `finance.receiptList` = `['giam_doc_kinh_doanh',
'giam_doc_dao_tao']` (`auth:74`) — cổng tiền ADR-B **cố ý loại `sale`**. Nhưng `sale` chính là vai giữ
`finance.receiptCreate` (`auth:64`) và là vai duy nhất mang dòng **P1-02 "Tạo phiếu học phí từ cơ hội"**
(§5:122). Theo bảng mới, người đóng vai sale không có đường nào tới màn của luồng mình.

Lối vào thật cho đúng luồng đó nằm ở CRM, không ở `/finance`:
- `apps/admin/src/pages/crm/opportunity-detail.tsx:209` — nút `Tạo phiếu thu`, hiện khi `stage === 'O4_TESTED'`
- `apps/admin/src/pages/crm/pipeline.tsx:154`
- `apps/admin/src/pages/cockpit.tsx:124`
- `apps/admin/src/lib/enroll-picker.tsx:41`
- `apps/admin/src/pages/enrollment/class-placement.tsx:169`

Vì dòng ngay dưới (`:115`) vừa nâng "không tìm được lối vào qua menu" thành **FAIL**, người test sale sẽ
ghi FAIL cho một hệ thống đang chạy đúng thiết kế. Bảng cần tách theo vai: GĐKD/GĐĐT vào từ `/finance`;
sale vào từ màn cơ hội CRM.

### F5 — HIGH · §5:115 "sale không thấy Quà tặng" đúng ở registry, sai ở thao tác

> `:115` — *"`sale` không thấy **Quà tặng** là **đúng thiết kế** ... sale vào luồng gắn kết qua **Đổi thưởng**"*

Cách sidebar thật sự hoạt động:
- `packages/ui/src/components/side-nav.tsx:38-44` — **hàng module là một `<button>`**, click gọi
  `onNavigate(mod.path)`.
- `side-nav.tsx:45` — entry con **chỉ render khi module đang active**.
- `packages/ui/src/lib/active-module.ts:15` — active tính từ `pathname` khớp module hoặc con của nó.
- `nav-registry.ts:86` — module `engagement` có `path: '/admin/engagement/gifts'`.

⇒ `sale` đứng ở `/cockpit` muốn tới **Đổi thưởng** **bắt buộc** phải click "Gắn kết" trước, và cú click
đó **đưa thẳng vào Quà tặng**. Route gate của màn đó là `gift.list` (`admin.routes.tsx:86`), mà
`gift.list` **có** `sale` (`auth:142`) — nên sale không bị chặn, sale *vào được* và mọi hành động 403.
Đó đúng là ngõ cụt read-only mà D5 được viết ra để tránh; D5 đóng được entry con, không đóng được hàng
module.

Cùng hình dạng với `/finance/class-placement`: module `finance-ops` có `path: '/finance'`
(`nav-registry.ts:51`) — cú click mở ra "Xếp lớp" cho sale lại là cú click ném sale vào màn phiếu thu
mà sale không có `finance.receiptList`.

Runbook cần nói thẳng điều này, nếu không người test sale gặp màn 403 ngay bước đầu và không biết nên
ghi PASS hay FAIL. (Nếu coi đây là lỗi sản phẩm thì nó thuộc Phase 1, không thuộc phase tài liệu — nhưng
câu §5:115 hiện tại đang khẳng định điều không đúng.)

### F6 — MEDIUM · TL27: Actors nói "cùng nội dung" với §Exceptions, mà không cùng

> `27-workflow-spec-p3.md:51-54` — *"**`super_admin` — người duyệt cho phiếu KHÔNG có track** ... không
> phải một lối tắt trang trí ... Xem thêm §Exceptions bên dưới, **cùng nội dung**."*
> `:73-74` — *"chủ phiếu là `sale` → chỉ `giam_doc_kinh_doanh` (**hoặc `super_admin`**) duyệt được"*

Exceptions cho `super_admin` duyệt **cả phiếu có track**; Actors mô tả nó như người duyệt **chỉ** cho
phiếu không track. Mã nguồn đứng về phía Exceptions: `checkin/router.ts:158` return sớm **không điều
kiện** cho mọi `super_admin`, trên mọi phiếu; và test `manual-punch-approval-track.test.ts:89` tên đúng
là *"4. super_admin approve mọi phiếu OK (kể cả track khác)"*.

Nói cách khác D1′ đúng về **chuyện gì là quan trọng** (phiếu không-track là lớp phiếu chỉ super_admin
duyệt được), nhưng câu *"cùng nội dung"* là sai — Actors bỏ mất một năng lực mà đoạn dưới và test đều
khẳng định. Thêm một mệnh đề là xong:

> *"(`super_admin` cũng duyệt được phiếu có track — bypass registry; điểm ở đây là với phiếu KHÔNG
> track thì nó là đường duy nhất.)"*

**Sắc thái nhỏ kèm theo:** `assertCanReviewTicket:155` chặn tự duyệt phiếu của chính mình. Nên với
phiếu mà **chủ là super_admin**, "đường duyệt duy nhất" cần **một super_admin thứ hai**. Nếu hệ thống
chỉ có một super_admin thì lớp phiếu đó không ai duyệt được — đáng ghi nếu Câu hỏi #3 dẫn tới việc thêm
dòng §5 "phiếu chấm công của giám đốc".

### F7 — MEDIUM · TL25 tự mâu thuẫn: sửa `:39`, bỏ quên `:93`

- `:39` (mới) — `sale / giao_vien (chủ phiếu) · GĐ theo track (duyệt) · super_admin (phiếu không track)`
- `:93` (cũ, phần *"3d. Vai trò active → có story?"*) — `... nhân viên (P3-01,02)`
- `:38` (P3-01) — vẫn `nhân viên`

Cùng một tài liệu, cùng một câu hỏi "ai là actor của P3-02", hai câu trả lời. Chữ `nhân viên` là chính
chữ mà `a754edf` vừa gỡ khỏi manifest và là gốc của cả sự cố §8. Sửa `:39` mà để `:93` và `:38` nghĩa là
đợt này để lại đúng cái bẫy nó vừa dọn.

### F8 — MEDIUM · TL25:39 khai `super_admin`, manifest thì không

`flow-manifest.ts` P3-02 `actorRoles: ['sale','giao_vien','giam_doc_kinh_doanh','giam_doc_dao_tao']` —
không có `super_admin`. Bảng Risk của phase-04 khẳng định *"manifest P3-02 **không** khai `super_admin`,
TL27 mới là chỗ lệch"*; sau sửa, **TL25 cũng lệch khỏi manifest**. Không cơ chế tự động nào bắt được
(actor-audit đọc manifest, không đọc TL25), nên nó sẽ nằm im tới lần audit tay tiếp theo.

Bất biến của đợt cấm sửa quyền, không cấm sửa manifest — nhưng đây là quyết định phải nêu, không phải
để trôi: hoặc TL25 ghi rõ *"(không nằm trong sổ nghiệm thu — xem Câu hỏi #3)"*, hoặc manifest bổ sung.

### F9 — MEDIUM · §8d:302 chỉ tới một bước không tồn tại trong §3

> `:302` — *"Chạy lại e2e **sau** redeploy | `phase-04:117` | **Thêm vào §3 giữa bước 0 và 1**"*

Bảng §3 (`:41-52`): sau bước 0 REDEPLOY là bước 1 Backup. **Không có bước e2e nào.** Lỗi có sẵn từ HEAD,
nhưng diff này viết lại chính dòng 0 và thêm ghi chú `:54` ngay dưới bảng mà vẫn để nguyên chỉ dẫn chưa
thực hiện — trong khi §9:321 gate lên đúng việc đó. Người chạy đọc §8d sẽ quay lên §3 tìm, không thấy,
và hỏi.

**Sửa:** thêm bước "0b — chạy lại e2e" vào bảng, hoặc đổi ô trạng thái thành *"Phase 3 chạy ngay sau
redeploy; xem ghi chú dưới bảng §3"*.

### F10 — MEDIUM · §3:54 khoá nhầm biến số

> `:54` — *"Deploy thêm lần nữa giữa Phase 3 và buổi UAT sẽ làm gate §9 ... lệch"*
> `:324` (gate) — *"commit đang chạy trên prod = `main` **tại thời điểm UAT**"*

Gate so prod với **`main` tại thời điểm UAT**, nên nó vỡ khi **`main` tiến lên**, không chỉ khi có
redeploy. Ghi chú cấm deploy nhưng không cấm merge — người đọc tưởng đã được bảo vệ trong khi một PR
merge vào `main` hôm sau vẫn làm gate sai. Cần một trong hai: *"đóng băng `main` từ khi Phase 3 deploy"*,
hoặc đổi gate thành *"= hash Phase 3 ghi lại"*.

### F11 — MEDIUM · §5 vẫn gọi `sale`/`giao_vien` là người duyệt P3-02

`:126` (sale) và `:188` (giao_vien) mang tên luồng *"Duyệt phiếu chấm công offsite"*. TL27/TL25 vừa được
viết lại chính để tách **chủ phiếu** khỏi **người duyệt**, và `manualPunch.approve` = `[GĐKD, GĐĐT]`
(`auth:118`) — sale/GV không duyệt được gì.

Theo luật §4.1 *"một vai đi trọn luồng"*, người đóng vai sale sẽ mở `/hr/checkin`, tìm nút duyệt, nhận
FORBIDDEN, và ghi FAIL. §8c:295 có giải thích (*"họ tham gia qua `manualPunch.resubmit` + `list`"*)
nhưng §5 — tờ giấy người ta cầm trên tay — thì không. Thêm một vế vào ô "Luồng" là đủ:
*"(vai chủ phiếu: gửi lại sau khi bị từ chối)"*.

### F12 — LOW · §8:251 nói "4 luồng", §8:258 nói 2

`:251` — *"lỗi dịch một mã vai không tồn tại thành **4 luồng không phân công được cho ai**"*
`:258` (nguyên văn giữ lại) — *"P3-02 và P4-01 tuy cũng khai `nhan_vien` nhưng còn có đồng-actor hợp lệ
... Chỉ P3-01 và P4-03 là thuần `nhan_vien`."*

Câu tóm tắt mới lấy lại con số 4 mà đoạn đính chính bên dưới đã bác. `Câu hỏi #1` (`:340`) cũng còn
"4 luồng". Dùng *"4 luồng khai `nhan_vien`, 2 trong đó không phân công được cho ai"*.

### F13 — LOW · §9:336 gắn nhãn "§8c" cho việc §8c không nói

Bằng chứng thì đúng (`flow-manifest.ts` P4-04 `actorRoles: ['sale']` — `giao_vien` đã ra). Nhưng §8c
(`:281-295`) chưa bao giờ nhắc P4-04; §8b nói về P2-04. Sau khi ô tick bị gỡ khỏi §9, dòng bảng này là
**nơi duy nhất** trong repo ghi lại phán quyết đó, mà nó lại trỏ đi chỗ khác. Hoặc bỏ tiền tố "§8c:",
hoặc thêm mục §8e ba dòng như §8b đã làm cho P2-04.

### F14 — LOW · Runbook (tracked) trỏ vào thư mục plan (untracked); N1/N5 không định nghĩa ở đâu trong runbook

- `:301` link `plans/260723-0913-don-tien-uat-truoc-phase-4/phase-03-brevo-host-uat-email-that.md`
- `:15` *"(nợ N5)"* · `:325` và `:343` *"nợ N1"*

`git status` cho thấy cả thư mục `plans/260723-0913-don-tien-uat-truoc-phase-4/` còn **untracked**. Nếu
docs được commit trước, runbook ra đời với link chết và hai mã nợ mà người đọc runbook không tra được ở
đâu. Commit thư mục plan cùng lượt, hoặc viết đủ nghĩa tại chỗ.

### F15 — LOW · §5:112 sai nhãn nút

Nhãn thật là `+ Tạo phiếu thu` (`receipt-list.tsx:130`); doc ghi *"Nút **Tạo phiếu**"*. Dòng `:133` trích
dẫn thì đúng (đó là `onClick` của chính nút ấy).

### F16 — LOW · §3.0 còn kể chuyện theo mốc 2026-07-22

`:60-62` — *"Đo thực tế 2026-07-22 ... Các bản vá RBAC **hôm nay** (`2c686bb`, `2c13634`, `11b7eea`)"*.
Với bước 0 nay chuyển sang Phase 3 và cả file đã mang đính chính 2026-07-23, chữ "hôm nay" trôi nghĩa.
Lập luận vẫn đúng; chỉ cần thay bằng ngày tuyệt đối.

### F17 — LOW (có sẵn) · TL27 có hai dòng `**Acceptance:**` liền nhau, dòng sau là văn bản tiền-ADR-0043

`:87-88` đúng theo ADR 0043; `:89` — *"không tự duyệt; **chỉ manager trực tiếp**; phiếu theo ngày;
resubmit được"* — là gate `managerId` mà ADR 0043 đã thay bằng gate track (chính tiêu đề mục ghi
*"supersedes ADR 0039"*). Không do diff này tạo ra, nhưng nó nằm cách khối vừa viết lại 35 dòng và nói
ngược lại nó.

### F18 — LOW (có sẵn) · TL25:51 còn ghi P4-03 là EmptyState chưa gọi API

*"`/crm/post-sale-meeting` *(UI EmptyState — chưa gọi API)*"*. `flow-manifest.ts` (chú thích P4-03) ghi
rõ điều đó **sai từ 2026-07-23**: màn đã wire (commit `5408ad2`), `post-sale-meeting.tsx:65` gọi
`parentMeeting.list`. §5 giao P4-03 cho 3 vai đi test; ai tra chéo TL25 sẽ được bảo là màn chưa xây.

---

## 3. Những gì kiểm mà KHÔNG có vấn đề

- **§5 = 67 luồng-vai** ✓ — manifest cho 68 cặp vai-nghiệp-vụ (GĐĐT 18, GĐKD 16, sale 13, GV 10,
  super_admin 5, PH 3, HV 3), trừ P1-08/GĐKD đã loại ở §7 ⇒ 67. Số từng mục §5 khớp từng vai.
- **`nhan_vien` không còn ở dạng đang hiệu lực** — chỉ còn trong khối `<details>` lịch sử.
- **§8c** (26 procedure ngoài registry, 2 cặp không kết luận được) giữ nguyên, và ô tick §9:325 dẫn
  đúng về nó.
- **Bất biến quyền** — `git diff packages/auth/src/index.ts` rỗng ✓.
- **P4-04** — `actorRoles: ['sale']`, `giao_vien` đã ra; §5 không còn dòng P4-04/GV ✓.
- **P2-04** — `actorRoles: ['giam_doc_dao_tao']`; §5 mục Giáo viên không có P2-04, khớp §8b ✓.
- Trích dẫn có sẵn `auth:64` (`finance.receiptCreate`) và `auth:105` (`user.manage: []`) — kiểm lại,
  vẫn đúng dòng.
- Phase-04/phase-01 dự báo **96**; thực tế **98**. Runbook §1 mô tả đúng vì sao lệch (vế `/finance/refund`
  mà plan không lường). Tài liệu ở đây **chính xác hơn plan** — nên sửa lại con số 96 trong hai file phase
  để plan không thành nguồn sai.

---

## 4. Việc tối thiểu để đạt tiêu chí "đọc một mạch"

| # | Việc | Ở đâu |
|---|---|---|
| 1 | "4 vai" → "P3-01 4 vai / P4-03 3 vai" | runbook `:249`, `:335` |
| 2 | Tách "98 cặp" khỏi "0 denied", hoặc chạy lại capture | runbook `:8` |
| 3 | Đồng bộ 102 → 98 | `docs/codebase-summary.md:10` |
| 4 | `/finance/new`: tách lối vào theo vai (sale vào từ CRM) | runbook `:112` |
| 5 | Nói rõ hàng module "Gắn kết" ném sale vào Quà tặng | runbook `:115` |
| 6 | Thêm mệnh đề "super_admin cũng duyệt được phiếu có track" | TL27 `:51-54` |
| 7 | Sửa `nhân viên (P3-01,02)` ở dòng roll-up | TL25 `:93` (và `:38`) |
| 8 | Bước e2e: thêm vào §3 hoặc sửa ô trạng thái §8d | runbook `:302` / `:41-52` |
| 9 | Đổi "đừng deploy nữa" thành "đóng băng `main`" | runbook `:54` |
| 10 | Ghi rõ sale/GV là **chủ phiếu** ở dòng P3-02 | runbook `:126`, `:188` |

Mục 1–5 là bắt buộc trước khi tập hợp người: 1 và 3 là số sai, 2 là bằng chứng khai khống, 4 và 5 làm
người test ghi FAIL cho hệ thống chạy đúng.

---

## 5. Câu hỏi còn treo

1. F5 là lỗi tài liệu hay lỗi sản phẩm? Nếu hàng module "Gắn kết" trỏ vào Quà tặng bị coi là sai, việc
   sửa thuộc Phase 1 (`nav-registry.ts:86`), không thuộc phase tài liệu.
2. F8: TL25 khai `super_admin` cho P3-02 trong khi manifest không — sửa TL25 cho khớp manifest, hay bổ
   sung manifest? Bổ sung manifest sẽ đẻ thêm một dòng §5 và đụng Câu hỏi #3 của runbook.
3. F3 (`codebase-summary.md`) có nằm trong phạm vi đợt B không, hay ghi vào §Nợ?
