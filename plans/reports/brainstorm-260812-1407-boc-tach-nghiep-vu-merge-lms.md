# Brainstorm — Bóc tách nghiệp vụ `cmc-lms` để merge an toàn vào ERP `cmc_edu`

**Ngày:** 2026-08-12 · **Đầu vào:** 6 báo cáo bóc tách song song (BR1–BR6) + review thực trạng cùng ngày
**Người tổng hợp:** Claude (điều phối grok ×3, pi, codex)
**Tính chất:** phân tích + thiết kế. Chưa sửa code.

---

## 0. Tiền đề của chủ hệ thống (dùng làm luật phân loại)

> `cmc-lms` được xây **tập trung vào nghiệp vụ dạy-học**. Chỗ nào nó chạm ERP (tiền, nhân sự, đa cơ sở)
> thì **chỉ xây cơ bản đủ vận hành** — **không phải chuẩn để port**.

Đây không phải chi tiết nhỏ, nó quyết định **cách** port. Cụ thể `cmc-lms`:

| Thiếu ở `cmc-lms` | `cmc_edu` có |
|-------------------|--------------|
| Không `facilityId`, **không RLS** — cách ly chỉ ở tầng tRPC | Facility + FORCE RLS 2 lớp (ADR 0042), boot-check chặn khởi động nếu thiếu |
| Không registry quyền — guard = 4 middleware | `PERMISSIONS` registry + `requirePermission`, SoD (sale không được cấp quyền học) |
| Không audit log hệ thống | Middleware tự ghi mọi mutation, sanitize credential |
| **Không có tiền** — hoàn phí "xử ngoài hệ" | ADR 0041: tiền và provisioning tách transaction |

⇒ **Kết luận thiết kế: không được bê code service của `cmc-lms` sang. Chỉ bê LUẬT.**
Mọi service `cmc-lms` đều thiếu 3 lớp bảo vệ mà `cmc_edu` bắt buộc; copy sang là mở lỗ hổng cách ly cơ sở, mất kiểm soát quyền, mất vết audit.

---

## 1. Kiến trúc chuyển giao — 3 tầng

| Tầng | Nội dung | Cách làm | Vì sao |
|------|----------|----------|--------|
| **1. Luật thuần** `@cmc/domain-lms` | Công thức tiến trình unit, `isEntitled`, `remainingUnits`, phủ ngày archive, xếp dãy bài | **Port nguyên**, kèm test thuần | Không mang giả định hạ tầng ⇒ an toàn tuyệt đối. Đã có 3 module, cần mở rộng |
| **2. Dịch vụ** `apps/api` | Ghi danh, điểm danh, phát bài, chấm, nhật ký | **Viết lại** theo khuôn `cmc_edu`: `withFacility` + `requirePermission` + audit | Code gốc thiếu facility/RLS/RBAC/audit |
| **3. Seam ERP** | Tiền → quyền học | **Giữ nguyên hợp đồng hiện có** | Đã đúng và đã có test — xem §3 |

**Quy tắc vàng:** cái gì tính được bằng hàm thuần thì đẩy xuống tầng 1 rồi port; cái gì chạm DB thì viết lại ở tầng 2.

---

## 2. Cạm bẫy lớn nhất: **port LUẬT, không port TRIGGER**

Trong `cmc-lms`, đường **chính** để học sinh có quyền học là admin tự bấm `enrollment.addWithUnits`.
Trong `cmc_edu`, đường chính **bắt buộc** là: phiếu thu duyệt → `provisionFromReceipt` → `grantUnitsFromReceipt`.

Nếu port nguyên `cmc-lms`, đường phụ thủ công vô tình trở thành đường chính ⇒ **thủng cổng tiền**: cấp quyền học mà không qua phiếu thu. Repo đã chống sẵn (`enrollment.grantUnits` **loại trừ sale**, chỉ GĐĐT).

