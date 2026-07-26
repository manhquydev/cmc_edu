# Bóc tách mức source code + mở rộng corpus — báo cáo tổng hợp vòng 2

**Ngày:** 2026-07-25 · **Loại:** read-only research · **Khác vòng 1:** clone repo về đọc CODE THẬT, không tra qua API

> **Không phải tư vấn pháp lý.** Phần license là đọc-hiểu văn bản công khai. Quyết định thương mại cần luật sư.

## Nguồn

Clone nông (tổng 1,16 GB) tại scratchpad, **không** nằm trong repo dự án:
`frappe` · `erpnext` · `hrms` · `education` · `lms` · `moodle`

| Chủ đề | Báo cáo |
|---|---|
| Frappe framework (source) | `deep-260725-2109-frappe-framework-source.md` |
| ERPNext + HRMS (source) | `deep-260725-2109-erpnext-hrms-source.md` |
| Education + LMS (schema thật) | `deep-260725-2109-education-lms-schema.md` |
| Moodle (source) | `deep-260725-2109-moodle-source.md` |
| Corpus mở rộng (14 repo mới) | `deep-260725-2109-wider-corpus-survey.md` |
| **Vòng 1 (kiến trúc + license)** | `research-260725-2011-oss-erp-lms-corpus-master.md` |

---

## 1. Số liệu chốt — đếm hai cách độc lập

Phương pháp: (a) đếm thư mục con của `*/doctype/`, (b) đếm file JSON chứa `"doctype": "DocType"`.
Hai cách khớp nhau trong sai số 1–2 file.

| Repo | DocType | Child table | **Entity thật** | Python LOC |
|---|---|---|---|---|
| erpnext | 532–534 | 251 | **~281** | 382.936 |
| frappe | 289–290 | 103 | ~186 | 211.513 |
| hrms | **159** | 54 | **105** | 68.550 |
| education | 74 | 29 | **45** | **9.015** |
| lms | 69–70 | 26 | ~43 | 21.583 |
| moodle | — | — | 80 subsystem · 45 plugin type | 7,27M PHP¹ |

¹ Tổng thô. `public/lib` chiếm ~5,23M nhưng phần lớn là thư viện bên thứ ba — **không** phải code lõi
Moodle. `public/mod` ~590K · `public/question` ~163K.

**Đọc lại quy mô cho đúng.** Gần một nửa DocType của ERPNext là child table (bảng dòng chi tiết),
không phải thực thể nghiệp vụ. Sau khi trừ: `education` chỉ còn **45 thực thể**, `lms` **43**.
Đặt cạnh **50 model Prisma của CMC** — CMC ngang `education` về số thực thể, trong khi bao trọn cả
ERP + LMS + HR còn `education` chỉ làm SIS. Khoảng cách quy mô nhỏ hơn nhiều so với ấn tượng từ con
số thô ở vòng 1.

**`frappe/education` mỏng bất ngờ: 9.015 dòng Python** — bằng 1/2,4 `lms`, 1/7,6 `hrms`. Cộng với
branch `develop` đứng im ~50 ngày (verify vòng 1) ⇒ đây là nguồn tham chiếu **mô hình dữ liệu**,
không phải nguồn tham chiếu **cách triển khai**.

---

## 2. Phát hiện kỹ thuật quan trọng nhất

### Frappe không có enforcement quyền nào ở tầng database — verify trực tiếp

Grep toàn bộ clone `frappe`:

| Tìm | Kết quả |
|---|---|
| `ROW LEVEL SECURITY` | **không có** |
| `CREATE POLICY` | **không có** |
| `SET ROLE` / `SESSION AUTHORIZATION` | **không có** |
| `set_config(` | 1 kết quả duy nhất — `frappe/commands/utils.py:865`, là lệnh CLI, không liên quan |

Toàn bộ phân quyền ở Python: `permissions.py:80` (`has_permission`) → `get_doc_permissions()` →
ghép điều kiện vào `WHERE` tại `db_query.py:1254`.

**Hệ quả:** trong Frappe, gọi thẳng `frappe.db.sql()` là **đi vòng qua toàn bộ hệ phân quyền** —
không có lưới an toàn phía dưới. Moodle cũng enforce ở tầng app (`public/lib/accesslib.php`);
Tryton ở tầng ORM.

**CMC EDU v2 ngược lại:** 38 Postgres policy, `withFacility()` set GUC transaction-local, policy coi
"không GUC" = **0 dòng** ⇒ fail-closed ngay cả khi tầng ứng dụng quên kiểm tra.

Đây là điểm CMC **hơn** cả Frappe, Moodle và Tryton — và là lý do kỹ thuật cứng để bác phương án
replatform, không phải chỉ là "ngại chuyển đổi".

---

## 3. Moodle — hai điều làm mọi tài liệu cũ lỗi thời

1. **Bản `main` = 5.3dev, cây thư mục đã tái cấu trúc: web root chuyển vào `public/`.** Mọi hướng
   dẫn/blog nói `lib/gradelib.php`, `mod/quiz/` nay phải đọc là `public/lib/gradelib.php`,
   `public/mod/quiz/`. (Tôi đã phải gửi đính chính giữa chừng cho luồng nghiên cứu vì prompt gốc
   của tôi dùng đường dẫn cũ.)
