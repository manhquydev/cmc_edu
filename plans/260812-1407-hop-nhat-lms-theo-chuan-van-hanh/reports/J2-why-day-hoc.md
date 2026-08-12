# J2 — Lý do mô hình dạy-học (unit · buổi · ghi danh · quyền học)

Nguồn: journals + plans trong `/home/manhquy/Downloads/cmc-lms` (chỉ đọc docs).  
Mục tiêu merge: **không lặp lại thứ đã bỏ / đã sửa đắt**.  
Phân biệt: **chốt** vs **bàn rồi thôi**. Không đoán.

---

## 1. Vì sao bỏ buổi bù

### 1.1 Timeline quyết định

| Thời điểm | Nội dung | Loại | Nguồn |
|---|---|---|---|
| 28/07/2026 ~00:50–06:50 | Buổi bù **từng được làm xong**: cột `makeupOfSessionId`, `createMakeupSession` (~82 dòng), nhánh cron, UI modal/badge; agent còn vá thiếu gán makeup khi tạo bù | Đã ship rồi gỡ | `plans/journals/260728-0034-cum-day-hoc-va-bo-buoi-bu.md:54-57,85-99` |
| 28/07 ~09:00 | Chủ dự án yêu cầu đơn giản hóa: **HS nghỉ → cơ sở sắp xếp NGOÀI hệ**; hệ chỉ đảm bảo **bài vẫn phát** (roster D1 đã đủ) | **Chốt** | journal `260728-0034…:85-91` |
| Cùng phiên | Hỏi 2 quyết định trước khi gỡ: (a) giữ “buổi lẻ” ngoài lịch tuần? → **KHÔNG**; (b) buổi hủy xử lý bài? → **giữ luật cũ**: không tiêu bài, dồn buổi sau | **Chốt** | journal `260728-0034…:88-91` |
| Cùng phiên | Migration `20260728070000_drop_makeup_sessions`: xóa 2 cột + 2 index; xóa API; gỡ UI; viết lại 3 test bất biến | Thực thi | journal `260728-0034…:91-99`; plan `260728-0034…/plan.md:42-44,67-68` |
| Roadmap | Mục 5c ghi: chỉ còn buổi theo lịch tuần + hủy | **Chốt authority** | `plans/roadmap-v1.md:38-41` |
| 01/08/2026 | Spec §4 **đổi lý do** “không buổi bù” sau khi unit chuyển sang đếm buổi (xem §2) | **Chốt lại** | `docs/class-unit-spec.md:137-145`; plan `260801-1441…/plan.md:68-69` |

### 1.2 Lập luận đầy đủ (hai lớp — đừng trộn)

**Lớp A — lý do lúc BỎ (28/07), khi unit còn “theo tháng lịch”:**

| Mục | Nội dung | Nguồn |
|---|---|---|
| Không phải vì khó | “Buổi bù không bị bỏ vì khó làm — nó chạy đúng, có test, có UI, migration đã áp” | journal `260728-0034…:117-119` |
| YAGNI muộn | Dưới mô hình **unit-theo-tháng-lịch**, hủy 1 buổi **không tạo “món nợ”** cần hệ ghi sổ → state-tracking bù (2 cột, self-relation, partial unique, nhánh cron) là thừa | journal `260728-0034…:119-123` |
| Thời điểm gỡ rẻ | Chưa migrate dữ liệu thật → gỡ không tốn giá dữ liệu | journal `260728-0034…:122-123` |

**Lớp B — lý do SAU (01/08+), khi unit đã “theo số buổi hợp lệ” (thay thế lớp A trong spec):**

| Mục | Nội dung | Nguồn |
|---|---|---|
| Món nợ CÓ nhưng xử bằng lùi | Hủy buổi **chủ đích** làm chậm tiến độ: unit đếm buổi hợp lệ → buổi sau **lùi**; lớp vẫn đủ 4 buổi/unit, chỉ dài hơn → **không cần loại buổi bù riêng** | `class-unit-spec.md:142-145`; plan `260801-1441…:7-9,18` |
| Non-goal cứng | Plan unit-by-sessions: **không làm buổi bù** | `260801-1441…/plan.md:18` |

### 1.3 Phương án khác đã cân nhắc

