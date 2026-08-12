# V3 — Tính khả thi nhập khung chương trình CSV → cmc_edu.CurriculumUnit

**Chỉ đọc.** Không sửa code/plan.  
**CSV:** `/home/manhquy/Downloads/cmc-lms/docs/CMC_EDU_Khung_Chuong_Trinh.csv`  
**Đích:** `/home/manhquy/Downloads/cmc_edu` model `CurriculumUnit`  
**Seeder chuẩn:** `/home/manhquy/Downloads/cmc-lms/packages/db/src/seed-curriculum.ts`  
**Ngày:** 2026-08-12

---

## Kết luận

### **KHẢ THI CÓ ĐIỀU KIỆN**

**Lý do ngắn:** File CSV + luật seeder `cmc-lms` đủ để suy ra **96 unit** (không phải 239/240 dòng thô) với `orderGlobal` **liền mạch theo program sau nén**. Enum `Program` / `UnitType` khớp.  
**Nhưng** schema `cmc_edu.CurriculumUnit` **không** 1-1 với CSV/`cmc-lms`: thiếu `unitCode`, thiếu `CurriculumLesson`, `level` kiểu **Int** trong khi CSV là **chuỗi**, bắt buộc `monthIndex` + `title` mà CSV không có cột tương ứng. Import **không** thể “load CSV vào bảng” không transform; phải có bảng ánh xạ tường minh + chấp nhận **mất** nội dung topic/bài học (hoặc mở rộng schema sau).  
**Không** xếp **KHÔNG KHẢ THI** vì mọi field bắt buộc của edu **có thể suy ra** bằng quy tắc (không cần migration bắt buộc để “có 96 hàng chạy dual-gate”).  
**Không** xếp **KHẢ THI** tuyệt đối vì bẫy identity/order/level + va chạm catalog placeholder 1–4.

---

## 1. CSV — cột, kiểu, giá trị đặc biệt

**File:** UTF-8 CSV, **240 dòng dữ liệu + 1 header** (`wc -l` = 240 dòng + newline cuối; user ghi ~239 ≈ cùng file).  
**Parser:** phải hỗ trợ field trong `"..."` (dấu phẩy trong `bai_hoc` / `tu_duy_...`) — seeder `cmc-lms` tự viết `parseCsv` (`seed-curriculum.ts:34-71`).

