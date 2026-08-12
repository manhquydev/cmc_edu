# DOC-C — Sửa TL10 + docs/README cho khớp code (2026-08-12)

**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Owner (only):** `docs/10-data-model-v2.md`, `docs/README.md`  
**Skill:** `/ak:docs` (update / reconcile with evidence)  
**Code / commit:** không sửa code, không commit  

Nguồn sự thật: `BRIEF-DOCS.md`, schema + migration `20260812120000_curriculum_level_text_drop_session_makeup`, open-tier Tier A only, CSV 96 unit.

---

## 1. `docs/10-data-model-v2.md`

### 1.1 §2 Từ điển Học tập — `CurriculumUnit` / `ClassSession` (bảng “Học tập”)

| Trước | Sau |
|-------|-----|
| `CurriculumUnit` chỉ “đơn vị CT” — không nêu `level` kiểu gì, không nêu quy mô catalog | Ghi **`level` = chuỗi mã cấp** (`U2`/`J`/`G`…), **không** số thứ tự; catalog **96 unit** (36/18/42); ghi chú ngày **2026-08-12** |
| `ClassSession` không nêu trạng thái buổi bù | Ghi `done`/`doneAt`; **không** còn `isMakeup` / `makeupForSessionId` (gỡ 2026-08-12) |

**Dòng (sau sửa):** khối bảng “### Học tập” — hai hàng `CurriculumUnit` / `ClassSession`.

### 1.2 §3 V11 — `makeupForSessionId` (yêu cầu chính)

| Trước | Sau |
|-------|-----|
| V11 liệt kê thêm `makeupForSessionId` như thay đổi mô hình còn hiệu lực | Giữ `Receipt.approvedAt` + `done`/`doneAt` là hiện trạng; **lịch sử** buổi bù: từng có `makeupForSessionId`/`isMakeup`, **gỡ 2026-08-12** (migration `20260812120000_…`), sweep chỉ hủy, lý do ngắn (lệch 4 buổi/unit) |

**Không xoá trắng** dấu vết buổi bù — đúng nguyên tắc BRIEF-DOCS.

### 1.3 §3 V13 (mới)

Thêm hàng **V13**: catalog 96 unit CSV; `level` Int→String; gap-aware `order_global` (Bright lỗ 40/44/48/52/56); nguồn migration + `@cmc/domain-lms`.

### 1.4 §5 Seed

| Trước | Sau |
|-------|-----|
| “Seed: curriculum UCREA/Bright I.G. theo `seed-curriculum` đã có” (gợi ý gói nháp cũ) | Catalog **96 unit** từ CSV thật; `level` chuỗi; ngày **2026-08-12** |

### 1.5 Sweep còn lại trong file 10

| Tìm | Kết quả |
|-----|---------|
| `isMakeup` / buổi bù ngoài V11 | Không — chỉ còn trong ghi chú lịch sử V11 + hàng ClassSession đã sửa |
| `CurriculumUnit.level` là số nguyên | Không từng ghi rõ “Int”; đã **chốt chuỗi** ở §2 + V13 |
| ERD mermaid ClassSession | Chỉ quan hệ batch/attendance — không field makeup — **không đổi** |

---

## 2. `docs/README.md`

### 2.1 Bảng ADR §3 — **0038** (yêu cầu chính, ~dòng 94)

| Trước | Sau |
|-------|-----|
| “Tier A cả lớp / **Tier B buổi bù riêng HS**” | **Chỉ Tier A** (unit mở cả lớp khi buổi dạy kết thúc ICT); ghi chú **2026-08-12**: Tier B + buổi bù đã gỡ |

### 2.2 Sweep “khung chương trình chỉ vài unit mẫu”

| Tìm | Kết quả |
|-----|---------|
| README nói curriculum chỉ seed vài unit / 4 unit nháp | **Không có** câu đó trong README |
| “mẫu” | Chỉ “WF-P1-03 mẫu”, “mẫu execution plan” — **template**, không phải catalog unit — **không sửa** (tránh nhiễu) |

Không thêm đoạn curriculum 96 unit vào README (ngoài phạm vi bảng ADR) trừ khi BRIEF bắt buộc; catalog đã chốt ở TL10. Report ghi: README không có claim “vài unit mẫu” cần vá.

---

## 3. File khác lệch (ngoài ownership — không sửa)

Ghi nhận cho agent/docs tiếp theo (không đụng trong task này):

- `docs/decisions/` ADR 0038 body (Tier B lịch sử — BRIEF: ADR **đánh dấu gỡ**, không rewrite)
- `docs/19-…`, `docs/26-…`, open-tier narrative nếu còn Tier B / makeup
- `docs/system-architecture.md`, plans/reports cũ

---

## 4. Danh sách chỗ đã sửa (số dòng gần đúng sau edit)

| File | Vị trí | Việc |
|------|--------|------|
| `docs/10-data-model-v2.md` | §2 Học tập ~L62–63 | CurriculumUnit level string + 96 unit; ClassSession no makeup |
| `docs/10-data-model-v2.md` | §3 V11 ~L91 | Bỏ makeup khỏi “còn hiệu lực”; thêm lịch sử gỡ 2026-08-12 |
| `docs/10-data-model-v2.md` | §3 V13 mới ~L93 | Catalog + level text + gap-aware |
| `docs/10-data-model-v2.md` | §5 Seed ~L116 | CSV 96 unit / level chuỗi |
| `docs/README.md` | §3 ADR **0038** ~L94 | Chỉ Tier A; note Tier B gỡ 2026-08-12 |

---

**Status: DONE**