| Phương án | Kết quả | Nguồn |
|---|---|---|
| Giữ buổi bù (entity + API + UI) | **Bỏ** sau khi đã code xong | journal `260728-0034…:85-99` |
| “Buổi lẻ” ngoài lịch tuần (dạy thêm ad-hoc) | **KHÔNG** — admin chỉ thêm/gỡ khung lịch tuần + hủy buổi | journal `260728-0034…:88-90`; spec `class-unit-spec.md:140-141` |
| Xử lý bài khi hủy khác đi | **Không đổi**: hủy không tiêu bài; dồn con trỏ; thu hồi nếu chưa có submission | journal `260728-0034…:90-91`; plan `260728-0034…/plan.md:33-37` |

### 1.4 HS nghỉ buổi thì xử lý ra sao (sau khi bỏ bù)

| Tình huống | Hệ làm gì | Hệ **không** làm | Nguồn |
|---|---|---|---|
| HS vắng 1 buổi | Vẫn trong roster D1 của unit buổi đó → **vẫn nhận bài** về nhà; điểm danh absent/late | Không tạo buổi bù trong LMS | plan `260728-0034…/plan.md:43-44`; roadmap `roadmap-v1.md:38-40`; spec `class-unit-spec.md:137-140` |
| Học bù thực tế | **Cơ sở sắp xếp ngoài hệ thống** | Không có `createMakeupSession` | journal `260728-0034…:85-87` |
| Lớp/GV nghỉ cả buổi | ADMIN **hủy buổi** (admin-only) → unit lùi (sau 01/08); bài chưa nộp thu hồi | GV không hủy được | spec `class-unit-spec.md:128-130,146-148` |
| Muốn dạy thêm | Thêm **khung lịch tuần**, không tạo buổi rời | — | journal `260728-0034…:89-90`; spec `class-unit-spec.md:140-141` |

### 1.5 Nguy cơ merge ERP

Port lại entity buổi bù / makeupOf / createMakeup = **lặp đúng thứ đã gỡ có chủ đích** (journal nhấn mạnh YAGNI muộn nhưng đúng lúc).

---

## 2. Vì sao tiến trình unit theo SỐ BUỔI, không theo tháng

### 2.1 Từng làm cách khác

| Cơ chế cũ | Mô tả | Nguồn |
|---|---|---|
| **Theo mùng 1 tháng lịch (M3)** | Unit nhảy theo lịch tháng; cron/mốc ngày; helper `unitOrderForDate` / `calendarMonthsBetween` (sau bị gỡ) | plan `260801-1441…/plan.md:1-3,43-44`; spec `class-unit-spec.md:76-78` |
| Stamp unit “theo ngày diễn ra” | Comment schema từng nói nhảy mùng 1 (lịch sử) | (đối chiếu code BR1; journal không chi tiết công thức cũ) |

### 2.2 Vì sao đổi (chốt 01/08/2026)

| Nội dung | Lý do | Nguồn |
|---|---|---|
| Outcome | Unit nhảy sau **đúng 4 buổi hợp lệ (không hủy)**, không theo mùng-1 | plan `260801-1441…:7-9` |
| Vấn đề sư phạm | Mỗi unit = 4 buổi (khung CSV); tiến độ phải bám **số buổi thực học** — tháng nghỉ/hủy buổi **không** được làm lớp “nhảy unit khi chưa học đủ” | spec `class-unit-spec.md:76-78` |
| Hủy → lùi | Hủy buổi → buổi tương lai kế thừa vị trí (“buổi 4” thành “buổi 3”), unit lùi; đủ 4 buổi hợp lệ mới nhảy | plan `260801-1441…:7-9`; spec `class-unit-spec.md:83-85` |
| Song song con trỏ bài | 4 buổi = 1 unit = 4 bài (cùng đếm buổi) — RT6 | plan `260801-1441…:85-86,91`; spec `class-unit-spec.md:85-86` |
| E13 chủ đích | Lớp ≥2 buổi/tuần **nhảy unit nhanh hơn tháng lịch** — đúng sư phạm, không phải bug | plan `260801-1441…:23,27,88` |
| Tết / nghỉ dài | **Không** cần chỉnh unit tay: admin hủy buổi nghỉ → unit tự giữ | plan `260801-1441…:29`; spec `class-unit-spec.md:99-100` |
| Derive độc lập cron (E10) | Unit từ **bản ghi buổi** persist; cron chết không sai unit; cron chỉ sinh buổi + phát bài | plan `260801-1441…:16-17`; spec `class-unit-spec.md:87-91` |

