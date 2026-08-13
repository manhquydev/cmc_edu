# Validate nhất quán toàn kế hoạch — 2026-08-13 09:21

**Góc:** nhất quán `plan.md` ↔ 6 phase ↔ adjudication red-team.
**Không phải red-team:** không tìm cách đập; chỉ đo kế hoạch có thi hành được và có đủ không.
**Repo chính:** `/home/manhquy/Downloads/cmc_edu` (cwd tuyệt đối này).
**Nguồn đối chiếu:** `/home/manhquy/Downloads/cmc-lms` @ `031d193`.
**Phạm vi đọc:**
`plans/260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/plan.md`,
`phase-a1-nen-lich-buoi-an-toan.md`,
`phase-a2-trang-thai-lop.md`,
`phase-a3-ly-do-huy-va-hoi-sinh.md`,
`phase-a4-vong-doi-va-ho-so-hoc-sinh.md`,
`phase-a5-bai-hoc-trong-unit.md`,
`phase-b1-danh-tinh-gia-dinh.md`,
`reports/redteam-adjudication-260813-0849.md`,
cộng các file mã được trích bên dưới.
**Không sửa mã.**

Mỗi kết luận gắn `DUNG` / `SAI` / `KHONG KIEM DUOC` và `file:dong`.

---

## Kết luận ngắn

Kế hoạch **thi hành được** nếu người làm theo **nội dung 6 phase** (A1 lịch → A2 trạng thái lớp → A3 hủy/hồi → A4 vòng đời+hồ sơ → A5 bài học ‖ B1 gia đình).
Nó **chưa đủ an toàn để thi hành nguyên văn `plan.md`**, vì giao thức trộn nhánh còn gọi nhầm **A2** cho việc của **A4**, thiếu ít nhất **5 file** cả hai làn đều sửa, hai quyết định chủ hệ thống không có phase, và hai ranh giới B1 (hợp đồng `studentId`, làm chết phiên cũ) vẫn chưa chọn.

---

## 1. `plan.md` và 6 phase có mâu thuẫn nhau không

### 1.1 Outcome / cổng cứng — khớp

| Khẳng định | `plan.md` | Phase | Kết luận |
|---|---|---|---|
| A1 đổi khoá buổi, lưu trữ khung, giáo viên theo buổi | `plan.md:123`, `:152` | `phase-a1:67-84`, `:89-95` | **DUNG** |
| A2 tập đóng + bảng ánh xạ + đóng/mở lại lớp | `plan.md:124`, `:153` | `phase-a2:40-59`, `:79-95` | **DUNG** |
| A3 lý do hủy 4 giá trị, hồi cùng hàng, đóng băng riêng | `plan.md:125`, `:154` | `phase-a3:17-23`, `:60-78` | **DUNG** |
| A4 6 giá trị, `completed` không chặn, 4 trường hồ sơ | `plan.md:126`, `:155` | `phase-a4:10-44`, `:75-85` | **DUNG** |
| A5 240 bài, upsert khoá ổn định, unit không bài vẫn mở buổi | `plan.md:127`, `:156` | `phase-a5:66-76`, `:87-95` | **DUNG** |
| B1 SĐT+mật khẩu, phiên đa con, bỏ OTP | `plan.md:128`, `:157` | `phase-b1:112-133` | **DUNG** |
| A1 chưa hủy buổi khi gỡ khung; A3 mới móc | `plan.md:135-138` | `phase-a1:80-81`; `phase-a3:73` | **DUNG** |
| A2 chưa hủy buổi khi đóng lớp; A3 mới móc | (cổng A2 `:153` không đòi hủy buổi) | `phase-a2:85-86`, `:105` | **DUNG** |
| Bỏ bảng nhận xét mới; việc ghép 4 ô thuộc Đợt 5 | `plan.md:140-144` | không phase nào xây bảng mới | **DUNG** (với mục sau 1.3) |
| C0 chuyển Đợt 5, chạy trên dữ liệu nguồn | `plan.md:65` | `phase-b1:42-49` | **DUNG** |

### 1.2 SAI — `plan.md` gọi A2 cho việc của A4

**SAI.** Giao thức trộn nhánh và bảng file chung vẫn dùng số phase **cũ** (khi A2 = vòng đời học sinh). Sau khi viết lại, A2 là trạng thái **lớp**.

| Chỗ | Viết gì | Thực tế phase |
|---|---|---|
| `plan.md:101` | `approved-children.ts` — Làn A dùng để «tập chặn vòng đời **(A2)**» | A2 (`phase-a2:1-114`) **không** nhắc `approved-children`, vòng đời, hay `@cmc/domain-lms` |
| `plan.md:110-112` | «**A2 không sửa** file này — **A2 xuất** tập chặn vòng đời thành hàm thuần» | Việc xuất hàm + cấm sửa file nằm ở **A4**: `phase-a4:69-73`, `:99` |

