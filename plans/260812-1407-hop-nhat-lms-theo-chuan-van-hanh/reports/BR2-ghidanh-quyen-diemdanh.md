# BR2 — Đặc tả nghiệp vụ: Ghi danh + Quyền học + Điểm danh + Vòng đời HS + Gia đình

Nguồn: `/home/manhquy/Downloads/cmc-lms` (chỉ đọc).  
Múi giờ nghiệp vụ: **Asia/Ho_Chi_Minh (ICT, UTC+7)** qua `ictTodayUtc` / `ictTodayIso`.  
Ngày đo: 2026-08-12.

Nhãn: `CHUẨN` | `TẠM` | `THIẾU` | `SEAM` (định nghĩa BRIEF2).

---

## 0. Hằng số & đồng hồ

| Hằng | Giá trị | Ý nghĩa | Nhãn | Bằng chứng |
|------|---------|---------|------|------------|
| `SESSIONS_PER_UNIT` | `4` | 4 buổi hợp lệ / unit | CHUẨN | `packages/domain/src/unit-progression.ts:15` |
| ICT offset | `7` giờ | quy đổi giờ bắt đầu buổi ICT → UTC | CHUẨN | `apps/api/src/lib/attendance-window.ts:3` |
| Cửa sổ điểm danh mở | `start − 15 phút` | trước giờ học ICT | CHUẨN | `attendance-window.ts:4,38-39` |
| Cửa sổ điểm danh đóng | UTC `17:00` cùng `sessionDate` | = **hết ngày ICT** (00:00 ICT ngày kế) | CHUẨN | `attendance-window.ts:39-48` |
| Expiring threshold | `0 < remaining ≤ 1` | "sắp hết unit" | CHUẨN | `enrollment.ts:795,854` |
| Advisory lock enrollment | `hashtext(batchId:studentId)`, ns `91002` | serialize add/revoke/archive/grantPast | CHUẨN | `enrollment.ts:306-308` (và các chỗ tương tự) |
| Advisory lock SĐT PH | `hashtext(phone)`, ns `91001` | serialize tạo HS / đổi SĐT PH | CHUẨN | `student.ts:158`; `parent.ts:74` |
| `BLOCKED_LMS_LIFECYCLE` | `{on_hold, withdrawn, transferred}` | chặn login LMS + roster điểm danh + lịch sử family | CHUẨN | `sessions.ts:17-21` |
| `Enrollment.status` | enum có; **không** là cổng roster | chỉ migrate | TẠM | `enrollment.ts:1-3`; `schema.prisma:80-86` |
| Cookie session TTL | 12h | family/staff | CHUẨN | `jwt.ts:28`; `auth.ts:85` |

**Ngày ICT:** `ictTodayUtc(now)` = midnight UTC của chuỗi `YYYY-MM-DD` theo TZ ICT (`ict-date.ts:40-43`). Cột `@db.Date` so sánh bằng `.getTime()` sau chuẩn hóa.

---

## 1. Mô hình dữ liệu quyền học

| Khái niệm | Luật | Nhãn | Bằng chứng |
|-----------|------|------|------------|
| Enrollment | unique `(classBatchId, studentId)`; 1 HS 1 dòng/lớp | CHUẨN | `schema.prisma:396-410` |
| EnrollmentUnitRange | dãy liên tục `[fromOrderGlobal..toOrderGlobal]`; nhiều dãy; **được phép hở** giữa đợt | CHUẨN | `schema.prisma:413-427`; comment addWithUnits `enrollment.ts:252-253` |
| Quyền học | **chỉ** ranges + (tùy chỗ) lifecycle + `archivedAt` theo ngày buổi | CHUẨN | domain `isEntitled` + `enrollmentCoversSession` |
| `Enrollment.status` | **không** gate roster | TẠM | `enrollment.ts:1-3` |
| Unit order | `orderGlobal` thuộc **course của lớp**; không nhảy chéo CT | CHUẨN | validate `idx.byOrder.has(o)` `enrollment.ts:275-278` |
| Unit hiệu lực lớp | unit stamp buổi non-cancelled sắp tới (`sessionDate >= hôm nay ICT`); fallback buổi cuối; fallback neo | CHUẨN | `batch-unit.ts:35-61` |

### Công thức thuần domain

