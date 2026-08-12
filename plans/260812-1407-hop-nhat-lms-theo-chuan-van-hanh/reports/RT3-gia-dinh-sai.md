# RT3 — Đập gia đình Plan Đợt A (`phase-01-dot-a-kich-hoat-van-hanh-unit.md`)

**Đối tượng:** `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/phase-01-dot-a-kich-hoat-van-hanh-unit.md`  
**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Vai trò:** phản biện thù địch — chỉ chỗ SAI / THIẾU so code. Không khen plan.

---

## 0. Inventory API `lmsOps` (gia đình 1 — “API đủ chỉ thiếu màn”)

Nguồn: `apps/api/src/lms-ops/router.ts`.

| Procedure | Input (zod/shape) | Output (return) | Permission |
|-----------|-------------------|-----------------|------------|
| `addWithUnits` L206–309 | `{ enrollmentId: uuid, fromOrderGlobal: int>0, toOrderGlobal: int>0 }` | `{ id, enrollmentId, fromOrderGlobal, toOrderGlobal }` | `enrollment.grantUnits` |
| `grantPast` L409–482 | **cùng** `addWithUnitsInput` | `{ id, enrollmentId, fromOrderGlobal, toOrderGlobal }` | same |
| `revokeFromNext` L489–560 | `{ enrollmentId, fromOrderGlobal: int>0 }` | `{ enrollmentId, rangesTouched }` | same |
| `archiveEnrollment` L563–590 | `{ enrollmentId }` | `{ enrollmentId, archivedAt }` | same |
| `unarchiveEnrollment` L593–616 | `{ enrollmentId }` | `{ enrollmentId, archivedAt: null }` | same |
| `assignExerciseSequence` L623–652 | `{ classBatchId, exerciseIds: uuid[] 1..200 }` | `{ deliveredCount, items: {position, exerciseId}[] }` | `exercise.manage` |
| `listExerciseSequence` L655–667 | `{ classBatchId }` | `{ items: {position, exerciseId}[] }` | `exercise.manage` |

**Ràng buộc runtime quan trọng (plan che):**

| Rule | Code |
|------|------|
| `addWithUnits` / `grantPast` chỉ khi `status === 'active'` | L224–226, L430–432 |
| Cả hai chặn nếu `archivedAt` set | L227–229, L433–435 |
| `addWithUnits` cấm `from < class current unit` | L240–247 |
| `grantPast` cho phép past; **không** có procedure `preview` | L406–482 — chỉ mutation |
| `revokeFromNext` cấm `fromOrderGlobal < currentOrder` | L513–517 |
| `rosterForSession` **không** trả `unitRanges` | L370–374 chỉ `enrollmentId, studentId, fullName` |

### API đọc dải unit / unit còn lại — **KHÔNG CÓ**

| Nhu cầu UI plan A1 | Procedure sẵn? | Thực tế |
|--------------------|----------------|---------|
| “Xem dải unit hiện có của HS” | Plan nói “(đọc từ roster/enrollment)” L56 | **`rosterForSession` không trả ranges** L370–374. **`classBatch.listStudents` không trả ranges / archivedAt** L325–330 (`class-batch-router.ts`). **`enrollment.mine` không trả unitRanges** L156–163. |
| Số unit còn lại (`remainingUnits`) | — | Pure `@cmc/domain-lms` `remainingUnits` (`unit-progression.ts` L70) **không mount tRPC**. Cần `currentOrder` lớp: **`classBatch.get` DTO không có `currentUnitId`/`startUnitId`** (`class-batch-router.ts` L87–113). |
| Preview grantPast | Plan L53 “(+ preview)” | **Không procedure preview** — chỉ `grantPast` mutate. |
| “Thêm HS + chọn dải” một luồng | enroll + addWithUnits | `enrollment.enroll` → **reserved** only; `addWithUnits` **từ chối non-active** L224–226. Không staff API “active + range” ngoài `grantUnitsFromReceipt` (internal provision). |

**Kết luận gia đình 1:** **SAI.** Mutations write có; **thiếu read surface** cho màn vận hành; **thiếu preview**; **flow thêm HS+dải gãy** vì reserved≠active.

---

## 1. Bảng phát hiện