A4 tự viện dẫn giao thức (`phase-a4:71`: «Theo giao thức trong `plan.md`: **A4 không sửa**…») — tức phase đúng đã tự sửa số, còn `plan.md` thì chưa. Người thi hành đọc `plan.md` trước sẽ chờ A2 ra hợp đồng hàm mà A2 không bao giờ làm.

Nguồn số cũ còn thấy trong adjudication: `redteam-adjudication-260813-0849.md:61` (H-5 «A2 ghi rõ dạng migration»), `:65` (H-8 «Quyết trong A2»), `:76` (M-2 «A2 sửa bảng»). Đó là số phase **trước khi tách**. Phase mới đã chuyển việc đó sang A4 (`phase-a4:21-27`, `:75-110`).

### 1.3 SAI — trong chính `plan.md`, «cần xây nhận xét theo buổi» chưa bị gạch

| Chỗ | Viết gì |
|---|---|
| `plan.md:47` (vòng 1) | Khái niệm **cần xây**: «Lý do hủy + hồi sinh buổi · **Nhận xét theo buổi** · Bài học trong unit» |
| `plan.md:57` (vòng 2) | Giữ một ô tự do; ghép 4 ô khi **nhập** |
| `plan.md:140-144` | **Bỏ** bảng nhận xét mới khỏi kế hoạch này; ghép 4 ô thuộc Đợt 5 |

Vòng 2 + đoạn bỏ việc **thắng** vòng 1, và 6 phase đi theo hướng bỏ. Nhưng bảng quyết định vòng 1 vẫn liệt «Nhận xét theo buổi» là việc **cần xây** trong kế hoạch này. **SAI** nội bộ `plan.md` — người đọc bảng quyết định sẽ tưởng A3 còn làm nhận xét.

### 1.4 SAI — hình dạng hàm mà A xuất cho B

| Chỗ | Hợp đồng |
|---|---|
| `plan.md:110-111` | Xuất **tập chặn vòng đời** (danh sách giá trị `notIn`) |
| `phase-a4:60-64`, `:96-98`, `:121` | Xuất **luật hợp thành hai cổng** (vòng đời **VÀ** dải quyền học), test **bốn tổ hợp** |

Hai thứ khác nhau. `getApprovedChildren` hôm nay chỉ lọc lifecycle, **không** lọc dải unit (`apps/api/src/guardian/approved-children.ts:20-23`, `:50`). Hàm hợp thành vòng đời × dải **đã có**: `apps/api/src/lms-ops/on-roster.ts:10-34` (`BLOCKED_TEACHING_LIFECYCLES` × `isEntitled`). A4 **không** nhắc `on-roster.ts`. Nếu A4 viết hàm thứ ba rồi B1 nhét vào `approved-children`, cổng đọc của phụ huynh sẽ lệch luật «`completed` + hết dải ⇒ vẫn xem lịch sử» (`phase-a4:64`).

### 1.5 SAI — B1.1 lặp câu đã bị chính B1 bác

`phase-b1:90-101` viết rõ «mọi procedure nhận `studentId` tường minh» **không đúng** với phiên học sinh (`apps/api/src/trpc.ts:298-308` lấy `studentId` từ token).
Ngay bước thi hành, `phase-b1:114-115` lại viết: «mọi procedure nhận `studentId` tường minh + kiểm sở hữu qua **một** helper».

`plan.md:157` (cổng B1) không chốt hợp đồng này. **SAI** nội bộ B1; `plan.md` không phân xử.

### 1.6 Lệch phạm vi, không đảo nghĩa

| Chỗ | Ghi nhận |
|---|---|
| Thời lượng buổi 90/110 | Có trong `phase-a5:44-62`, `:79`; **không** có trong outcome/cổng A5 của `plan.md:127`, `:156` | Phase là tập cha — **không mâu thuẫn**, nhưng `plan.md` thiếu việc A5 bắt buộc làm |
| `phase-a5:40-42` khoá ổn định | Đưa hai ứng viên (`lessonCode` **hoặc** bộ ba chương trình/unit/bài), chưa chọn | Xem mục 5, H-10 |

### 1.7 Phụ thuộc khai báo