### 2.3 Ràng buộc giữ khi đổi

| Ràng buộc | Nguồn |
|---|---|
| Buổi đã điểm danh / quá khứ đã stamp: **đóng băng**; restamp chỉ tương lai chưa điểm danh (tránh mồ côi Attendance) | plan `260801-1441…:11-12,28` |
| Giữ neo `(currentUnit, currentUnitAnchor)` — **không migration cột** | plan `260801-1441…:13,30` |
| Không đụng `EnrollmentUnitRange` / roster D1 | plan `260801-1441…:14-15` |
| Không buổi bù; hủy buổi admin-only | plan `260801-1441…:18-19` |
| Công thức: `unit(k) = anchorOrder + floor(k/4)`, k = index non-cancelled từ neo | plan `260801-1441…:34-36` |

### 2.4 Liên hệ với “bỏ buổi bù”

- **28/07**: bỏ bù vì dưới model **tháng**, hủy **không** sinh nợ → makeup YAGNI (journal `260728-0034…:119-123`).
- **01/08**: model **buổi** làm hủy **có** nợ, nhưng nợ xử bằng **lùi** → makeup vẫn không cần; **spec viết lại lý do** (plan `260801-1441…:68-69`).  
→ Merge: đừng tái lập makeup với lý do “đã có nợ buổi” — nợ đã có cơ chế lùi.

---

## 3. Các lần sửa quyền unit & ghi danh — sai chỗ nào, sửa thành gì

### 3.1 Trạng thái trước khi sửa (chỉ 1/4 ca vận hành)

| Ca vận hành | Trước | Nguồn |
|---|---|---|
| Đổi gói / thêm unit tương lai | Có: `addWithUnits` + `revokeFromNext` | plan `260731-2257…/plan.md:24-28` |
| Add nhầm HS/dãy/lớp | **Không gỡ được** — HS kẹt roster | `260731-2257…:26-27` |
| Nghỉ **một** lớp (học 2 lớp) | Không đường; `lifecycle` toàn cục sẽ chặn cả lớp kia | `260731-2257…:27-28` |
| Cấp bù unit quá khứ (migrate) | `validateNewRange` chặn cứng `starts_in_past` | `260731-2257…:28` |

### 3.2 Nguyên tắc xương sống (chốt chủ dự án)

| # | Quyết định | Nguồn |
|---|---|---|
| Xương sống | **Quá khứ THÊM được, BỚT thì không** | plan `260731-2257…:34-35`; journal `260801-0210…:11` |
| Q1 | Mốc gỡ theo **NGÀY buổi**: buổi **cùng ngày** gỡ **vẫn giữ HS**; hiệu lực từ hôm sau | `260731-2257…:48` |
| Q2 | “Chưa có dữ liệu” = chưa Attendance **và** chưa Submission **và** chưa SessionExercise thuộc roster | `260731-2257…:49` |
| Q3 | `grantPast` trên enrollment đã gỡ → **chặn**, hoàn tác trước | `260731-2257…:50` |
| Q4 | Gỡ lớp duy nhất → **không** ép đổi lifecycle | `260731-2257…:51` |
| Q6 | Sao đã cộng **bất biến** — gỡ không thu hồi sao | `260731-2257…:53` |

### 3.3 Sửa thành gì (thi công 31/07–01/08)

