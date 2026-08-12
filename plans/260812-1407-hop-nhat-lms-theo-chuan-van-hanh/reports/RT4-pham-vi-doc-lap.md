# RT4 — Phạm vi & tính độc lập của Đợt A

**Đối tượng:** `cmc_edu/plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/phase-01-dot-a-kich-hoat-van-hanh-unit.md`  
**Bối cảnh:** `plan.md` (rào chắn 1–2, phụ thuộc A→B→(C∥D)→E), phase-02 Đợt B  
**Lăng kính:** chỉ phạm vi + độc lập; thù địch; xác minh code  
**Repo code:** `/home/manhquy/Downloads/cmc_edu` · chuẩn: `/home/manhquy/Downloads/cmc-lms`  
**Ngày:** 2026-08-12

---

## Trả lời thẳng 5 câu hỏi

| # | Câu hỏi | Kết luận ngắn |
|---|---------|---------------|
| 1 | A độc lập B/C/D hay rò rỉ? | **A0–A3 phần lớn độc lập C/D và độc lập Submission (B4).** **A4 rò rỉ cứng vào B5.** A3 rò rỉ mềm vào B2/B3 (cờ gắn open-tier). |
| 2 | A làm khó B/C/D/E? | **Có — chủ yếu A4** (UI + dữ liệu dãy trên model `Exercise` unit-bound sẽ vứt/viết lại ở B). C/D/E không bị A làm khó đáng kể. |
| 3 | Vi phạm Rào chắn 1? | **Không port lại buổi bù / 3 cửa login / unit mùng-1.** **Có kích hoạt mô hình bài gắn unit** mà `cmc-lms` đã cố ý gỡ (A4 + catalog `Exercise.curriculumUnitId`) — vi phạm **tinh thần** Rào chắn 1 (loại “bỏ vì nghiệp vụ sai”), không chỉ defer. |
| 4 | A4 làm được không khi chưa có thư viện PDF? | **API hiện tại “chạy được” trên `Exercise` catalog.** **Không đạt chuẩn `cmc-lms` §8** (dãy từ `ExerciseFolder`/`ExerciseFile`). **A4 phải dời sang sau B5 (hoặc cắt khỏi A).** Đây là lỗ hổng phạm vi lớn nhất của đợt. |
| 5 | Thứ tự A0…A4 tối ưu? | **A0→A1→A2→A3 hợp lý.** **A4 sai chỗ** — nên ra khỏi A hoặc gắn B sau thư viện. |

---

## Bảng phát hiện