| Phase | `dependencies:` | `plan.md:131` |
|---|---|---|
| A1 | `[]` (`phase-a1:5`) | gốc | **DUNG** |
| A2 | `[A1]` (`phase-a2:5`) | A1 → A2 | **DUNG** (khai báo) |
| A3 | `[A1, A2]` (`phase-a3:5`) | A2 → A3 | **DUNG** |
| A4 | `[A3]` (`phase-a4:5`) | A3 → A4 | **DUNG** (khai báo) |
| A5 | `[A4]` (`phase-a5:5`) | A4 → A5 | **DUNG** (khai báo) |
| B1 | `[]` (`phase-b1:5`) | nhánh riêng, rebase lên A (`plan.md:108-109`, `:132`) | **DUNG** hình, xem 2.3 và 3.4 |

---

## 2. Bảng phụ thuộc A1 → A2 → A3 → A4 → A5 có đúng không

Câu hỏi: phase sau có làm việc mà phase trước **đã cần rồi** không (thứ tự đảo).

### 2.1 A1 → A2 → A3 — thứ tự kỹ thuật đúng

**DUNG.** A3 tự nói vì sao cần cả hai (`phase-a3:10-11`): hồi khi thêm lại khung cần API gỡ/thêm khung của A1; hồi khi mở lại lớp cần đóng/mở của A2.

Đo được nền hiện tại khớp tiền đề tách phase:

| Tiền đề | Bằng chứng mã |
|---|---|
| Khoá buổi bám id khung | `packages/db/prisma/schema.prisma:765` `@@unique([classBatchId, scheduleSlotId, sessionDate])` |
| Nguồn không dính bẫy | `cmc-lms` `packages/db/prisma/schema.prisma:388` `@@unique([classBatchId, sessionDate, startTime])` |
| `schedule-router` chỉ có `generateSessions` | `apps/api/src/class/schedule-router.ts:31-93` |
| Sinh buổi dựa `skipDuplicates` + khoá cũ | `apps/api/src/class/generate-sessions.ts:5-8`; `schedule-router.ts:71-80` |
| `ClassBatch.status` là String tự do, chưa procedure dùng | `schema.prisma:662-665` |
| Hủy hiện tại không nhận lý do | `apps/api/src/lms-ops/cancel-session.ts:30-38` — opts không có reason |
| Đóng dấu đóng băng theo `done` | `apps/api/src/lms-ops/stamp-sessions.ts:60-64` |

A1/A2 cố ý **chưa** hủy buổi (`phase-a1:80-81`, `phase-a2:85-86`). Đó là tách PR, không phải A1/A2 đã cần việc của A3 để đạt cổng của chính chúng (`plan.md:152-153`).

A2 không cần khoá buổi mới hay cột giáo viên của A1 để đóng/mở lớp. Phụ thuộc A2→A1 là **cùng nhánh / cùng `schema.prisma`**, không phải gọi API A1. Không đảo thứ tự.

### 2.2 A3 → A4 → A5 — không đảo, nhưng hai mắt xích sau là phụ thuộc tổ chức

**DUNG** (không có việc phase sau mà phase trước đã cần).

| Mắt xích | Phase sau có cần việc phase trước không? |
|---|---|
| A4 sau A3 | A4 (enum vòng đời + 4 trường hồ sơ) **không** gọi hủy/hồi hay chính sách đóng băng. A3 **không** cần 6 giá trị vòng đời để hủy buổi. |
| A5 sau A4 | A5 (bài học + dấu bài) **không** đọc hồ sơ HS / vòng đời. Cột `do_tuoi` trong CSV (`phase-a5:17`) không được A5 dùng với `dateOfBirth` của A4. |
| A5 sau A3 (gián tiếp qua A4) | A5 bước 4 «đi theo đường đóng dấu unit» (`phase-a5:83`) đụng `stamp-sessions.ts` — đúng file A3 viết lại chính sách (`phase-a3:33-46`, `:78`). Thứ tự A3 trước A5 **đúng**; phụ thuộc khai báo qua A4 chỉ là đi cùng một nhánh. |

Không tìm thấy việc A4 làm mà A3 đã cần, hay A5 làm mà A4 đã cần.

### 2.3 SAI bàn giao — A4.4 nhắm thủ tục B1 sẽ gỡ

Không nằm trong chuỗi A1–A5, nhưng phá thứ tự **toàn kế hoạch** (A ‖ B).

| Việc | Phase |
|---|---|
| Thêm cổng vòng đời cho **đường đăng nhập** (`loginStudent` hiện không đọc lifecycle) | `phase-a4:46-53`, `:109`; mã `apps/api/src/lms-auth/router.ts:524-621` |
| Gỡ `loginStudent` | `phase-b1:65-66`, `:117` |

A4 gắn cổng vào một procedure B1 xóa. B1 **không** viết bước «login gia đình mới gọi hàm vòng đời của A4». Phát hiện M-2 (đường đăng nhập chưa có cổng) sẽ **mất** nếu B1 rebase/xóa `loginStudent` mà không gắn lại.

