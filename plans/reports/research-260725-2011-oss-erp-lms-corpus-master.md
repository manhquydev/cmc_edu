# Bóc tách corpus OSS ERP/LMS — báo cáo tổng hợp

**Ngày:** 2026-07-25 · **Branch:** acceptance-journey-38-lms · **Loại:** read-only research, không chạm code sản phẩm
**Phạm vi:** 8 repo do người dùng chỉ định + 2 repo phát sinh khi kiểm chứng (`frappe/hrms`, `tryton/tryton`)

> **Không phải tư vấn pháp lý.** Toàn bộ phần license là đọc-hiểu văn bản công khai để định hướng kỹ thuật.
> Quyết định thương mại cần luật sư.

## Báo cáo chi tiết

| Chủ đề | File |
|---|---|
| Frappe Framework (lõi MIT) | `research-260725-2011-oss-frappe-framework.md` |
| ERPNext + kiểm chứng erpnext-14 | `research-260725-2011-oss-erpnext.md` |
| frappe/education + frappe/lms | `research-260725-2011-oss-education-lms.md` |
| Moodle | `research-260725-2011-oss-moodle.md` |
| Tryton · Dolibarr · metasfresh | `research-260725-2011-oss-other-erps.md` |
| License & compliance | `research-260725-2011-oss-license-compliance.md` |

---

## 1. Năm kết luận

1. **Chỉ `frappe/frappe` (MIT) là an toàn để nhúng code.** 7 repo còn lại đều copyleft. CMC EDU v2
   không có file `LICENSE` → mặc định proprietary → mọi hành vi copy code/schema từ nhóm copyleft
   kéo nghĩa vụ mở mã lên chính sản phẩm.
2. **`frappe/lms` là AGPL-3.0 — rủi ro cao nhất trong corpus** vì CMC phục vụ phụ huynh/học sinh
   qua mạng, đúng tình huống §13 nhắm tới. Đây là repo *giống sản phẩm CMC nhất* đồng thời
   *nguy hiểm nhất về license*. Nghịch lý này cần được ý thức rõ.
3. **Giá trị thật của corpus là domain model, không phải code.** CMC là **hybrid ERP+LMS**, không
   phải tập con của bất kỳ repo nào: không repo nào trong 8 cái có đồng thời HR/chấm công/KPI/lương,
   thưởng sao học sinh, họp phụ huynh, after-sale, và RLS facility-scoped ở tầng DB.
4. **CMC mạnh hơn cả corpus ở đúng một điểm kiến trúc: enforce quyền ở tầng database.** Frappe,
   Moodle, Tryton, Dolibarr đều enforce ở tầng application. CMC dùng Postgres RLS + GUC
   transaction-local (38 policy / 13 migration), fail-closed. Không nên đánh đổi điểm này để lấy
   thứ gì từ corpus.
5. **Nhiều "gap" mà nghiên cứu chỉ ra thực chất là non-goal đã chốt.** `docs/project-roadmap.md` §1
   (giữ quyết định TL16) loại khỏi v2: huy hiệu · bảng xếp hạng · chứng chỉ tự động · duyệt lên cấp.
   Certificate/badge/leaderboard của Education/LMS/Moodle vì thế **không phải thiếu sót** — đừng
   đưa vào backlog dưới danh nghĩa "OSS có mà mình chưa có".

---

## 2. Bảng sự thật đã verify

Cột "Nguồn" ghi rõ mức xác thực: **[F]** đọc file gốc, **[A]** GitHub API, **[S]** báo cáo agent.