| Hàm | Công thức | Nhãn | Bằng chứng |
|-----|-----------|------|------------|
| `isEntitled(ranges, order)` | `∃ range: from ≤ order ≤ to` | CHUẨN | `unit-progression.ts:59-61` |
| `remainingUnits(ranges, currentOrder)` | \|Set các order `≥ currentOrder` thuộc bất kỳ range\| (khử trùng chồng) | CHUẨN | `unit-progression.ts:70-77` |
| `enrollmentCoversSession(archivedDayUtc, sessionDate)` | `archivedDayUtc == null OR sessionDate ≤ archivedDayUtc` (so **ngày**, UTC-midnight) | CHUẨN | `unit-progression.ts:85-87` |
| `validateNewRange(range, currentOrder)` | `from≤to`; `from ≥ currentOrder` else `starts_in_past` | CHUẨN | `unit-progression.ts:94-101` |
| `splitEntitlement` | mỗi enrollment: `entitledNow=isEntitled(...)`, `remaining=remainingUnits(...)` | CHUẨN | `batch-unit.ts:113-122` |

**Hết unit:** `remaining === 0` và `unitRanges.length > 0` → UI flag `expired`; `unitRanges.length === 0` → `noRange` (mồ côi). `enrollment.ts:766-788`.

---

## 2. `addWithUnits` — ghi danh / cấp dãy unit thường

**Procedure:** `enrollment.addWithUnits` · `adminProcedure` · `enrollment.ts:254-362`

| Luật | Điều kiện kích hoạt | Hành vi | Chặn / lỗi | Nhãn | Bằng chứng |
|------|---------------------|---------|------------|------|------------|
| Chỉ admin | session admin | mutation | FORBIDDEN nếu không admin | CHUẨN | `trpc.ts:68-71` |
| Lớp discard | `batch.archivedAt != null` | — | `NOT_FOUND` "Không tìm thấy lớp" | CHUẨN | `enrollment.ts:267-269` |
| Lớp phải running | `batch.status !== 'running'` | — | `BAD_REQUEST` "Lớp không ở trạng thái đang chạy" | CHUẨN | `enrollment.ts:270-272` |
| Unit thuộc CT lớp | mỗi `o ∈ [from..to]` ∈ `idx.byOrder` | — | `BAD_REQUEST` unit order không thuộc CT | CHUẨN | `enrollment.ts:275-278` |
| Input order | `fromOrder`, `toOrder` int **positive** | — | Zod fail | CHUẨN | `enrollment.ts:259-260` |
| Không bắt đầu quá khứ | `validateNewRange` vs **effective.order** (unit hiệu lực derive buổi) | ok | `starts_in_past` → `BAD_REQUEST` "Không cấp được unit đã qua — unit hiện tại …" | CHUẨN | `enrollment.ts:280-291`; domain `unit-progression.ts:99-100` |
| Dãy đảo | `from > to` | — | `BAD_REQUEST` "Dãy unit không hợp lệ" | CHUẨN | `validateNewRange` inverted |
| HS tồn tại chưa soft-delete | `student.archivedAt == null` | — | `NOT_FOUND` HS | CHUẨN | `enrollment.ts:295-301` |
| Serialize | advisory lock `(batchId:studentId)` ns 91002 | trước read ranges | — | CHUẨN | `enrollment.ts:306-308` |
| Tạo/reuse enrollment | unique (batch, student); create nếu chưa có | include unitRanges | — | CHUẨN | `enrollment.ts:310-318` |
| **Re-add sau gỡ** | `enrollment.archivedAt != null` | set `archivedAt=null` + log `restored` **trước** add range mới; **hồi sinh cả dãy cũ** | — | CHUẨN | `enrollment.ts:319-333` |
| Chống chồng range | overlap: `r.from ≤ to AND from ≤ r.to` | — | `CONFLICT` "HS đã có quyền tới {code}" | CHUẨN | `enrollment.ts:335-341` |
| Ghi range mới | create `EnrollmentUnitRange` + log updated | return `{enrollmentId, fromCode, toCode}` | — | CHUẨN | `enrollment.ts:342-361` |
| Hở giữa đợt | không merge/fill gap | cho phép | — | CHUẨN | comment `252-253` |

**Không làm:** không xóa attendance/submission cũ; không set `Enrollment.status`.

---