`phase-b1:5` `dependencies: []` + `plan.md:108` «B rebase lên A trước khi mở PR» không nói rebase lên **A4** (chỗ hàm vòng đời ra đời) hay lên A5. Xem 3.4.

### 2.4 Tạm thời sau khi merge từng PR A

`plan.md:131` = năm PR tuần tự. Nếu A1/A2 lên `develop` trước A3: gỡ khung / đóng lớp **không** hủy buổi tương lai. Cổng A1/A2 cho phép điều đó. Không phải thứ tự đảo; là lỗ vận hành giữa các PR — `plan.md` không nói năm PR có được merge lẻ lên `develop` hay giữ trên một nhánh đến hết A3.

**KHONG KIEM DUOC** ý định merge từng PR; **DUNG** rằng cổng từng phase không đòi việc của phase sau.

---

## 3. Giao thức trộn nhánh có đủ không

Nguồn bảng: `plan.md:98-104`. Luật: `plan.md:106-115`.
Adjudication gốc (H-4): `redteam-adjudication-260813-0849.md:60`.

### 3.1 Bảng `plan.md` — 6 dòng

| File trong `plan.md:99-104` | Làn A | Làn B | Có phải cả hai làn sửa? |
|---|---|---|---|
| `packages/db/prisma/schema.prisma` | enum lớp/buổi, vòng đời, bài, hồ sơ | `LoginOtp`, `ParentAccount`, `StudentAccount` | **DUNG** — A1–A5 và B1 đều đụng model/enum |
| `apps/api/src/guardian/approved-children.ts` | «tập chặn (A2)» | gộp helper sở hữu | **SAI số phase** (phải là A4, và luật `:110` lại **cấm** A sửa). Sau luật: chỉ B sửa. Bảng và luật **mâu thuẫn nhau** |
| `apps/api/src/trpc.ts` | «—» | guard, allowlist audit | Cột A = «không sửa» thì **không phải file cả hai làn**. Vẫn liệt vào bảng «cả hai làn đều sửa» (`plan.md:96`) — **SAI** cách xếp. Xem 3.3: A **rất có thể** vẫn sửa |
| `scripts/acceptance-report/flow-manifest.ts` | flow lớp/buổi | flow đăng nhập | **DUNG** hướng. A4 đổi `enrollment.blockLms` / `student.setLifecycle`; B1 đổi P1-07/P1-04 |
| `apps/e2e/src/db.ts` | seed lớp/buổi | seed danh tính | **DUNG** — `seedClassBatch` `:1093`; `loginOtp` `:103`, `:187-201` |
| `apps/api/src/test/db.ts` | seed lớp/buổi | seed danh tính | **DUNG** — `parentAccount`/`loginOtp` `:206-227`; session seed có `scheduleSlotId` `:670-690` |

### 3.2 File cả hai làn đều sửa — **thiếu trong bảng**

Đo từ việc từng phase bắt buộc đụng, không từ chữ `kind`.

| File | Làn A làm gì | Làn B làm gì | Bằng chứng |
|---|---|---|---|
| `apps/api/src/lms-auth/router.ts` | A4.4 thêm cổng vòng đời vào `loginStudent` | B1.2/B1.3 viết lại login, **gỡ** `loginStudent` | `phase-a4:109`; `phase-b1:65-66`, `:117`; mã `:524-621` |
| `apps/api/src/lms-auth/login.test.ts` | A4 fixture/test vòng đời trên login | B1 viết lại file OTP lớn nhất | `phase-a4:122`; `phase-b1:130`; test đã có `lifecycle: 'blocked_lms'` (`login.test.ts:236`) |
| `apps/api/src/exercise/open-tier.ts` | A4 đổi `lifecycle === 'blocked_lms'` + luật `completed` xem / không nhận bài | B1.1 router `openForStudent` / `listForStudent` dùng `requireLmsStudent` | `phase-a4:107`, `:118-119`; `phase-b1:56`; mã `:79`, `:164`, `:250-263` |
| `apps/api/src/enrollment/router.ts` | A4 đổi `blockLms` đang ghi `'blocked_lms'` | B1 đổi `mine` (`requireLmsParent`) | `phase-a4:107`; `phase-b1:55`; mã `:98`, `:129-130` |
| `packages/auth/src/index.ts` | A2 thêm khoá đóng/mở lớp vào `PERMISSIONS` | B1 ranh giới #3: `family` đứng đâu trong 9 vai | `phase-a2:75-76`, `:93`; `phase-b1:78`; registry `:10-20`, `:77-178` (`class.read` `:116` là đúng cửa A2 không được lấy) |
| `apps/api/src/provisioning/provision-from-receipt.ts` | A4 hồ sơ HS / mặc định vòng đời lúc tạo HS | B1 **cấm** gán chuỗi mặc định cho tài khoản gia đình; mật khẩu mặc định HS đang ở đây | `phase-a4:108`; `phase-b1:105-110`; `student.create` `:253-258`; `hashPassword('Cmc2026@')` `:302-312` |

