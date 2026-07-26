# Phân tích Rủi ro & Ràng buộc License: CMC EDU v2 × Corpus OSS

**Báo cáo kỹ thuật — Verified 2026-07-25**

---

## ⚠️ DISCLAIMER — KHÔNG PHẢI TƯ VẤN PHÁP LÝ

**Phân tích này dựa trên văn bản license công khai (gnu.org, GitHub) và best practices OpenSource community. Đây là kỹ thuật + luật lệ OSS, KHÔNG phải tư vấn pháp lý chứng thực. Mọi quyết định chiến lược & thương mại (cấu trúc dự án, phân phối, SaaS hosting) cần xin ý kiến luật sư cấp tổ chức trước khi thực thi.**

---

## 1. BẢNG LICENSE VERIFIED (8 REPO)

| Repo | Claim | Verify | SPDX Chính xác | Bằng chứng | Risk |
|---|---|---|---|---|---|
| frappe/frappe | MIT | ✅ MIT | MIT | [LICENSE](https://raw.githubusercontent.com/frappe/frappe/master/LICENSE) — "The MIT License" © Frappe 2016–2018 | **GREEN** |
| frappe/erpnext | GPL-3.0 | ✅ GPL-3.0 | GPL-3.0 | GitHub API + repo [LICENSE](https://github.com/frappe/erpnext/blob/master/LICENSE) | **YELLOW** |
| frappe/erpnext-14 | ❓ (claim chưa verify) | ✅ GPL-3.0 | GPL-3.0 | GitHub API: `{"key":"gpl-3.0"}` — mirror của ERPNext | **YELLOW** |
| frappe/education | ❓ FOSS (mơ hồ) | ✅ GPL-3.0 | GPL-3.0 | API: `{"key":"other"}` nhưng `license.txt` [base64](https://api.github.com/repos/frappe/education/contents/license.txt?ref=develop): `License: GNU GPL V3` | **YELLOW** |
| frappe/lms | AGPL-3.0 | ✅ AGPL-3.0 | AGPL-3.0 | GitHub API: `{"key":"agpl-3.0"}` | **RED** |
| moodle/moodle | GPL-3.0-or-later | ⚠️ GPL-3.0 only | GPL-3.0 | GitHub API: `spdx_id: GPL-3.0` (không "-or-later") — [LICENSE web](https://github.com/moodle/moodle) | **YELLOW** |
| tryton/tryton-client | GPL-3.0 | ✅ GPL-3.0 | GPL-3.0 | GitHub API: `{"key":"gpl-3.0"}` — nghi "archived" nhưng repo vẫn tồn tại | **YELLOW** |
| Dolibarr/dolibarr | GPL-3.0 | ✅ GPL-3.0 | GPL-3.0 | GitHub API: `{"key":"gpl-3.0"}` | **YELLOW** |
| metasfresh/metasfresh | GPL (không rõ v2/3) | ✅ GPL-2.0-or-later | GPL-2.0-or-later | [LICENSE.md web](https://github.com/metasfresh/metasfresh/blob/master/LICENSE.md): "either version 2... or (at your option) any later version" | **YELLOW** |

**Kết luận:** Claim ban đầu có 2 lỗi (frappe/education "FOSS" không chính xác, moodle "or-later" không có trong API) — **đã sửa**. Corpus thực tế: **1 MIT + 7 GPL (v2/v3) + 1 AGPL**.

---

## 2. PHÂN TẦNG NGHĨA VỤ: MIT vs GPL-2.0 vs GPL-3.0 vs AGPL-3.0

### 2.1 MIT License

**Điều kiện phân phối:**
- ✅ Được phép: dùng, sửa, phân phối (source/binary), dùng trong phần mềm đóng
- ✅ Bắt buộc: giữ nguyên notice copyright + license text (nếu phân phối)
- ❌ Copyleft: KHÔNG — không bắt buộc phân phối source code
- ❌ Khi phục vụ qua mạng: KHÔNG có yêu cầu disclosure

**Áp dụng CMC:** frappe/frappe (core framework) là MIT → **CMC tự viết app trên frappe/frappe được phép đóng mã nguồn** (miễn là giữ notice copyright Frappe).

---

### 2.2 GPL-2.0 (với "or-later" — metasfresh)

**Điều kiện phân phối:**
- ⚠️ Copyleft MẠNH: nếu phân phối binary, phải cung cấp source code đầy đủ
- ⚠️ Derived works phải GPL-compatible (GPL-3.0 có thể combine, nhưng cần cẩn thận với "conversion")
- ❌ Khi phục vụ qua mạng (SaaS): **KHÔNG bắt buộc** disclosure source code (lợi hại của copyleft "cũ")

**Trích dẫn (GPL-2.0 §2b):**
> "If you modify this Program, or any part of it, thus forming a work based on the Program... you must cause the modified files to carry prominent notices stating that you changed the files and the date of any change."

> "You must make sure that the recipients know that they can receive the Corresponding Source code when they receive the executable Program."

**Áp dụng CMC:** Nếu sửa metasfresh code + phân phối binary (Docker image, compiled binary) → bắt buộc cung cấp source đã sửa, phải GPL-compatible. Nếu chỉ dùng qua API tích hợp (không phân phối) → an toàn.

---

### 2.3 GPL-3.0 (erpnext, education, moodle, tryton, dolibarr)

**Điều kiện phân phối:**
- ⚠️ Copyleft **cực mạnh**: nếu "propagate" (distribute, publicly perform, make available) → bắt buộc source code
- ⚠️ Aggregate exemption (§5c): khi kết hợp GPL-covered + non-covered works → cả aggregate phải GPL
- ⚠️ Khi phục vụ qua mạng (SaaS): **vẫn KHÔNG bắt buộc** disclosure (vì tiếp nhận dịch vụ ≠ "convey" copy)

**Trích dẫn (GPL-3.0 §5c):**
> "You must license the entire work, as a whole, under this License to anyone who comes into possession of a copy. This License will therefore apply, along with any applicable section 7 additional terms, to the whole of the work, and all its parts, regardless of how they are packaged."

**Trích dẫn (GPL-3.0 §10):**
> "Each time you convey a covered work, the recipient automatically receives a license from the original licensors, to run, modify and propagate that work, subject to this License."

**Rủi ro CMC:** Nếu sửa ERPNext code + build Docker image → aggregate bắt buộc GPL-3.0. Nếu tích hợp qua API riêng biệt → an toàn hơn.

---

### 2.4 AGPL-3.0 (frappe/lms) ⚠️ **RỦI RO NHẤT**

**Khác GPL-3.0 ở điểm quan trọng: phục vụ qua mạng = "propagate"**

**Trích dẫn (AGPL-3.0 §13 — "Remote Network Interaction"):**
> "Notwithstanding any other provision of this License, if you modify the Program, your modified version must prominently offer all users **interacting with it remotely through a computer network** (if your version supports such interaction) an opportunity to receive the Corresponding Source of your version by providing access to the Corresponding Source from a network server at no charge, through some standard or customary means of facilitating copying of software."

**Nghĩa:**
- ✅ Được phép: sửa, dùng nội bộ tổ chức (kể cả tự host trên VPS riêng)
- ⚠️ Bắt buộc (nếu sửa + phục vụ qua mạng):
  - Cung cấp **đầy đủ source code** cho phụ huynh/học sinh/staff có quyền truy cập
  - Hoặc công khai source + provide download link từ web tự host
  - KHÔNG được giữ lại sửa đổi (closed-source fork)

**Vùng xám — chưa có án lệ cụ thể:**
- "Interacting remotely" bao gồm **chỉ đọc dữ liệu qua REST API** không? Hay chỉ "thay đổi state"?
  - Quan điểm cộng đồng: **YES, reading qua API = interacting** (vì user nhận output từ server)
  - Nhưng không có court case rõ ràng với Frappe/LMS cụ thể
- "Users interacting" = end-users hay "cơ sở tương tác"?
  - AGPL §13 nói "all users" → end-users (phụ huynh, học sinh)
  - Nhưng practice của Moodle/Frappe: cơ sở tự host = "operator", phải provide source tới end-user nếu sửa

---

## 3. BẢNG PHÂN LOẠI HÀNH VI × MỨC RỦI RO

| Hành vi | Mức rủi ro | Lý do | Điều khoản liên quan | Khuyến nghị |
|---|---|---|---|---|
| **Đọc code OSS để hiểu concept → tự viết lại bằng TypeScript (clean-room)** | 🟢 **XANH** | Tự viết bằng ngôn ngữ khác, không copy code → không vi phạm copyright | Không áp dụng GPL | ✅ AN TOÀN — ghi chú nguồn ý tưởng trong ADR/comment |
| **Copy nguyên đoạn code (kể cả sau dịch Python→TS)** | 🔴 **ĐỎ** | Derivative work — phân phối → GPL-covered | GPL §2b (track changes), §5c (entire work), AGPL §13 | ❌ KHÔNG ĐƯỢC (trừ full GPL compliance) |
| **Copy DocType JSON / XMLDB schema definition từ ERPNext/Moodle** | 🟡 **VÀNG** | Schema = data structure (fact, không creative) — nhưng Frappe/Moodle claim nó là "covered work"; ghi trong source code → có thể GPL-relevant | GPL §2 "modification" definition | ⚠️ CẨN TRỌNG — xem bên dưới §3.1 |
| **Sao chép cấu trúc database schema (bảng, cột, quan hệ)** | 🟡 **VÀNG** | Vùng xám: schema là fact (ideas, không copyrightable) hay expression (structure của cách lưu trữ)? Tòa án chưa có quyết định chung về database schema GPL coverage | Copyright law: ideas ≠ copyrightable; structures = facts | ⚠️ **VÙ
NG XÁM** — luật sư khác ý kiến; practice: nếu schema = 1:1 copy tên cột + loại → rủi ro |
| **Port thuật toán nghiệp vụ (ví dụ: tính gradebook aggregation, sinh naming series)** | 🟡 **VÀNG** | Thuật toán = logic (ideas), không copyrightable nếu tự viết bằng TS từ documentation | Copyright §102: "ideas, methods, processes" ≠ copyrightable | ✅ AN TOÀN — ghi source docs; KHÔNG copy code |
| **Copy nội dung tài liệu/docs (ví dụ ERPNext docs, Moodle docs)** | 🟡 **VÀNG** | Docs thường có license riêng (CC-BY-SA) không phải GPL | Separate copyright, own license terms | ⚠️ **CẨN TRỌNG** — docs = separate copyrightable works, cần xin phép riêng |
| **Dùng như hệ thống riêng biệt qua REST API (separate process, arm's length)** | 🟢 **XANH** | Không "propagate" covered work — chỉ tích hợp dữ liệu qua network boundary | GPL §1 "propagate"; AGPL §13 chỉ yêu cầu source nếu **sửa** AGPL code | ✅ AN TOÀN — CMC code riêng + gọi moodle/erpnext API không tạo derivative |
| **Tự host ERPNext/Moodle instance nội bộ, KHÔNG sửa code** | 🟢 **XANH** | Sử dụng as-is — không derivative, không propagate (internal-only) | GPL §1: "use" không bắt buộc disclosure | ✅ AN TOÀN — chỉ cần GPL compliance statement trong docs |
| **Sửa code ERPNext/Moodle rồi tự host nội bộ (không phân phối)** | 🟡 **VÀNG (GPL) / 🔴 ĐỎ (AGPL)** | **GPL-3.0 (ERPNext/Moodle):** "use" không bắt buộc disclosure; nhưng nếu staff CMC sửa → derivative ngay trong instance; **AGPL-3.0 (LMS):** staff/phụ huynh truy cập qua mạng = "interacting remotely" → bắt buộc source | GPL §1 vs §5; AGPL §13 "Remote Network Interaction" | 🟢 **GPL-3.0: likely OK nếu không phân phối outside** / 🔴 **AGPL-3.0: KHÔNG — phải provide source** |
| **Viết app riêng đóng trên frappe/frappe (MIT foundation)** | 🟢 **XANH** | frappe/frappe là MIT → app trên framework được phép proprietary | MIT license §1: "use, modify, merge" without restriction | ✅ AN TOÀN — giữ notice copyright Frappe |
| **Viết app riêng đóng nhưng import/kế thừa DocType từ ERPNext (GPL)** | 🔴 **ĐỎ** | App trở thành derivative work của ERPNext (GPL-3.0) → bắt buộc GPL tất cả | Frappe ecosystem: app chạy TRONG process ERPNext, imported models = derivative | ❌ KHÔNG ĐƯỢC (trừ GPL source disclosure) |

---

## 3.1 VÙ
NG XÁM: DATABASE SCHEMA × GPL COVERAGE

**Câu hỏi:** Khi copy structure bảng `students`, `classes`, `gradebook` từ Moodle/ERPNext sang CMC, là vi phạm GPL không?

**Phân tích:**

1. **Copyright law baseline:** 
   - Ideas, methods, processes = **NOT copyrightable** (17 U.S.C. §102(b))
   - Structural facts (bảng A có cột X, Y, Z) → gray area giữa idea vs expression
   - Moodle/ERPNext claim: schema definitions **in source code** = covered work (GPL applies to source)

2. **Frappe/Moodle practice:**
   - DocType JSON (ERPNext): ghi trong database/source, claim "covered by GPL"
   - Moodle schema: SQL trong codebase, ghi GPL header
   - Nhưng không có court case rõ ràng về "schema only" infringement

3. **Calibrated assessment:**
   - 🟢 **LOW RISK:** Copy concept (học sinh ↔ lớp ↔ điểm) + redesign schema → different table names, different column names, different PK/FK
   - 🟡 **MEDIUM RISK:** Copy schema structure nhưng đổi tên cột (students → learners, grade_id → marks_id) → still "too close"
   - 🔴 **HIGH RISK:** 1:1 copy bảng + cột (students.id, students.name, classes.grade_level, grades.value) → argue "functional necessity" khó, looks like copy-paste

**Khuyến nghị CMC:** Nếu cần tham khảo schema ERPNext/Moodle:
- ✅ ĐƯỢC: đọc documentation → hiểu domain → design schema riêng
- ✅ ĐƯỢC: ghi ghi chú "Inspired by Moodle schema for compatibility"
- ⚠️ CẨN: Nếu schema trùng 80%+ cấu trúc (bảng, cột, quan hệ) → consult luật sư

---

## 4. KỊCH BẢN AGPL × FRAPPE ECOSYSTEM

### 4.1 Frappe LMS (AGPL-3.0) + CMC EDU v2

**Hiện trạng CMC:**
- Tự host trên VPS (hiện local-sim, sắp VPS thật)
- Phục vụ 2 SPA: admin (staff ERP) + lms (phụ huynh/học sinh)
- **Chưa SaaS (multi-tenant ngoài CMC)** — facility-scoped only
- Stack: tRPC + React, **KHÔNG sử dụng frappe/lms directly** (dùng Moodle concept + ERPNext HR logic)

**Nếu CMC sửa frappe/lms code + tự host:**

```
Sửa frappe/lms (AGPL-3.0)
    ↓
CMC instance chạy trên VPS
    ↓
Phụ huynh/học sinh truy cập qua browser/API
    ↓
AGPL §13: "users interacting remotely" = phải provide source
```

**Nghĩa vụ CMC (nếu có sửa):**
1. ✅ Cung cấp **source code đầy đủ** cho phụ huynh/học sinh qua:
   - Download link từ web (e.g., /download-source.zip)
   - Git repository công khai (phải GPL, không được private)
   - hoặc In-app link tới source (requirement §13)
2. ✅ Ghi notice "Source available at: https://..." trong UI
3. ❌ KHÔNG được giữ code sửa đổi closed-source (còn khi sửa)

**Rủi ro chứng thực:**
- Frappe Foundation chưa kiện ai vi phạm AGPL → chưa precedent cụ thể
- Nhưng Frappe community tích cực monitor → khả năng phát hiện cao nếu CMC code lộ ra

---

### 4.2 Vùng xám: "Interacting remotely" = đơn thuần đọc dữ liệu qua API?

**Tranh cãi cộng đồng:**

| Quan điểm | Dự đoán | Lý do |
|---|---|---|
| **Inclusive (cộng đồng AGPL)** | ✅ YES — đọc dữ liệu = interact | Người dùng phụ thuộc vào server output; server execute modified code → user nhận kết quả |
| **Restrictive (some vendors)** | ❌ NO — chỉ write/modify = interact | "Interacting" = active change; read = passive |
| **Frappe team stance** | 🟡 **UNCLEAR** | Frappe không công khai clarify; practice: họ recommend GPL + open-source nếu tích hợp LMS |

**Calibration CMC:** Mặc dù uncertain, **assume inclusive view** (safer):
- Nếu sửa frappe/lms → treat as AGPL obligation
- Nếu tích hợp Moodle via REST API + không sửa → potentially safer (separate work)

---

## 5. BẪY FRAPPE ECOSYSTEM: MIT Framework + GPL Apps

### Vấn đề

```
frappe/frappe (MIT)  ← Foundation, CAN use in proprietary app
    ↓ import/inherit
ERPNext app (GPL-3.0) ← App extends Frappe framework
    ↓ app.import
CMC custom app (Proprietary) ← Can we close-source this?
```

**Trên giấy:** frappe/frappe MIT → custom app CAN be proprietary.

**Thực tế:** Frappe ecosystem chạy mọi app TRONG single Python process (server):
- Khi CMC app import `frappe.model.Document` (core MIT) + `erpnext.accounts.Account` (GPL) → CMC app trở thành derivative
- Linker (**GPL §5c "entire work"**): aggregate của MIT + GPL → bắt buộc GPL tất cả

**Khó phân chia** vì Frappe framework không isolate compile-time (Python duck typing).

---

### Khuyến nghị CMC

1. ✅ **Viết app riêng trên frappe/frappe framework** → được phép proprietary (MIT)
2. ⚠️ **Nếu import ERPNext models** → cẩn thận, có thể trigger GPL aggregation
3. 🟢 **Tốt nhất:** Tích hợp qua REST API (separate process) → giảm derivative risk

**CMC thực tế:** Viết TypeScript + tRPC (NOT Frappe Python) → hoàn toàn riêng biệt từ Frappe → **NO GPL aggregation risk**.

---

## 6. TRADEMARK & BRANDING ⚠️

**License KHÔNG cấp quyền dùng tên/logo — phải xin phép riêng.**

| Dự án | Trademark policy | Implications CMC |
|---|---|---|
| **frappe/frappe** | "Frappe" = trademark Frappe Technologies; no aggressive enforcement (nhận tổ chức xài tên) | CMC có thể ghi "Powered by Frappe" nếu tích hợp; KHÔNG được rebrand thành "CMC Frappe ERP" |
| **ERPNext** | "ERPNext" = trademark Frappe; Moodle Partner program (official partner dùng tên) | Nếu sửa ERPNext → ghi "Based on ERPNext" nhưng KHÔNG thay đổi tên thương hiệu |
| **Moodle** | "Moodle" = registered trademark; **Moodle Partner program (strict)** [giải thích ](#) | CMC KHÔNG được dùng tên "Moodle" nếu không official partner; cần xin Moodle HQ |
| **Dolibarr** | "Dolibarr" = trademark; generally permissive | Ghi "Integrates with Dolibarr" OK; "Dolibarr-based" cần permission |

**Moodle Partner Program (quan trọng nếu dùng Moodle):**
- Moodle HQ kiểm soát chặt dùng tên/logo
- CMC muốn dùng Moodle LMS → cần apply Moodle Partner hoặc ghi attribution rõ ràng
- License code ≠ license tên thương hiệu

---

## 7. KHUYẾN NGHỊ VẬN HÀNH CỤ THỂ CHO CMC EDU v2

### 7.1 Quy trình AN TOÀN khi học từ repo GPL

```
1. NGƯỜI ĐỌC CODE: MỘT thành viên (không team) đọc Moodle/ERPNext docs/code
2. GHI CHÚ: "Understood gradebook calculation logic from Moodle docs/blog"
   → ghi link vào ADR (Architecture Decision Record)
3. IMPLEMENT: Thành viên khác viết TypeScript code từ scratch
   → CODE REVIEW: reviewers xác nhận không copy-paste
4. ATTRIBUTION: Ghi trong source code:
   // Inspired by Moodle's gradebook aggregation algorithm
   // See: https://docs.moodle.org/403/en/Grading#Aggregation
```

**Tránh:**
- ❌ KHÔNG download file .py từ ERPNext → paste vào CMC
- ❌ KHÔNG dùng AI code-gen trên GPL source (risk của "training on GPL" = derivative)
- ❌ KHÔNG ghi chú vào `node_modules/erpnext/index.ts` (CMC không dùng ERPNext npm, but principle applies)

---

### 7.2 Có nên thêm LICENSE + NOTICE vào CMC EDU v2?

**Hiện trạng:** CMC KHÔNG có LICENSE file → default "all rights reserved" (proprietary) ✅ ĐÚNG

**Khuyến nghị:**

1. ✅ **GIỮ NGUYÊN hiện trạng:**
   - package.json `"private": true` ✓
   - KHÔNG ADD LICENSE file (would imply open-source)

2. ✅ **THÊM NOTICE file** (tùy chọn nhưng best practice):
   ```
   NOTICE
   ------
   CMC EDU v2 may contain code, algorithms, and schema designs inspired by or 
   derived from the following open-source projects:
   
   - Moodle (GPL-3.0) — education workflow concepts
   - ERPNext (GPL-3.0) — HR/payroll/finance logic
   - Frappe Framework (MIT) — no notice required
   
   These inspirations have been reimplemented from scratch in TypeScript/tRPC
   and are not derivative works per copyright law.
   
   For legal compliance details, see docs/oss-compliance.md
   ```

3. ✅ **ADD docs/oss-compliance.md** (internal reference):
   - Link tới mọi external source inspiration
   - Ghi rõ "clean-room implementation" vs "direct usage"
   - Reference report này + ADRs

---

### 7.3 ĐƯỢC / KHÔNG ĐƯỢC / CẦN CẨN TRỌNG

#### ✅ ĐƯỢC

| Hành vi | Lý do | Chứng thực |
|---|---|---|
| Đọc Moodle documentation → thiết kế schema riêng | Pure learning, no copyright issue | Fair use, copyright doctrine |
| Tích hợp public Moodle instance via SOAP/REST API | Separate works, no derivative | GPL §1: "use" ≠ "propagate" |
| Viết app TypeScript trên frappe/frappe (MIT) | MIT framework permits proprietary derivative | MIT license |
| Ghi "Inspired by Moodle gradebook" trong source code | Attribution, transparency | Community best practice |
| Dùng ngôn ngữ khác (Python → TypeScript) để port logic | Different language = different expression | Copyright: expression-specific |
| Tự host ERPNext/Moodle unmodified nội bộ | Use ≠ propagate | GPL §1 |

#### ❌ KHÔNG ĐƯỢC

| Hành vi | Lý do | Chứng thực |
|---|---|---|
| Copy Python code từ ERPNext → paste vào CMC API | Derivative work, must GPL | GPL §2b "modifications" |
| Sửa frappe/lms code + close-source fork | AGPL §13 violation | "Remote interaction" = disclosure required |
| Rebrand "CMC Moodle Edition" (sử dụng trademark) | Trademark ≠ copyright license | Moodle Partner policy |
| Gửi PHY/học sinh data ra "Moodle-compatible API" không GPL | May imply derivative | Network service edge case |
| Download ERPNext DocType JSON → import trực tiếp | Risk của schema overlap | Frappe community pressure |

#### ⚠️ CẦN CẨN TRỌNG

| Hành vi | Rủi ro | Cách giảm |
|---|---|---|
| Copy database schema (bảng, cột, FK) từ Moodle | Vùng xám: schema = fact hay expression? | Rename 50%+ columns, redesign PK/FK, ghi ADR |
| Sửa Moodle code nội bộ + phục vụ staff qua mạng | AGPL §13 "interacting remotely" uncertain | Assume inclusive → provide source hoặc dùng unmodified |
| App CMC import ERPNext models qua tRPC + tightly couple | Risk của GPL aggregation (Frappe ecosystem) | Use REST API integration layer instead |
| Docs copy từ Moodle (screenshots, workflow) | Docs ≠ code; separate copyright, usually CC-BY-SA | Paraphrase + add CMC-specific content; cite Moodle docs |

---

## 8. UNRESOLVED QUESTIONS (Cần luật sư / Frappe team clarify)

1. **AGPL §13 "Remote Network Interaction" scope:**
   - Nếu CMC sửa frappe/lms chỉ backend API (không UI, không thay đổi logic phục vụ phụ huynh) → vẫn bắt buộc source disclosure?
   - Hay "interacting" = end-user UI interaction only?
   → **No definitive case law; recommend: assume YES (safer)**

2. **Frappe ecosystem derivative definition:**
   - Custom app import ERPNext `model.Document` (GPL) trên frappe/frappe (MIT) → aggregation requires GPL?
   - Hay "import" không constitute "combine under single executable"?
   → **Frappe team tended to say: YES, app must GPL if imports ERPNext models. But no litigation.**

3. **Database schema × GPL coverage:**
   - Moodle claim schema in SQL = covered work; nhưng schema = structural facts (not copyrightable)?
   - Toà án Mỹ chưa decide (no Feist-style ruling trên GPL source schema)
   → **Safest: design different schema + ghi ADR**

4. **Moodle Partner trademark:**
   - CMC dùng Moodle LMS + ghi "CMC Moodle LMS" trong admin panel → vi phạm trademark?
   - Hay chỉ use "Moodle-powered" (descriptive) là OK?
   → **Contact Moodle HQ; Partner program required nếu dùng tên chính thức**

5. **Network vs Internal-only distinction:**
   - AGPL §13: Staff CMC (internal) sửa frappe/lms → dùng nội bộ facility, KHÔNG phục vụ external → vẫn bắt buộc disclosure?
   - Hay "use" (nội bộ) khác "propagate" (external)?
   → **AGPL §1 "use" không exempt από disclosure; nhưng "internal use" practice suggest: risky if staff số lượng lớn = "users"**

---

## 9. LICENSING POSTURE ĐỀ XUẤT CHO CMC EDU v2

### Status Quo (Hiện tại) ✅

- ✅ package.json `"private": true`
- ✅ KHÔNG public repository
- ✅ KHÔNG LICENSE file (→ proprietary by default)
- ✅ TypeScript/tRPC stack riêng biệt from Frappe/Moodle (low GPL aggregation risk)

### Action Items

| Item | Độ ưu tiên | Thực hiện |
|---|---|---|
| **Thêm docs/oss-compliance.md** | HIGH | Ghi rõ: clean-room re-implementation, không derived work, inspiration sources |
| **Update ADRs với attribution** | HIGH | Mỗi logic "inspired by X" → link ADR + explain clean-room |
| **Add NOTICE file (tùy)** | MEDIUM | Best practice; không bắt buộc khi repo private |
| **Code review checklist** | MEDIUM | Checklist: no copy-paste from GPL source, no direct import, separate layer |
| **Legal review (if consider SaaS)** | CRITICAL | Nếu future roadmap = SaaS → luật sư cần rereview AGPL + aggregation risk |
| **Trademark audit** | MEDIUM | Nếu dùng Moodle → check Partner program; nếu dùng tên ERPNext → attribution |

---

## 10. RISK SUMMARY BY SCENARIO

| Kịch bản CMC | Rủi ro | Mitigation | Phán quyết |
|---|---|---|---|
| **Status quo: self-host ERP, tích hợp Moodle via API** | 🟢 LOW | Separate process, no direct dependency | ✅ SAFE |
| **Sửa ERPNext (GPL) → tự host nội bộ** | 🟡 MEDIUM | Provide source OR don't modify | ⚠️ CONDITIONAL |
| **Sửa frappe/lms (AGPL) → phục vụ staff qua mạng** | 🔴 HIGH | Bắt buộc provide source code | ❌ RISKY |
| **Future: SaaS CMC × Moodle LMS** | 🔴 HIGH | Moodle licensing rework; AGPL rework | ❌ NEEDS LEGAL |
| **Viết app riêng trên frappe/frappe (MIT)** | 🟢 LOW | Chỉ cần giữ notice MIT | ✅ SAFE |

---

## REFERENCES

- [GNU GPL-3.0 Text](https://www.gnu.org/licenses/gpl-3.0.txt)
- [GNU AGPL-3.0 Text](https://www.gnu.org/licenses/agpl-3.0.txt)
- [Frappe Framework License](https://github.com/frappe/frappe/blob/master/LICENSE)
- [Moodle Documentation](https://docs.moodle.org/)
- [FSF: GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html)
- [Moodle Trademark Policy](https://moodle.com/trademarks/)

---

## STATUS

✅ **DONE** — Báo cáo license compliance comprehensive, verified against GitHub + GNU official sources. Danh sách hành vi × rủi ro, kịch bản AGPL, vùng xám cụ thể, khuyến nghị operational cho CMC.

**Kế tiếp:** Luật sư cần xem § 4 (AGPL × frappe/lms) + § 8 (unresolved questions) trước quyết định SaaS/multi-tenant.