| ID | Mức | Phát hiện | Kịch bản hỏng cụ thể | Bằng chứng (file:dòng) | Đề xuất sửa plan |
|----|-----|-----------|----------------------|------------------------|------------------|
| **RT4-1** | **HIGH** | **A4 dựng UI xếp dãy trên `exerciseIds` (catalog `Exercise` gắn unit), trong khi chuẩn `cmc-lms` dãy lấy từ thư viện `ExerciseFolder`/`ExerciseFile` — model B5 mới port.** Plan A4 giả định “API đã có = màn làm được = xong chuẩn bị B”. | Sprint A ship màn “Chọn bài từ catalog unit → gán dãy”. Ops gán 40 vị trí cho 5 lớp. Đợt B B5 đổi `ClassExerciseItem` → `exerciseFileId` (hoặc dual-write). Màn A4 vỡ type/API; dữ liệu `exerciseId` không map 1-1 sang file thư viện (1 unit 1 homework ≠ file phẳng theo thư mục). Phải làm lại UI + migrate/vứt dãy đã gán. | A plan `:89-92`; B plan B5 `:77-79`; `cmc_edu` schema `Exercise` bắt buộc `curriculumUnitId` + `ClassExerciseItem.exerciseId` → `Exercise` (`schema.prisma:821-865`); `assignExerciseSequence` input `exerciseIds` (`lms-ops/router.ts:623-628`); `writeSequenceUpdate` validate `tx.exercise` published (`exercise-delivery.ts:81-87`); `domain-lms/exercise-sequence.ts:2` comment “Monorepo uses Exercise ids (not ExerciseFile)”; `cmc-lms` schema `ClassExerciseItem.exerciseFileId` → `ExerciseFile` (`cmc-lms/.../schema.prisma:660-666`); `cmc-lms` **có** `ExerciseFolder`/`ExerciseFile`, **cmc_edu không** (grep schema edu = 0 model). | **Cắt A4 khỏi Đợt A.** Ghi rõ: xếp dãy **chỉ** sau B5 (hoặc gộp A4 vào B sau thư viện). Nếu giữ spike tạm, đánh dấu **throwaway / cấm prod data**. |
| **RT4-2** | **HIGH** | Plan tuyên bố A “**không đụng lược đồ, không phá e2e**” và “rẻ nhất” nhưng A4 **ghi dữ liệu vận hành** vào spine delivery tạm — làm **B5 + B4 đắt hơn**. | A4 prod: `ClassExerciseItem` + worker `deliverForSession` tạo `SessionExercise` trỏ `Exercise`. B4 rekey `Submission` sang `sessionExerciseId`; B5 đổi FK bài. Chuỗi phụ thuộc dữ liệu: sequence → delivery → (sau này) submission. Mỗi lớp đã deliver = hàng cần map/quyết định giữ-bỏ. B không còn “chỉ schema + flag”. | `deliverForSession` ghi `SessionExercise.exerciseId` (`exercise-delivery.ts:202-209`); fallback không sequence còn **phát theo `curriculumUnitId`** (`:179-195`) — đúng mô hình cũ gắn unit; B plan B4/B5 (`phase-02:63-79`); A plan claim no migration (`:115`). | A outcome **không** gồm “freeze sequence prod”. A4 (nếu còn) = dev-only hoặc sau B5. |
| **RT4-3** | **HIGH** | **Câu hỏi quan trọng nhất (A4):** “chưa thư viện PDF thì A4 có làm được?” — Plan trả lời ngầm **có** (API sẵn). Thực tế: **làm được bản tạm, không làm được bản đúng chuẩn.** Gộp hai nghĩa “làm được” = scope fraud. | Product/owner đọc A4 “chuẩn bị Đợt B” → tin ops đã xếp dãy kiểu `cmc-lms`. Demo: chọn exercise theo unit. B5 mới lộ: thư viện một cấp + thứ tự đóng băng theo folder, **không** picker theo `curriculumUnitId`. Gap kỳ vọng = rework full màn + training ops. | Chuẩn §8: thư viện tách khung CT, gán thư mục+thứ tự (`cmc-lms` class-unit-spec mục 8; BR3 trong reports plan); edu `Exercise@@unique([curriculumUnitId, type])` (`schema.prisma:838-839`) — **bám unit**; review plan2: “Folder library UI deferred” (`review-independent-plan2-teaching-spine-260811.md:66`). | Viết A4 (hoặc non-goal): **“Không UI sequence cho tới ExerciseFolder/File.”** Tách “API stub đã có” ≠ “màn vận hành chuẩn”. |
| **RT4-4** | **MEDIUM** | **A3 bật `LMS_ENTITLEMENT_GATE` chỉ siết nhánh open-tier ON.** Khi open-tier OFF (mục tiêu B3), cờ **không chạy** nhánh intersect range — plan A nói như thể entitlement “có hiệu lực vĩnh viễn” sau A. | A3 bật gate=1; open-tier vẫn 1. HS không range mất bài open-tier → “thành công”. B3 `LMS_OPEN_TIER_ENABLED=0`: code đi `deliveredExerciseIdsForStudent`, **bỏ qua** `isEntitlementGateOnOpenTier` (`open-tier.ts:100-111` vs `:113-198`). A3 không còn là “cổng entitlement” chính; entitlement thật = roster D1 lúc deliver/đọc. Test A #5 và runbook “bật cờ = xong dual-gate” **lỗi thời ngay sau B**. Ops tưởng env A3 vẫn cứu khi tắt open-tier → không. | `isEntitlementGateOnOpenTier` (`open-tier.ts:85-88`); chỉ dùng khi open-tier enabled (`:102-113`, `:172-198`); BR5 env table (`BR5:62-67`); A plan A3 (`:78-87`); verify #5 (`:104`). | Đổi wording A3: **“siết tạm open-tier cho tới B3”**. Verify B phải chứng dual-gate delivery, không tái dùng test open-tier-only. Giữ A3 sau A0/A1 — đúng an toàn — nhưng **đừng** gọi là outcome vĩnh viễn chương trình. |
| **RT4-5** | **MEDIUM** | **Rò rỉ A ↔ B qua makeup/open-tier:** A0 đếm `isMakeup` “cho Đợt B” nhưng A **không** chặn tạo thêm buổi bù. Trong lúc A chạy, makeup vẫn làm lệch restamp (B đã chứng minh) và Tier B open-tier vẫn sống — A3 bật gate **không** sửa lệch unit do makeup. | A0 đếm 12 makeup. Trong 2 tuần A1–A3, GV/admin vẫn `addMakeup` (UI live). Restamp sau hủy: makeup chiếm slot → unit 4 buổi thành 5 thực (kịch bản B). A3 bật entitlement: HS “đủ range” nhưng roster/unit stamp đã lệch → báo cáo unit/tiền sai **trước** B1. A0 số liệu **stale** lúc B bắt đầu. | B evidence makeup+restamp (`phase-02:22-30`); `addMakeup` còn (`class-session-router` — BR5 §1); A non-goal “Không gỡ buổi bù” (`phase-01:20`); A0 #4 (`:37`). | A0: snapshot + **cấm tạo makeup mới** (feature flag / ẩn UI) trong cửa sổ A→B, hoặc A0 re-run bắt buộc ngày start B. Không bắt A gỡ hết makeup (đúng B) nhưng **đừng để counter chạy ngược**. |
| **RT4-6** | **MEDIUM** | **A1 (cấp/thu unit) không phụ thuộc Submission (B4) — plan đúng phần này; nhưng plan không nói rõ ranh giới → dễ kéo scope “màn lớp” sang chấm/bài.** | Dev A1 mở class-detail, thấy panel bài/chấm cũ, “tiện thể” wire sequence/submit. Scope A phình sang surface B. | Admin hiện **0 hit** UI `addWithUnits`/`grantPast` (A plan `:47-48`); `lmsOps` UI hiện chỉ create class / roster / cancel (`classes/index.tsx:259`, `attendance-panel.tsx:111`, `session-detail.tsx:79`). Submission unique `(exerciseId, studentId)` (`schema.prisma:930`) — **không** được A1 đọc/ghi. | A1 checklist: **chỉ** range grant/revoke/archive + hiển thị dải. Cấm scope creep exercise/submission trong PR A. |
| **RT4-7** | **MEDIUM** | **Rào chắn 1 — A4 kích hoạt mô hình “bài theo unit” đã bị `cmc-lms` loại**, dù không re-intro makeup/login. Rào chắn 1 bảng: “Exercise gắn curriculumUnitId” thuộc lớp **bỏ vì nghiệp vụ sai** (class-unit-spec §1/§8). A không port code cũ; A **bật vận hành** hybrid edu đã bị chuẩn thay. | Owner tin A “chỉ kích hoạt đúng chuẩn cmc-lms”. Thực tế A4 + fallback deliver-by-unit = vận hành **ngược** §8. Merge narrative vỡ: “đợt đầu đã theo chuẩn” là sai. | Rào chắn 1 (`plan.md:39-44`); class-unit-spec: bài **không** gắn unit; `exercise-delivery.ts:179-195` fallback unit homework; schema Exercise unit-bound. | Ghi non-goal A: **không** coi catalog unit-homework là chuẩn cuối. Không ship UI củng cố model đó. |
| **RT4-8** | **MEDIUM** | **Thứ tự: A4 sau A3 không có dependency kỹ thuật; A3 không cần A4.** Gắn A4 cuối A tạo ảo giác “chuỗi hoàn chỉnh” trong khi A4 thuộc B. | Team làm A0–A3 xong, burn sprint còn lại vào A4 throwaway → trễ B (domino thật). Hoặc A4 làm dở → A “không done” dù value unit ops đã có. | A3 chỉ env + backfill ranges (`phase-01:78-87`); open-tier list bài theo unit đã end, **không** cần `ClassExerciseItem`. Delivery sequence chỉ cần khi open-tier OFF (B3). | Outcome A chốt ở **A3** (gate + màn unit). A4 remove hoặc “optional / B”. |
| **RT4-9** | **LOW** | A2 (cảnh báo ≤1 unit) **độc lập B/C/D** và **phụ thuộc A1/data range** — plan đặt A2 trước A3 đúng hướng nhưng **chưa có API list**; domain đã có `remainingUnits`. | Làm A2 trước khi có cách đọc range trên UI/API ổn → màn “sắp hết” empty/sai → ops bỏ qua. Không chặn A nhưng lãng phí. | `remainingUnits` trong `domain-lms/unit-progression.ts:64-70`; **không** có procedure list expiring trong `apps/api` (grep remain/expiring list = 0); review plan2 “expiring list deferred” (`:63`). | A2 sau A1; thêm API read trong A1 hoặc A2 explicit — không block A3. |
| **RT4-10** | **LOW** | **C/D độc lập A:** plan `A → B → (C∥D) → E` và “A không bị chặn freeze cmc-lms” (`plan.md:85-88`) **đúng** cho identity/lifecycle. Không tìm thấy A đụng `kind` parent/student hay enum lifecycle. | (Không kịch bản hỏng A→C/D.) Rủi ro ngược: làm C song song A trên cùng branch → conflict lớn (BR5: 67 file auth) — **ngoài plan A**, ghi nhận coordination. | plan phụ thuộc (`plan.md:66-72`); A non-goals C/D (`phase-01:21-22`). | Giữ A không đụng auth/lifecycle. Không gộp C vào A. |