| Lỗi / thiếu | Sửa | Nguồn |
|---|---|---|
| Không gỡ HS khỏi lớp | `enrollment.archive` = set `archivedAt` **mốc thời gian** (không boolean); unarchive; footprint 2 bước | journal `260801-0210…:12-14`; plan `260731-2257…:36-38` |
| `archivedAt` hiểu sai | Đổi ngữ nghĩa cờ → mốc; **11 read-site** qua helper `enrollmentCoversSession` | journal `260801-0210…:16-17`; plan `260731-2257…:59-61` |
| Cấp bù quá khứ | `previewGrantPast` + `grantPast` bỏ chặn starts_in_past **cục bộ**; preview + seenHash TOCTOU | journal `260801-0210…:15`; plan `260731-2257…:39-40` |
| `remainingUnits` đếm đôi | Đếm theo **Set** order (dãy chồng raw) — QA thấy 8→3 | journal `260801-0210…:25`; plan phase-00 M4 `260731-2257…:109` |
| Scout sai nhóm history | History/PH phải nhận enrollment archived, lọc **tầng buổi** — nếu filter `archivedAt IS NULL` → **mất học bạ** | plan `260731-2257…:79-85` |
| 3 cổng bài tập lệch | Discovery / nộp / tải PDF **cùng** luật sessionDate ≤ ngày(archivedAt) (B2) | plan `260731-2257…:86-90`; journal `260801-0210…:22-23` |
| Mốc bằng `new Date()` | Phải `ictTodayUtc()`/clock nghiệp vụ (B1) — test pin + “cùng ngày=giữ” | journal `260801-0210…:20-21`; plan `260731-2257…:98` |
| Helper nhét +7h trong domain | Domain **thuần**; ICT chuẩn hóa ở API (B3) | journal `260801-0210…:24`; plan `260731-2257…:100` |
| add lại sau gỡ kẹt | `addWithUnits` **reset archivedAt** + hồi sinh dãy cũ (M3/E-A4) — must-fix entity lifecycle | plan `260801-1058…:46-48`; journal `260801-1348…:20-21` |
| Preflight close/setCurrentUnit liệt HS đã gỡ | Lọc archivedAt | plan `260731-2257…:129-130`; phase-00 |

### 3.4 Phân biệt 3 cổng độc lập (học được)

| Cổng | Ý nghĩa | Không lẫn với |
|---|---|---|
| `EnrollmentUnitRange` | Quyền unit theo orderGlobal | — |
| `Enrollment.archivedAt` | Nghỉ **một lớp** theo mốc ngày | lifecycle toàn cục |
| `Student.lifecycle` ∈ on_hold/withdrawn/transferred | Chặn LMS toàn bộ (điểm danh/nhật ký/phát bài/login con) | archive 1 lớp |

Nguồn: plan `260731-2257…:27-28`; roadmap `roadmap-v1.md:45-47` (lifecycle vs enrollment.status); journal `260801-1348…:22-24`.

### 3.5 Non-goals đã từ chối (đừng port)

| Ý tưởng | Kết quả | Nguồn |
|---|---|---|
| Endpoint `updateRange` sửa tại chỗ | **Không** — gỡ + add lại đủ | plan `260731-2257…:72` |
| Hard-delete ghi danh | **Không** — luôn archivedAt hoàn tác | `260731-2257…:73` |
| Nút “phát bù bài” cho grantPast | **Ngoài hệ** | `260731-2257…:74-75,151` |
| Backfill sao cho cấp bù | **Không** | `260731-2257…:75` |

### 3.6 Deploy prod liên quan

| Mục | Nội dung | Nguồn |
|---|---|---|
| 01/08 ~02:07 ICT | archive + grantPast → PR #20 → main `195ec66` → **prod LIVE**; **không migration** → zero-downtime | journal `260801-0210…:1-3,38-42` |
| Follow-up không chặn | FE unarchive nuốt lỗi; grantPast double-submit overlap (benign Set) | journal `260801-0210…:44-47` |

---

## 4. realign unit history giải quyết vấn đề gì

### 4.1 Vấn đề

| Nội dung | Nguồn |
|---|---|
| Lớp migrate/nhập bù **neo sai từ đầu** → **toàn bộ** unit stamp lệch khung | journal `2026-08-08-realign-unit-history-ship.md:5-7` |
| Vận hành thường: restamp **đóng băng** buổi quá khứ/đã điểm danh → **không** sửa được lịch sử bằng `setCurrentUnit` | plan `260808-1048…:15-25`; journal realign `:18-19` |
| Escape hatch sẵn có chỉ gắn buổi quá khứ **chưa stamp + chưa điểm danh** — **gap** = relabel buổi **đã stamp/đã điểm danh** | plan `260808-1048…:50-51`; journal realign `:51-54` |

### 4.2 Giải pháp đã chốt (08/08/2026)