| Bóc tách | Port? |
|----------|-------|
| **Luật**: dải unit phải nằm trong khóa, cấm chồng lấn, cấm bắt đầu trong quá khứ, cắt từ unit kế tiếp | **Có** |
| **Trigger**: ai được bấm, bấm lúc nào | **Không** — `cmc_edu` dùng trigger tiền |

Áp dụng tương tự cho: hoàn phí (cmc-lms "xử ngoài hệ" = `TẠM`, `cmc_edu` có nghiệp vụ hoàn tiền thật), tạo học sinh (cmc-lms admin tạo tay; `cmc_edu` ADR 0041 cấm học sinh mồ côi ngoài mạch tiền).

---

## 3. Seam tiền ↔ quyền học — đã đúng, đừng đụng

Hợp đồng hiện tại (đã có test, đã sửa lỗi Critical hôm 11/08):

1. **Một người ghi duy nhất**: `grant-units.ts` là writer duy nhất của `EnrollmentUnitRange`.
2. **Tiền ngoài transaction cấp quyền** (ADR 0041): duyệt phiếu xong mới cấp; cấp lỗi ⇒ `retry_pending`, **không** rollback tiền.
3. **Idempotent**: `sourceReceiptId` unique + bắt `P2002`.
4. **Quyền học gắn tiền còn hiệu lực**: grant đọc lại phiếu `FOR UPDATE`, `netAmount − Σhoàn > 0`; hoàn đủ/hủy ⇒ xóa dải.
5. **Sửa lỗi đã xong**: worker không cấp lại sau khi ops đã thu hồi (chặn bằng audit `enrollment.grantUnitsFromReceipt`).

**Khuyến nghị: đóng băng hợp đồng này thành ADR, mọi nghiệp vụ dạy-học port sau phải nối vào đây, không mở writer thứ hai.**

Còn thiếu ở seam: **bảng gói bán → số unit**. Hiện chỉ có `Receipt.unitCount` + mặc định env **4**. Đây là khoảng trống nghiệp vụ đã nêu từ 11/08 và **vẫn trống**.

---

## 4. Phát hiện quan trọng nhất: bốn thứ tưởng rời, thực ra là **một chuỗi domino**

Bốn xung đột dưới đây **không thể làm rời từng cái** — chúng khóa lẫn nhau:

```
Bỏ buổi bù  ──→  Tier B chết  ──→  open-tier mất lý do tồn tại  ──→  phải rekey Submission
(makeup)         (mở bài theo        (chuyển hẳn sang               (exerciseId
                  buổi bù)            delivery 1 bài/buổi)            → sessionExerciseId)
```

| Mắt xích | Vì sao khóa nhau | Quy mô (file / test) |
|----------|------------------|----------------------|
| Buổi bù `addMakeup` | `cmc-lms` **đã bỏ hẳn**; Tier B của open-tier **chạy bằng** buổi bù | 20 / 9 |
| Open-tier Tier A/B (ADR 0038) | Mất Tier B thì chỉ còn Tier A — thua hẳn mô hình delivery | 13 / 5 |
| Delivery `SessionExercise` | Là chuẩn mới, **đã port** nhưng **không phải mặc định** | 10 / 1 |
| Khóa `Submission` | `cmc_edu`: `unique(exerciseId, studentId)` — mỗi bài **chỉ nộp được một lần vĩnh viễn**. `cmc-lms`: `unique(sessionExerciseId, studentId)` — **mỗi lần phát một lần nộp** | schema + ≥4 |

**Hệ quả nghiệp vụ của khóa Submission** (dễ bỏ sót): với mô hình `cmc_edu` hiện tại, nếu một unit được **học lại** (lớp ôn, học sinh học lại khóa), học sinh **không thể nộp lại** bài đó — bản ghi cũ chặn. `cmc-lms` không có vấn đề này. Đây là lỗi nghiệp vụ tiềm ẩn, không chỉ là khác biệt kỹ thuật.