| Repo | License (đã verify) | Trạng thái | Nguồn |
|---|---|---|---|
| `frappe/frappe` | **MIT** | develop, sống (push 2026-07-25), 10.468 sao | [A] + [S][F] |
| `frappe/erpnext` | **GPL-3.0** (`license.txt` toàn văn + `package.json`) | develop, sống, 37.256 sao, ~640 DocType, ~382K LOC | [A] + [S][F] |
| `frappe/erpnext-14` | GPL-3.0 (thừa kế) | ⚠️ **fork bỏ hoang** — `fork:true`, parent `frappe/erpnext`, **5 sao**, commit cuối **2024-04-30** | [F][A] tự kiểm |
| `frappe/education` | **GPL v3 khai báo** — nhưng `license.txt` chỉ đúng **1 dòng** `License: GNU GPL V3`, **không có toàn văn**; GitHub trả `NOASSERTION` | develop, **commit cuối 2026-06-05 (~50 ngày)**, 582 sao, ~73 DocType | [F][A] tự kiểm |
| `frappe/lms` | **AGPL-3.0** (toàn văn) | develop, **commit hôm nay**, 3.082 sao, ~63 DocType | [A] + [S][F] |
| `frappe/hrms` | **GPL-3.0** | sống, 8.264 sao — **HR/Payroll đã tách khỏi ERPNext về đây** | [A] + [S] |
| `moodle/moodle` | **GPL-3.0-or-later** (`COPYING.txt` d.639–640 + header `lib/setup.php`) | main, sống, 7.283 sao, ~2,9M LOC PHP | [F] tự kiểm |
| `tryton/tryton-client` | GPL-3.0 | ⚠️ **`archived: true`**, commit cuối **2022-12-10**; repo sống là `tryton/tryton` (+ Heptapod upstream) | [A] tự kiểm + [S] |
| `Dolibarr/dolibarr` | **GPL-3.0-or-later** | develop, sống, 7.442 sao | [A] + [S][F] |
| `metasfresh/metasfresh` | **GPL-2.0-or-later** (header source: *"either version 2 … or (at your option) any later version"*) | ⚠️ default branch `new_dawn_uat` **không có file license ở root**; chỉ `master` có `LICENSE.md` | [F] tự kiểm |

---

## 3. Đính chính danh sách gốc

| # | Claim ban đầu | Thực tế | Mức nghiêm trọng |
|---|---|---|---|
| 1 | `frappe/erpnext-14` = "branch/version ERPNext 14 đóng gói theo version" | Fork cá nhân bỏ hoang từ 04/2024, 5 sao. Pin v14 đúng = branch `version-14` hoặc tag trong repo chính | **Cao** — nghiên cứu nhầm repo chết |
| 2 | `tryton/tryton-client` = "điểm vào khám phá Tryton" | Đã archived từ 12/2022 | **Cao** — điểm vào sai |
| 3 | `frappe/education` license = "FOSS (xem setup.py/LICENSE để bóc chính xác)" | Khai báo GPL v3, nhưng file license chỉ 1 dòng, không toàn văn, GitHub không phân loại được | **Trung bình** — copyleft, không permissive; không xác định được only/or-later |
| 4 | ERPNext bao gồm "HR" | HR/Payroll **đã tách** sang `frappe/hrms` (repo riêng, GPL-3.0) | **Trung bình** — ảnh hưởng trực tiếp vì CMC có HR |
| 5 | metasfresh "GPL (docker/release-info GPL-2.0)" | Core = **GPL-2.0-or-later**; default branch thiếu file license | Thấp |
| 6 | Moodle "GPL-3.0-or-later" | ✅ **Đúng** (và chính xác hơn field SPDX của GitHub) | — |

## 4. Đính chính giữa các luồng nghiên cứu

Ghi lại vì cả hai lỗi đều đến từ cùng một nguyên nhân — **tin field `license.spdx_id` của GitHub API
thay vì đọc file** — và cả hai đều đã được tôi kiểm chứng lại trực tiếp:

| Sai | Ai nói | Thực tế đã verify |
|---|---|---|
| "metasfresh GPL-2.0 **không** or-later ⇒ **incompatible** với GPL-3.0" | luồng ERP-khác | Header source có mệnh đề or-later ⇒ nâng lên GPL-3.0 được ⇒ **không incompatible** |
| "Moodle GPL-3.0, **không phải** or-later" | luồng license | `COPYING.txt` + header source đều ghi or-later |

Bài học vận hành: field SPDX của GitHub là suy luận tự động, không phải nguồn sự thật. Với repo
license lỏng (`education`, `metasfresh`) nó sai hoặc bỏ trống hoàn toàn.

---

## 5. Ràng buộc license — được và không được

Chi tiết + trích điều khoản: `research-260725-2011-oss-license-compliance.md`. Rút gọn:

| Hành vi | Với `frappe/frappe` (MIT) | Với nhóm GPL/AGPL |
|---|---|---|
| Đọc để hiểu concept, tự viết lại bằng TypeScript | ✅ | ✅ vùng an toàn nhất — **nhưng phải là ý tưởng, không phải bản dịch từng dòng** |
| Copy code (kể cả dịch Python→TS gần như 1-1) | ✅ (giữ notice MIT) | ❌ kéo copyleft lên toàn CMC |
| Copy DocType JSON / XMLDB schema | ✅ | ❌ tránh |
| Sao chép cấu trúc bảng/cột/quan hệ | ✅ | ⚠️ **vùng xám, chưa có án lệ rõ** — tránh sao chép nguyên vẹn |
| Port thuật toán nghiệp vụ | ✅ | ⚠️ tuỳ mức độ biểu đạt được sao chép |
| Tự host nội bộ, không sửa, không phân phối | ✅ | ✅ GPL không phát sinh nghĩa vụ; **AGPL vẫn phát sinh khi phục vụ qua mạng** |
| Tích hợp như hệ riêng biệt qua REST API | ✅ | ✅ đường an toàn nhất nếu thật sự cần dùng |

**Ba điểm chưa chắc chắn, không được trình bày như đã ngã ngũ:** (a) phạm vi "user tương tác qua
mạng" của AGPL §13 khi chỉ phục vụ nội bộ tổ chức; (b) app đóng chạy trên framework MIT nhưng
import DocType của ERPNext có tạo derivative work không; (c) database schema có được bảo hộ bản
quyền không.

**Việc vệ sinh pháp lý nên làm ngay, độc lập với mọi quyết định khác:** repo hiện **không có file
`LICENSE`**. Nên thêm `LICENSE` proprietary rõ ràng + `NOTICE` liệt kê dependency bên thứ ba. Chi
phí gần bằng 0, loại bỏ một mơ hồ không đáng có.

---

## 6. CMC EDU v2 đứng ở đâu (baseline tự đo)

| Chỉ số | Giá trị | Cách đo |
|---|---|---|
| Prisma model | 50 | `grep -c "^model " packages/db/prisma/schema.prisma` |
| Router tRPC | 33 (32 nghiệp vụ + health) | `find apps/api/src -name "*router*.ts"` |
| Procedure | ~148 | đếm key `name: requirePermission(...)` |
| Role | 9 enum / 5 active | `packages/auth/src/index.ts` (ADR-D amendment) |
| Permission key | 76 | `PERMISSIONS` registry |
| `CREATE POLICY` RLS | 38 / 13 migration | migrations |

Đối chiếu quy mô: ERPNext ~640 DocType / 382K LOC, Moodle ~2,9M LOC. CMC nhỏ hơn 1–2 bậc độ lớn
**và đó là điều đúng** — CMC giải một bài toán hẹp (trung tâm k–12 Việt Nam) chứ không phải ERP
tổng quát. Đừng dùng chênh lệch quy mô làm thước đo thiếu sót.

---

## 7. Gap hai chiều, đã lọc theo non-goal đã chốt

### 7.1 Corpus có, CMC chưa — **đáng cân nhắc**

| Concept | Nguồn | Liên quan | Vì sao |
|---|---|---|---|
| **Academic Year / Term** | education, ERPNext (Fiscal Year) | **Cao** | CMC có `ClassBatch` nhưng không có thực thể niên khoá/kỳ học. Ảnh hưởng báo cáo theo kỳ, so sánh năm, khoá sổ |
| **Assessment Criteria có trọng số + Grading Scale** | education, Moodle gradebook | **Cao** | `FinalGrade` hiện là điểm thô; không có breakdown theo tiêu chí, không map điểm→hạng |
| **Fee Structure / Fee Schedule (template học phí)** | education | **Cao** | CMC tạo `Receipt` thủ công; template biểu phí giảm sai sót và mở đường tính doanh thu dự kiến |
| **Docstatus lifecycle + amend chain** | ERPNext | **Vừa** | CMC đã có ledger append-only (`RefundRecord`, `AuditLog`); ERPNext bổ sung mô hình sửa-bằng-cách-tạo-bản-mới có chuỗi truy vết |
| **Period lock / khoá sổ kỳ** | ERPNext Fiscal Year | **Vừa** | Chặn sửa dữ liệu tài chính sau khi chốt kỳ |
| **Record rules** | Tryton | **Vừa** (đối chiếu) | Xác nhận thiết kế RLS của CMC là hướng đúng; Tryton làm ở tầng ORM, CMC làm ở tầng DB — CMC chặt hơn |

