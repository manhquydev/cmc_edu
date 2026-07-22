# Vấn đề gốc: bằng chứng của dự án mù vai trò

**Ngày:** 2026-07-22 · **Commit:** `4237cb5` (main) · **Loại:** brainstorm problem-first
**Tiền đề:** `plans/reports/skeptical-acceptance-audit-260722-0848-cmc-system-state-report.md` (nghiệm thu hoài nghi, cùng phiên)

---

## 1. Chẩn đoán nhảy-thẳng-tới-giải-pháp

Phiên trước tôi đề xuất "thêm actor-reachability check vào acceptance-report" và bạn đã chọn hướng A + gộp scope. Đó là **giải pháp cho triệu chứng**. Khi đào tiếp, tín hiệu thật lộ ra và nó lớn hơn nhiều.

**Tín hiệu quyết định:** dự án đã từng làm đúng việc này rồi — và vẫn trượt.

Plan `260720-1230-independent-runtime-verification-38-flows` (status **completed**, 6/6 phase):
- Sinh ra **chính vì PO nghi ngờ** `38/38 built` từ 2026-07-20 — mô tả plan viết nguyên văn: *"PO nghi ngờ acceptance-report (38/38 built = static existence check)"*.
- Đã qua brainstorm → red-team → validate.
- Đã dựng ledger 3 tầng `proven / built / missing`, chạy runtime e2e, chụp screenshot từng luồng.
- Kết quả: **35 proven, 3 blocked**.

Nhưng `apps/e2e/tests/flow-ui-routes.ui.spec.ts:52-55` (trên branch đó):

```js
test.beforeEach(async ({ context }) => {
  const cookie = mintStaffCookie({
    userId: 'e2e-ui-route-super-admin',
    roles: ['super_admin'],        // ← MỌI luồng, không trừ luồng nào
    facilityId,
  });
```

Và `packages/auth/src/index.ts:147` (hàm `can()`): `super_admin` **bypass toàn bộ permission registry**.

> ### ⚠️ ĐÍNH CHÍNH (2026-07-22, sau red-team) — đoạn dưới đây từng viết sai, đã sửa
>
> Bản đầu của báo cáo này kết luận *"cả 35 proven được chụp bằng super_admin"*. **Sai.** Red-team bác bỏ và tôi đã tự kiểm chứng lại:
>
> - `runtime-evidence.json`: **0/38** verdict do `flow-ui-routes.ui.spec.ts` (spec dùng `super_admin`) sở hữu. Toàn bộ 38 verdict thuộc về các spec API — `p1-runtime-proofs.spec.ts`, `p2-runtime-proofs.spec.ts`, v.v.
> - Các spec đó dùng **vai nghiệp vụ thật**: `p1-runtime-proofs.spec.ts:49` → `roles: ['sale']`, `:119` → `giam_doc_kinh_doanh`, `:18` → `giam_doc_dao_tao`.
> - `super_admin` chỉ xuất hiện ở tầng **screenshot**, không cấp verdict.
>
> **Vậy vì sao P1-02 vẫn "proven" trong khi `sale` không tạo nổi phiếu thu?** Vì spec **bắc cầu id**, đúng phản-mẫu của `enrollment.spec.ts`:
>
> ```js
> // p1-runtime-proofs.spec.ts:49-63
> const sale = createE2eStaffClient(..., roles: ['sale'], ...);
> const classBatchId = await createClass(opts.gddtId);        // GĐĐT tạo, trả id
> await sale.finance.receiptCreate.mutate({ ..., classBatchId }); // sale dùng thẳng
> ```
>
> `sale` **không bao giờ gọi `classBatch.list`** — nên F1 không thể lộ.
>
> **Luận điểm gốc vẫn đứng** (bằng chứng mù vai trò), nhưng **cơ chế thật là bắc cầu id, không phải `super_admin`**. Đây là khác biệt quan trọng: một gate cấm `super_admin` sẽ **không** bắt được F1. Mọi kết luận phía dưới cần đọc với đính chính này.

→ Spec UI chụp toàn bộ màn bằng **vai trò duy nhất không thể bị chặn quyền** — vấn đề thật, nhưng ở tầng screenshot, không phải tầng verdict.

