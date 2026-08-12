# BR5 — Nghiệp vụ LMS CŨ trong cmc_edu sẽ XUNG ĐỘT / PHẢI GỠ khi áp chuẩn cmc-lms

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Chuẩn so sánh:** `/home/manhquy/Downloads/cmc-lms` (code + `docs/class-unit-spec.md`, schema)  
**Phạm vi đếm:** `apps/` + `packages/` (loại `node_modules`, `dist`).  
**Grep ngày:** 2026-08-12. Chỉ đọc. Không đề xuất giải pháp triển khai.

**Nhãn xung đột với chuẩn mới (dạy-học):**
- `XUNG ĐỘT` = luật edu cũ mâu thuẫn trực tiếp chuẩn cmc-lms  
- `SEAM ERP` = gắn tiền/ghi danh ERP; không gỡ mù (cmc-lms coi ERP là TẠM)  
- `THỪA / SONG SONG` = hai đường cùng tồn tại, một đường là chuẩn mới

---

## Chuẩn cmc-lms (neo so sánh — bằng chứng)

| Luật chuẩn mới | Bằng chứng cmc-lms |
|----------------|-------------------|
| **Không buổi bù** — chỉ lịch tuần + hủy; HS nghỉ xử ngoài hệ; hủy lùi unit | `docs/class-unit-spec.md` ~L138–144; plan `260728-0034` “ClassSession KHÔNG có isMakeup” |
| Homework theo **SessionExercise delivery** (1 phát/buổi) | `apps/api/src/services/exercise-delivery.ts`; submission `@@unique([sessionExerciseId, studentId])` schema L701–714 |
| Session LMS **`kind: 'family'`** (SĐT+mật khẩu, multi-child) — không mint parent vs student tách | `apps/api/src/auth/sessions.ts` L31–38, L98–102 |
| `StudentLifecycle` **6 giá trị** | schema L38–45: `admitted, active, on_hold, transferred, withdrawn, completed` |
| BLOCKED LMS = `on_hold\|withdrawn\|transferred` (`completed` không chặn) | `sessions.ts` L17–22 |
| Ghi danh unit-range (dạy-học), không “reserved seat” teaching | class-unit-spec “Thêm học sinh → dãy unit” |

---

## 1. `classSession.addMakeup` + toàn bộ đường học bù

| Trường | Nội dung |
|--------|----------|
| **Đang làm gì** | Tạo `ClassSession` ad-hoc `isMakeup=true` ngoài lịch tuần (`class-session-router.ts` L361–406). UI “Thêm buổi bù” (`class-detail.tsx` L264–489). Schema `isMakeup`, `makeupForSessionId` (`schema.prisma` L743–773). Open-tier **Tier B**: makeup present/late mở unit cho 1 HS (`open-tier.ts` L146–170). Auto-makeup sweep **đã cắt** (`session-done-sweep.ts` L5–7, L52–54, L88 — always null). |
| **Xung đột chuẩn mới** | cmc-lms: **KHÔNG có buổi bù**; hủy buổi = lùi progression. Giữ makeup = hai mô hình “nợ buổi” song song. |
| **Gỡ thì vỡ gì (call site)** | **20 files** (grep `addMakeup\|isMakeup\|makeupForSession\|makeupSession`). Core: `class-session-router.ts`, `class-detail.tsx`, `open-tier.ts` Tier B, `schedule-fc-events.ts` (badge), `session-detail.tsx` label, `schema.prisma` + 2 migrations, e2e seeds. |
| **Tests phụ thuộc** | **9 test files**: `class-detail.test.tsx`, `gate.test.ts` (addMakeup L445+), `open-tier.test.ts` (Tier B makeup), `schedule*.test.*`, `session-detail.test.tsx`, `session-done-sweep.test.ts`, e2e `attendance*.spec.ts`. |
| **Rủi ro gỡ** | **CAO** — UI live + API live + Tier B open-tier; data rows `isMakeup=true` có thể tồn tại. Sweep đã no-makeup nên nửa chừng. |

---

## 2. Hai đường mở bài tập: open-tier ADR 0038 vs SessionExercise delivery

### 2a. Open-tier (ADR 0038) — **nghiệp vụ cũ / default**