| Mục | Nội dung | Nguồn |
|---|---|---|
| UX | Admin trỏ 1 buổi mốc non-cancelled + khai “buổi này = buổi P (1–4) của unit U” | plan `260808-1048…:16-20` |
| Thuật toán | `resolveReferenceAnchor` → re-origin neo buổi đầu + `restampBatchUnits(force=true)` | plan `260808-1048…:17-20` |
| Option A | **Pha ≠ 0 → từ chối** (không hỗ trợ bắt đầu giữa unit; không thêm field offset) | journal realign `:12-15`; plan `260808-1048…:35,57-59` |
| Schema | **Không đổi** schema/API contract; chỉ neo + relabel `curriculumUnitId` | journal realign `:16-17` |
| An toàn | Preview 2 bước; Attendance/bài nộp **giữ**; **không tự sửa** EnrollmentUnitRange; idempotent 0 event lần 2 | plan `260808-1048…:21-22,36-38` |
| Phạm vi | Chỉ lớp `running`; lớp closed → mở lại trước (limit v1) | journal realign `:20`; plan `260808-1048…:33` |
| **Không** đụng bài | Con trỏ bài = MAX position SessionExercise, **độc lập** neo unit (suýt lỗi lớn nếu giả định coupling) | journal realign `:24-27`; plan NI1 `260808-1048…:63-66` |
| Không dùng hằng ngày | Khác `setCurrentUnit` (neo=hôm nay, không force) | spec `class-unit-spec.md:111-113` |

### 4.3 Ship

PR #32 merge `29c16aa` main; domain 59 + API 361 + web 212 — journal realign `:30-34,46-47`.

### 4.4 Bài học thiết kế

| Bài học | Nguồn |
|---|---|
| Advise ban đầu đoán “cần offset 2 chiều”; đọc code thật → thu hẹp còn cờ `force` | journal realign `:50-54` |
| Defect UI: gợi ý buổi P theo `i%4+1` sai trên lớp đã lệch → tính theo nhóm unitCode stamp thật | journal realign `:38-40` |

---

## 5. Ràng buộc vận hành học được từ chạy thật

| # | Ràng buộc / sự cố | Bài học | Ngày | Nguồn |
|---|---|---|---|---|
| 1 | Bỏ bù **sau khi** feature đã đúng | Đơn giản hóa khi đã chạy, không né việc khó; YAGNI muộn vẫn rẻ nếu chưa migrate | 28/07 | journal `260728-0034…:117-123` |
| 2 | Contract-first trước multi-agent | Schema + helper + router rỗng trước → 4 agent không đụng file | 28/07 | journal `260728-0034…:46-49,103-107` |
| 3 | “Chạy thật” bắt bug ẩn | upsertDraft xóa ảnh sau publish — review code không thấy | 28/07 | journal `260728-0034…:64-67,113-116` |
| 4 | P0 nhật ký lọc theo Attendance.status | GV viết hôm sau → comment mất + không publish | 28/07 | journal `260728-0034…:23-28`; plan `260728-0034…:52` |
| 5 | markAll 1-click xóa ghi chú vắng thủ công | Nút “có mặt tất cả” phải **không ghi đè** đã mark | 28/07 | journal `260728-0034…:31-32,60-61` |
| 6 | Coverage: enumerate procedure, không tin doc | 68 procedure / 3 trống; test hằng số cố ý bỏ | 29/07 | journal `260729-0220…:12-33` |
| 7 | iPhone upload chết prod; e2e 47/47 xanh | `capture="environment"`; e2e `setInputFiles` **đi vòng** chỗ vỡ; log không request = bằng chứng | 31/07 | journal `260731-1115…:10-36,94-96` |
| 8 | Buổi đã hủy vẫn lộ nhật ký PH | Publish/filter phải chặn status cancelled | 31/07 | journal `260731-1115…:25-26,69-73` |
| 9 | Lớp prod `CMC-26-0002`: 48/48 buổi teacher_id NULL, không slot | Không GV mở nhật ký; cần backfill slot | 31/07 | journal `260731-1115…:119-120` |
| 10 | F3: đổi KG/unit lớp đã có buổi | 2 bug thật (effectiveFrom không cascade; anchor nhảy vọt) → **chỉ lớp trống** | 01/08 | plan `260801-1058…:41-43`; journal `260801-1348…:12-14` |
| 11 | Vòng đời entity “tạo trước, sửa phản ứng” | Audit toàn hệ, đối xứng CRUD, hết vá lẻ tẻ | 01/08 | journal `260801-1348…:4-6` |
| 12 | archivedAt = cổng đọc nhiều nơi | Tách TƯƠNG LAI vs LỊCH SỬ PH; sai một bên = rò roster hoặc mất học bạ | 01/08 | journal `260801-1348…:22-24` |
| 13 | remainingUnits Set trên data thật | Dãy chồng → số sai 8→3 nếu cộng dồn | 01/08 | journal `260801-0210…:25` |
| 14 | EnsureSessions createMany + restamp ngoài tx | Buổi mồ côi null-unit nếu restamp throw → bọc 1 tx (P0 unit-by-sessions) | 01/08 | plan `260801-1441…:98-100` |
| 15 | Realign: bài ≠ unit | Relabel unit **không** được đụng SessionExercise | 08/08 | journal realign `:24-27` |
| 16 | GV nghỉ đột xuất + cron phát bài | Phải báo admin **trong ngày**; không hủy kịp vẫn tiêu 1 bài (thu hồi nếu chưa nộp) | chốt spec | `class-unit-spec.md:146-148` |
| 17 | Hủy buổi admin-only | GV không hủy (chốt 28/07, gỡ mâu thuẫn role-matrix) | 28/07 | `class-unit-spec.md:128-130` |

