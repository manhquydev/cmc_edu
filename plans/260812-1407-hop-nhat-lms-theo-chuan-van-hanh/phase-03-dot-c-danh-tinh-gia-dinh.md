---
title: "Đợt C: Danh tính gia đình"
status: pending
dependencies: [1]
---

# Đợt C — Một tài khoản gia đình

**Thẩm quyền:** `plans/reports/decisions-owner-260812-cau-6-7.md` câu 6 (ACCEPTED 12/08).

## Đợt này đứng riêng

Quy mô: **67 file + 25 test**, gồm **toàn bộ e2e journey LMS**.
Bộ chứng cứ nghiệm thu hiện tại đứng trên mô hình đăng nhập hai tầng ⇒ đổi sang `family` sẽ
**làm tụt con số nghiệm thu giữa chừng** cho tới khi journey viết lại xong.
Vì vậy **không gộp đợt này với đợt khác**, và mốc "viết lại journey" nằm **trong chính đợt này**.

## Vì sao gộp (giữ lý do, không chỉ giữ kết quả)

Nguồn: journal `2026-08-07-gp-hsph...pr-29`, plan `260807-1211`.

| Vấn đề của mô hình tách đôi | Bằng chứng |
|-----------------------------|-----------|
| Hai vai trò khu học tập **gần như trùng tính năng** (đều xem + nộp theo con) | plan `:23-28` |
| Sink `studentIds[0]` ở **≥9 chỗ API** ⇒ nhà nhiều con luôn thấy con đầu sau khi đổi con | red-team RT#4 High |
| `setChildPassword` / `childLoginInfo` = phụ huynh đặt mật khẩu con ⇒ **leo thang quyền** khi gộp | RT#7 |
| Hai guard + hai helper sở hữu ⇒ phức tạp, dễ lệch | plan `:32-33` |

**`cmc_edu` đang có đúng cả 4 vấn đề này.** Phase-04 của plan 11/08 đã sửa được một phần
(không mặc định lấy con đầu — `length === 1 ? children[0] : null`), phần còn lại chưa.

## Thứ `cmc-lms` đã bỏ — cấm port lại

`kind:'parent'` / `kind:'student'` · email-OTP (`otpRequest`/`otpVerify`, bảng `LoginOtp`) ·
vé chọn con (`enterChildProfile`) · `setChildPassword` / `childLoginInfo` / `loginStudent` ·
app phụ huynh tách riêng.

## Quyết định đã chốt ở `cmc-lms` (tái dùng, đỡ phải nghĩ lại)

| Mã | Quyết định | Đánh đổi đã chấp nhận |
|----|-----------|----------------------|
| D1 | 1 tài khoản = 1 gia đình, khoá theo `ParentAccount.phone` | Chưa đổi tên bảng thành FamilyAccount |
| D2 | Đăng nhập = SĐT + mật khẩu; **bỏ OTP** | — |
| D3 | `loginCode` thôi làm credential; **giữ** `StudentAccount.passwordHash` | HS chưa tự đăng nhập |
| D-KIND | Dùng literal `'family'`, không giữ `'parent'` | Chấp nhận churn test + buộc đăng nhập lại |
| D4 | Phiên đa con, đổi con phía client, **không PIN / không xác thực lại** | Rủi ro máy dùng chung trong 12h — chủ hệ thống chấp nhận tường minh |
| — | **Không** ghi `submittedBy` phân biệt phụ huynh nộp thay con | YAGNI, red-team bị bác |

---

## C0. Cổng đo trước — BẮT BUỘC (bài học đắt nhất của `cmc-lms`)

`cmc-lms` cutover big-bang **an toàn** vì Phase 1 hard-stop đếm được **0 tài khoản null mật khẩu**.
Red-team của họ xếp đây là **Critical #1/#2**: gỡ OTP khi còn tài khoản OTP-only = **khoá cửa người dùng**.

**`cmc_edu` rủi ro CAO hơn** vì phụ huynh ở đây đang đăng nhập **OTP là chính**.

| # | Truy vấn bắt buộc |
|---|-------------------|
| 1 | `ParentAccount` có `passwordHash IS NULL` — **nếu > 0, cấm big-bang** |
| 2 | `ParentAccount` không có `phone` hoặc phone trùng |
| 3 | `Guardian` mồ côi (trỏ tới HS/PH không tồn tại) |
| 4 | `StudentAccount` đang thực sự được dùng để đăng nhập (có dấu vết đăng nhập không) |

**Cổng:** (1) > 0 ⇒ phải có đường đặt mật khẩu lần đầu **trước** khi gỡ OTP, hoặc chuyển từng bước
thay vì big-bang.

## Các bước

1. **C1** — Đường đặt mật khẩu cho phụ huynh chưa có (nếu C0 phát hiện), + quên mật khẩu gia đình.
2. **C2** — Gộp `kind` về `'family'`; phiên đa con; mọi API nhận `studentId` tường minh + kiểm sở hữu.
3. **C3** — Gỡ OTP + `loginStudent` + vé chọn con; drop `LoginOtp` (migration riêng, sau khi code gỡ).
4. **C4** — Gộp UI: một app gia đình, picker chọn con; bỏ cây route `/parent` vs `/student`.
5. **C5** — **Viết lại e2e journey LMS** theo mô hình mới; khôi phục con số nghiệm thu.

## Kiểm chứng

- Không còn `kind` parent/student trong mã nguồn và token
- Test: nhà 2 con — đổi con thì mọi màn đổi theo, không rơi về con đầu
- Test: tài khoản gia đình không truy cập được HS không thuộc mình
- Test: đổi `kind` buộc phiên cũ hết hiệu lực
- Journey LMS viết lại xanh; con số nghiệm thu ≥ mức trước đợt

## Rủi ro

| Rủi ro | Giảm thiểu |
|--------|-----------|
| **Khoá cửa phụ huynh** khi gỡ OTP | Cổng C0 — chặn cứng |
| Con số nghiệm thu tụt | Có mốc C5 trong chính đợt; báo trước cho chủ hệ thống |
| Phiên cũ còn sống sau khi đổi mô hình | Đổi `kind` làm chết cookie cũ — đúng ý đồ, cần thông báo người dùng trước |
