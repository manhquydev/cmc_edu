# Review — Thực trạng hợp nhất LMS (`cmc-lms` → `cmc_edu`)

**Ngày đo:** 2026-08-12 · **Repo:** `cmc_edu` branch `develop` HEAD `c15bb3d` · đối chiếu `/home/manhquy/Downloads/cmc-lms`
**Phương pháp:** 5 agent đọc code song song (2 grok trên `cmc-lms`, 2 grok + 1 pi trên `cmc_edu`). Chỉ tin code/schema/test, không tin status trong tài liệu.
**Tính chất:** read-only. Không sửa code, không chạy migration, không commit.

---

## Kết luận một câu

Việc hợp nhất mới xong **xương sống dữ liệu quyền học** (unit-range + cầu tiền→unit + dual-gate điểm danh); phần **danh tính/trải nghiệm** (gộp PH+HS) **chưa làm**, phần **di trú dữ liệu + đóng LMS cũ** **chưa bắt đầu**. `cmc_edu` hiện mang **song song hai mô hình nghiệp vụ**, và các công tắc để chuyển sang mô hình mới **đã dựng nhưng chưa bật**.

---

## 1. Khai vs Thật

| Plan | Tự khai | Đo được | Chênh |
|------|---------|---------|-------|
| 1 — foundation unit-range | `completed` | **Đúng phần lớn** | Schema `EnrollmentUnitRange` + `orderGlobal` unique + neo lớp + `domain-lms` (3 module, 3 test) + dual-gate `rosterForSession` đều có thật |
| 2 — teaching spine API/UI/family | `completed` | **PARTIAL** | `phase-07` success criteria còn `[ ]` ngay trong file của nó; UI grant/archive/sequence **không tồn tại**; **PH/HS không hề gộp** |
| 3 — money bridge + cutover | `in_progress` | **Đúng** | Grant surface xong + có test; import **0 script**; 5/5 bước cutover còn `[ ]` |

**Vấn đề quy trình:** plan 2 đánh `status: completed` trong khi phase cuối tự nó chưa đạt. Phiên làm việc sau đọc metadata này sẽ bị dẫn sai. Nên sửa lại thành `in_progress`.

---

## 2. Ba khoảng trống lớn

### 2.1 Danh tính — chưa gộp PH/HS (khoảng trống lớn nhất)

| Trục | `cmc-lms` (nghiệp vụ đúng) | `cmc_edu` (hiện tại) |
|------|---------------------------|----------------------|
| Principal | **3**: `family`, `teacher`, `admin` | `parent` / `student` tách đôi — `lms-auth/session-token.ts:19-22,106` |
| Đăng nhập gia đình | **SĐT + mật khẩu**, 1 bước — `sessions.ts:128-148` | PH: **OTP** (SMS/email); HS: mật khẩu riêng — `lms-auth/router.ts:200,341,524` |
| Bảng tài khoản | `ParentAccount` (login) + `StudentAccount` (không còn đường login) | `ParentAccount` **và** `StudentAccount` **đều** là đường login |
| Nhiều con | `Guardian` + picker "Ai đang học hôm nay?" — `profile-picker.tsx` | Route `/parent/*` vs `/student/*` tách, `kind-guard.tsx:15-24` |
| OTP | **Đã drop bảng** — migration `20260807140000_drop_login_otp` | `LoginOtp` còn sống |

**Điểm mấu chốt:** `phase-04` của plan 2 tên là "Family principal ownership sinks" và đánh `done`, nhưng **Notes của chính nó ghi**: *"Parent login remains OTP-primary; student password path exists."* Phase này chỉ làm phần **ownership plumbing** (`isActive`, `tokenVersion`, bắt buộc `studentId` + kiểm Guardian) — **không** làm việc gộp tài khoản.

**Và quan trọng hơn:** việc gộp PH/HS **không nằm trong 5 quyết định owner** (`decisions-owner-260811-cau-1-5.md` chỉ chốt: unit-granting, nguồn dữ liệu B, build-then-cutover, break-glass, hoàn tiền). Deep-scout 2026-08-11 **có** nêu "Family auth cutover" là hạng mục HIGH, nhưng nó **chưa bao giờ được nâng thành quyết định sản phẩm**. Đây là **thiếu thẩm quyền**, không phải thiếu code — và theo luật repo, phải chốt authority trước khi sửa.

### 2.2 Công tắc đã dựng nhưng chưa bật

| Biến | Default | Hệ quả thực tế |
|------|---------|----------------|
| `LMS_OPEN_TIER_ENABLED` | **ON** (`open-tier.ts:79-81`) | Bài tập vẫn mở theo ADR 0038 Tier A/B (nghiệp vụ **cũ**) |
| `LMS_ENTITLEMENT_GATE` | **OFF** (`open-tier.ts:85-87`) | Bài tập **không** giao với dải unit đã mua |

⇒ Ở cấu hình mặc định, **quyết định số 1 của owner ("cấp quyền theo unit") chưa có hiệu lực trên đường bài tập.** Chỉ **điểm danh** (`rosterForSession`) mới thực sự dual-gate.

Đây là trạng thái **cố ý và đã ghi ADR** (`docs/decisions/0045-...md:15` ghi rõ flag hiện default off, bật khi product OK) — nên là **việc chưa bật**, không phải lỗi ẩn. Nhưng nó có nghĩa: toàn bộ cầu tiền→unit đang ghi dữ liệu mà **chưa ai tiêu thụ** trên đường học bài.

### 2.3 Chưa có đường di trú

