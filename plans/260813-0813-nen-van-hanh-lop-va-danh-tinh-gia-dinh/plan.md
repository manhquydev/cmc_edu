---
title: "Nền vận hành lớp/buổi + Danh tính gia đình"
description: "Hai làn: (A) nền lịch buổi an toàn, trạng thái lớp, lý do hủy + hồi sinh buổi, vòng đời 6 giá trị, bài học trong unit — gỡ chặn cho việc nhập dữ liệu; (B) gộp phụ huynh/học sinh thành một tài khoản gia đình."
status: pending
priority: P1
effort: multi-sprint
tags: [lms, merge, lifecycle, danh-tinh, cutover]
created: 2026-08-13
revised: 2026-08-13
parent: ../260812-1407-hop-nhat-lms-theo-chuan-van-hanh/plan.md
---

# Nền vận hành lớp/buổi + Danh tính gia đình

Đây là **phần dư của Đợt 1** và **Đợt 3** trong chương trình
[hợp nhất LMS](../260812-1407-hop-nhat-lms-theo-chuan-van-hanh/plan.md), tách ra thi hành riêng
vì phần dư Đợt 1 đã **rơi khỏi mọi đợt đang chạy**.

> **Bản này đã qua red-team 4 vòng và được viết lại.** Phân xử đầy đủ:
> [`reports/redteam-adjudication-260813-0849.md`](./reports/redteam-adjudication-260813-0849.md)
> — 1 CRITICAL, 11 HIGH, 6 MEDIUM chấp nhận; 2 bác bỏ có bằng chứng ngược.
> Bản đầu **không an toàn để thi hành**: nó tưởng "thêm lý do hủy" là mở rộng một hàm, trong khi
> `cmc_edu` chưa có gỡ khung lịch, chưa có đóng lớp, và khoá duy nhất của buổi đang là một bẫy
> sinh buổi ma.

---

## Sự thật nền

`cmc-lms` **đang vận hành thật**, là chuẩn nghiệp vụ, đóng băng tại `031d193`.
`cmc_edu` **chưa production**, không người dùng thật, không dữ liệu thật.
⇒ Thay đổi phá vỡ làm ngay, mạnh tay. Rủi ro dữ liệu dồn hết về Đợt 5.

**Hai rào chắn:** (1) phân biệt "cmc-lms bỏ vì nghiệp vụ sai" với "bỏ vì phạm vi hẹp";
(2) **port LUẬT, không port CODE, không port TRIGGER**.

---

## Quyết định của chủ hệ thống

### 2026-08-13 (vòng 1)

| Nội dung | Quyết định |
|---|---|
| Bảng giá theo unit + gói bán | **Dùng chung toàn hệ** — không `facilityId`, không RLS (QĐ 0021). Áp dụng ở Đợt 4 |
| Khái niệm cần xây | Lý do hủy + hồi sinh buổi · Nhận xét theo buổi · Bài học trong unit |
| Khái niệm **không** xây | Huy hiệu, tiến độ cấp độ |
| Hash bcrypt ↔ PBKDF2 | **Hoãn tới Đợt 5**, khi có DB đầy đủ của hệ cũ. Làn B phải dồn xác thực vào **một hàm duy nhất** |
| Thứ tự | Song song A ‖ B |

### 2026-08-13 (vòng 2 — sau red-team)

| Nội dung | Quyết định |
|---|---|
| Giáo viên của buổi | **Thêm cột giáo viên trên buổi**, mặc định theo lớp. Giữ được thực tế dạy thay; đây là cạm bẫy E-3 mà `cmc-lms` đã trả giá |
| Hồ sơ học sinh | **Giữ cả bốn**: mã học sinh, ngày sinh, giới tính, ghi chú |
| Ô nhận xét theo buổi | **Giữ một ô tự do.** `cmc_edu` đã có nhận xét theo buổi và nó **mạnh hơn** nguồn (là điều kiện đóng buổi). Khi nhập thì **ghép bốn ô của `cmc-lms` thành một đoạn có nhãn** |
| Trạng thái lớp | **Đổi thành danh sách có kiểm soát**; chốt tập giá trị + bảng ánh xạ **trước** khi viết đường đóng/mở lại lớp |

### Quyết định thi hành (có căn cứ, không hỏi lại)

| # | Quyết định | Căn cứ |
|---|---|---|
| 1 | `blocked_lms` → **`on_hold`**, bằng `RENAME VALUE` | Lý do treo nó ("ảnh hưởng dữ liệu thật") sai — không có dữ liệu thật. `RENAME` vì gỡ giá trị enum **không lùi được** |
| 2 | **Cổng C0 chuyển sang Đợt 5**, chạy trên dữ liệu **nguồn** | Chạy trên `cmc_edu` chắc chắn ra > 0 ⇒ cổng tự chặn chính nó |
| 3 | Gộp hằng số ngưỡng duyệt hai mắt về một nguồn | Hard-code hai nơi: `finance/router.ts:40`, `worker/reconcile-finance-flags.ts:20` |
| 4 | Bọc `PermissionGate` cho `/finance/new`, `/finance/refund` | Các route tài chính khác đều có |