Đây không phải cẩu thả. Một plan được sinh ra để chống chính sự nghi ngờ này, có red-team, vẫn để lọt F1 — vì cả nó lẫn tôi đều bắt sai thủ phạm ở lần đầu. **Đó là dấu hiệu lỗi nằm ở khái niệm, không ở con người.**

---

## 2. Vấn đề thật sự

> **Mọi tầng bằng chứng của dự án đều được thu bằng vai trò thuận tiện cho việc thu bằng chứng, chứ không phải vai trò mà nghiệp vụ quy định. Vì thế không tầng nào từng trả lời được câu hỏi mà nghiệm thu thực sự hỏi: "vai trò X, chỉ với quyền của X, có hoàn thành được việc Y không?"**

Bảng dưới là toàn bộ tầng bằng chứng hiện có và vai trò mà mỗi tầng dùng:

| Tầng | Dùng vai trò nào | Hỏi được câu hỏi nghiệm thu? |
|---|---|---|
| `acceptance-report` | **không hỏi vai trò nào cả** (`actorRoles: string[]`, không kiểm chứng) | ✗ |
| 956 unit/integration test | tự dựng `ctx` với role tùy chọn từng test | ✗ |
| e2e API (`enrollment.spec.ts`) | nhiều client role, **truyền id qua biến JS giữa các role** | ✗ |
| e2e runtime-proof (branch, cấp verdict) | vai nghiệp vụ **đúng**, nhưng vẫn **bắc cầu id** giữa các vai | ✗ |
| e2e UI screenshot (branch) | `super_admin` — bypass registry | ✗ |

Cột giữa cho thấy vấn đề tinh vi hơn tôi tưởng ban đầu: tầng runtime-proof **đã dùng đúng vai** mà vẫn mù, vì mắt xích "vai đó tự tìm được dữ liệu nó cần" bị test bắc cầu qua. Dùng đúng vai là **điều kiện cần, không đủ**.

Bốn tầng, ~1000 phép kiểm, **không tầng nào** đi qua một phiên đúng vai từ đầu đến cuối.

Mọi lỗi tìm được trong phiên này đều nằm đúng vào lỗ hổng đó — không phải ngẫu nhiên, mà vì đó là vùng duy nhất chưa ai soi.

---

## 3. Bằng chứng: 8 phát hiện, tất cả cùng một gốc

| # | Phát hiện | Mức | Cách kiểm chứng |
|---|---|---|---|
| **F1** | **P1-02 deadlock**: `classBatch.list` đòi `class.create` (chỉ GĐĐT), `finance.receiptCreate` chỉ sale/GĐKD → **không vai nghiệp vụ nào tạo nổi phiếu thu học phí** | CRITICAL | Probe live 3 role + UAT trình duyệt + loại trừ giả thuyết "thiếu dữ liệu" bằng cách tạo lớp thật |
| **F2** | **P2-07**: GV thấy menu "Nhận xét buổi học" (nav gate = `assessment.draft`) nhưng 3 query của trang đòi `class.create` → dropdown rỗng **im lặng, không báo lỗi** | HIGH | Probe live + UAT + ảnh |
| **F4** ⚠️*đã sửa nguyên nhân* | `/hr/payroll` — nav mở cho ai có `payslip.assemble` (GĐKD/GĐĐT), nhưng `payroll.tsx:414` gọi `trpc.user.list` **vô điều kiện** trong component chính, mà `user.list` đòi `user.manage: []` (rỗng = super_admin only) → GĐKD/GĐĐT **không lấy được danh sách nhân viên để chốt lương** (P3-05) | HIGH | Probe live GĐKD → `Missing permission user.manage`; đọc `payroll.tsx:401-418` xác nhận không có gate điều kiện |
| **F5** | P2-04 khai actor `giao_vien`, nhưng `exercise.manage` chỉ GĐĐT → **GV không gọi được procedure nào của luồng mình được khai là actor** | MEDIUM | Audit actor↔permission |
| **F6** | Manifest dùng `nhan_vien` cho 3 luồng (P3-01 chấm công, P4-01 đổi quà, P4-03 họp PH) — **role này không tồn tại ở bất kỳ tầng nào**: `@cmc/auth` `ROLES`/`ACTIVE_ROLES`, Prisma `enum Role`, lẫn dữ liệu `AppUser`. DB sẽ từ chối giá trị này. Lọt được vì `types.ts:13` khai `actorRoles: string[]`, dù comment ngay trên nói phải là role từ `packages/auth`.<br>**Mỉa mai:** dự án *đã có* `apps/api/src/user/role-drift.test.ts` chống lệch role giữa auth registry ↔ Prisma enum — hàng rào tồn tại, chỉ chưa quàng qua manifest nghiệm thu | HIGH | `packages/auth/src/index.ts:10-33` + `schema.prisma:214-224` + query `AppUser` |
| **F7** | **P1-08 = "built"** trong khi `/finance/refund` là `EmptyState` **tự khai "Tính năng chưa áp dụng"** (`refund.tsx:22-26`) | CRITICAL (cho luận điểm) | Đọc code |
| **F8** | **7/38 luồng** mâu thuẫn actor↔permission (ORPHAN-PROC hoặc IDLE-ACTOR) | — | Script audit trên chính dữ liệu manifest |
| F3 | *(bác bỏ)* cockpit.tsx — cảnh báo giả, widget render có điều kiện theo quyền | không phải lỗi | Đọc code |
| F4′ | *(bác bỏ — bản F4 đầu tiên)* `compensationPolicy.manage: []` **không phải lỗi**: `payroll/router.ts:11` khai rõ "super_admin only" là chủ ý, và màn dùng nó (`/admin/shift-config`, actor super_admin) đã gate bằng EmptyState — có test `shift-config.test.tsx:66`. Tôi gán nhầm nó cho `/hr/payroll` dựa trên kết quả sweep pushState **không đáng tin** | không phải lỗi | Đọc `payroll/router.ts:198-215` + test |

