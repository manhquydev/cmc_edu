# Chuỗi xác thực LMS + Brevo — 2026-07-26

Mô hình chủ dự án chốt: HS đăng nhập bằng **SĐT phụ huynh** + mật khẩu; **chỉ phụ huynh**
đổi mật khẩu cho con; **PH đăng nhập bằng email** + OTP gửi qua **Brevo**.

## Kiểm chứng đầu-cuối trên stack production (không phải mock)

Chạy qua đúng HTTP mà SPA dùng (https://hoc.localhost, nginx, API `NODE_ENV=production`):

```
1. OTP requested
2. OTP minted, 6 digits: true
3. Parent session issued: true | children: [{"fullName":"Nguyễn Minh Anh"}]
4. Parent reset the child password
5. Student login → sessionToken cấp, mustChangePassword: false
```

Email thật qua Brevo: `EmailOutbox` → `status=sent`. Trước đó Brevo trả **HTTP 401 —
unrecognised IP**; sau khi chủ dự án thêm IP vào allowlist thì gửi thành công. Đây là bằng
chứng key hợp lệ + worker chọn đúng `BrevoEmailTransport` ở production. Retry + dead-letter
cũng hoạt động đúng (5 lần thử rồi `dead`, kèm `lastError` đọc được).

## Lỗ hổng đã đóng

| Vấn đề | Sửa |
|---|---|
| `parentAccount` chỉ có `updateEmail`, không có `list` ⇒ không tìm được PH để sửa email | Thêm `parentAccount.list` (facility-scoped, tìm kiếm, lọc "chưa có email") |
| Modal "Cập nhật email" chỉ với tới từ hàng đợi `GuardianLinkRequest`; PH do provisioning tạo không bao giờ ở đó | Thêm tab "Tất cả phụ huynh", dùng lại đúng modal đã có |
| `/admin/parents` không có trong menu | Thêm mục "Phụ huynh" |
| Email PH là tuỳ chọn khi lập phiếu thu ⇒ PH không email = khoá vĩnh viễn, con cũng không đổi được mật khẩu | Bắt buộc ở form (API giữ optional cho tương thích ngược) |

**Vị trí menu — lệch đề bài có chủ đích.** Tôi giao đặt mục "Phụ huynh" trong cụm Quản trị;
agent đặt vào "Lớp & Học sinh" và giải thích: `packages/auth/src/index.ts:99` cấp
`parentAccount.updateEmail` cho `giam_doc_kinh_doanh`/`sale`, trong khi cụm Quản trị gate
`roles: ['super_admin']` chạy TRƯỚC mọi kiểm tra quyền con ⇒ đặt ở đó sẽ giấu mục này khỏi
đúng hai vai được cấp quyền. Cùng hạng lỗi với `shift-config` sáng nay. **Giữ quyết định của agent.**

## An toàn: email demo

Seed cũ dùng `hoa.parent@gmail.com` — địa chỉ có thể thuộc người thật, mà production gửi OTP
thật. Đã đổi sang `@example.com` (RFC 2606, không tới ai) trong `scripts/seed-local-sim-demo.ts`
và trong DB local-sim.

## Sửa thêm: flaky #36 (`kpi double-fire`)

`apps/api/src/kpi/auto-score.ts:361` — `create()` ném P2002 **bên trong** transaction Postgres
làm abort cả transaction (`25P02: current transaction is aborted`), nên câu lệnh phục hồi
trong `catch` luôn chết. Thay bằng `createMany({ skipDuplicates: true })` →
`INSERT ... ON CONFLICT DO NOTHING`, thua đua chỉ là kết quả 0 dòng chứ không phải lỗi.
Ngữ nghĩa giữ nguyên: thắng đua thì dùng bản vừa chèn; thua đua thì đi qua đúng guard
"chỉ cập nhật khi còn draft, không bao giờ đè bản submitted+".

Kiểm chứng: 5/5 lần chạy riêng xanh (29 test/lần), và **xanh trong lần chạy full** trước đó
luôn đỏ vì nó.

## Kiểm chứng tổng

| Gate | Kết quả |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | admin **466/466** · api **1016/1017** |
| Stack production | 6 service healthy, luồng PH/HS chạy thật |

Một test còn đỏ: `submission/grade.test.ts` — "2 concurrent grades → 1 CONFLICT" nhận được 2
fulfilled. **Flaky thứ hai, không phải hồi quy**: 3/3 xanh khi chạy riêng, và thay đổi duy nhất
trong `submission/router.ts` là join đọc thêm `student.fullName` cho hàng đợi chấm bài — không
chạm đường khoá ghi của `grade`. Cùng họ với #36: test dựng tình huống đua, khi runner tải nặng
hai lệnh tự xếp hàng nên cả hai cùng thành công.

## Còn lại
1. Flaky `submission/grade` concurrent — nên làm test tự ép đua thay vì dựa vào thời điểm.
2. Chưa chứng minh OTP tới **hộp thư thật** (mới chứng minh Brevo nhận). Cần một địa chỉ
   chủ dự án kiểm soát.
3. Học sinh: màn `student/change-password` vẫn chỉ dẫn "nhờ phụ huynh" — giờ đã đúng vì PH
   vào được, nhưng nên thêm liên kết/hướng dẫn rõ hơn.

## Câu hỏi tồn đọng
1. Có cần gửi OTP thử tới một hộp thư thật để chốt nghiệm thu không? Nếu có, cho địa chỉ nào?
2. Commit toàn bộ công việc hôm nay (47 file) thành một PR hay tách theo module?