2. **`main` là nhánh alpha.** Bản ổn định mới nhất: **v5.2.1** (`MOODLE_502_STABLE`). Hiểu kiến trúc
   thì đọc `main` được; nhưng nếu thực sự tích hợp qua web services thì phải nhắm nhánh stable.
   *(Nhánh nào là LTS hiện hành: chưa verify, không khẳng định.)*

3. **`TRADEMARK.txt` ở root repo.** GPL cấp quyền với **code**, không cấp quyền với **tên và
   thương hiệu**. Chi tiết ở báo cáo Moodle — tóm tắt: tích hợp thì được, **đặt tên sản phẩm/app/
   domain/marketing dính chữ "Moodle" thì không**.

---

## 4. Corpus mở rộng — phát hiện lớn nhất bị luồng khảo sát bỏ sót

Tôi tự verify license 9 repo mới. Kết quả có hai thứ **đổi hẳn bài toán license** mà báo cáo khảo
sát không nêu trong kết luận:

| Repo | License (verify từ file) | Ý nghĩa |
|---|---|---|
| **apache/ofbiz-framework** | **Apache-2.0** | ⭐ **ERP đầy đủ duy nhất trong toàn corpus 23 repo có license permissive** — code dùng được trong sản phẩm đóng |
| **sakaiproject/sakai** | **ECL-2.0** (Educational Community License, phái sinh Apache-2.0) | ⭐ **LMS permissive duy nhất** |
| instructure/canvas-lms | **AGPL-3.0** | Cùng hạng rủi ro `frappe/lms` — luồng khảo sát không gắn cờ |
| openedx/**openedx-platform** | AGPL-3.0 | ⚠️ repo **đã đổi tên** từ `openedx/edx-platform` (301 redirect) |
| odoo/odoo | LGPL-3.0 (`LICENSE` branch `19.0`) | Open-core: Community LGPL ≠ Enterprise đóng |
| axelor/axelor-open-suite | AGPL-3.0 | Rủi ro cao |
| GibbonEdu/core | GPL-3.0 | SIS k-12, domain gần CMC |
| chamilo/chamilo-lms | GPL-3.0 | — |
| idempiere/idempiere | **chưa xác định** — không có `LICENSE` ở root | Cần đọc file khác trước khi kết luận |

**Vì sao điều này quan trọng:** vòng 1 kết luận "chỉ `frappe/frappe` (MIT) là an toàn để nhúng code".
Sau vòng 2, kết luận đó phải mở rộng: **OFBiz (Apache-2.0) và Sakai (ECL-2.0) cũng an toàn về mặt
license.**

**Nhưng an toàn ≠ hữu ích.** Cả hai đều là Java, đồ sộ, thiết kế theo phong cách cũ; OFBiz nhắm ERP
thương mại/kho vận, Sakai nhắm đại học. Với một trung tâm k–12 chạy TypeScript, khả năng dùng lại
code thực tế **gần bằng không**. Giá trị của phát hiện này là **đóng lại câu hỏi** "liệu có bỏ sót
lựa chọn permissive nào không" — câu trả lời: có hai, và đã kiểm tra, không phù hợp.

---

## 5. Đính chính số liệu do agent báo sai

| Sai | Thực tế (verify 2 cách) |
|---|---|
| hrms "379 DocType" | **159** |
| erpnext "~640 DocType" (vòng 1) | **532–534**; 640 là số *file JSON*, gồm dashboard/list-view settings |
| lms "63 DocType" (vòng 1) | 69–70 |
| Khảo sát mở rộng không gắn cờ Canvas = AGPL, không nêu OFBiz/Sakai permissive | đã bổ sung ở §4 |

Nguyên nhân lặp lại ở cả hai vòng: **đếm nhầm đơn vị** (file vs thư mục) và **tin field SPDX của
GitHub API thay vì đọc file**. Với repo license lỏng (`education`, `metasfresh`, `odoo`, `axelor`,
`idempiere`), SPDX của GitHub trả `NOASSERTION` hoặc trống.

---

## 6. Cái gì đáng lấy — tổng hợp cả hai vòng

Đã lọc bỏ non-goal TL16 (huy hiệu · bảng xếp hạng · chứng chỉ tự động · duyệt lên cấp) và mọi thứ
chỉ phục vụ e-learning (CMC dạy **offline**).

| # | Concept | Nguồn | Mức | Ghi chú từ đọc code |
|---|---|---|---|---|
| 1 | **Assessment Criteria có trọng số + Grading Scale** | education (`api.py` `get_grade()`), moodle gradebook (`public/lib/grade/`) | **Cao** | CMC `FinalGrade` là điểm thô. Moodle có cây `grade_category` + nhiều chiến lược tổng hợp — **quá nặng**; mô hình tối thiểu của `education` mới là thứ nên tham chiếu |
| 2 | **Academic Year / Term** | education, ERPNext Fiscal Year | **Cao** | CMC không có thực thể niên khoá/kỳ. Ảnh hưởng báo cáo theo kỳ, so sánh năm, khoá sổ |
| 3 | **Fee Structure → Fee Schedule → Fees** | education (`fee_schedule.py`, `fees.py`) | **Cao** | CMC tạo `Receipt` thủ công; template biểu phí giảm sai sót, mở đường doanh thu dự kiến |
| 4 | **auto-absent (tự đánh vắng)** | hrms (`Employee Checkin`, `Shift Type`) | **Vừa** | Chỉ phần auto-absent đáng tham chiếu. Phần ghép cặp qua nửa đêm **không áp dụng** — xem §6.1 |
| 5 | **docstatus + amend chain** | erpnext | **Vừa** | CMC đã có ledger append-only; ERPNext bổ sung mô hình "sửa = tạo bản mới có liên kết ngược" |
| 6 | **Period lock / khoá sổ kỳ** | erpnext | **Vừa** | Chặn sửa dữ liệu tài chính sau khi chốt kỳ |

### 6.1 Nghi vấn ca qua nửa đêm — đã kiểm, KHÔNG phải lỗi

Đọc HRMS thấy nó xử lý riêng ca vắt qua nửa đêm, trong khi CMC ghép cặp chấm công theo **ngày lịch
ICT** (`apps/api/src/kpi/auto-score.ts:232-238` và `apps/api/src/payroll/router.ts:337-347`, khoá
bằng `ictDateOnlyOf`, "punch đầu ngày = vào, cuối ngày = ra"). Thoạt nhìn là lỗ hổng.

**Đã kiểm tra và không phải lỗi.** `apps/api/src/shift/router.ts:59` có
`.refine((input) => input.endTime > input.startTime)` — ca có giờ kết thúc không lớn hơn giờ bắt đầu
bị **chặn ngay ở tầng validation**. Ca qua nửa đêm **không biểu diễn được** trong mô hình dữ liệu
(`ShiftTemplate.startTime/endTime` là `HH:mm` ICT wall-clock). Ghép cặp theo ngày lịch vì thế
**nhất quán** với ràng buộc dữ liệu.

HRMS cần xử lý ca đêm vì nhắm nhà máy/vận hành 24h. CMC là trung tâm k–12 dạy ban ngày và buổi tối,
đã chủ động loại ca đêm. **Không cần hành động.** Chỉ cần biết: nếu sau này CMC muốn mở ca qua nửa
đêm thì phải sửa đồng thời cả ba chỗ — validation, `auto-score.ts`, `payroll/router.ts`.

**Cảnh báo ngược — đừng bắt chước:** multi-currency, tax slab, workflow engine tổng quát, quiz
engine, question bank, plugin architecture kiểu Moodle. Tất cả đều là chi phí lớn cho quy mô một
trung tâm k–12.

---

## 7. Corpus đã bão hoà chưa

**Rồi, về mặt tìm nền tảng.** Không còn ứng viên nào chưa xét đáng để CMC cân nhắc thay thế hoặc
nhúng. Hai lựa chọn permissive cuối cùng (OFBiz, Sakai) đã được kiểm tra và loại vì lý do kỹ thuật,
không phải lý do license.

**Chưa, về mặt học mô hình domain.** Sáu concept ở §6 đến từ đọc code thật, chưa được đưa vào thiết
kế CMC. Đó mới là phần việc còn lại — và nó là việc **thiết kế**, không phải việc **nghiên cứu**.

**Khuyến nghị: dừng khảo sát OSS.** Khảo sát thêm sẽ cho thêm dữ liệu nhưng không đổi quyết định.

---

## 8. Bước tiếp theo

Giữ nguyên khuyến nghị vòng 1, nay có bằng chứng source-level chống lưng:

1. **Sau M0 go-live** — viết ADR + story packet cho 3 concept ưu tiên cao (§6 mục 1–3).
2. **Rủi ro bằng 0, làm bất cứ lúc nào** — thêm `LICENSE` proprietary + `NOTICE` (repo vẫn đang thiếu).
3. **Chốt mâu thuẫn leaderboard** trong `docs/project-roadmap.md` (§1 loại khỏi v2 ↔ §2 ghi chờ phase-08).
4. **Loại vĩnh viễn** — replatform lên Frappe/ERPNext/Odoo/Moodle. Lý do cứng: mất RLS tầng DB
   (§2), sai stack, và với mọi thứ trừ `frappe/frappe`/OFBiz/Sakai là kéo copyleft lên sản phẩm đóng.

---

## 9. Câu hỏi chưa giải

1. Ba concept ưu tiên cao có đúng ý PO không, hay chỉ là "OSS có nên mình cũng nên có".
2. Leaderboard: non-goal hay hạng mục phase-08.
3. iDempiere license — không có `LICENSE` ở root, chưa kết luận.
4. Nhánh nào của Moodle là LTS hiện hành — chưa verify.
5. Nếu thêm Academic Year/Term vào CMC: chi phí migration cho dữ liệu pilot đang chạy thật là bao
   nhiêu — chưa ước lượng.