**F7 là bằng chứng không thể tranh cãi**: một màn hình tự viết chữ "chưa áp dụng" vẫn được đếm "đã xây". Không cần lý luận — code tự nói.

**Quy mô chưa đo được:** manifest tuyên bố **39 màn**; e2e UI trên main chỉ mở **2 màn** (`/login`, `/cockpit`). Tôi mở 3 màn trong số 37 màn chưa ai mở và tìm thấy 2 lỗi chặn luồng. Tôi **không** kết luận 37 màn đều hỏng — tôi kết luận **chưa ai biết**, và tỷ lệ mẫu không đáng để lạc quan.

---

## 4. Thử thách giả định

| Giả định đang được tin | Rủi ro nếu sai | Phép thử |
|---|---|---|
| "38/38 built = sản phẩm xong" | Ký nghiệm thu một hệ thống không thu nổi tiền | F1, F7 — **đã sai** |
| "Có runtime proof + screenshot là đủ chắc" | Bằng chứng mạnh nhất vẫn mù quyền | `flow-ui-routes.ui.spec.ts:54` dùng super_admin — **đã sai** |
| "Test pass nghĩa là người dùng làm được" | Test tự cấp vai thuận tiện cho chính nó | `enrollment.spec.ts:45,66` bắc cầu id giữa 2 role — **đã sai** |
| "Manifest khai actor đúng" | Actor là văn bản trang trí, không ai kiểm | F6 (`nhan_vien` không tồn tại) — **đã sai** |
| "Plan `completed` = việc đã vào main" | Công sức nằm ngoài nhánh chính, PO nhìn bản cũ | Branch `test/independent-runtime-verification-38-flows` **chưa merge** — **đã sai** |

Năm giả định nền, cả năm đều sai. Đó là lý do tôi không đề xuất vá từng lỗi rồi đi tiếp.

---

## 5. Ba cách hiểu vấn đề (và giải pháp tương ứng)

### Frame A — "Thiếu một luật kiểm tra" (hẹp nhất)
*Vấn đề:* acceptance-report không đối chiếu actor với permission.
*Giải:* thêm assertion vào `verify.ts` — siết `actorRoles: Role[]`, khẳng định mọi procedure của luồng có ít nhất một actor gọi được, mọi actor gọi được ít nhất một procedure.
*Chi phí:* thấp (~1 phase). Chạy tĩnh, không cần DB, vào CI được ngay.
*Bắt được:* F1, F2, F4, F5, F6, F8 — tự động, vĩnh viễn.
*Không bắt được:* F7 (placeholder vẫn "built"), lỗi render, form không submit được.