| Hạng mục | Trạng thái |
|----------|-----------|
| Script import từ LMS live | **Không tồn tại** (`scripts/lms-v2/` không có; `find scripts -name "*lms*"` rỗng) |
| Dry-run import | Chưa chạy, không hiện vật |
| Bảng gói bán → unit của owner | **Trống** — chỉ có `Receipt.unitCount` + env default **4** |
| 5 bước cutover (freeze → chuyển SoT → đóng LMS cũ) | **0/5** |
| Staging teaching-day smoke | Chưa |

---

## 3. Ma trận delta nghiệp vụ (ngoài 3 khoảng trống trên)

| Năng lực | `cmc-lms` | `cmc_edu` | Nhận định |
|----------|-----------|-----------|-----------|
| Dải unit `orderGlobal` + entitlement | có | có | **đã port** |
| Roster theo unit của buổi | có | có (`rosterForSession`) | **đã port** |
| Hủy buổi + restamp lùi unit | có | có (`cancelSessionAndRestamp`) | **đã port** |
| Phát bài tự động khi hết giờ buổi | cron `*/5` | worker `deliverDueExercises` | **đã port** |
| **Học bù** | **đã bỏ hẳn** (không model/API) | **còn `classSession.addMakeup`** (`class-session-router.ts:361`) | **lệch ngược** — edu giữ thứ LMS mới đã loại |
| **Thư viện bài PDF** (`ExerciseFolder`/`ExerciseFile`) | có | **không có** (phase-06 ghi deferred) | **thiếu** |
| **Bảo lưu HS** (`on_hold`) | lifecycle **6** giá trị | lifecycle **3** (`active`/`blocked_lms`/`withdrawn`) | **thiếu nghiệp vụ bảo lưu** |
| Cảnh báo sắp hết unit (`expiring`) | có | **không** (deferred) | **thiếu** |
| Đặt lại neo unit / `realignHistory` | có | **không có procedure** | **thiếu** |
| UI cấp/thu unit, archive, xếp dãy bài | admin có | **không có màn nào** | **thiếu** (API có, UI không) |
| Sinh buổi cuốn chiếu hằng tháng | cron `5 0 1 * *` | `schedule.generateSessions` | cần xác minh lịch nền |
| Cơ sở (facility) + RLS | **không có** | **có** | edu **thêm đúng** (ERP đa cơ sở) |
| Tiền / hoàn tiền / CRM / HR | **không có** (xử ngoài hệ) | có | edu **thêm đúng** |

**Đọc bảng này:** phần đã port là *lõi tính toán quyền học*. Phần thiếu tập trung ở *công cụ vận hành hằng ngày* (thư viện bài, cấp/thu unit trên UI, bảo lưu, cảnh báo hết unit) — tức là đúng những thứ nhân viên phải bấm mỗi ngày.

---

## 4. Rủi ro

| # | Rủi ro | Mức |
|---|--------|-----|
| R1 | **Mục tiêu di động**: `cmc-lms` đang live và vẫn tiến hóa; mỗi tuần port thêm thì bản gốc cũng đổi | **Cao** |
| R2 | **Hai mô hình song song trong 1 repo**: 2 đường auth + 2 đường mở bài tập; chi phí gánh mỗi ngày mà chưa ai dùng | **Cao** |
| R3 | Thiếu quyết định owner về danh tính ⇒ không được sửa (luật authority của repo) | **Cao** — chặn |
| R4 | `unitCount` mặc định 4 cho **mọi** phiếu thu chưa khai; bảng gói thật chưa có ⇒ import/vận hành sẽ cấp sai số unit | **Trung bình–Cao** |
| R5 | Metadata plan sai (`completed` khi chưa xong) dẫn sai phiên sau | **Trung bình** |
| R6 | `addMakeup` còn sống trái nghiệp vụ mới | **Trung bình** |

**Đã kiểm và KHÔNG còn là rủi ro:** lỗi Critical C1 trong review 2026-08-11 (worker cấp lại unit sau khi ops đã thu hồi = học miễn phí) **đã được sửa thật** — reconciler nay chặn bằng audit `enrollment.grantUnitsFromReceipt` (`reconcile-orphaned-receipts.ts:163-167`), và có test `reconcile-orphaned-receipts.test.ts:405`.

---

## 5. Điều cần owner quyết trước khi viết thêm code

1. **Mô hình danh tính** — gộp PH+HS thành một tài khoản gia đình (SĐT+mật khẩu) như LMS mới, hay giữ hai tầng? *Chưa có quyết định nào.* Đây là gốc của phần lớn công việc còn lại.
2. **Bảng gói bán → số unit** (3–5 gói thật) — thiếu cái này thì cầu tiền→unit không thể rời khỏi mặc định 4.
3. **Chiến lược tổng thể** — tiếp tục port, hay đảo chiều lấy `cmc-lms` làm lõi LMS và ghép ERP vào (xem phần khuyến nghị trong phiên làm việc).

---

## Nguồn bằng chứng

| Báo cáo | Phạm vi |
|---------|---------|
| A | Nghiệp vụ dạy-học thật của `cmc-lms` (schema, unit, vòng lặp ngày, cron) |
| B | Kiểm kê LMS hiện có trong `cmc_edu` |
| C2 | Kiểm chứng từng claim của plan 2 |
| D | Cầu tiền→unit + trạng thái cutover |
| E | Mô hình người dùng + UI của `cmc-lms` |

Bản đầy đủ nằm trong scratchpad phiên `ec961fba`; các trích dẫn `file:dòng` trong tài liệu này đã lấy nguyên từ đó.

## Câu hỏi chưa giải quyết

1. Lịch cron sinh buổi hằng tháng ở `cmc_edu` có tương đương `cmc-lms` không (chưa truy vết process nền).
2. `cmc-lms` còn thay đổi tiếp không — nếu có, port sẽ là mục tiêu di động (R1).
3. Số liệu dữ liệu live thật (bao nhiêu HS/lớp/buổi cần import) — chưa truy vấn DB.