## 3. `previewGrantPast` / `grantPast` — cấp bù unit quá khứ

**Mục đích:** ngoại lệ duy nhất bỏ chặn `starts_in_past` (migrate / nhập bù). `addWithUnits` **không** nới.

### 3.1 Khác `addWithUnits`

| Khía cạnh | addWithUnits | grantPast | Nhãn | Bằng chứng |
|-----------|--------------|-----------|------|------------|
| Quá khứ `from < effective` | CHẶN | CHO PHÉP | CHUẨN | `grantPastPreview` comment `enrollment.ts:123-127` |
| Preview bắt buộc | không | `previewGrantPast` + `seenHash` | CHUẨN | `enrollment.ts:576-590,592-594` |
| Batch status running | bắt buộc | **chỉ** check `batch.archivedAt` (không check running trong grantPast) | CHUẨN* | grantPast `606-612` vs add `270-272` |
| Ghi danh đã archive | re-add → unarchive | **CHẶN** — "hoàn tác trước khi cấp bù" | CHUẨN | `enrollment.ts:627-639` |
| Floor lớp | không | `fromOrder ≥ batchUnitFloor` (min order buổi từng có; hoặc startUnit nếu chưa buổi) | CHUẨN | `enrollment.ts:97-111,144-150` |
| Overlap range | CONFLICT | CONFLICT (preview + commit) | CHUẨN | `enrollment.ts:156-161` |

\*Khác biệt batch.status: code thật; khi port ghi nhận — grantPast không mirror check `running`.

### 3.2 `grantPastPreview` — số hậu quả

| Field | Công thức | Nhãn | Bằng chứng |
|-------|------------|------|------------|
| pastUnits / futureUnits | đếm order trong [from..to]: `o < effective.order` vs `else` | CHUẨN | `enrollment.ts:210-215` |
| pastSessions | buổi `status ≠ cancelled`, unit stamp trong [from..to], `sessionDate ≤ today ICT` | CHUẨN | `enrollment.ts:167-180` |
| attendedGap | pastSessions **chưa** có Attendance cho enrollment (nếu chưa có enrollment → tất cả gap) | CHUẨN | `enrollment.ts:184-198` |
| missingExerciseSessions | pastSessions có `deliveredExercise` (HS sẽ thiếu bài đã phát) | CHUẨN | `enrollment.ts:199` |
| affectedMonths | unique (year,month) UTC của pastSessions | CHUẨN | `enrollment.ts:195-208` |

### 3.3 Preview hash (H4 TOCTOU)

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| Payload hash | `sha256(JSON({effectiveOrder, attendedGap, missingExerciseSessions, affectedMonths}))` hex | CHUẨN | `enrollment.ts:236-248` |
| preview trả | rest fields + `seenHash` (không lộ effectiveOrder/enrollmentId/pastSessionsCount ra client body đã strip một phần) | CHUẨN | `enrollment.ts:586-589` |
| commit | trong lock: tính lại preview → hash ≠ `seenHash` → `{committed:false}` **không** throw | CHUẨN | `enrollment.ts:645-648` |
| commit ok | create enrollment nếu thiếu; create range; log | CHUẨN | `enrollment.ts:651-681` |

---

## 4. `revokeFromNext` — thu hồi từ unit kế tiếp

**Procedure:** `enrollment.revokeFromNext` · admin · reason min 3 ký tự · `enrollment.ts:364-417`

| Luật | Hành vi | Nhãn | Bằng chứng |
|------|---------|------|------------|
| Guard | `enrollment.archivedAt` hoặc `batch.archivedAt` → `NOT_FOUND` | CHUẨN | `382-384` |
| Mốc cắt `C` | `effective.order` **đọc trong transaction** (sau lock) | CHUẨN | `393-396` |
| Range `from > C` | **DELETE** range | CHUẨN | `401-402` |
| Range `to > C` và `from ≤ C` | **UPDATE** `toOrderGlobal = C` (giữ unit đang học) | CHUẨN | `403-405` |
| Range `to ≤ C` | giữ nguyên | CHUẨN | (không vào if) |
| Giữ lại | quyền tới unit hiện tại (inclusive C); attendance/submission/history **không đụng** | CHUẨN | comment D3 `364`; log `407-413` |
| Return | `{revokedFromOrder: C+1, keptThroughUnit: unitCode}` | CHUẨN | `416` |
| Tiền / hoàn phí | comment spec: "tiền xử ngoài hệ" | **SEAM** | `docs/class-unit-spec.md:213-215` |