Sáu file trên **không** có trong `plan.md:99-104`. Luật 3 (`plan.md:113-114`) chỉ nói `flow-manifest.ts` và hai `db.ts` — không phủ 6 file này.

### 3.3 `trpc.ts` — bảng nói A không đụng; A2/A1 gần như phải đụng

`apps/api/src/trpc.ts:99-139` `AUDIT_EXCLUDED_PATHS`: path tự ghi `AuditLog` phải vào set, nếu không middleware nhân đôi dòng.

A2 đòi «Mọi lần đóng/mở lại ghi `AuditLog`» và «đúng một bản ghi vết» (`phase-a2:84`, `:103`). A1 đòi đổi giáo viên có ghi vết (`phase-a1:73`). Nếu viết audit inline (cùng kiểu `classSession.cancel` đã nằm trong set, `trpc.ts:106`) thì A **phải** sửa `trpc.ts`. Cột «—» ở `plan.md:102` **thiếu**.

B1 sửa đúng chỗ đã nêu: `lmsAuth.*` `:109-122` (`phase-b1:70`, `:133`).

**KHONG KIEM DUOC** A có chọn inline audit hay middleware tự ghi (phase không chốt). **SAI** nếu đọc bảng như «A không bao giờ sửa `trpc.ts`».

### 3.4 Luật rebase / chủ file — đủ hướng, thiếu mốc

| Luật `plan.md:106-115` | Đánh giá |
|---|---|
| 1. A chủ `schema.prisma` + chuỗi migration; B rebase lên A, không ngược | **DUNG** hướng. **Thiếu:** rebase lên A **nào** (A1? A4 có hàm B cần? hết A5?). `phase-b1:5` `dependencies: []` không khóa mốc |
| 2. B sở hữu `approved-children.ts`; A không sửa; A xuất hàm thuần | Hướng đúng, **SAI số** A2→phải A4; **thiếu** chữ ký hàm (xem 1.4). «Hợp đồng chốt trước khi cả hai bắt đầu» (`plan.md:111-112`) — **chưa chốt** trong tài liệu |
| 3. Mỗi làn chỉ sửa phần mình trong `flow-manifest` + hai `db.ts` | **DUNG** cho 3 file đó. Không mở rộng sang file mục 3.2 |
| 4. B đúng một migration (drop `LoginOtp`), để cuối | **DUNG**, khớp `phase-b1:117-118` |

### 3.5 File chỉ một làn — không cần vào bảng, ghi để khỏi lẫn

| File | Chỉ |
|---|---|
| `apps/api/src/lms-ops/on-roster.ts` | A4 (đổi `BLOCKED_TEACHING_LIFECYCLES` `:11`) — phase không liệt |
| `apps/api/src/lms-ops/stamp-sessions.ts` | A3 rồi A5 (cùng làn) |
| `apps/api/src/class/schedule-router.ts` | A1 rồi A3 |
| `scripts/acceptance-report/verify.ts` | B1 (`phase-b1:70`, `:133`; whitelist `lmsAuth` `:41-43`) — A không bắt buộc |

---

## 4. Quyết định chủ hệ thống có vào đúng phase không

Nguồn: `plan.md:39-67`.

### 4.1 Vòng 1 (`plan.md:43-49`)

| Quyết định | Phase phản ánh | Kết luận |
|---|---|---|
| Bảng giá theo unit + gói bán dùng chung, không `facilityId` — **Đợt 4** | Không thuộc 6 phase | **DUNG** (đúng chỗ hoãn) |
| Cần xây: lý do hủy + hồi sinh | A3 | **DUNG** |
| Cần xây: nhận xét theo buổi | Không phase nào xây; `:140-144` bỏ | **SAI** bảng vòng 1 vs phần còn lại (1.3). Hướng thi hành đúng là **không** xây trong kế hoạch này |
| Cần xây: bài học trong unit | A5 | **DUNG** |
| Không xây huy hiệu, tiến độ cấp độ | Không phase nào xây | **DUNG** |
| Hash bcrypt ↔ PBKDF2 hoãn Đợt 5; Làn B dồn xác thực vào **một hàm** | `phase-b1:85-87`; hàm hiện có `apps/api/src/lms-auth/password-hash.ts:40-51` (`verifyPassword` **chỉ** nhận `pbkdf2`) | **DUNG** hướng. B1 chưa chỉ định file/hàm đích (giữ `verifyPassword` hay viết mới) |
| Thứ tự song song A ‖ B | `plan.md:131-132`; B1 `dependencies: []` | **DUNG** hình |