| Trường | Nội dung |
|--------|----------|
| **Đang làm gì** | Mở `Exercise` theo Tier A (session non-makeup đã end) + Tier B (makeup present). Kill-switch `LMS_OPEN_TIER_ENABLED` default **`'1'` ON** (`open-tier.ts` L79–81). Dual-gate phụ `LMS_ENTITLEMENT_GATE` default **`'0'` OFF** (L85–87). Gate nộp: `assertExerciseOpenForStudent` trong `submission/router.ts` L241, L291. UI HS: `student/home.tsx`, `student/exercise.tsx` gọi `openForStudent`. |
| **Xung đột** | cmc-lms mở bài qua **delivery/roster D1**, không Tier A/B teaching-progress catalog. Default ON = production đang chạy mô hình cũ. |
| **Files** | **13 files** pattern open-tier/env (core: `open-tier.ts`, `submission/router.ts`, `student/home.tsx`, `student/exercise.tsx`, gifts import `loadLmsStudent`, e2e). Mount: `router.ts` merge open-tier (không match mọi pattern env). |
| **Tests** | **5 files**: `open-tier.test.ts` (chính), `exercise-delivery.int.test.ts` (OFF path), 3 e2e. |
| **Rủi ro gỡ open-tier** | **RẤT CAO** — default path homework + submit gate + e2e; cần thay bằng delivery trước khi tắt. |

### 2b. SessionExercise delivery — **đã port một phần chuẩn mới**

| Trường | Nội dung |
|--------|----------|
| **Đang làm gì** | `ClassExerciseItem` + `SessionExercise`; `deliverForSession` / `deliverDueExercises` (`exercise-delivery.ts` L120, L226); worker L131–132; `lmsOps.assignExerciseSequence` / `deliverSessionExercise`; khi open-tier OFF → `deliveredExerciseIdsForStudent` (`open-tier.ts` L100–110). |
| **Xung đột / trạng thái** | **THỪA SONG SONG**: delivery = hướng chuẩn mới nhưng **không phải default**; submission vẫn key theo `exerciseId` không `sessionExerciseId` (mục 7). |
| **Files** | **10 files** (delivery pattern). |
| **Tests** | **1 file** `exercise-delivery.int.test.ts` (+ domain `packages/domain-lms/src/exercise-sequence.test.ts` — pure math). |
| **Rủi ro gỡ delivery** | **TRUNG BÌNH** nếu quay lại pure open-tier; **CAO** nếu đang bật flag OFF trên môi trường nào đó (UNKNOWN runtime). **Không gỡ** nếu áp chuẩn mới — giữ/mở rộng. |

### Env (2 biến)

| Biến | Default code | Ý nghĩa khi merge |
|------|--------------|-------------------|
| `LMS_OPEN_TIER_ENABLED` | `'1'` ON | Tắt = chỉ delivery; bật = ADR 0038 |
| `LMS_ENTITLEMENT_GATE` | `'0'` OFF | Chỉ khi open-tier ON: intersect range |

---

## 3. Hai đường đăng nhập LMS + kind parent/student

| Trường | Nội dung |
|--------|----------|
| **Đang làm gì** | **PH:** OTP phone/email → token `kind:'parent'` (`lms-auth/router.ts` requestOtp/verifyOtp/requestOtpEmail/verifyOtpEmail). **HS:** `loginStudent` password → `kind:'student'` (L524+). Bảng `LoginOtp` (`schema.prisma` L1036). `StudentAccount` password/lockout (L473–497). Token claims `kind: 'parent'\|'student'` (`session-token.ts` L19–22). `requireLmsParent` / `requireLmsStudent` (`trpc.ts` L298, L317). UI: `kind-guard.tsx` ParentOnly/StudentOnly; routes `/parent/*` vs `/student/*` (`routes/index.tsx` L47–80). Login page hai mode (`pages/login.tsx`). |
| **Xung đột chuẩn mới** | cmc-lms: **`kind: 'family'`**, phone+password, multi-child một session (`sessions.ts` L31–38). Không tách route parent vs student mint. |
| **Files** | **67 files** (pattern login/OTP/kind/requireLms/signLmsToken). Bao gồm toàn `apps/lms` family pages, e2e journey LMS, provisioning StudentAccount. |
| **Tests** | **25 test/spec files** (login, session-token, kind-isolation, list-for-child parent-only, e2e lms-auth/login/journeys…). |
| **Rủi ro gỡ** | **RẤT CAO / HỆ THỐNG** — xóa two-tier = rewrite auth + toàn bộ LMS SPA + e2e acceptance journeys. `StudentAccount` có thể còn cho mật khẩu con, nhưng **kind student + route tree + OTP-primary PH** là lớp xung đột. |