---

## 5. `archive` / `unarchive` — gỡ / hoàn tác khỏi một lớp

### 5.1 Hiệu lực `archivedAt`

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| Giá trị ghi | `archivedAt = ictTodayUtc()` (**ngày ICT midnight**, không wall-clock ms) | CHUẨN | `enrollment.ts:506-511` |
| Hiệu lực roster | buổi có `sessionDate ≤ archivedDayUtc` **vẫn** cover; buổi **sau** mốc **không** | CHUẨN | `unit-progression.ts:83-87`; log "từ ngày hôm sau" `519` |
| Cùng ngày gỡ | HS **còn** trong roster buổi hôm đó | CHUẨN | domain comment `83-84` |
| Idempotent archive lần 2 | trả mốc cũ, không push mốc, `committed:true`, không log mới | CHUẨN | `enrollment.ts:467-474` |
| Cảnh báo 2 bước | `seen` undefined → preview `committed:false`; confirm `warningsMatchSeen` | CHUẨN | `495-504`; `warning-confirm.ts:24-28` |
| Warning clean | footprint: 0 att + 0 sub + 0 delivered entitled | CHUẨN | `477-483` |
| Warning has-data | giữ dữ liệu; hiệu lực từ hôm sau | CHUẨN | `485-492` |
| Batch discard | `NOT_FOUND` lớp | CHUẨN | `450-452` |
| unarchive | chỉ khi `archivedAt != null`; set null; trả unitRanges | CHUẨN | `527-574` |
| unarchive khi chưa gỡ | `BAD_REQUEST` | CHUẨN | `544-546` |

### 5.2 `enrollmentCoversSession` (chuẩn hóa API)

```
archivedDayUtc = archivedAt ? ictTodayUtc(archivedAt) : null
covers = archivedDayUtc == null || sessionDate.getTime() <= archivedDayUtc.getTime()
```

API luôn chuẩn hóa qua `archivedDayUtcOf` trước khi gọi domain (`enrollment.ts:21-23`, `attendance.ts:30-32`).

---

## 6. `isEntitled` / `remainingUnits` / expiring

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| Còn quyền unit U | `isEntitled(ranges, U)` | CHUẨN | domain |
| remaining từ unit hiện tại lớp | `remainingUnits(ranges, effectiveOrder)` gồm unit đang học nếu entitled | CHUẨN | `unit-progression.ts:63-77` |
| Hết unit (derive) | `hasRanges && remaining===0` → `expired:true` | CHUẨN | `enrollment.ts:786-788` |
| Expiring list | lớp `running` + `archivedAt null`; enrollment `archivedAt null`; `0 < remaining ≤ 1` | CHUẨN | `enrollment.ts:795-866` |
| Ngưỡng | **≤ 1** (còn đúng 1 unit hoặc fraction set size 1) | CHUẨN | `854` + domain comment `64` |

---

## 7. Roster điểm danh — điều kiện đủ để HS xuất hiện

### 7.1 `sessionRoster` (GV/admin điểm danh) — **chuẩn vận hành**

File: `attendance.ts:51-117`

HS ∈ roster buổi S ⇔ **TẤT CẢ**:

| # | Điều kiện | Ghi chú |
|---|-----------|---------|
| 1 | Có `Enrollment` với `classBatchId = S.classBatchId` | đọc **kể cả** archived |
| 2 | `isEntitled(unitRanges, orderS)` | `orderS` = stamp `curriculumUnit.orderGlobal` của buổi; fallback `currentUnitOrderOf` lớp |
| 3 | `!BLOCKED_LMS_LIFECYCLE.has(student.lifecycle)` | on_hold / withdrawn / transferred **loại**; **completed giữ** |
| 4 | `enrollmentCoversSession(archivedDayUtc, S.sessionDate)` | gỡ từ hôm sau |

**Không** yêu cầu: `Enrollment.status`; session không cancelled để **liệt kê** roster (nhưng mark chặn cancelled).

Nhãn: **CHUẨN**.

### 7.2 `enrollment.rosterForSession` (admin)