### 4.2 Vòng 2 (`plan.md:53-58`)

| Quyết định | Phase | Kết luận |
|---|---|---|
| Thêm cột giáo viên trên buổi, mặc định theo lớp (E-3) | `phase-a1:53-61`, `:83-84`; nguồn có cột `cmc-lms` `schema.prisma:373-374`; đích không có trên `ClassSession` (`schema.prisma:731-771`) | **DUNG** |
| Hồ sơ HS giữ cả bốn trường | `phase-a4:75-90`; `Student` đích `schema.prisma:423-431` chỉ tên/cơ sở/vòng đời/phiếu | **DUNG** |
| Ô nhận xét: giữ một ô; ghép 4 ô khi nhập | `plan.md:140-144`; `QualitativeAssessment` đã là điều kiện đóng buổi `apps/api/src/class/session-done.ts:10-12` | **DUNG** (Đợt 5, không phải A3) |
| Trạng thái lớp = tập đóng; chốt ánh xạ **trước** đóng/mở | `phase-a2:40-59`, `:81`; bước 2 trước bước 4 (`:91-94`) | **DUNG** |

### 4.3 Quyết định thi hành (`plan.md:62-67`)

| # | Quyết định | Phase | Kết luận |
|---|---|---|---|
| 1 | `blocked_lms` → `on_hold` bằng `RENAME VALUE` | `phase-a4:21-27`, `:95`, `:105` | **DUNG** (A4, không phải A2) |
| 2 | Cổng C0 → Đợt 5, chạy trên dữ liệu **nguồn** | `phase-b1:42-49` | **DUNG** |
| 3 | Gộp hằng số ngưỡng duyệt hai mắt về một nguồn (`finance/router.ts:40`, `worker/reconcile-finance-flags.ts:20`) | **Không phase nào** | **SAI** — quyết định có căn cứ, không hỏi lại, nhưng không có bước/cổng/file trong A1–A5 hay B1. Đo được lệch thật: `APPROVAL_SECOND_EYE_THRESHOLD = 20_000_000` (`apps/api/src/finance/router.ts:40`) và `THRESHOLD = 20_000_000` sao chép (`apps/api/src/worker/reconcile-finance-flags.ts:20-21`) |
| 4 | Bọc `PermissionGate` cho `/finance/new`, `/finance/refund` | **Không phase nào** | **SAI** — cùng kiểu. Đo được: `apps/admin/src/routes/finance.routes.tsx:28-33` (`path: 'new'`, không `PermissionGate`); `:61-66` (`path: 'refund'`, không cổng). `:id` và `class-placement` **đã** có cổng (`:45-56`, `:69-83`) |

#3 và #4 không thuộc «nền lớp/buổi» hay «danh tính gia đình». Nếu cố ý nằm ngoài kế hoạch này, `plan.md` phải ghi «không thuộc 6 phase / làm ở Đợt X». Hiện chúng đứng trong bảng «có căn cứ, không hỏi lại» của **chính** kế hoạch — thi hành nguyên văn thì việc **rơi**.

---

## 5. Phát hiện adjudication đã vào phase chưa

Nguồn: `reports/redteam-adjudication-260813-0849.md`.
Cột «phase adjudication» = số phase **cũ** trong cột «Đổi gì». Cột «phase mới» = file phase sau khi viết lại.