| ID | Mức | Phát hiện | Kịch bản hỏng cụ thể | Bằng chứng | Đề xuất sửa plan |
|----|-----|-----------|----------------------|-----------|------------------|
| RT3-01 | **HIGH** | Plan L47–56: “API đã có đủ, chưa có màn” — **thiếu API đọc dải unit + remaining** | GĐĐT mở chi tiết lớp → listStudents chỉ thấy tên/status → **không biết HS còn dải nào / còn mấy unit** → bấm grant mù hoặc phải query DB tay. | `listStudents` L325–330; `rosterForSession` L370–374; không `lmsOps.listUnitRanges` / `enrollment.listRanges` (grep API) | Thêm requirement procedure staff: list ranges theo classBatch/enrollment + remainingUnits (cần current unit neo). Bỏ câu “API đủ”. |
| RT3-02 | **HIGH** | “Thêm HS + chọn dải unit” (L52) **không ráp được** chỉ từ API hiện có | Sale/GĐĐT `enrollment.enroll` → reserved → `addWithUnits` ném “Enrollment must be active…” → **màn A1 không hoàn thành happy path** trừ khi đi full receipt approve (ERP) hoặc seed DB. | enroll reserved: `enrollment/router.ts` comment L4–5; addWithUnits L224–226 | Plan phải chốt: (a) chỉ grant trên enrollment đã active (sau phiếu), hoặc (b) procedure mới / path rõ — không giả vờ enroll+addWithUnits đủ. |
| RT3-03 | **MEDIUM** | `grantPast (+ preview)` (L53) — **preview không tồn tại** | UI “xem trước” phải tự đoán overlap/program/order → server mới báo lỗi sau submit → UX sai so plan. | `grantPast` L409–482 mutation only | Xóa “+ preview” hoặc thêm task API preview (read-only validate). |
| RT3-04 | **HIGH** | Archive/unarchive UI: **listStudents không trả `archivedAt`** | Gỡ HS (`archiveEnrollment`) → enrollment vẫn `status:'active'` + `archivedAt` set → listStudents vẫn hiện “active” (L314 `status in reserved\|active`) **không cờ gỡ** → không biết ai đã archive / nút unarchive mù. | listStudents L310–330; archive sets only `archivedAt` L575–578 | Mở rộng listStudents (hoặc listEnrollmentOps) trả `archivedAt` + `unitRanges`. |
| RT3-05 | **HIGH** | A2 “cảnh báo sắp hết unit ≤1” — **không có API expiring** trong cmc_edu | Plan L74–76 coi như chỉ “cần một chỗ” + ngưỡng 1; dev implement UI không có query → **phải viết API mới từ đầu** (cmc-lms có `enrollment.expiring`). | Grep: `remainingUnits` chỉ domain + test; cmc-lms `enrollment.ts` L796–867 `expiring:` | Đưa A2 vào “API mới + UI”, không “chỉ kích hoạt”. Spec input/output theo cmc-lms expiring. |
| RT3-06 | **MEDIUM** | A4 sequence UI: list chỉ `{position, exerciseId}` — **không title/PDF** | Màn xếp dãy chỉ thấy UUID → không usable trừ gọi thêm `exercise.get/list` (plan không ghi). | `listExerciseSequence` L665–666; SequenceItem position+exerciseId | Plan ghi join `exercise.list` / mở rộng DTO. |
| RT3-07 | **LOW–MEDIUM** | “Toàn đợt không migration” (L15, L115) — **đúng schema**, nhưng **sai framing workload** | Team tin zero-backend → ship UI gọi API thiếu → A1/A2 blocked mid-sprint. A0/backfill là **data** không migration — OK; A2/read APIs là **code API mới**. | Phase L15, L115; RT3-01/05 | Viết lại: “không migration Prisma”; “có thể cần procedure read/expiring mới”. |
| RT3-08 | **MEDIUM** | “Không phá e2e” (L15) + kiểm chứng #6 CI xanh sau A3 — **lạc quan / false green** | Hầu hết journey homework/grade **seed `seedSubmittedSubmission` / không gọi `openForStudent`**. `LMS_ENTITLEMENT_GATE` chỉ siết open-tier (`open-tier.ts` L84–87, L113+), **không** dual-gate attendance. CI workflow **không set** `LMS_ENTITLEMENT_GATE=1`. ⇒ Bật cờ prod có thể cắt HS; **ui-e2e vẫn xanh** vì không đo gate. | e2e: `grading-submission` L59–71 seed submission; `lms-stars-redeem` seed; không hit `openForStudent` (rg e2e). CI: `.github/workflows/ui-e2e.yml` không ENTITLEMENT. Attendance dual-gate riêng (`attendance/router.ts` assertDualGate) — e2e class thường unstamped → không dính. | Plan: (1) CI job set `LMS_ENTITLEMENT_GATE=1` + seed range cho fixture cần open homework; (2) test e2e tối thiểu openForStudent empty vs entitled; (3) đừng tuyên bố “không phá e2e” = “gate an toàn”. |
| RT3-09 | **MEDIUM** | Kiểm chứng #2–4 “cần integration test” — **đã có sẵn** trong `lms-ops.int.test.ts` | Plan làm như còn thiếu test backend → lãng phí; hoặc ngược lại: **không** có test **UI** / **API đọc mới**. | int: roster cover L88; grantPast L280; revoke L320; archive L410 | Phân tách: reuse int test; thêm test cho procedure **mới** (list ranges, expiring). |
| RT3-10 | **HIGH** | A3 bật `LMS_ENTITLEMENT_GATE=1` **giữ** `LMS_OPEN_TIER_ENABLED=1` (L82–85) | Gate chỉ intersect open-tier; HS **không dải** → open set empty (test open-tier L379–399). Nếu A0 backfill **lọt** enrollment active không range → HS mất bài **ngay**. Plan có A0 nhưng **không** có API/tool backfill product — chỉ `grantPast` thủ công. | open-tier L113+ entitlement; A0 L39 “backfill xong” | Plan A0 phải có runbook/script backfill + số còn lại = 0 trước A3; không chỉ “đếm”. |
| RT3-11 | **MEDIUM** | `classBatch.create` legacy vẫn seed e2e; dual-gate attendance | Không phải A trực tiếp, nhưng lớp e2e **không stamp unit** → sau A3 entitlement homework ≠ attendance dual-gate. Ops tạo lớp bằng API cũ → stamp null → roster fail-closed. A0 đếm null stamp — tốt; plan A **không chặn** create legacy. | BR5/classBatch.create; dual-gate khi `curriculumUnitId` set | A non-goal hoặc task: deprecate UI/API path create không unit (ít nhất doc risk). |
| RT3-12 | **LOW** | SoD `grantUnits` không sale — plan L69 đúng | — | `packages/auth` grantUnits chỉ giam_doc_dao_tao | Không issue |