| # | Cột | Kiểu thực tế (toàn file) | Empty | Ghi chú / giá trị đặc biệt |
|---|-----|--------------------------|-------|----------------------------|
| 1 | `unit_code` | string | 0/240 | **96 mã unique**; 60 mã lặp vì multi-topic. Có mã `+` review: `U2.5+`, `U1.10+`, `U3.5+`, `U3.10+`, `U4.5+`, `U4.10+` |
| 2 | `program` | string | 0/240 | **Không** phải enum raw: `UCREA` (36), `Bright I.G` (36), `Black Hole` (168) |
| 3 | `do_tuoi` | string | 0/240 | 3 giá trị tuổi/đối tượng; seeder lms → `Course.description` |
| 4 | `level` | string | 0/240 | **Không phải Int:** `U2,U3,U4` / `J,T,C,W,Q,U` / `G,R,B,P` |
| 5 | `sub_level` | string | 36/240 | UCREA toàn rỗng; Bright/BH có `J-1`, `G1`… |
| 6 | `unit_type` | enum-like | 0/240 | `LESSON` (234), `REVIEW` (6 — chỉ UCREA `*+`) |
| 7 | `assessment` | string | 215/240 | `""` / `Thi giữa kỳ` / `Thi cuối kỳ` — có thể nằm **topic cuối** unit (Bright/BH), không chỉ dòng đầu |
| 8 | `sessions` | int-as-string | 0/240 | **luôn `4`** |
| 9 | `duration_month` | int-as-string | 0/240 | **luôn `1`** — seeder lms **không** ghi vào unit |
| 10 | `thoi_luong_buoi_phut` | int-as-string | 0/240 | UCREA `90`; Bright+BH `110` (doc class-unit-spec từng ghi 110') |
| 11 | `order_global` | int-as-string | 0/240 | 96 giá trị unique **sau gom unit**; dòng thô **trùng** order khi multi-topic |
| 12 | `topic_no` | int-as-string | 0/240 | 1..4 — thứ tự topic **trong unit** |
| 13 | `chu_de` | string | 0/240 | Chủ đề topic → theme unit (join) |
| 14 | `bai_hoc` | string | 0/240 | Nội dung lesson |
| 15 | `tu_duy_khai_niem_dat_duoc` | string | 0/240 | thinking goal |
| 16 | `ghi_chu` | string | 210/240 | Play Kit / ghi chú |

**Cấu trúc logic:** 1 dòng CSV = **1 topic** (`CurriculumLesson` bên lms). Nhiều dòng cùng `unit_code` = **1 unit** (Bright 2 topic/unit; Black Hole tới 4).

---

## 2. Cách `cmc-lms` nhập CSV (`packages/db/src/seed-curriculum.ts`)

| Bước | Luật | Dòng |
|------|------|------|
| Đọc CSV | `readCurriculumCsv`, strip BOM, trim | `:73-84` |
| Map program | `PROGRAM_BY_CSV`: `UCREA`→`UCREA`, **`Bright I.G`→`BRIGHT_IG`**, **`Black Hole`→`BLACK_HOLE`**; lạ → throw | `:10-14`, `:209-211` |
| Nén `order_global` | `compactOrderGlobal` **theo từng program**: sort unique order, map `base + i` — **lấp lỗ**, giữ mốc đầu | `:86-102`, `:217-228` |
| Cổng ổn định | `assertOrderGlobalStable`: nếu unitCode đổi order mà đã có `EnrollmentUnitRange` → **throw** (trừ `LMS_ALLOW_ORDER_SHIFT=true`) | `:175-202`, `:230-234` |
| Course | upsert `Course` theo `program` unique; name=CSV program string; description=`do_tuoi` | `:238-242` |
| Gom unit | `Map<unit_code, rows[]>` giữ thứ tự CSV | `:244-250` |
| Transaction | Đảo `order_global` → **âm** trước ghi (tránh unique mid-update) | `:256-265` |
| Unit fields | `level` **string**, `subLevel`, `seqInLevel` đếm theo level, `orderGlobal` đã nén, `unitType` REVIEW/LESSON, `assessment` = **first non-empty trong mọi topic**, `theme` = join `chu_de`, `sessions`, `sessionMinutes` | `:270-295` |
| Lesson | mỗi topic → `CurriculumLesson`, `lessonCode = unitCode#topic_no` | `:297-315` |
| Prune | unit không còn CSV → xóa nếu không bám session/batch/range | `:120-163`, `:318-320` |
| Idempotent | upsert `unitCode` / `lessonCode` | `:291-314` |

**Không** map `duration_month` vào DB unit.  
**Không** tin `order_global` thô khi có lỗ (Bright: 40,44,48,52,56 thiếu sau khi bỏ unit ôn).

---

## 3. So sánh model `CurriculumUnit`

### 3.1 `cmc-lms` (`packages/db/prisma/schema.prisma:201-224`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| id | Uuid | yes | |
| courseId | Uuid FK Course | yes | Course 1-1 program |
| unitCode | String unique | yes | **Khóa nghiệp vụ CSV** |
| level | **String** | yes | `U2`, `J`… |
| subLevel | String? | no | |
| seqInLevel | Int | yes | seeder đếm |
| orderGlobal | Int | yes | unique với courseId |
| unitType | UnitType | yes | LESSON/REVIEW |
| assessment | String? | no | |
| theme | String | yes | join chủ đề |
| sessions | Int | yes | =4 |
| sessionMinutes | Int | yes | 90/110 |
| createdAt | DateTime | yes | |
| + relations | lessons, sessions, batches | | **CurriculumLesson** riêng |

### 3.2 `cmc_edu` (`packages/db/prisma/schema.prisma:792-812`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| id | uuid | yes | |
| program | Program enum | yes | **Trực tiếp**, không qua Course.units |
| level | **Int** | yes | Khác hẳn CSV/lms string |
| monthIndex | **Int** | yes | **Không có** trong CSV / lms unit |
| unitType | UnitType | yes | LESSON/REVIEW — khớp |
| title | String | yes | **Không** cột CSV 1-1 |
| orderGlobal | Int | yes | `@@unique([program, orderGlobal])` |
| createdAt | DateTime | yes | |
| + relations | classSessions, exercises, batches | | **Không** CurriculumLesson |

`Course` bên edu: facility-scoped shell (`schema:618-628`), **không** sở hữu units. Khớp ADR 0045: trục unit = `Program` + `orderGlobal`.

### 3.3 Field lms có — edu không

`courseId`, `unitCode`, `subLevel`, `seqInLevel`, `assessment`, `theme`, `sessions`, `sessionMinutes`, bảng `CurriculumLesson` (content/thinkingGoal/note/topic).

### 3.4 Field edu có — lms không (trên unit)

`program` (trực tiếp), `monthIndex` (Int), `title`, `level` **Int**.

### 3.5 Field **bắt buộc edu** mà CSV **không** cung cấp đúng kiểu

| Field edu | CSV? | Cần gì |
|-----------|------|--------|
| `level` Int | có `level` **string** | Bảng map tường minh (vd U2→2, J→1…) hoặc hash/ordinal — **không có map chuẩn trong edu** |
| `monthIndex` Int | không (chỉ `duration_month=1` vô dụng) | Suy `seqInLevel` như seeder lms, hoặc = `orderGlobal` local 1..N (test harness đang làm tương tự) |
| `title` String | không cột title | Join `chu_de` theo unit; hoặc `unit_code + chu_de` |
| `program` enum | có string display | Map `PROGRAM_BY_CSV` |
| `unitType` | có | `REVIEW` iff `unit_type==REVIEW` |
| `orderGlobal` | có nhưng multi-row + gaps | **Gom unit_code + compactOrderGlobal** |

`unit_code` **không** lưu được nếu không thêm cột — mất khóa idempotent chuẩn lms; chỉ còn `(program, orderGlobal)`.

---

## 4. `orderGlobal` — kiểm tra dữ liệu thật

### 4.1 Theo **dòng CSV thô**

| Program | Dòng | unit unique | order raw | Lỗ trong min–max | Trùng order (multi-topic) |
|---------|------|-------------|-----------|------------------|---------------------------|
| UCREA | 36 | 36 | 1..36 | **không** | không |
| Bright I.G | 36 | 18 | 37..59 | **40,44,48,52,56** | có (2 dòng/unit) |
| Black Hole | 168 | 42 | 61..102 | không trong min–max | có (4 dòng/unit) |

- Toàn file: 96 `order_global` distinct trên 240 dòng.  
- **Không** share `order_global` giữa 2 program (0 cross).  
- **Không** “1 dòng = 1 unit”: 240 ≠ 96.

### 4.2 Sau luật seeder (gom `unit_code` + `compactOrderGlobal`)

| Program enum | Số unit | order sau nén | Liền mạch? |
|--------------|---------|---------------|------------|
| UCREA | 36 | **1..36** | có |
| BRIGHT_IG | 18 | **37..54** (lấp 5 lỗ) | có |
| BLACK_HOLE | 42 | **61..102** | có |

⇒ **Theo từng program, sau transform: continuous & unique.**  
⇒ **Raw CSV: Bright không continuous; multi-topic làm order không unique theo dòng.**

**Lệch ADR 0046 edu** (`docs/decisions/0046-order-global-stability.md:18`): spike gợi ý 1..N **per program**. Seeder lms **giữ offset** 37 / 61 (dãy xuyên 3 CT). Cả hai hợp lệ với `@@unique([program, orderGlobal])`, nhưng **import edu nên chốt 1 convention** (giữ số CSV-sau-nén **hoặc** renumber 1..N) — renumber phá khớp migrate sau từ lms live.

---

## 5. Tên program CSV ↔ enum `cmc_edu`

`cmc_edu` enum (`schema.prisma:124-128`):

```
UCREA | BRIGHT_IG | BLACK_HOLE
```

| CSV `program` | Enum | Map seeder lms |
|---------------|------|----------------|
| `UCREA` | `UCREA` | identity |
| `Bright I.G` | `BRIGHT_IG` | **bắt buộc** (khoảng trắng + dấu chấm) |
| `Black Hole` | `BLACK_HOLE` | **bắt buộc** (khoảng trắng) |

Ghi thẳng CSV string vào enum Prisma → **fail**.  
`do_tuoi` không vào `CurriculumUnit` edu (lms → Course.description).

---

## 6. Các bẫy khác

| ID | Bẫy | Hậu quả nếu bỏ qua |
|----|-----|-------------------|
| T1 | Coi 240 dòng = 240 unit | Phình catalog; phá “1 unit = 4 buổi”; multi-topic thành unit rác |
| T2 | Không `compactOrderGlobal` Bright | `stamp-sessions` / generator cần dãy liền — lỗ 40,44… | 
| T3 | Ghi `level` string vào `level` Int | Insert/type error |
| T4 | Không suy `title` / `monthIndex` | NOT NULL violation |
| T5 | Mất `unitCode` | Không đối soát CSV↔DB; re-import không idempotent theo mã U2.1 |
| T6 | Mất `CurriculumLesson` / assessment / sessionMinutes | UI/ops không thấy topic, Play Kit, thời lượng; **không** chặn dual-gate nếu chỉ cần order axis |
| T7 | `assessment` chỉ đọc dòng đầu unit | Bright/BH: kỳ thi ở topic cuối → nuốt assessment (seeder lms đã vá `:283-286`) |
| T8 | Catalog edu đã có UCREA 1–4 placeholder (`scripts/ensure-curriculum-units.ts`) | Upsert `(program,orderGlobal)` **đè title** hoặc skip → lệch “Bài 1: Làm quen” vs “Bạn bè” (U2.1). Nếu đã **bán range** 1–4 theo placeholder, **đổi nghĩa order = đổi quyền** (ADR 0046 / assertOrderGlobalStable) |
| T9 | Test/int seed `orderGlobal` 101, 201, 301… trên UCREA | Import full 1–36 **không** đụng 101+; nhưng max-based auto seed sau import có thể dính — môi trường test |
| T10 | Renumber Bright/Black về 1..N “cho đẹp” | Lệch số với lms + journal migrate; import sau từ live lms lệch range |
| T11 | Import không transaction / không đảo order tạm | Unique `(program,orderGlobal)` đụng giữa chừng khi đổi số |
| T12 | `Course` facility edu ≠ Course global lms | Không tạo 1 Course/program global; unit gắn `program` — OK nhưng UI “khóa học” facility vẫn rỗng units quan hệ |
| T13 | Exercise edu `@@unique(curriculumUnitId, type)` bám unit | Sau import, mỗi unit có thể 1 homework — khác thư viện folder lms; không chặn import unit |
| T14 | Dot A plan gốc **không** liệt kê bước import CSV (phase-01 A0–A4) | Scope “A cần import khung” là **ngoài** phase-01 đã viết — cần chèn bước + cổng đo riêng |

---

## 7. Ma trận “có làm được không” theo lớp

| Lớp mục tiêu | Kết quả |
|--------------|---------|
| Có **96 hàng** `CurriculumUnit` đủ `program`+`orderGlobal` liền mạch để dual-gate / stamp / grant | **Làm được** với transform (điều kiện) |
| Giữ nguyên fidelity CSV (topic, unit_code, phút/buổi, assessment) trong edu schema **hiện tại** | **Không** — thiếu cột/bảng |
| Copy nguyên `seed-curriculum.ts` sang edu | **Không** — schema Course/Unit/Lesson khác |
| Chạy mù không map program/level/title | **Không** |

---

## 8. Điều kiện tối thiểu nếu tiến hành

1. **Transform pipeline** (port logic, không port schema): parse CSV → map program → group `unit_code` → `compactOrderGlobal` → build 96 rows.  
2. **Chốt map `level` string→Int** và quy tắc `monthIndex` + `title` (ghi vào plan/ADR).  
3. **Chốt dải order:** giữ 1..36 / 37..54 / 61..102 **hoặc** 1..N từng program — khuyến nghị **giữ số sau compact của lms** để sau merge data.  
4. **Cổng trước import:** đếm `EnrollmentUnitRange`, so order hiện có UCREA 1–4; cấm silent shift (mirror `assertOrderGlobalStable`).  
5. **Idempotent key:** `(program, orderGlobal)` + optionally lưu `unit_code` vào `title` prefix hoặc migration thêm cột sau.  
6. Chấp nhận **mất** lesson-level content **hoặc** phase schema `CurriculumLesson` / thêm cột — ngoài “chỉ nhét CurriculumUnit”.

---

## 9. Verdict

| | |
|--|--|
| **Xếp hạng** | **KHẢ THI CÓ ĐIỀU KIỆN** |
| **Vì sao không “KHẢ THI”** | Schema edu ≠ CSV; 3 field bắt buộc cần bịa/ánh xạ; multi-row + gap Bright; mất unitCode/lesson |
| **Vì sao không “KHÔNG KHẢ THI”** | Trục entitlement chỉ cần `(program, orderGlobal, unitType, …)`; 96 unit suy được từ CSV bằng đúng luật seeder lms; enum khớp sau map tên |
| **Rủi ro cao nhất** | Import đè/đổi nghĩa order đã bán + quên compact Bright + quên multi-topic |

---

## Unknowns

- Prod/staging `cmc_edu` hiện có bao nhiêu `CurriculumUnit` / range đã bán (ngoài ensure 1–4 local-sim).  
- Owner muốn **giữ offset 37/61** hay **1..N per program**.  
- Có plan thêm `unitCode` / `CurriculumLesson` vào edu trong B/E không — chưa thấy trong phase-01 A.  
- `thoi_luong_buoi_phut` 110 vs class-unit-spec từng ghi 110' — chỉ metadata nếu edu không có cột `sessionMinutes`.

---

Status: DONE | Summary: Import CSV→cmc_edu CurriculumUnit là KHẢ THI CÓ ĐIỀU KIỆN — 96 unit sau gom+nén order, nhưng bắt buộc transform (program/level/title/monthIndex), không 1-1 schema, và có bẫy order/placeholder/multi-topic.