| # | Phát hiện (tóm) | Adjudication giao | Phase mới xử lý | Kết luận |
|---|---|---|---|---|
| **C-1** | Xóa khung sinh buổi ma (khoá bám id khung + `ON DELETE SET NULL`) | Đổi khoá; lưu trữ không `DELETE`; hồi = `UPDATE` cùng hàng; sinh buổi tra ngày+giờ | **A1** `phase-a1:13-25`, `:67-84` (khoá, lưu trữ, tra trước khi tạo). Hồi cùng hàng = **A3** `phase-a3:60-62`, `:74-75` | **DUNG** — tách đúng: nền A1, hồi A3 |
| **H-1** | Không có API gỡ khung, không có đóng lớp | A1 thêm gỡ/sửa khung **và** đóng lớp trước khi móc lý do hủy | Gỡ/sửa khung = **A1** `phase-a1:80-81`. Đóng lớp = **A2** `phase-a2:85-94`. Móc lý do = **A3** | **DUNG** — tách A1/A2, cả hai trước A3 |
| **H-2** | `QualitativeAssessment` đã là nhận xét theo buổi + điều kiện đóng buổi | Viết lại A3.2; khác biệt là 1 ô vs 4 ô | `plan.md:140-144` bỏ bảng mới. Mã `session-done.ts:10-12` | **DUNG** — xử lý bằng cách **bỏ việc**, không viết lại A3.2 |
| **H-3** | Không được đi theo quy tắc công khai của nhật ký (lộ nhận xét cả lớp) | A3 không đi theo nhật ký | Không còn việc nhận xét trong 6 phase | **DUNG** — hết việc thì hết bề mặt lộ. Không cần bước riêng |
| **H-4** | Hai làn đụng `schema.prisma`, `approved-children.ts`, `trpc.ts`, `flow-manifest.ts`, hai `db.ts` | Giao thức chủ file + rebase một chiều | `plan.md:94-115` | **DUNG một phần** — có giao thức, nhưng số phase sai (1.2) và **thiếu file** (3.2). Không bị quên; **chưa đủ** |
| **H-5** | Đổi enum không lùi được nếu thêm-rồi-gỡ | «A2 ghi rõ dạng migration» (`RENAME` + `ADD`) | **A4** `phase-a4:21-27`, `:95` | **DUNG** nội dung; số phase adjudication cũ. `plan.md:64` + R6 `:176` khớp |
| **H-6** | Đóng dấu khi hồi là phép ngược; đóng băng theo `done`, bỏ `capped`, không đảo bài/điểm | «A1 viết chính sách đóng băng riêng» | **A3** `phase-a3:28-56`, `:78`, `:88-89`. `plan.md` R2 `:171` | **DUNG** nội dung, chuyển đúng sang A3 (A1 mới không hồi sinh). Chính sách còn «đề xuất, chốt khi thi hành» (`phase-a3:48`) — có chỗ đứng, chưa khóa số |
| **H-7** | `ClassSession` không có `teacherId` | Quyết trong A1 | **A1** `phase-a1:53-61`, `:83-84` | **DUNG** |
| **H-8** | `Student` thiếu `studentCode`, `dateOfBirth`, `gender`, `note` | Quyết trong A2 | **A4** phần 2 `phase-a4:75-110` | **DUNG** nội dung, số phase cũ |
| **H-9** | Không có hợp đồng ánh xạ trạng thái lớp (E-2) | A1 phải có bảng ánh xạ trước khi viết mở lại lớp | **A2** `phase-a2:40-59`, `:81`, `:91-94` (bảng trong phase, trước bước đóng/mở) | **DUNG** — chuyển sang A2; ánh xạ và đóng/mở **cùng phase**, bảng viết trước bước mã |
| **H-10** | A3 chưa công bố khoá ổn định xuyên hệ cho bài học | Upsert theo `lessonCode` (hoặc tương đương đã **công bố**) | **A5** `phase-a5:34-42`, `:72`, `:80-81` | **SAI / chưa xong** — A5 **thừa nhận** phải ghi khoá vào phase (`:42`) rồi để bước 2 «Chọn và ghi ra» lúc thi hành. Hai ứng viên, **chưa chọn**. Đợt 5 vẫn không có khoá để bám |
| **H-11** | B1.5 đếm thiếu test (3 e2e + `login.test.ts`) | Đếm theo caller của thủ tục bị gỡ | **B1** `phase-b1:122-130` liệt đúng 4 chỗ | **DUNG** |
| **M-1** | Đếm 8 router sót `guardian/router.ts:71`, `exercise/open-tier.ts:250-263`, `exercise/upload-route.ts:77-83` | B1.1 thêm vào danh sách | **B1** `phase-b1:55-56` | **DUNG** |
| **M-2** | Tập chặn hiện tại `{blocked_lms, withdrawn}`; `loginStudent` không đọc vòng đời | «A2 sửa bảng; nêu riêng đường đăng nhập» | **A4** `phase-a4:31-40`, `:46-53`, `:109`, `:122`. Đo được `approved-children.ts:50`; `loginStudent` `:524-621` không đọc `lifecycle` | **DUNG** nội dung. **Lỗ bàn giao** với B1 (2.3) — cổng gắn vào procedure sẽ bị gỡ |
| **M-3** | «Mọi procedure nhận `studentId` tường minh» sai với phiên học sinh | Chọn **một** hợp đồng và viết ra | **B1** mô tả hai hợp đồng (`phase-b1:88-101`) rồi **không chọn**. B1.1 (`:114-115`) lặp phương án đã bác | **SAI** — chưa đưa vào bước thi hành được. **Bị bỏ quên ở mức chốt** |
| **M-4** | Importer giữ `chu_de`; mất **3** cột; `ghi_chu` trống 210/240 | Sửa số trong A3; `note` nullable | **A5** `phase-a5:24-28`, `:74` | **DUNG** nội dung, số phase cũ A3→A5 |
| **M-5** | Bỏ OTP = bỏ trần thử; `ParentAccount` không khoá | B1 bắt buộc chính sách giới hạn thử | **B1** ranh giới #6 `:81`, cấm + rủi ro `:149-150`. `ParentAccount` (`schema.prisma:452-469`) không có `loginAttempts`/`loginLockedUntil` (các cột đó ở `StudentAccount` `:487-490`) | **DUNG một phần** — bắt buộc có chính sách, **chưa viết** chính sách (ngưỡng, khoá ở đâu, có bump `tokenVersion` không) |
| **M-6** | «Làm chết phiên cũ» liệt lựa chọn không tồn tại (không cookie; `tokenVersion` không tăng khi đổi mật khẩu) | B1 chốt **đúng một** cơ chế có thật | **B1** ranh giới #2 `:77` liệt đúng hai đường (`tăng tokenVersion bằng tay` **hoặc** từ chối claim lạ). **Chưa chọn**. Đo được: `tokenVersion` chỉ tăng ở `parentAccount.setActive` (`apps/api/src/parentAccount/router.ts:220-238`), không thấy tăng trong `lms-auth` khi đổi mật khẩu | **SAI** — chưa chốt. Cùng kiểu M-3: có phân tích, không có quyết định |
| **B1** (bác) | `sourceReceiptId` / `createdByReceiptId` chặn nhập 11 HS | Không phải chặn lược đồ; hỏi Đợt 5 | Không nhét vào 6 phase như chặn schema. A4 không đòi NOT NULL hai FK | **DUNG** — không phải việc của kế hoạch này |
| **B2** (bác) | Backfill mật khẩu gia đình bằng literal mặc định | Giữ thành **cấm** trong B1 | `phase-b1:103-110` cấm `provision-from-receipt.ts:302-312` | **DUNG** |
| Hạ mức `parseLmsToken` | localStorage `parentAccountId` rỗng | Giữ trong B1 | `phase-b1:152` | **DUNG** |