---

## 2. Trả lời 5 gia đình (tóm tắt đập)

### (1) “API đủ, chỉ thiếu màn”
**SAI.**  
- Write mutations: có (bảng §0).  
- **Thiếu:** list ranges, remainingUnits staff, archive flag on list, grant preview, flow active enroll+range.  
- `roster`/`listStudents`/`enrollment.mine` **không** đủ “hiển thị dải + unit còn lại”.

### (2) “Cảnh báo sắp hết unit chỉ ngưỡng ≤1”
**SAI một nửa.** Ngưỡng domain `remainingUnits` có (`unit-progression.ts` L70 + test ≤1).  
**API `expiring` / list sắp hết: KHÔNG có trong cmc_edu** — phải **viết mới** (cmc-lms có `enrollment.expiring` L796+).

### (3) “Không migration”
**ĐÚNG về Prisma schema** cho A1–A4 nếu chỉ UI+env+procedure app-level.  
**SAI nếu hiểu “zero backend change”** — A2 + read APIs = code API mới. Data backfill A0 = UPDATE/INSERT ranges, không migration file.

### (4) “Không phá e2e”
**CHƯA CHỨNG MINH / LẠC QUAN.**  
- Journey bài tập/HS hiện tại: seed submission, **không** `openForStudent`.  
- Bật `LMS_ENTITLEMENT_GATE` **có thể không làm đỏ** e2e hiện tại → **false green**, không chứng minh an toàn production.  
- CI không set cờ → kiểm chứng #6 không cover A3.

### (5) Gia đình khác phase-01
- “Thêm HS + dải” vs reserved/active — **gãy**.  
- Preview grantPast — **hư cấu**.  
- listStudents vs archive — **UI không làm được đúng**.  
- Integration tests #2–4 — **đã có**, plan nhầm “còn thiếu”.  
- A0 backfill không tool — **rủi ro A3**.

---

## 3. Unknowns

1. DB production (1) active không range — chưa chạy A0 (plan bắt buộc nhưng RT không có DB).  
2. Deploy có set `LMS_ENTITLEMENT_GATE` ngoài CI không.  
3. Có procedure staff list enrollment ngoài grep pattern không (đã quét unitRanges public procedures — không thấy).

---

Status: DONE | Summary: Đợt A overclaim “API đủ + zero risk e2e”: thiếu read/expiring/preview/active-grant flow; bật entitlement dễ false-green e2e và cắt HS nếu A0 backfill không đủ tool.