---

## 4. `classBatch.create` cũ song song `lmsOps.createClassWithUnits`

| Trường | Nội dung |
|--------|----------|
| **Đang làm gì** | **Cũ:** `classBatch.create` — tạo lớp + generate sessions, **không** bắt buộc unit neo/stamp (`class-batch-router.ts` L145+; `generate-sessions.ts`). **Mới:** `lmsOps.createClassWithUnits` — startUnit + stamp (`lms-ops/router.ts` L85). **UI admin** đã chuyển sang mới (`classes/index.tsx` L260). E2e/tests vẫn seed bằng **cũ**. |
| **Xung đột** | Lớp không unit-stamp → dual-gate roster fail-closed / open-tier lệch unit. Hai API cùng “tạo lớp”. |
| **Files create cũ** | **27 files** match `classBatch.create` (nhiều e2e + `generate-sessions.test.ts`). |
| **Tests create cũ** | **15 files**. |
| **Files create mới** | **4 files**; **tests 2**. |
| **Rủi ro gỡ create cũ** | **TRUNG BÌNH–CAO** — UI product ít phụ thuộc; **suite e2e/unit vỡ hàng loạt** nếu xóa trước khi migrate seed helper. |

---

## 5. `enrollment.enroll` reserved vs `addWithUnits`

| Trường | Nội dung |
|--------|----------|
| **Đang làm gì** | **Cũ ERP:** `enrollment.enroll` → status `reserved` only; active qua receipt (`enrollment/router.ts` L4–5, L41; `activateEnrollmentForReceipt`). UI xếp lớp `class-placement.tsx` L72. **Mới teaching:** `lmsOps.addWithUnits` / grantPast gắn `EnrollmentUnitRange` (GĐĐT only). Roster teaching cần active **+** range cover. |
| **Xung đột** | Teaching chuẩn mới = add HS + dãy unit; reserved-without-range **không** lên roster dual-gate. Hai bước sale enroll vs GĐĐT grant. |
| **Gỡ mù enroll?** | **SEAM ERP** — xóa `enroll` phá money-gate P1 (receipt, class-placement sale). Không thuần “gỡ LMS cũ”. |
| **Files enroll** | **20 files**; **tests 10**. |
| **Files addWithUnits** | **4 files**; **tests 2**. **Không UI** grant. |
| **Rủi ro** | Gỡ enroll: **RẤT CAO (ERP)**. Gỡ/ignore range path: **CAO (teaching)**. Merge = redesign SEAM, không binary delete. |

---

## 6. `StudentLifecycle` 3 giá trị vs chuẩn 6

| | cmc_edu | cmc-lms |
|--|---------|---------|
| Enum | `active`, `blocked_lms`, `withdrawn` — `schema.prisma` L93–97 | `admitted`, `active`, `on_hold`, `transferred`, `withdrawn`, `completed` — cmc-lms schema L38–45 |

| Trường | Nội dung |
|--------|----------|
| **Đang làm gì** | Gate LMS: `blocked_lms` / `assert-student-active`; `enrollment.blockLms`; open-tier empty khi blocked; `student.setLifecycle` 3 giá trị. |
| **Thiếu so chuẩn mới** | **`admitted`**, **`on_hold`**, **`transferred`**, **`completed`**. Thừa mapping: `blocked_lms` **không** có trong cmc-lms (gần `on_hold` nhưng khác tên/semantics). |
| **Xung đột** | BLOCKED set khác: edu ≈ `{blocked_lms, withdrawn?}`; mới = `{on_hold, withdrawn, transferred}`; `completed` vẫn xem LMS. |
| **Files** | **24 files** lifecycle/blocked_lms/setLifecycle/blockLms. |
| **Tests** | **10 files** (`block-lms.test.ts`, `assert-student-active.test.ts`, open-tier blocked, student-detail UI…). |
| **Rủi ro đổi enum** | **CAO** — migration data + mọi gate; không “gỡ” mà **mở rộng/thay thế**. |