---

## 6. LỆCH (doc/journal ↔ code/sự thật vận hành)

| Mục | Mô tả | Nguồn |
|---|---|---|
| Lý do “không buổi bù” đổi 2 lần | Journal 28/07: YAGNI vì unit-tháng không sinh nợ. Spec 01/08: nợ có, xử bằng lùi. **Cả hai đúng theo thời điểm**; merge đọc **spec hiện hành** + nhớ timeline | journal `260728-0034…:119-123` vs `class-unit-spec.md:142-145` |
| Roadmap còn câu “unit theo tháng” ở dòng cũ | `roadmap-v1.md:11` text lịch sử; cơ chế hiện tại đã là theo buổi (plan 260801-1441) | roadmap + plan unit |
| Journal 260729 coverage | Hữu ích quy trình test; **ít** lý do unit/buổi | `260729-0220…` |
| Journal “260731-2257” riêng | **Không có** file journal tên đúng; nội dung nằm plan `260731-2257` + journal `260801-0210` | ls journals |
| Plan entity 260801-1058 header `status: todo` | Journal `260801-1348` báo **8/8 phase xong** — status frontmatter plan có thể **lệch** | plan header vs journal `:33-35` |

---

## 7. Cái đã thử rồi BỎ (checklist anti-port)

| Đã bỏ / từ chối | Thay bằng | Nguồn |
|---|---|---|
| Entity buổi bù + createMakeup + UI | Lịch tuần + hủy + (sau) lùi unit; HS bù ngoài hệ | journal `260728-0034…` |
| Buổi lẻ ngoài lịch tuần | Chỉ slot tuần | journal `260728-0034…:88-90` |
| Unit nhảy mùng-1 tháng | floor(k/4) trên buổi hợp lệ | plan `260801-1441…` |
| Chỉ sửa unit tương lai (không gỡ/cấp bù) | archive mốc + grantPast | plan `260731-2257…` |
| Dùng lifecycle để nghỉ 1 lớp | archivedAt theo lớp | plan `260731-2257…:27-28` |
| Option B realign (offset mid-unit) | Option A từ chối pha≠0 | journal realign `:12-15` |
| Sửa dãy unit tại chỗ updateRange | Gỡ + add lại | plan `260731-2257…:72` |
| Thu hồi sao khi gỡ HS | Ledger bất biến | plan `260731-2257…:53` |

---

## Unknowns

1. Journal chi tiết phiên brainstorm **đổi unit tháng → buổi** (ngoài plan 260801-1441 + spec) — không thấy journal riêng ngày 01/08 chỉ về unit-progression; luận “vì sao” lấy từ plan/spec.  
2. Prod backfill `backfill:unit-progression` đã chạy chưa — plan ghi “CHƯA chạy backfill trên prod” tại lúc viết plan (`260801-1441…:104-105`); trạng thái sau đó UNKNOWN trong các journal đã đọc.  
3. File journal đúng tên `260731-2257-*` — không tồn tại; dùng plan + `260801-0210`.  
4. Chi tiết advise 27/07 “edge case lop-unit” gốc (trước code) — không đọc lại trong đợt này; có thể còn quyết định nền ở `plans/reports/advise-260727-*` chưa trích.

---

Status: DONE | Summary: Bỏ bù vì YAGNI (rồi vì lùi buổi thay nợ); unit đổi tháng→4 buổi để nghỉ/hủy không nhảy unit ảo; ghi danh sửa bằng archive-mốc + grantPast + 3 cổng thống nhất; realign force phá đóng băng migrate; prod dạy e2e-vòng, iPhone capture, F3 chỉ lớp trống.