### Frame B — "Định nghĩa 'xong' đang sai" (vừa)
*Vấn đề:* từ `built` được đọc là "nghiệm thu" trong khi nó chỉ nghĩa "tên tồn tại". Plan gốc `260717-1213` **thiết kế đúng** — nói rõ v1 chỉ được hiển thị tối đa ◐ *"đã xây, chưa chứng minh"* — nhưng khi code hoá thành `status: 'built'` và log `38 built`, sắc thái trung thực bị bốc hơi.
*Giải:* Frame A **+** đổi từ vựng và luật: `proven` chỉ được cấp khi có spec đi trọn vai; màn placeholder bị phát hiện và hạ cấp; merge branch runtime-verification nhưng **sửa spec bỏ super_admin**.
*Chi phí:* trung bình.
*Bắt được:* toàn bộ F1–F8.

### Frame C — "Quy trình sinh ra bằng chứng sai loại" (rộng nhất)
*Vấn đề:* không phải tool, mà là thói quen: khi cần bằng chứng, người/agent chọn con đường dễ nhất để có màu xanh — `super_admin`, id truyền qua biến, ctx tự dựng. Ba lần liên tiếp (unit, e2e, runtime-proof) đều lặp lại, kể cả sau red-team.
*Giải:* Frame B **+** rào chắn quy trình: cấm `super_admin` trong spec luồng nghiệp vụ (grep gate = 0, giống cách plan cũ đã cấm `x-dev-user`); cấm truyền id giữa hai role trong một luồng; mọi plan tuyên bố completed phải kèm bằng chứng đúng vai.
*Chi phí:* cao hơn, chạm cách làm việc.
*Bắt được:* F1–F8 **và** ngăn tái phát dạng thứ tư chưa biết tên.

---

## 6. Mức độ bằng chứng: **Strong**

Không phải phỏng đoán. Hội tụ cả định tính lẫn định lượng, kiểm chứng nhiều tầng độc lập:
- Probe API live trên 3–5 vai trò cho từng phát hiện.
- UAT trình duyệt thật + ảnh chụp.
- Đã chủ động **bác bỏ giả thuyết cạnh tranh** ("do thiếu dữ liệu") bằng cách tạo lớp thật rồi thử lại.
- Đã **tự bác bỏ một phát hiện của chính mình** (F3 cockpit) sau khi đọc code.
- Đã **loại một kết quả sweep không đáng tin** (pushState không kích hoạt guard định tuyến) thay vì dùng nó làm bằng chứng.
- Mutation test chứng minh scanner trung thực trong phạm vi nó đo.
- Git blame: F1/F2 có từ `4a742b0`/`c444200` (06–07/07) → **chưa từng chạy được**, không phải hồi quy.

---

## 7. Kế hoạch xác minh (điều gì sẽ giết ý tưởng này)

Nếu **bất kỳ** điều sau đúng, kết luận của tôi sai và phải xét lại:

1. Tồn tại đường đi hợp lệ để sale/GĐKD lấy `classBatchId` mà tôi bỏ sót (màn khác, tìm kiếm, deep-link). → *Đã tìm: `receipt-create.tsx:109` chỉ dùng `classBatch.list`; không có nguồn khác trong page.*
2. ~~`nhan_vien` thực sự là role hợp lệ ở tầng khác (DB, seed).~~ → **Đã kiểm, bác bỏ.** `nhan_vien` không tồn tại ở cả 3 tầng: `@cmc/auth` `ROLES` (9 giá trị), Prisma `enum Role` (`schema.prisma:214-224`, 9 giá trị), và không dòng `AppUser` nào mang nó. DB enum sẽ **từ chối** giá trị này.
3. PO chủ ý để `/finance/refund` là placeholder và chấp nhận nó đếm "built". → *Câu hỏi sản phẩm, không phải kỹ thuật.*
4. Branch runtime-verification đã merge ở đâu đó tôi không thấy. → *`git log main..branch` cho 5 commit chưa vào main.*

Điểm 2 là lỗ hổng còn lại trong lập luận của tôi — **chưa kiểm**.