---

## 7. Hạng mục khác (trùng lặp / mâu thuẫn)

| # | Hạng mục | Đang làm | Xung đột cmc-lms | Files/tests (grep) | Rủi ro |
|---|---------|----------|------------------|--------------------|--------|
| 7.1 | **Submission key** `@@unique([exerciseId, studentId])` | Một submission/catalog exercise | Mới: `@@unique([sessionExerciseId, studentId])` — mỗi lần phát | schema L930; `submission/router.ts` L246+; suite grade/annotate (nhiều tests trong `submission/*.test.ts` ≥4 files) | **CAO** — rewrite model + grade/stars |
| 7.2 | **SessionStatus `done` + done-sweep** | 3-condition done + makeup field null | cmc-lms SessionStatus chỉ planned/confirmed/cancelled (không `done`) | `schema.prisma` L137–141; `session-done-sweep.ts` + test | **TRUNG BÌNH–CAO** — HR/KPI có thể phụ thuộc done |
| 7.3 | **Thiếu SessionCancelReason** | cancel không phân loại reason | cmc-lms enum manual/slot_removed/class_closed/ceiling | edu cancel-session không reason | **THIẾU** (không phải gỡ — thiếu chuẩn mới) |
| 7.4 | **Open-tier Tier B phụ thuộc makeup** | Xem mục 1+2 | Không makeup ⇒ Tier B chết | `open-tier.ts` L146–170; tests open-tier makeup | gỡ makeup bắt buộc đụng open-tier |
| 7.5 | **FinalGrade theo tháng ICT** | `period` YYYY-MM | cmc-lms periodKey khác (student period badges) | FinalGrade model L945–958; grade.test | **TRUNG BÌNH** (grading semantics) |
| 7.6 | **Dual create class** | mục 4 | — | — | — |
| 7.7 | **Dual homework env** | mục 2 | Kill-switch “hai model” cố ý tạm | — | production dual-mode debt |

---

## Bảng tổng hợp ưu tiên gỡ / redesign

| # | Hạng mục | Loại | Files (apps+packages) | Test files | Rủi ro gỡ/đổi |
|---|----------|------|----------------------:|-----------:|---------------|
| 1 | Makeup / addMakeup | XUNG ĐỘT | 20 | 9 | CAO |
| 2a | Open-tier ADR 0038 (default) | XUNG ĐỘT (cũ) | 13+ | 5 | RẤT CAO |
| 2b | SessionExercise delivery | CHUẨN (giữ) | 10 | 1+domain | Không gỡ |
| 3 | Auth OTP PH + loginStudent + kind parent/student | XUNG ĐỘT | 67 | 25 | RẤT CAO |
| 4 | classBatch.create (không unit) | THỪA SONG SONG | 27 | 15 | TB–CAO (tests) |
| 5 | enrollment.enroll reserved | SEAM ERP | 20 | 10 | RẤT CAO nếu gỡ ERP |
| 5b | addWithUnits (API-only) | CHUẨN teaching | 4 | 2 | Giữ/mở UI |
| 6 | StudentLifecycle 3 vs 6 | XUNG ĐỘT schema | 24 | 10 | CAO |
| 7.1 | Submission by exerciseId | XUNG ĐỘT | schema+submission/* | ≥4 | CAO |

---

## Unknowns

1. Số hàng DB production có `isMakeup=true` / không unit-stamp / không range — không query DB.  
2. Env prod thực tế `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE` — chỉ default code.  
3. cmc-lms còn `StudentAccount` password; mức “gộp family” trên edu có giữ StudentAccount hay không — quyết định product, không suy từ edu.  
4. Phụ thuộc HR `SessionStatus.done` với payroll/KPI khi bỏ `done` — cần audit payroll riêng.

---

Status: DONE | Summary: Cũ xung đột mạnh nhất: makeup+open-tier default, auth two-tier parent/student, lifecycle 3-value, submission-by-exercise; delivery/unit-range là hướng chuẩn mới nhưng song song/không default; enroll reserved là SEAM ERP không gỡ mù.