`enrollment.ts:685-732` — điều kiện **1,2,4** — **KHÔNG** filter lifecycle.  
→ Lệch nhẹ với roster điểm danh. Nhãn: **CHUẨN** (admin list) nhưng khi port cần biết **khác** attendance roster.

### 7.3 D1 bất biến

Roster theo **unit của buổi** (đã stamp), không theo unit hiện tại lớp → roster lịch sử ổn định khi lớp sang unit mới. `enrollment.ts:685-686`; spec `class-unit-spec.md:185-189`.

---

## 8. Điểm danh

### 8.1 Cửa sổ thời gian

| | |
|--|--|
| Mở | `sessionStartUtc(sessionDate, startTime) − 15 phút` |
| `sessionStartUtc` | parse `HH:mm`; `Date.UTC(y,m,d, hour-7, minute)` (startTime là ICT) |
| Đóng | `Date.UTC(y,m,d, 17, 0, 0)` = hết ngày ICT của `sessionDate` |
| Check | `now < opensAt OR now > closesAt` → BAD_REQUEST "Ngoài giờ điểm danh…" |
| **Override** | **chỉ admin** bỏ qua cửa sổ; teacher luôn `assertAttendanceWindowOpen` |

Nhãn: **CHUẨN**.  
Bằng chứng: `attendance-window.ts:33-65`; `attendance.ts:34-41` (`assertWindowForActor`).

### 8.2 Ai được điểm danh

| Actor | Guard | Nhãn | Bằng chứng |
|-------|-------|------|------------|
| Teacher | `staffProcedure` + `assertTeachingSessionAccess` (session.teacherId = user) | CHUẨN | `attendance.ts:559-562`; `teaching-authz.ts` |
| Admin | cùng access với `allowAdmin: true` | CHUẨN | `560-561` |

### 8.3 `mark` (từng HS)

| Luật | Hành vi / chặn | Nhãn | Bằng chứng |
|------|----------------|------|------------|
| Session cancelled | BAD_REQUEST không điểm danh | CHUẨN | `563-565` |
| Window | teacher phase-gate; admin free | CHUẨN | `566` |
| Enrollment khác lớp | BAD_REQUEST | CHUẨN | `582-587` |
| Lifecycle blocked | BAD_REQUEST "Học sinh đã nghỉ/tạm dừng…" | CHUẨN | `591-596` |
| Không entitled / không cover | BAD_REQUEST "không còn quyền unit…" | CHUẨN | `606-614` |
| Status | enum `present \| absent \| late` | CHUẨN | `schema.prisma:88-92`; input `attendance.ts:423` |
| excused | boolean default false; **độc lập** status (late+excused được) | CHUẨN | upsert `626`; monthly report `231-232` |
| note | optional string | CHUẨN | markInput |
| Upsert | unique `(classSessionId, enrollmentId)` | CHUẨN | `617-640` |

### 8.4 `markAll`

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| defaultStatus | áp cho roster | CHUẨN | `652-675` |
| overrides | per enrollmentId; max 1 override/HS; phải ∈ roster | CHUẨN | `689-702` |
| `overwriteExisting` default **false** | đã có attendance + không override → **skip** (không xóa điểm riêng) | CHUẨN | `667-722` |
| excused override | default false nếu không set | CHUẨN | `725` |

### 8.5 Family xem

`myAttendance` / `attendanceForChild`: ownership + `attendanceHistoryForStudent` — lifecycle blocked → `[]`; lịch sử buổi entitled kể cả chưa mark (`attendance: null`). `attendance.ts:766-778,139-218`.

---

## 9. Vòng đời học sinh (`Student.lifecycle`)

### 9.1 Sáu giá trị

| Value | Label UI (admin) | Chặn login family (con biến mất khỏi studentIds) | Chặn roster điểm danh / mark | Family history attendance | Nhãn | Bằng chứng |
|-------|------------------|--------------------------------------------------|------------------------------|---------------------------|------|------------|
| `admitted` | (enum) | không | không | có (nếu entitled) | CHUẨN | schema `38-45` |
| `active` | — | không | không | có | CHUẨN | create default `student.ts:219` |
| `on_hold` | Tạm dừng | **có** | **có** | rỗng | CHUẨN | BLOCKED + `student.ts:24` |
| `transferred` | Đã chuyển | **có** | **có** | rỗng | CHUẨN | |
| `withdrawn` | (BLOCKING label) | **có** | **có** | rỗng | CHUẨN | |
| `completed` | — | **không** | **không** | có | CHUẨN | comment sessions `15-16`; attendance `104-105` |