### Phát hiện bị bỏ quên hoặc chưa đóng

Không có C/H/M nào **biến mất** khỏi tài liệu phase. Ba chỗ **chưa thi hành được**:

1. **H-10** — khoá bài học chưa công bố (`phase-a5:40-42`).
2. **M-3** — hai hợp đồng `studentId`; B1.1 vẫn viết phương án đã bác.
3. **M-6** — cơ chế giết phiên cũ chưa chọn.

Cộng lỗ bàn giao **M-2 × B1.3** (cổng login gắn vào `loginStudent` rồi gỡ).

---

## 6. Tổng hợp thi hành được / đủ

| Câu hỏi | Trả lời |
|---|---|
| Thi hành được nếu làm theo 6 phase (bỏ qua nhãn A2 trong giao thức)? | **Có** — chuỗi A1→A3 có xương sống mã; A4/A5/B1 có bước và cổng đo được |
| Thi hành được nếu làm **nguyên văn `plan.md`** (A2 xuất hàm, A không đụng `trpc.ts`, bảng 6 file là đủ)? | **Không** — A2 không xuất hàm; thiếu ≥6 file chung; #3/#4 không có chủ |
| Đủ để hai làn mở nhánh song song hôm nay? | **Không** — hợp đồng hàm A↔B chưa chốt (1.4); M-3/M-6/H-10 còn mở; mốc rebase B chưa ghi |

Việc nên sửa trên giấy (không làm trong vòng validate này):

1. `plan.md:101`, `:110-112`: A2 → **A4**; tách «tập chặn vòng đời» khỏi «luật hợp thành dải unit»; chỉ định sửa `on-roster.ts` + `getApprovedChildren`, không viết hàm thứ ba mơ hồ.
2. Bảng trộn nhánh: thêm 6 file mục 3.2; sửa cột `trpc.ts`; nói A2/A1 có được sửa allowlist không.
3. Ghi mốc «B rebase lên **sau A4**» (tối thiểu — lúc hàm vòng đời tồn tại) và «B1 login mới gọi hàm đó» (thay A4.4 vá `loginStudent`).
4. Gắn #3/#4 vào một phase (hoặc một dòng «không thuộc kế hoạch này»).
5. Chốt H-10 / M-3 / M-6 thành một dòng mỗi cái, rồi sửa B1.1 cho khớp.

---

Status: DONE_WITH_CONCERNS
Summary: Chuỗi A1→A3 khớp mã và không đảo thứ tự; A4/A5 chỉ phụ thuộc tổ chức. Kế hoạch chưa thi hành nguyên văn vì `plan.md` vẫn giao việc vòng đời cho A2, bảng trộn nhánh thiếu ít nhất 6 file cả hai làn cùng sửa, quyết định tài chính #3/#4 không có phase, và H-10/M-3/M-6 chưa chốt.