> **Số 3 và 4 chuyển sang Đợt 4, không làm ở kế hoạch này.** Cả hai thuộc miền tài chính, còn
> kế hoạch này thuộc miền lớp/buổi và danh tính. Nhét vào đây sẽ làm PR mất mạch và người review
> phải đổi ngữ cảnh giữa chừng. Chúng không chặn việc gì ở A1–A5 hay B1.
> Vòng validate bắt đúng chỗ này: hai quyết định đã ghi mà **không phase nào nhận**.

### Quyết định kỹ thuật chốt sau vòng validate (13/08)

| # | Điểm treo | Chốt |
|---|---|---|
| 1 | Khoá ổn định của bài học (A5) | **`(chương trình, thứ tự unit toàn cục, thứ tự bài trong unit)`** — suy được từ dữ liệu cả hai hệ đều có. Đồng thời **lưu mã bài** dạng `{mã unit}-{số thứ tự bài}` để Đợt 5 đối chiếu với mã của `cmc-lms`. Không chọn mã bài làm khoá chính vì CSV của `cmc_edu` không có sẵn cột đó |
| 2 | Hai hợp đồng `studentId` (B1) | **Mọi thủ tục chạm dữ liệu một học sinh đều nhận `studentId` tường minh + kiểm sở hữu.** Token gia đình **không** mang `studentId`. Đây là điều kiện để "đổi con phía client, không xác thực lại" chạy được — nếu con đang chọn nằm trong token thì đổi con buộc phải cấp token mới |
| 3 | Cơ chế làm chết phiên cũ (B1) | **Tăng `tokenVersion`.** Cơ chế đã có sẵn và đang chạy: `assert-live-session.ts` so claim với cột, và `parentAccount.setActive` đã dùng. Migration tăng một lần cho mọi tài khoản. Không phát minh cơ chế mới |
| 4 | Chính sách giới hạn thử mật khẩu (B1) | **Sao đúng khuôn đã có ở `StudentAccount`** (`schema.prisma:486-490`): đếm lần thử sai, khoá tới một mốc thời gian, xoá cả hai khi đăng nhập đúng. Thêm hai cột tương ứng cho tài khoản gia đình; giữ nguyên ngưỡng và thời gian khoá đang dùng cho học sinh |

---

## Đính chính bằng chứng — bắt buộc đọc

`phase-03` của plan mẹ được viết bằng cách **chép chứng cứ của `cmc-lms` sang**. Đo lại 13/08:

| `phase-03` khẳng định | Đo được ở `cmc_edu` |
|---|---|
| Sink `studentIds[0]` ở **≥9 chỗ API** | **Sai.** `rg studentIds\[0\]` trong `apps/api` + `apps/lms` + `packages/` = **0**. Chỉ một chỗ ở UI (`apps/lms/src/pages/parent/home.tsx:126`), chỉ chạy khi nhà đúng **một** con |
| `enterChildProfile`, `childLoginInfo`, `setChildPassword` | **Không tồn tại.** Tên thật: chọn con là state client; `lmsAuth.resetChildPassword` |
| **67 file + 25 test** | Không có nguồn đo |
| R2 "tụt con số nghiệm thu" | Thổi phồng — nhưng **con số thay thế của tôi cũng sai**. Tôi viết "3 flow"; validate bác: ít nhất **4** journey bị chạm. Số đúng phải **đo** bằng `pnpm acceptance:report`, không chép |

**Lý do thật để làm Làn B:**

```ts
// apps/api/src/lms-auth/router.ts:546-573 — loginStudent findMany MỌI StudentAccount,
// khớp mật khẩu rồi break. Comment :543-545 tự thừa nhận nhiều account cùng mật khẩu.
```
Mật khẩu mặc định lúc cấp tài khoản dùng chung cho mọi tài khoản mới
(`provisioning/provision-from-receipt.ts:302-312`) ⇒ nhà hai con chưa đổi mật khẩu thì
**đăng nhập vào con nào là không xác định**.

---

## Giao thức trộn nhánh — bắt buộc, thay cho câu sai ở bản đầu

Bản đầu viết *"hai làn không đụng file chung"*. **Sai.** Đo được các file **cả hai làn đều sửa**:

| File | Làn A dùng để | Làn B dùng để |
|---|---|---|
| `packages/db/prisma/schema.prisma` | enum lớp/buổi, vòng đời, bài học, hồ sơ HS | `LoginOtp`, `ParentAccount`, `StudentAccount` |
| `apps/api/src/guardian/approved-children.ts` | **A4** cần tập chặn vòng đời | gộp helper sở hữu (B1) |
| `apps/api/src/lms-auth/router.ts` | **A4** thêm cổng vòng đời cho đăng nhập | B1 viết lại login, **gỡ** `loginStudent` |
| `apps/api/src/lms-auth/login.test.ts` | **A4** test vòng đời trên login | B1 viết lại (file test OTP lớn nhất) |
| `apps/api/src/exercise/open-tier.ts` | **A4** luật `completed` xem/không nhận bài | B1.1 router `openForStudent` |
| `apps/api/src/enrollment/router.ts` | **A4** đổi chỗ ghi `blocked_lms` | B1 đổi thủ tục của phụ huynh |
| `packages/auth/src/index.ts` | **A2** khoá đóng/mở lớp | B1 vị trí của principal gia đình |
| `apps/api/src/provisioning/provision-from-receipt.ts` | **A4** hồ sơ HS, vòng đời lúc tạo | B1 cấm dùng chuỗi mặc định cho tài khoản gia đình |
| `scripts/acceptance-report/flow-manifest.ts` | flow lớp/buổi | flow đăng nhập |
| `apps/e2e/src/db.ts`, `apps/api/src/test/db.ts` | seed lớp/buổi | seed danh tính |

**Luật:**

1. **Làn A là chủ `schema.prisma` và chuỗi migration.** Làn B rebase lên A trước khi mở PR;
   không bao giờ ngược lại.
2. **Mốc rebase của Làn B: sau khi A4 vào `develop`.** Trước A4, B không có hàm cổng vòng đời để
   gọi và sẽ đụng cùng lúc 5 file trong bảng trên. B mở nhánh sớm được, nhưng **không mở PR**
   trước mốc này.
3. **`approved-children.ts` do Làn B sở hữu.** **A4** (không phải A2 — bản đầu ghi sai số phase)
   **không sửa file này**; A4 xuất luật hợp thành thành hàm thuần ở `@cmc/domain-lms`, B1 gọi vào.
4. **Hợp đồng hàm A4 → B1 phải chốt trước khi cả hai bắt đầu.** Hàm nhận vòng đời học sinh và
   trạng thái dải quyền học, trả về việc được xem lịch sử và được nhận bài mới. Chữ ký cụ thể
   chốt ở bước đầu A4 và ghi vào `phase-a4`.
5. Mỗi làn chỉ sửa **phần của mình** trong `flow-manifest.ts` và hai `db.ts`; xung đột giải bằng
   giữ cả hai, không ghi đè.
6. Làn B có **đúng một** migration (drop `LoginOtp`) và để **cuối cùng**.

Ba file dưới đây chỉ **một làn** đụng, ghi ra để khỏi tranh chấp nhầm:
`apps/api/src/lms-ops/on-roster.ts` (A4) · `apps/api/src/lms-ops/stamp-sessions.ts` (A3 rồi A5) ·
`apps/api/src/class/schedule-router.ts` (A1 rồi A3) · `scripts/acceptance-report/verify.ts` (B1).

---

## Các phase

| # | Phase | Làn | Outcome |
|---|---|---|---|
| A1 | [Nền lịch buổi an toàn](./phase-a1-nen-lich-buoi-an-toan.md) | A | Đổi khoá duy nhất của buổi; lưu trữ khung thay vì xóa; có đường sửa/gỡ khung; giáo viên theo buổi |
| A2 | [Trạng thái lớp + đóng/mở lại lớp](./phase-a2-trang-thai-lop.md) | A | Trạng thái lớp có kiểm soát + bảng ánh xạ; đóng và mở lại lớp được |
| A3 | [Lý do hủy + hồi sinh buổi](./phase-a3-ly-do-huy-va-hoi-sinh.md) | A | Hủy buổi phân loại được; buổi tự hồi đúng lý do; chính sách đóng băng khi hồi sinh |
| A4 | [Vòng đời học sinh + hồ sơ](./phase-a4-vong-doi-va-ho-so-hoc-sinh.md) | A | 6 giá trị vòng đời; `completed` không chặn; hồ sơ HS đủ bốn trường |
| A5 | [Bài học trong unit](./phase-a5-bai-hoc-trong-unit.md) | A | 240 bài học từ CSV, khoá ổn định xuyên hệ; buổi hiện đúng bài hôm nay |
| B1 | [Một tài khoản gia đình](./phase-b1-danh-tinh-gia-dinh.md) | B | SĐT + mật khẩu, phiên đa con, bỏ OTP và hai tầng đăng nhập |

```
Làn A:  A1 ──► A2 ──► A3 ──► A4 ──► A5     (một nhánh, tuần tự, năm PR)
Làn B:  B1                                  (nhánh riêng, rebase lên A)
```