⇒ **Khuyến nghị: gộp 4 mắt xích thành MỘT đợt thi công.** Làm rời sẽ để hệ ở trạng thái nửa vời (đã xảy ra rồi: sweep tự động tạo buổi bù đã cắt, nhưng API và UI buổi bù vẫn còn).

---

## 5. Rủi ro đã xác minh: buổi bù làm lệch cách đếm unit

Không phải suy đoán — đã đọc code:

- `addMakeup` tạo `ClassSession` với `isMakeup=true`, **không gán unit**, **không restamp** (`class-session-router.ts:361-411`).
- `restampBatchSessions` lấy **mọi buổi chưa hủy** từ mốc neo, sắp thứ tự, gán `unit = neo + floor(vị trí / 4)` — **không loại trừ `isMakeup`** (`stamp-sessions.ts:39-55`).

Hai hệ quả, cả hai đều hỏng:

| Thời điểm | Hậu quả |
|-----------|---------|
| **Ngay khi tạo** | Buổi bù có `curriculumUnitId = null` ⇒ dual-gate fail-closed ⇒ **roster rỗng**, không ai điểm danh được, không phát bài. Buổi bù chết lâm sàng |
| **Khi restamp chạy sau** (hủy bất kỳ buổi nào trong lớp) | Buổi bù **chiếm một vị trí** ⇒ đẩy toàn bộ buổi sau lệch một nấc ⇒ một unit 4 buổi âm thầm thành 5 buổi thực ⇒ **dải unit đã bán phủ ít bài học hơn số đã bán** |

Đây chính là lý do `cmc-lms` bỏ buổi bù. **Đây là lập luận mạnh nhất để gỡ `addMakeup`**, và nên gỡ sớm hơn là muộn (mỗi buổi bù tạo ra hôm nay là một hàng dữ liệu sai phải dọn sau).

---

## 6. Chi phí ẩn lớn nhất: đổi danh tính sẽ phá bộ chứng cứ nghiệm thu

Gộp PH/HS thành tài khoản gia đình chạm **67 file + 25 test**, trong đó có **toàn bộ e2e journey LMS**.

Bộ chứng cứ nghiệm thu hiện tại (31/38 luồng đã chứng minh) **đứng trên** mô hình đăng nhập hai tầng. Đổi sang `family` ⇒ phải **viết lại các journey LMS**, và trong thời gian viết lại, con số nghiệm thu sẽ tụt.

Đây không phải lý do để không làm — chủ hệ thống đã chốt gộp, và gộp là đúng nghiệp vụ thật. Nhưng phải **biết trước** để không hoảng khi số nghiệm thu giảm giữa chừng, và để **không** làm đợt này chung với đợt khác.

⇒ **Khuyến nghị: đợt danh tính đứng riêng một mình**, có mốc "viết lại journey" nằm trong chính đợt đó.

---

## 7. Thứ tự thi công đề xuất

Sắp theo **phụ thuộc thật** và **giá trị sớm**, không theo số thứ tự plan cũ.

### Đợt A — Kích hoạt cái đã xây (rẻ nhất, giá trị ngay)

Không đụng schema, không phá e2e.

1. **UI cấp/thu unit, archive, xếp dãy bài** — API đã có đủ, **chưa có màn nào**. Đây là lý do vận hành chưa dùng được.
2. **Cảnh báo sắp hết unit** (`expiring`) — `cmc-lms` có, `cmc_edu` chưa.
3. **Bật `LMS_ENTITLEMENT_GATE`** — biến cầu tiền→unit từ "ghi mà không ai đọc" thành có hiệu lực.

> ⚠️ **Điều kiện trước khi bật gate:** phải đếm trong DB số enrollment `active` **không có** dải unit. Bật gate khi còn dữ liệu cũ chưa có dải ⇒ học sinh đang học **mất quyền làm bài ngay lập tức**. Đếm trước, backfill bằng `grantPast`, rồi mới bật.

### Đợt B — Chuỗi domino bài tập (làm trọn gói, §4)