### 9.2 `setLifecycle`

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| Admin only | — | CHUẨN | `student.ts:399` |
| No-op nếu same | committed true, không log | CHUẨN | `418-420` |
| Cảnh báo 2 bước | chỉ khi **chuyển VÀO** BLOCKED từ non-blocked **và** còn enrollment active non-archived ở lớp running | CHUẨN | `425-448` |
| Nội dung cảnh báo | ẩn điểm danh; ngừng phát bài mới; chặn đăng nhập HS; có thể ảnh hưởng PH nếu con duy nhất | CHUẨN | `439-441` |
| Confirm | `seen` khớp id warnings | CHUẨN | `451-462` |
| Side-effect DB | **chỉ** update lifecycle + log — **không** auto archive enrollment | CHUẨN | `465-481` |

**Hệ quả đăng nhập family:** `familySession` filter bỏ con blocked; nếu **0** con hợp lệ → `loginFamilyByPhone` fail null (`sessions.ts:140-141`).

---

## 10. Gia đình (Guardian / ownership / khóa)

### 10.1 Quan hệ

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| ParentAccount | phone unique (login), email?, passwordHash?, isActive, tokenVersion | CHUẨN | `schema.prisma:548-563` |
| Guardian | unique (parentAccountId, studentId); relation enum | CHUẨN | `579-591` |
| Tạo HS | admin `student.create`: reuse PH theo SĐT; Guardian; StudentAccount loginCode=studentCode | CHUẨN | `student.ts:154-244` |
| GuardianLinkRequest | model + status pending/approved/rejected | **THIẾU** API approve/reject trong routers đã audit | schema `593-610`; parent router không có approve |

### 10.2 Đổi con

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| Session mang tất cả con hợp lệ | JWT chỉ sub=ParentAccount.id | CHUẨN | `sessions.ts:83-105`; `jwt.ts:8-14` |
| Active child | `localStorage` `cmc.family.activeStudentId`; 1 con auto-select | CHUẨN | `active-student.tsx:5,44-48` |
| Không re-mint | setStudentId client-only | CHUẨN | `active-student.tsx:1-2,58-61` |
| Picker | "Ai đang học hôm nay?" | CHUẨN | `profile-picker.tsx` |

### 10.3 Ownership API family

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| Mọi procedure family nhận `studentId` | `assertPrincipalOwnsStudent(session.studentIds, studentId)` else FORBIDDEN | CHUẨN | `principal-owns-student.ts:10-14` |
| studentIds nguồn | resolve DB mỗi request từ Guardian − blocked lifecycle | CHUẨN | `sessions.ts:93-102` |
| Ví dụ | enrollment.classesForChild, attendance.myAttendance, submission.*, rewards.*, exercise.forStudent, sessionEvidence.listForPrincipal | CHUẨN | các router familyProcedure |

### 10.4 Khóa tài khoản gia đình

| Luật | Chi tiết | Nhãn | Bằng chứng |
|------|----------|------|------------|
| `parent.setActive(false)` | `ParentAccount.isActive=false` + bump `tokenVersion`; cascade bump **mọi StudentAccount** của con qua Guardian | CHUẨN | `parent.ts:250-286` |
| Login | `!isActive` → login fail (dummy hash timing) | CHUẨN | `sessions.ts:135-137` |
| Mở lại | chỉ `isActive=true`, **không** cascade tokenVersion | CHUẨN | `parent.ts:247-248,280-285` |
| Comment stale | comment vẫn nói mint kind student | TẠM (doc drift) | `parent.ts:239-242` vs runtime family |

---

## 11. Đổi lớp & bảo lưu — làm bằng tổ hợp (không API “transfer” riêng)