**Vì sao A1 tách ra khỏi A3.** Bản đầu gộp cả hai và tưởng chỉ cần mở rộng `cancelSessionWithRestamp`.
Thực tế `cmc_edu` **không có API gỡ khung lịch**, và khoá duy nhất của buổi bám vào **id khung**
với FK `ON DELETE SET NULL` — xóa khung sẽ sinh buổi ma. Nền phải đúng trước, lý do hủy mới có
chỗ móc.

**Việc bỏ khỏi kế hoạch:** bảng nhận xét theo buổi mới. `cmc_edu` **đã có**
(`QualitativeAssessment` với `classSessionId`), và nó là **điều kiện đóng buổi**
(`class/session-done.ts:10-12`) — mạnh hơn nguồn. Bản đầu định thêm bảng thứ hai song song, kèm
một ràng buộc sẽ **lộ nhận xét của học sinh khác**. Đã bỏ; việc còn lại chỉ là ghép bốn ô của
nguồn thành một đoạn khi nhập, thuộc Đợt 5.

---

## Tiêu chí nghiệm thu

| Phase | Cổng cứng |
|---|---|
| A1 | Khoá duy nhất buổi theo `(lớp, ngày, giờ bắt đầu)`; gỡ khung **không** xóa hàng; sinh lại buổi **không** tạo bản đôi cho cùng ngày+giờ; buổi mang giáo viên riêng, mặc định theo lớp |
| A2 | Trạng thái lớp là tập đóng; bảng ánh xạ 5 giá trị nguồn → tập đích có văn bản; đóng và mở lại lớp có quyền riêng + audit |
| A3 | Gỡ khung ⇒ buổi tương lai hủy `slot_removed`; thêm lại khung ⇒ **cùng hàng** hồi sinh; `manual` ⇒ không hồi; mở lại lớp ⇒ chỉ buổi `class_closed` hồi; dấu unit sau hồi sinh khớp chính sách đóng băng đã viết |
| A4 | 6 giá trị; tập chặn = `{on_hold, withdrawn, transferred}`, **`completed` không chặn**; luật hợp thành hai cổng là một hàm thuần có test bốn tổ hợp; hồ sơ HS đủ bốn trường |
| A5 | 240 bài học, upsert theo khoá ổn định, chạy hai lần không nhân bản; số bài/unit đúng 1/2/4; unit không có bài vẫn mở buổi được |
| B1 | Không còn `kind` parent/student; nhà 2 con cùng mật khẩu đăng nhập **xác định**; không chạm được HS ngoài gia đình; journey viết lại xong |

Toàn kế hoạch:

- [ ] `typecheck-and-test` + `ui-e2e` xanh (cả hai là required check)
- [ ] `pnpm acceptance:report` không tụt so với mốc trước khi bắt đầu
- [ ] Không claim nào trong `flow-manifest.ts` trỏ tới thủ tục/route đã gỡ

---

## Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | **Xóa khung lịch sinh buổi ma** (CRITICAL, red-team C-1) | A1 đổi khoá duy nhất + cấm `DELETE` khung. Đây là phase đầu tiên vì mọi thứ khác đứng trên nó |
| R2 | Hồi sinh buổi làm lệch dấu unit cả dãy | A3 viết **chính sách đóng băng riêng**, không dùng lại đường hủy nguyên văn; đóng băng hiện theo `done`, không theo điểm danh |
| R3 | Hai nhánh xung đột `schema.prisma` và chuỗi migration | Giao thức trộn nhánh ở trên; A là chủ, B rebase |
| R4 | B1 làm tụt con số nghiệm thu | Lấy mốc bằng `pnpm acceptance:report` **trước** khi bắt đầu, so lại sau B1.5. Bản đầu ghi "3 flow" — validate bác, ít nhất 4 journey bị chạm. Mốc viết lại journey nằm **trong** B1 |
| R5 | Bỏ OTP là bỏ trần thử mật khẩu; `ParentAccount` không có cơ chế khoá | B1 bắt buộc có chính sách giới hạn thử |
| R6 | Đổi enum vòng đời không lùi được | Dùng `RENAME VALUE` + `ADD VALUE`; **cấm** thêm rồi gỡ trong một lần dựng lại kiểu |
| R7 | B1 đếm thiếu bề mặt | Tính theo **caller của thủ tục bị gỡ**, không theo bộ đếm `kind` |

> **Giả định phải kiểm lại nếu sai:** `cmc_edu` chưa có người dùng và dữ liệu thật. Red-team
> ghi nhận điều này **không kiểm được từ repo** — tài liệu nói chưa UAT, nhưng không đọc được
> DB triển khai từ đây. Nếu đã có bản đang dùng thì toàn bộ mức độ mạnh tay phải xem lại.

<!-- slug: nen-van-hanh-lop-va-danh-tinh-gia-dinh -->