### 7.2 Corpus có, CMC chưa — **nhưng là non-goal đã chốt, KHÔNG đưa vào backlog**

Chứng chỉ tự động · huy hiệu · bảng xếp hạng · duyệt lên cấp — `docs/project-roadmap.md` §1 giữ
quyết định TL16. *(Ngoại lệ cần làm rõ: leaderboard bị loại ở §1 nhưng §2 lại ghi "còn leaderboard
chờ phase-08" — hai chỗ trong cùng file mâu thuẫn, nên chốt lại.)*

### 7.3 Corpus có, CMC chưa — **không liên quan mô hình kinh doanh hiện tại**

Quiz engine tự chấm · Course Progress % · Live Class · Job board · e-learning nội dung số. CMC là
trung tâm dạy **offline**, app LMS là cổng phụ huynh/học sinh. Chỉ mở lại nếu có quyết định sản
phẩm về học online.

### 7.4 CMC có, corpus không

HR gắn chặt vận hành lớp (`TimePunch`→`KpiScore`→`Payslip`) · thưởng sao/đổi quà · họp phụ huynh ·
after-sale case · session evidence có consent ảnh trẻ · receipt-driven provisioning · RLS
facility-scoped tầng DB. Đây là phần **không có sẵn để học** — phải tự thiết kế, và đang chạy thật.

---

## 8. Bước tiếp theo — phương án

| | Phương án | Chi phí | Đánh giá |
|---|---|---|---|
| **A** | Dừng ở tham chiếu: lưu bộ báo cáo, tra khi mở M2/P4 | ~0 | An toàn, nhưng dễ mốc và không tạo giá trị |
| **B** | Chọn 3 concept ở §7.1 (academic term · weighted assessment · fee structure), viết ADR + story packet, xếp vào backlog sau M0 | Thấp–vừa | **Khuyến nghị** |
| **C** | Đánh giá tích hợp Moodle như hệ riêng qua REST API | Vừa | Chỉ khi có quyết định sản phẩm về e-learning. Hiện roadmap không có → **chưa làm** |
| **D** | Replatform lên Frappe/ERPNext | Rất cao | **Loại** |

**Vì sao loại D, nói thẳng:** CMC đã có 50 model, ~148 procedure, RLS tầng DB, 889+ test, đang ở
milestone go-live M0. Replatform nghĩa là vứt toàn bộ tài sản đó để đổi lấy một framework enforce
quyền **yếu hơn** (tầng app), stack Python thay vì TypeScript đội đang dùng, và — nếu chạm ERPNext
— kéo theo GPL-3.0 lên sản phẩm đóng. Không có gì trong corpus bù nổi.

**Khuyến nghị: B, cộng hai việc nhỏ độc lập** — (1) thêm `LICENSE` proprietary + `NOTICE`;
(2) chốt lại mâu thuẫn leaderboard trong `project-roadmap.md`.

Thứ tự đề xuất: cả ba đều **sau M0 go-live**, trừ việc thêm `LICENSE` có thể làm ngay vì rủi ro
bằng 0.

---

## 9. Câu hỏi chưa giải

1. AGPL §13 có kích hoạt khi hệ thống chỉ phục vụ trong nội bộ tổ chức (phụ huynh/học sinh của
   chính CMC) hay không — cần luật sư nếu có ý định chạm `frappe/lms`.
2. Ba concept ở phương án B có thực sự nằm trong ý muốn của PO không, hay chỉ là "OSS có nên mình
   cũng nên có" — cần PO xác nhận trước khi viết ADR.
3. Leaderboard: non-goal (§1) hay hạng mục phase-08 (§2) — hai chỗ trong `project-roadmap.md`
   mâu thuẫn.
4. `frappe/education` ~50 ngày không commit trên `develop` — nếu chọn nó làm nguồn tham chiếu domain
   chính, cần theo dõi xem repo có bị bỏ rơi không.
5. Chưa khảo sát: `frappe/hrms` (phát sinh khi kiểm chứng, GPL-3.0, 8.264 sao). Đây mới là repo
   tương ứng với mảng HR/payroll/KPI của CMC, không phải ERPNext. Nếu muốn tham chiếu HR thì đây là
   chỗ cần đọc tiếp.