Gỡ buổi bù → gỡ Tier B → tắt open-tier → rekey `Submission` sang `sessionExerciseId` + migration dữ liệu.

### Đợt C — Danh tính gia đình (đứng riêng, §6)

`ParentAccount` SĐT+mật khẩu, bỏ OTP, gộp `kind`, viết lại LMS SPA + journey.

### Đợt D — Mở rộng lược đồ cho khớp chuẩn

`StudentLifecycle` 3 → 6 giá trị (quyết định ánh xạ `blocked_lms` → `on_hold`), thêm `SessionCancelReason`.
*Phải xong trước Đợt E* — import cần ánh xạ đúng các giá trị này.

### Đợt E — Import + cutover + đóng LMS cũ

Script import (chưa tồn tại), dry-run, đối soát, freeze, chuyển SoT, đóng.

**Phụ thuộc bắt buộc:** A → B → (C ∥ D) → E. C và D chạy song song được vì không đụng nhau.

---

## 8. Việc phải chốt trước khi viết code

| # | Việc | Chặn đợt nào |
|---|------|--------------|
| 1 | ~~**Mốc đóng băng `cmc-lms`**~~ — **ĐÃ CHỐT 12/08/2026** tại commit `031d193` | ~~Tất cả~~ ✅ |
| 2 | **Bảng gói bán → số unit** (3–5 gói thật) | Seam tiền, E |
| 3 | **Ánh xạ `blocked_lms` → giá trị nào trong bộ 6** | D, E |
| 4 | Đếm DB: enrollment active không có dải unit; số hàng `isMakeup=true` | A, B |

Mục 1 và 2 là **quyết định chủ hệ thống**. Mục 3 là quyết định sản phẩm nhỏ. Mục 4 là truy vấn — làm được ngay khi có quyền vào DB.

---

## 9. Điều KHÔNG nên làm

| Đừng | Vì |
|------|-----|
| Copy service `cmc-lms` sang `apps/api` | Thiếu facility/RLS/RBAC/audit — mở lỗ hổng cách ly cơ sở |
| Mở writer thứ hai cho `EnrollmentUnitRange` | Phá bất biến single-writer đang giữ tính đúng của seam tiền |
| Gỡ `enrollment.enroll` (reserved) như "nợ LMS cũ" | Đó là **SEAM ERP**, không phải nghiệp vụ cũ — gỡ là phá cổng tiền |
| Bỏ `SessionStatus.done` chỉ vì `cmc-lms` không có | HR/KPI/payroll có thể phụ thuộc — phải audit payroll trước |
| Làm đợt danh tính chung với đợt khác | 67 file + phá journey nghiệm thu — cần cô lập |
| Bật `LMS_ENTITLEMENT_GATE` trước khi backfill | Cắt quyền làm bài của học sinh đang học |

---

## Nguồn

| Mã | Nội dung |
|----|----------|
| BR1 | Lớp / lịch / buổi / tiến trình unit — `cmc-lms` |
| BR2 | Ghi danh / quyền học / điểm danh / vòng đời / gia đình — `cmc-lms` |
| BR3 | Bài tập / chấm / sao / nhật ký — `cmc-lms` |
| BR4 | Ràng buộc an toàn + điểm nối ERP — `cmc_edu` |
| BR5 | Nợ nghiệp vụ cũ phải gỡ + quy mô file/test — `cmc_edu` |
| BR6 | Đối chiếu từng luật chuẩn vs `cmc_edu` |

Đặc tả đầy đủ (~120KB, mọi luật kèm `file:dòng`) trong scratchpad phiên `ec961fba`.

## Câu hỏi chưa giải quyết

1. ~~Mốc đóng băng `cmc-lms`~~ — **đã chốt 12/08/2026** tại commit `031d193` (ngày commit 09/08).
2. Payroll/KPI có phụ thuộc `SessionStatus.done` không — chưa audit.
3. Số liệu DB thật (enrollment không dải, hàng `isMakeup`) — chưa truy vấn.