---

## Ma trận độc lập (A step × đợt khác)

| Bước A | Phụ thuộc B? | Phụ thuộc C/D? | Phụ thuộc Submission rekey? | Phụ thuộc thư viện PDF? | Ghi chú |
|--------|--------------|----------------|----------------------------|-------------------------|---------|
| A0 đo | Đếm makeup **phục vụ B** (không block logic A) | Không | Không | Không | Số makeup stale nếu không freeze tạo mới |
| A1 cấp/thu/gỡ unit | **Không** (API `lmsOps.*` đã có, dual-gate roster riêng) | Không | **Không** | **Không** | Core value A; đúng độc lập |
| A2 sắp hết unit | Không | Không | Không | Không | Cần range data + API đọc |
| A3 bật entitlement | **Mềm:** cờ chỉ có nghĩa khi open-tier ON; B3 làm cờ “chết” | Không | Không | Không | Interim control, không phải dual-gate cuối |
| A4 xếp dãy | **Cứng → B5** (và làm đắt B4 nếu đã deliver) | Không | Gián tiếp sau deliver | **Cứng nếu muốn đúng chuẩn** | **Không thuộc A** |

---

## Rào chắn 1 — checklist nhanh Đợt A

| Thứ `cmc-lms` đã bỏ (nghiệp vụ sai) | A có port/bật lại? |
|-------------------------------------|--------------------|
| Buổi bù | Không gỡ, **cũng không** thêm — defer B (OK) nhưng **không chặn tạo mới** (RT4-5) |
| Unit theo mùng-1 | Không — restamp theo buổi đã có nền |
| 3 cửa login / OTP / student kind | Không đụng (OK) |
| Teacher tạo HS/lớp | Không đụng (OK) |
| **Bài gắn unit / không thư viện folder** | **A4 + fallback deliver-by-unit = vận hành model đã bỏ** (RT4-1, RT4-7) |
| Facility/RLS/ERP | Giữ (đúng loại “bỏ vì scope hẹp”) |