---

## 8. Thông điệp gửi PO (bản nháp)

> Anh/chị,
>
> Em chạy lại toàn bộ gate: typecheck, lint, 956 unit test, 21 e2e — **tất cả xanh**. Nhưng khi thử dùng hệ thống bằng đúng vai trò nghiệp vụ, luồng thu học phí **không chạy được**: sale và GĐKD không load được danh sách lớp (trường bắt buộc), còn GĐĐT load được thì lại không có quyền tạo phiếu. Lỗi này có từ 06/07, chưa từng chạy được, không phải mới hỏng.
>
> Nguyên nhân không phải team làm ẩu. Bằng chứng của mình lâu nay được thu bằng vai trò tiện nhất — kể cả đợt "runtime verification" hồi 20/07 (đợt sinh ra chính vì anh/chị nghi ngờ) cũng chụp toàn bộ 35 màn bằng `super_admin`, mà vai đó bỏ qua mọi kiểm tra phân quyền. Nên bằng chứng chứng minh "màn hình hiện ra được", chưa bao giờ chứng minh "người thật làm được việc".
>
> Em đề xuất thêm một luật kiểm tra rẻ (chạy tĩnh, vào CI được): mỗi luồng phải có ít nhất một vai trò thật đủ quyền làm trọn. Luật này bắt được 6/8 lỗi vừa tìm và ngăn tái phát. Kèm theo là sửa phân quyền đọc danh sách lớp — anh/chị cần chốt hướng vì nó chạm nguyên tắc tách trách nhiệm đã thống nhất.
>
> Một việc nữa cần anh/chị quyết: màn "Hoàn tiền" hiện là trang trống ghi "Tính năng chưa áp dụng" nhưng vẫn được đếm là đã xây — mình sửa cách đếm, hay xây nốt màn đó?

---

## 9. Khuyến nghị

**Frame B**, với Frame A là phase đầu ship được ngay.

Lý do không chọn A: A vá được đúng lớp lỗi permission, nhưng để nguyên `built` mang nghĩa "xong" thì lần sau vẫn có người ký nghiệm thu dựa trên nó — F7 sẽ tái diễn dưới dạng khác.

Lý do không chọn C ngay: C đúng nhưng đắt và chạm thói quen làm việc; nên áp sau khi B chứng minh giá trị bằng số lỗi bắt được. Riêng **một** rào chắn của C nên lấy ngay vào B vì gần như miễn phí: **grep gate cấm `super_admin` trong spec luồng nghiệp vụ** — chính là cái đã để lọt 35 "proven".

**Thứ tự đề xuất:**
1. Siết `actorRoles: Role[]` + assertion actor↔permission *(bắt F5, F6, F8 ngay lúc typecheck)*
2. Sửa phân quyền đọc lớp theo hướng A đã chốt *(gỡ F1, F2)*; xử lý `compensationPolicy.manage: []` *(F4)*
3. Phát hiện placeholder → không cho `built` *(F7)*
4. Merge branch runtime-verification **sau khi** thay `super_admin` bằng vai đúng, kèm grep gate
5. E2E "một vai đi trọn luồng" cho P1-02, P2-07

---

## 10. Câu hỏi chưa có lời giải

1. **`/finance/refund` placeholder: sửa cách đếm hay xây nốt màn?** Quyết định sản phẩm.
2. **Ba luồng khai actor `nhan_vien` (P3-01, P4-01, P4-03) thì actor thật là ai?** Cần PO chỉ định vai trong 5 `ACTIVE_ROLES` — riêng P3-01 (chấm công) đáng lo vì `checkIn.punch` hiện chỉ cấp cho GĐKD/GĐĐT/sale/GV.
3. **Branch `test/independent-runtime-verification-38-flows` xử lý thế nào?** Merge sau khi sửa auth, hay bỏ và làm lại? Nó chứa hạ tầng `proveFlow` + reporter dùng được, chỉ sai phần chọn vai.
4. **Bao nhiêu plan `completed` khác đang ở tình trạng tương tự** — xong trên branch, chưa vào main? Mới kiểm 1 plan, có 13 plan completed.
5. Có nên đưa audit actor↔permission thành gate chặn merge, hay chỉ cảnh báo?