| Nhu cầu nghiệp vụ | Cách làm trong code hiện tại | API | Nhãn | Bằng chứng |
|-------------------|------------------------------|-----|------|------------|
| **Nghỉ / gỡ khỏi 1 lớp** (giữ lịch sử buổi ≤ mốc) | `enrollment.archive` | archive / unarchive | CHUẨN | mục 5 |
| **Học tiếp cùng lớp** (hết unit) | `addWithUnits` dãy mới (có thể hở) | addWithUnits | CHUẨN | M4 `enrollment.ts:252-253` |
| **Quay lại lớp đã gỡ** | `addWithUnits` (auto unarchive + giữ ranges cũ) **hoặc** `unarchive` rồi add range | add / unarchive | CHUẨN | `319-333` |
| **Thu hồi unit tương lai** (còn trong lớp) | `revokeFromNext` | — | CHUẨN | mục 4 |
| **Bảo lưu / tạm dừng toàn trung tâm** | `student.setLifecycle('on_hold')` — ẩn roster **mọi** lớp; chặn login con; **không** archive enrollment | setLifecycle | CHUẨN | mục 9; class-unit-spec `196-202` |
| **Thôi học** | `lifecycle='withdrawn'` (+ tùy chọn archive từng lớp) | setLifecycle | CHUẨN | |
| **Chuyển trường / chuyển đi** | `lifecycle='transferred'` — **không** có procedure chuyển enrollment sang batch khác atomic | setLifecycle | CHUẨN (lifecycle) / **THIẾU** (wizard đổi lớp 1-click) | không tìm thấy API transfer batch |
| **Đổi lớp thực tế** (ra lớp A vào lớp B) | thao tác admin: `archive` A + `addWithUnits` B (và/hoặc lifecycle) — **thủ công 2 bước** | compose | **SEAM**/vận hành | không atomic transaction cross-batch |
| `EnrollmentStatus.transferred` | enum schema; **không** dùng gate | TẠM | schema `80-86`; enrollment header |

---

## 12. Ma trận ưu tiên khi nhiều luật đụng nhau (roster / mark)

Thứ tự filter thực tế trong `sessionRoster`:

1. Có enrollment cùng batch  
2. `isEntitled(unit của buổi)`  
3. lifecycle ∉ BLOCKED  
4. `enrollmentCoversSession`  

**Mark** thêm: session ≠ cancelled; window (trừ admin); enrollment đúng lớp.

**Family history:** lifecycle blocked → cắt **toàn bộ** history (không chỉ tương lai).

**Admin student.detail:** cố ý **không** dùng gate BLOCKED khi đọc history (admin thấy hết) — `student.ts:488-493`.

Nhãn: **CHUẨN**.

---

## 13. SEAM / TẠM / THIẾU — tóm tắt port

| Mục | Nhãn | Lý do ngắn |
|-----|------|------------|
| Toàn bộ unit-range, archive theo ngày, roster D1, attendance window, lifecycle BLOCKED, family ownership | **CHUẨN** | nghiệp vụ dạy-học tinh |
| revokeFromNext lý do "hoàn phí" | **SEAM** | tiền ngoài LMS |
| Đổi lớp atomic / đồng bộ phiếu thu | **SEAM** / **THIẾU** | compose thủ công; ERP cmc_edu đã có tiền |
| `Enrollment.status` | **TẠM** | migrate only |
| GuardianLinkRequest self-service | **THIẾU** | schema không API |
| StudentAccount login | **TẠM** | bảng còn, login path không |
| grantPast không check `batch.status===running` | ghi nhận lệch | code thật — quyết định port có siết không |

---

## Unknowns

| # | UNKNOWN |
|---|---------|
| U1 | Có UI/admin path nào set `Enrollment.status` sau migrate không — grep runtime gần như không dùng. |
| U2 | `grantPast` cố ý bỏ check `running` hay sót — không có comment khẳng định. |
| U3 | `enrollment.rosterForSession` (admin) bỏ lifecycle: product intent hay sót đồng bộ với attendance. |
| U4 | Wizard "đổi lớp" ngoài compose archive+add — không thấy. |
| U5 | GuardianLinkRequest approve flow — không có trong parent/student router đã đọc. |
| U6 | Tương tác phát bài (`exercise-delivery`) với lifecycle — comment khẳng định filter BLOCKED (`exercise-delivery.ts:203`) nhưng chi tiết formula không mở rộng BR2 này. |

---

Status: DONE | Summary: Đặc tả đủ implement lại ghi danh unit-range, grantPast+hash, revoke/archive, roster D1, cửa sổ điểm danh ICT, lifecycle 6 giá trị, family ownership; đổi lớp = compose archive+add, bảo lưu = on_hold.