---

## Thứ tự đề xuất (chỉ sửa plan, không implement)

```
A0 (đo + freeze tạo makeup nếu cần)
 → A1 (màn unit ops)
 → A2 (cảnh báo ≤1)
 → A3 (bật LMS_ENTITLEMENT_GATE sau backfill)
[HẾT ĐỢT A]

B1…B5 gồm UI xếp dãy SAU B5 thư viện
(C ∥ D) → E
```

**Không** khuyến nghị: A4 giữa A3 và B; **không** khuyến nghị dời A3 trước A1.

---

## Việc plan A đã xử lý — không nêu thành finding mới

- Cổng A0 trước bật gate (cắt quyền HS) — đúng hướng R3.
- A1 luật “quá khứ THÊM được, BỚT không”, archive từ hôm sau, grantPast chặn archived — khớp chuẩn unit.
- `grantUnits` không sale / SoD — khớp Rào chắn 2.
- Non-goal không gỡ makeup / không đụng login / lifecycle / import — đúng tách đợt (trừ lỗ hổng A4 và freeze makeup).

---

## Unknowns

- Prod `cmc_edu` hiện có bao nhiêu `ClassExerciseItem` / `SessionExercise` đã ghi (nếu đã deliver ngầm) — ảnh hưởng chi phí B nếu A4 chạy thêm.
- Runtime env prod: `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE` thực tế (code default 1/0).
- B5 sẽ **rename** `Exercise` hay **song song** `ExerciseFile` — chưa chốt trong phase-02 ngoài “cần có thư viện”.
- Owner có chấp nhận **throwaway** sequence UI trên catalog unit không (plan không hỏi).

---

Status: DONE | Summary: Đợt A0–A3 khá độc lập và đúng hướng kích hoạt unit; A4 là lỗ hổng phạm vi HIGH — UI dãy bài không thể “đúng chuẩn” trước thư viện PDF (B5) và sẽ buộc làm lại + làm đắt B.
