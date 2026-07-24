# Phase 4 — Hạ tầng phiên LMS + journey đăng nhập (MỘT PHẦN)

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-04-ha-tang-phien-lms.md`
**Ngày:** 2026-07-24 · **Branch:** `acceptance-journey-38-lms`

**Trạng thái: L-01 XONG, L-02 CHƯA LÀM.** Lý do dừng ghi ở §"Vì sao dừng".

## Đã giao

| Hạng mục | File | Trạng thái |
|---|---|---|
| Wrapper phiên LMS | `apps/e2e/src/journey/mint-lms-session.ts` | Xong, chưa có spec dùng (L-02/Phase 8 sẽ dùng) |
| Reader OTP theo email | `apps/e2e/src/db.ts` — `readOtpCodeByEmail` | Xong, dùng trong L-01 |
| Vệ sinh danh tính xuyên run | `apps/e2e/src/db.ts` — `sweepParentIdentity` | Xong, dùng trong L-01 |
| **L-01** journey đăng nhập OTP email | `apps/e2e/tests/journeys/lms-parent-otp-login.journey.ui.spec.ts` | **Xanh 4 lần liên tiếp** |
| Gắn `journey:` + sửa khai sai cho P1-07 | `scripts/acceptance-report/flow-manifest.ts` | Xong — sổ lên **10/38** |
| **L-02** kích hoạt học sinh 2 vai | — | **CHƯA LÀM** |

## L-01 — không cần MỘT ngoại lệ seed nào

Triage (§4, S7) kết luận P1-07 bế tắc: modal cập nhật email chỉ hiện trên row
link-request, mà link-request thì không bao giờ được tạo ⇒ "không có đường UI
nào đặt email phụ huynh".

**Kết luận đó SAI.** Kiểm chứng trực tiếp:

- `/finance/new` có ô **"Email phụ huynh"** (`receipt-create.tsx:277-284`)
- `finance.receiptCreate` nhận `parentEmail` (`finance/router.ts:103`)
- provisioning upsert email đó lên `ParentAccount` (`provision-from-receipt.ts:157`)

Nên L-01 chạy trọn bằng UI thật: sale nhập email lên phiếu → GĐKD duyệt →
provisioning tạo tài khoản mang đúng email → phụ huynh đăng nhập bằng mã OTP.
**S7 không cần nữa; S5 (seed `GuardianLinkRequest`) vẫn bị từ chối như user đã
chốt** — hai chuyện khác nhau, và đường receipt không hồi sinh queue link-request.

Bài học lặp lại đúng cảnh báo trong bộ nhớ dự án: report của agent phải được
kiểm lại, kể cả report cẩn thận có grep. Grep của triage đúng nhưng phạm vi
tìm sai màn.

## Falsification (chạy thật, không mô tả)

| # | Phá gì | Kết quả |
|---|---|---|
| 1 | Bỏ bước nhập email trên phiếu | Spec đỏ với chẩn đoán chính xác: "No OTP email was queued… almost always means no ParentAccount owns this address — check that the flow under test actually recorded it" ✅ |
| 2 | Nhập mã OTP sai trước khi nhập mã đúng (nằm luôn trong spec) | UI báo lỗi generic, KHÔNG vào được `/parent` ✅ |
| 3 | Chạy lại 4 lần liên tiếp | 4/4 xanh (23.1–23.8 s), không flake rate-limit ✅ |

Falsification #1 còn bắt được lỗi trong **chính helper của tôi**: bản đầu của
`readOtpCodeByEmail` fallback thẳng sang khôi phục code từ hash `LoginOtp`, mà
`requestOtpEmail` LUÔN tạo row đó (để giữ hợp đồng no-leak) và chỉ enqueue email
khi có ParentAccount. Nên bản đầu trả về một mã **chưa từng được gửi**, làm spec
đỏ ở chỗ khác với lý do khó hiểu, và làm sai luôn lời hứa trong docblock ("tìm
thấy trong outbox tức là đã enqueue"). Đã sửa: vắng row outbox = lỗi tường minh;
chỉ fallback khi row CÓ nhưng payload đã bị worker scrub (race thật, RT-11).

## Lỗi sản phẩm phát hiện được: ô học phí từ chối số tròn

Trong lúc dựng L-01, form tạo phiếu thu **im lặng không submit** với học phí
`3000000`.

Nguyên nhân (đã cô lập bằng thực nghiệm): `NumberInput` của ô "Học phí (VND)" đặt
`min={1}` `step={100000}` (`receipt-create.tsx:311-317`), nên bộ giá trị hợp lệ là
`1 + n×100000` — tức `100001`, `200001`, … **Số tròn như 3.000.000 là step
mismatch**, rơi vào state React thành `NaN`, `validate()` gắn lỗi "phải là số
nguyên", và form return sớm. Không có request nào rời trình duyệt.

Đo trực tiếp: `3000000` → không submit; `3000001` → submit thành công;
`5000001` (giá trị journey P1-03 vẫn dùng) → submit thành công. Journey hiện có
xanh lâu nay chỉ vì `5000001` tình cờ đúng bậc.

Đây là lỗi thật với người dùng thật: nhân viên sale nhập học phí 3.000.000 sẽ bấm
"Tạo phiếu thu" và **không có gì xảy ra**, thông báo lỗi lại nói sai nguyên nhân
("số nguyên"). Chuyển sang plan sửa, KHÔNG sửa trong plan này (bất biến plan).
L-01 dùng `3000001` kèm comment giải thích để người sau không "dọn" thành số tròn.

## Sửa khai sai của P1-07 trong manifest

Khai cũ: `lmsAuth.requestOtp`, `lmsAuth.verifyOtp`, `enrollment.mine` — **không
procedure nào được UI gọi**. Tự kiểm chứng lại (không tin report):

```
rg "lmsAuth\.requestOtp\b" apps/lms/src   → 0 matches
rg "enrollment\.mine"      apps/lms/src   → 0 matches
rg "lmsAuth\.requestOtpEmail" apps/lms/src → login.tsx:51
rg "lmsAuth\.verifyOtpEmail"  apps/lms/src → login.tsx:61
```

Sửa `expected.trpc` thành hai biến thể email thật, rồi mới gắn `journey:` — nếu
gắn trước khi sửa thì chính là vi phạm H2 mà Phase 3 vừa dựng badge để bắt.
`enrollment.mine` chuyển vào `DOCUMENTED_GAPS` thay vì xoá, để capability vẫn
hiện trong sổ (trang phụ huynh chưa có chỗ liệt kê lớp của con) — nếu chỉ xoá,
nó thành orphan chưa phân loại và `verify` sẽ exit 1.

## Trung thực về phạm vi của L-01 xanh

Xanh ở đây **không** có nghĩa "phụ huynh đăng nhập được ngoài production". Nó
chứng minh sinh mã, enqueue email, và xác thực mã. Nó KHÔNG chứng minh **gửi**:
môi trường non-production dùng `ConsoleEmailTransport`, và chính màn đăng nhập
hiển thị nhãn "[DEV ONLY — blocked-on-comms]". Transport thật (Brevo/Graph) tồn
tại nhưng không được chạy ở đây. Cảnh báo này viết ngay trong header spec.

## Vì sao dừng trước L-02

Đọc `lms-login.ui.spec.ts` (bước 0 bắt buộc của phase) lộ hai thứ làm L-02 nặng
hơn dự kiến, cần làm tử tế chứ không nên làm vội:

1. **Cổng `mustChangePassword` có ghi chú lỗi đã biết** ngay trong spec cũ
   (`:155-167`): `change-password.tsx:30` bật ngược về `/student/home` vì
   `useSession()` chưa kịp phản ánh session vừa set. Ghi chú nói đã đánh `fixme`,
   nhưng test tại `:168` hiện là `test(` thường và **đang xanh** — tức ghi chú có
   thể đã cũ, hoặc lỗi chỉ xảy ra theo thời điểm. Phải xác định rõ trước khi xây
   L-02 lên trên cổng đó, nếu không L-02 sẽ chứng minh một hành vi không ổn định.
2. **Mật khẩu mặc định `Cmc2026@` đang bị hardcode** trong spec cũ (`:169`),
   trong khi phase-04 (c) cấm L-02 hardcode. Đường thay thế mà plan nêu (ERP staff
   `student.resetPassword`) cần xác minh có màn UI thật hay không — chưa kiểm.

Cả hai là quyết định thiết kế, không phải việc gõ thêm code. Dừng ở ranh giới
sạch (mọi thứ đã giao đều xanh và đã commit) tốt hơn là giao một L-02 nửa vời.

## Kiểm chứng

- L-01: 4/4 xanh liên tiếp
- Toàn bộ `ui-chromium`: **18/18 xanh** (3.4 phút — khớp dải dự phóng Phase 1)
- 4 api spec dùng `readOtpCode` (đã refactor tách `recoverCodeFromHash`): 12 pass,
  1 skip (skip có sẵn, cần `TEST_OTP_SEAM=1`) — không hồi quy
- `pnpm typecheck` 27/27 · `lint` sạch · `test` 2100 pass (23/23 task)
- `git diff packages/auth/src/index.ts` rỗng; 0 file sản phẩm bị chạm
- Sổ: **10/38 luồng đã chứng minh chạy** (trước phase này: 9/38)

## Việc còn lại của Phase 4

1. Chốt trạng thái thật của cổng `mustChangePassword` (ghi chú lỗi cũ còn đúng?).
2. Xác minh có màn ERP nào gọi `student.resetPassword` (`student/router.ts:93-97`)
   để lấy mật khẩu biết-trước mà không hardcode.
3. Viết L-02 theo trình tự đã sửa của RT-5 (reset XOÁ cờ, nên phải gặp cổng TRƯỚC
   khi parent reset).
4. Dùng `mintLmsSession` lần đầu (hiện đã viết nhưng chưa spec nào gọi) — bản
   parent bơm `children` từ Guardian, cần smoke đúng như phase yêu cầu.

## Câu hỏi chưa giải quyết

- Ô học phí từ chối số tròn: sửa ở plan kế tiếp bằng cách nào — bỏ `step`, hay đổi
  `min` về 0/1000? (Thuộc plan sửa, không quyết ở đây.)
- Spec cũ `lms-login.ui.spec.ts` có nên gộp/giữ khi L-02 xong (phase-04 bước 0
  yêu cầu ghi quyết định này) — chưa quyết vì L-02 chưa viết.
