# Phase 4 (tiếp) — L-02 kích hoạt học sinh: XONG

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-04-ha-tang-phien-lms.md`
**Ngày:** 2026-07-25 · **Branch:** `acceptance-journey-38-lms`

Đóng nốt Phase 4. Hai câu hỏi thiết kế chặn L-02 (ghi ở report L-01) đã giải
bằng cách đọc code, không phải hỏi lại.

## Hai blocker — giải bằng bằng chứng

**Blocker 1 — cổng `mustChangePassword`: ghi chú lỗi cũ ĐÃ LỖI THỜI.**
`change-password.tsx` đã được viết lại: dùng `<Navigate to="/student/home">` với
điều kiện `session?.mustChangePassword === false` (false tường minh, không phải
undefined/stale). Comment trong file còn tự nêu "side-effect-in-render is what
caused the P1-07 clobber" — tức chính lỗi cũ đã được sửa. Test đang xanh là
đúng, không phải may. L-02 dựng trên cổng này an toàn.

**Blocker 2 — mật khẩu mặc định: là hằng số công bố, không phải bí mật.**
`Cmc2026@` là giá trị provisioning hash vào MỌI tài khoản (`provision-from-receipt.ts:306`,
`student/router.ts:94`) VÀ được LMS in ra cho người dùng ở cả màn đăng nhập
(`login.tsx:209`) lẫn màn đổi mật khẩu (`change-password.tsx:44`). Không thể đăng
nhập lần đầu mà không biết nó. Nên spec tham chiếu qua MỘT hằng số đặt tên
`PROVISIONING_DEFAULT_PASSWORD` thay vì rải literal. Việc app để literal này lặp
4 chỗ thay vì một hằng chung → ghi vào sổ finding sản phẩm.

## Đã giao

| Hạng mục | File |
|---|---|
| **L-02** journey kích hoạt học sinh | `apps/e2e/tests/journeys/lms-student-activation.journey.ui.spec.ts` |
| Helper chuỗi provision dùng chung (DRY) | `apps/e2e/src/journey/provision-student-via-receipt.ts` |
| Lookup parent id + children (bypass RLS) | `apps/e2e/src/db.ts` — `findParentAccountIdByPhone`, `findGuardianChildren` |
| Chuẩn hoá phone trong sweep/lookup | `apps/e2e/src/db.ts` |
| Gắn `journey:` P1-04 | `scripts/acceptance-report/flow-manifest.ts` |
| Refactor L-01 dùng helper chung | `apps/e2e/tests/journeys/lms-parent-otp-login.journey.ui.spec.ts` |
| `mintLmsSession` dùng thật lần đầu | qua L-02 (bản parent bơm `children`) |

## Trình tự L-02 (đúng RT-5: reset XOÁ cờ, nên quan sát cổng TRƯỚC reset)

1. Provision qua chuỗi receipt thật → StudentAccount, mật khẩu `Cmc2026@`, cờ bật
2. Học sinh đăng nhập mật khẩu mặc định → **giữ ở `/student/change-password`**;
   assert màn logout-only (có nút đăng xuất, KHÔNG có ô đổi mật khẩu)
3. Phụ huynh (inject `mintLmsSession`) vào `/parent/home` → thấy con → bấm "Đặt
   lại mật khẩu học sinh" của chính con → màn reset → đặt mật khẩu mới → thành công
4. Học sinh đăng nhập mật khẩu MỚI → thẳng `/student/home` (cờ đã false)
5. **Falsification:** đăng nhập mật khẩu CŨ sau reset → bị chặn, lỗi generic

`mintLmsSession` bản parent bơm `children` từ Guardian (RT-6) — nhờ đó `/parent/home`
render chip con và bấm được nút reset. Không truyền id giữa context (§4.3): phụ
huynh điều hướng UI của chính mình.

## Falsification (chạy thật)

| Phá gì | Kết quả |
|---|---|
| Bỏ bước submit reset | Spec đỏ ở bước "mật khẩu mới đăng nhập được" — chứng minh assertion load-bearing ✅ |
| (nằm trong spec) mật khẩu cũ sau reset | Bị chặn, generic error ✅ |
| 4 lần liên tiếp (cả L-01+L-02) | 4/4 xanh (28.8–28.9s mỗi lần) ✅ |

## Lỗi tìm được trong lúc build (đều đã sửa ở tầng test)

1. **Phone không chuẩn hoá.** `randomVnPhone` sinh `0964661984`, provisioning lưu
   `84964661984` (login-normalized). `findParentAccountIdByPhone` và
   `sweepParentIdentity` ban đầu query theo phone thô → miss. Đã sửa: chuẩn hoá
   trong helper (import `normalizeLoginPhone`). **Kéo theo phát hiện L-01's sweep
   cũng miss âm thầm** — L-01 xanh 4× chỉ vì phone ngẫu nhiên gần như không trùng,
   không phải vì sweep chạy đúng. Nay sweep thật sự dọn được.
2. **RLS chặn `Student` khi đọc children.** `getDb()` là kết nối app (RLS, không có
   facility context). `Guardian`/`ParentAccount` miễn RLS (ADR 0042) nhưng `Student`
   thì không → quan hệ bắt buộc `student` trả null → Prisma throw. Đã sửa: chuyển
   lookup vào `db.ts` (`findGuardianChildren`) chạy `withFacility(..., {bypass:true})`
   như các helper khác; `mint-lms-session.ts` gọi nó, giữ vai trò wrapper mỏng.

## Trung thực về phạm vi

Như L-01: xanh không có nghĩa "học sinh đăng nhập được production". Nó chứng minh
cơ chế provisioning → cổng → reset → đăng nhập. Không chứng minh gửi email (comms
vẫn stub non-prod).

## DRY: trích helper chung

L-01 và L-02 cùng cần chuỗi sale-tạo-phiếu → GĐ-duyệt → provision (~40 dòng). Đạt
ngưỡng "≥2 spec cùng cần" của phase → trích `provisionStudentViaReceipt`. Lợi phụ:
gotcha học phí `3000001` (min=1 step=100000) mã hoá MỘT chỗ, L-02 không tái phạm.
Refactor L-01 sang helper rồi verify lại 4× — không yếu đi assertion nào.

## Kiểm chứng

- L-02: 4/4 xanh liên tiếp; L-01 vẫn xanh sau refactor
- Full `ui-chromium`: **19/19 xanh** (3.4 phút)
- `typecheck` 27/27 · `lint` sạch · `test` 2100 pass (23/23)
- `git diff packages/auth/src/index.ts` rỗng; 0 file sản phẩm bị chạm
- Sổ: **11/38 luồng đã chứng minh chạy** (trước: 10/38)

## Finding sản phẩm mới (bàn giao plan sửa)

- Mật khẩu mặc định `Cmc2026@` là literal lặp 4 chỗ (2 API + 2 UI) thay vì một
  hằng chung — rủi ro drift; nên rút về một hằng số export.
  (Cộng dồn với finding cũ: ô học phí từ chối số tròn.)

## Câu hỏi chưa giải quyết

- Spec cũ `lms-login.ui.spec.ts` (phủ gate + no-leak ở mức màn) có gộp/giữ khi đã
  có L-01/L-02 phủ end-to-end? Đề xuất GIỮ (nó là safety-net nhanh cho login
  screen, khác tầng với journey end-to-end) — nhưng chờ user chốt theo phase-04
  bước 0.
