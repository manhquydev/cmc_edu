# Scout bizdiff — vòng đời lớp + buổi + lịch

Phạm vi: tạo/mở/đóng/mở lại lớp, trạng thái lớp, khung `ScheduleSlot`, sinh buổi, hủy/hồi sinh buổi, đổi GV buổi, neo unit.

| Bên | Repo | HEAD lúc scout |
|---|---|---|
| Nguồn (chuẩn nghiệp vụ) | `/home/manhquy/Downloads/cmc-lms` | `031d193` (đúng freeze) |
| Đích | `/home/manhquy/Downloads/cmc_edu` | `af85b78` |

Phương pháp: `ak-scout` đọc-only — `rg` + đọc router/schema/service. Không sửa file ngoài báo cáo này. Không suy đoán: ô không có procedure/cột thì ghi **THIEU** hoặc **khong tim thay**.

Xác minh lại 3 khẳng định sẵn có:

| Khẳng định | Kết quả |
|---|---|
| `cmc_edu` không có đường reopen lớp | Đúng. `rg classBatch.reopen` trong `apps/api/src/class` và `apps/api/src/lms-ops` = 0. Các `reopen` còn lại là payslip/CRM. |
| `cmc_edu` không hủy buổi khi gỡ khung | Đúng. Không có `removeSlot`/`editSlot` procedure. `scheduleSlot.create` chỉ chạy lúc tạo lớp. |
| `cmc_edu` không có `SessionCancelReason` | Đúng. `rg SessionCancelReason\|cancelReason\|slot_removed\|class_closed` trong `apps/api/src` = 0. |

---

## Bảng đối sánh

Cột 4 = mức độ **khi port chuẩn nguồn sang đích** + một câu lý do.

| Năng lực | cmc-lms (file:dòng) | cmc_edu (file:dòng hoặc THIEU) | Mức độ |
|---|---|---|---|
| Tạo lớp: admin nhập chương trình + unit bắt đầu + ngày KG + ≥1 khung → mã lớp, `status=running`, neo unit = (startUnit, startDate), sinh buổi | `apps/api/src/routers/class-batch.ts:129-189` (create, `status: 'running'` :155, neo :151-152, `ensureSessionsUntil` :185); UI không nằm trong phạm vi API nhưng nút tạo đi qua procedure này | Có, **khác mô hình**. UI gọi `lmsOps.createClassWithUnits` `apps/admin/src/pages/classes/index.tsx:260`; API `apps/api/src/lms-ops/router.ts:107-221` (neo :167-169, sinh `[startDate,endDate]` :188-205). Đường cũ `classBatch.create` `apps/api/src/class/class-batch-router.ts:145-254` **không** ghi neo (`:194-206`). Lớp đích **bắt buộc `endDate`**, không cuốn chiếu. | **BAT BUOC** — không tạo được lớp thì không có buổi/unit/ghi danh. Đích đã có đường unit-aware; thiếu cuốn chiếu + `effectiveFrom`. |
| Mở lớp `planned`/`open` → `running` (procedure riêng) | **khong tim thay**. Enum giữ 5 giá trị `packages/db/prisma/schema.prisma:47-55` kèm chú thích hệ mới chỉ dùng running/closed, planned/open/cancelled cho migrate `:47-48`. `rg status: 'open'` trong `apps/api/src/routers` = 0. Tạo lớp ghi thẳng `running` `:155`. | **khong tim thay**. Cột `status String @default("active")` `packages/db/prisma/schema.prisma:662-665`. Writer `classBatch.update` trong `apps/api/src/class` chỉ đổi GV `:365-368` hoặc `endDate` `schedule-router.ts:51-54`. Không procedure “mở lớp”. | **BO DUOC** — nguồn vận hành không có bước “mở”; planned/open là di sản migrate. |
| Đóng lớp: preflight HS còn quyền → `force` + `seenStudentIds` → `status=closed` + hủy buổi tương lai `planned`/`confirmed` lý do `class_closed` + thu hồi bài | `apps/api/src/routers/class-batch.ts:679-767` (preflight `:723-728`, force khớp danh sách `:730-737`, `status: 'closed'` `:740`, hủy `:744-756`); UI `apps/web/src/admin/class-detail-page.tsx:185-186,479-510` | **THIEU**. `rg classBatch.close\|data: \{ status: 'closed' \}` trong `apps/api/src/class` và `lms-ops` = 0. Schema ghi “Not exercised by any P2-Foundation procedure yet” `packages/db/prisma/schema.prisma:662-665`. UI detail không có nút đóng `apps/admin/src/pages/classes/class-detail.tsx:515-529` (actions chỉ xếp dãy bài). | **BAT BUOC** — lớp chạy xong khung phải đóng; không đóng thì cron/sinh buổi (nếu port) và quyền HS không cắt. |
| Mở lại lớp (`reopen`): chỉ `closed` → `running`; hồi sinh **chỉ** buổi `cancelReason=class_closed` từ hôm nay; rồi `ensureSessionsUntil` | `apps/api/src/routers/class-batch.ts:769-812` (revive `:788-800`); UI `apps/web/src/admin/class-detail-page.tsx:188-200`; test `apps/api/src/test/admin-core.int.test.ts:238-273,487-501` | **THIEU**. `rg classBatch.reopen` trong `apps/api/src/class` + `lms-ops` = 0. | **BAT BUOC** — đóng nhầm phải cứu được (nguồn ghi rõ red-team #7). Không có reason thì cũng không revive chọn lọc được. |
| Trạng thái lớp: enum 5 giá trị `planned \| open \| running \| closed \| cancelled` (đã bỏ `paused`) | Enum `packages/db/prisma/schema.prisma:49-55`; mặc định `running` `:300`; migration drop paused `packages/db/prisma/migrations/20260727052000_drop_paused_add_unit_anchor/migration.sql:3` | Cột `String @default("active")` `packages/db/prisma/schema.prisma:662-665`. UI nhãn khác schema: `planned/active/completed/cancelled/closed` `apps/admin/src/pages/classes/class-detail.tsx:33-66`. Không writer đổi status lớp. | **BAT BUOC** cho cặp đang-chạy/đã-đóng (nguồn `running/closed`, đích comment `active/closed`). Ba giá trị migrate `planned/open/cancelled` **BO DUOC** nếu đích không nhập lớp cũ. UI đích đang vẽ 5 nhãn không khớp writer. |
| Xóa mềm lớp tạo nhầm (`discard`) khi chưa điểm danh; `undiscard` khôi phục | `discard` `apps/api/src/routers/class-batch.ts:814-854`; `undiscard` `:330-354` | **THIEU**. `rg classBatch.discard\|undiscard` trong `apps/api/src` = 0. | **NEN CO** — tách “xóa lớp nhầm” khỏi “đóng lớp”; không có thì admin chỉ còn xóa tay/DB. |
| Thêm khung giữa chừng: lớp `running`, `effectiveFrom=hôm nay`, cascade GV buổi tương lai cùng thứ/giờ, rồi sinh buổi | `addSlot` `apps/api/src/routers/class-batch.ts:856-948` (`effectiveFrom: today` `:900-902`, cascade GV `:910-927`, `ensureSessionsUntil` `:946`); UI `apps/web/src/admin/class-detail-page.tsx:1105-1111` | **THIEU** procedure sau tạo. `scheduleSlot.create` chỉ trong `classBatch.create` `apps/api/src/class/class-batch-router.ts:209-221` và `createClassWithUnits` `apps/api/src/lms-ops/router.ts:173-186`. Hàm `addSlot` ở `apps/admin/src/pages/classes/index.tsx:346` là **form tạo lớp**, không ghi DB khung của lớp đã có. | **BAT BUOC** — đổi lịch tuần (thêm buổi T3/T5) là thao tác vận hành thường xuyên. |
| Xóa khung: archive slot + hủy buổi tương lai `planned` chưa điểm danh lý do `slot_removed` + restamp | `removeSlot` `apps/api/src/routers/class-batch.ts:950-996` (hủy `:967-986`); UI `apps/web/src/admin/class-detail-page.tsx:1088-1092` | **THIEU**. Không `removeSlot`. Xóa slot trong form tạo `apps/admin/src/pages/classes/index.tsx:355` không đụng lớp đã lưu. | **BAT BUOC** — gỡ khung mà để buổi tương lai sống = dạy buổi ma / tính unit sai. |
| Sửa khung: chỉ đổi giờ kết/GV → cập nhật tại chỗ; đổi thứ hoặc giờ bắt → archive + hủy `slot_removed` + tạo khung mới `effectiveFrom=today` + sinh buổi | `editSlot` `apps/api/src/routers/class-batch.ts:1058-1216` (nhánh không dời `:1097-1123`, dời `:1143-1215`); UI `apps/web/src/admin/class-detail-page.tsx:1128-1130,1358` | **THIEU**. Không `editSlot`. | **BAT BUOC** — dời lịch tuần không được bắt admin xóa tay + thêm tay (nửa vời). |
| Cột `ScheduleSlot.effectiveFrom`: khung tạo cùng lớp = ngày KG; khung thêm sau = ngày thêm; generator không đẻ buổi quá khứ ma | Model `packages/db/prisma/schema.prisma:342-346`; gán lúc create `:162-164`; gán lúc addSlot `:900-902`; cửa sổ sinh `apps/api/src/services/session-generator.ts:26-30,64-68` | **THIEU** cột. Model `packages/db/prisma/schema.prisma:706-723` chỉ có `weekday/startTime/endTime`. `rg effectiveFrom` trong `apps/api/src` = 0. | **BAT BUOC** nếu port thêm/sửa khung giữa chừng. Không có mốc này thì regenerate theo `[startDate,endDate]` đẻ buổi lịch sử. |
| `ScheduleSlot.teacherId` per-khung (GV đứng buổi của khung đó) | Model `packages/db/prisma/schema.prisma:340-341`; input slot `:21` | **THIEU**. Slot không có `teacherId` `packages/db/prisma/schema.prisma:706-723`. GV nằm ở **lớp**: `ClassBatch.teacherId` / `teacherAppUserId` `:661,669`. | **BAT BUOC** — một lớp 2 khung (T3 GV A, T5 GV B) là lịch thật nguồn. Đích gán 1 GV/lớp. |
| Sinh buổi cuốn chiếu từ khung tới horizon (cuối tháng sau); chỉ lớp `running`; kẹp trần sức chứa 4 buổi/unit còn lại; có `revived` | `ensureSessionsUntil` `apps/api/src/services/session-generator.ts:32-144` (chặn non-running `:47-48`, trần `:97-107`, revive `:84-118`); gọi lúc tạo `:185`, addSlot `:946`, reopen `:810`, cron `apps/api/src/cron.ts:15-36` | Có sinh **cửa sổ cố định**, không cuốn chiếu, không trần, không revive. `planClassSessions` `apps/api/src/class/generate-sessions.ts:48-71`; persist `schedule.generateSessions` `apps/api/src/class/schedule-router.ts:32-91` (`createMany skipDuplicates` `:71-81`, có thể nới `endDate` `:49-54`). Cron cuốn chiếu: **khong tim thay** (worker đích là session-done-sweep, không materialize lớp). | **BAT BUOC** theo chuẩn nguồn (không có ngày kết, buổi đẻ dần). Đích đang chọn `[start,end]` — giữ mô hình đó thì `generateSessions` đủ để lấp cửa sổ, nhưng **không** thay được revive/trần/cron. |
| Hủy buổi tay (`manual`): chặn nếu đã điểm danh; `cancelReason=manual`; thu hồi bài; restamp lùi unit | `cancelSession` `apps/api/src/routers/class-batch.ts:1218-1258` (`cancelReason: 'manual'` `:1240`) | Có hủy + restamp, **không lý do**. `classSession.cancel` `apps/api/src/class/class-session-router.ts:292-306` → `cancelSessionWithRestamp` `apps/api/src/lms-ops/cancel-session.ts:30-67` (`data: { status: 'cancelled' }` không `cancelReason` `:66`); alias `lmsOps.cancelSessionAndRestamp` `apps/api/src/lms-ops/router.ts:401-413`; UI `apps/admin/src/pages/classes/class-detail.tsx:246-256,347-356`. Đích chặn `done` chứ không chặn theo số Attendance `:55-56`. | **BAT BUOC** (hủy buổi: đích đã có). Lý do hủy: xem hàng dưới. |
| Lý do hủy `SessionCancelReason` 4 giá trị: `manual` / `slot_removed` / `class_closed` / `ceiling` — quyết định buổi có được hồi sinh không | Enum + comment `packages/db/prisma/schema.prisma:63-73`; cột `ClassSession.cancelReason` `:376-377`; ghi `manual` `:1240`, `slot_removed` `:981,:1164`, `class_closed` `:753`, `ceiling` `session-generator.ts:232` | **THIEU** enum, cột, và mọi ghi reason. `ClassSession` `packages/db/prisma/schema.prisma:731-771` không có `cancelReason`. Hủy sweep cũng chỉ `status: 'cancelled'` `apps/api/src/worker/session-done-sweep.ts:92-99`. | **BAT BUOC** — không có reason thì reopen/thêm-lại-khung không phân được nghỉ lễ vs đóng lớp vs gỡ khung. |
| Hồi sinh buổi khi thêm lại khung cùng thứ/giờ: chỉ buổi `cancelled` + `cancelReason=slot_removed` → `planned` | `session-generator.ts:84-118` (lọc `:91`, `updateMany` `:114-118`) | **THIEU**. `generateSessions` `createMany skipDuplicates` `schedule-router.ts:71-81` bỏ qua hàng đã có (kể cả cancelled). Unique đích là `(classBatchId, scheduleSlotId, sessionDate)` `schema.prisma:765` — slot mới = id mới nên có thể **đẻ buổi trùng ngày** chứ không revive. | **BAT BUOC** đi cùng xóa/thêm khung. Thiếu = lỗ lịch vĩnh viễn hoặc buổi trùng. |
| Hồi sinh buổi khi mở lại lớp: chỉ `class_closed` tương lai | `class-batch.ts:788-800` | **THIEU** (không reopen, không reason). | **BAT BUOC** đi cùng đóng/mở lại. |
| Hủy buổi vượt trần khung (`ceiling`) khi restamp đẩy buổi tương lai quá unit cuối | `restampBatchUnits` `apps/api/src/services/session-generator.ts:227-235` | **THIEU**. `restampBatchSessions` `apps/api/src/lms-ops/stamp-sessions.ts:60-72` bỏ qua `done`, `continue` nếu không map được unit, **không** hủy. | **NEN CO** — đích có `endDate` nên ít đẻ vô hạn; vẫn cần khi neo bị chỉnh lùi/tiến và cửa sổ còn buổi thừa. |
| Đổi GV **buổi** (qua khung): `editSlotTeacher` ghi slot + cascade buổi tương lai chưa điểm danh cùng thứ/giờ | `editSlotTeacher` `apps/api/src/routers/class-batch.ts:998-1056`; UI inline `apps/web/src/admin/class-detail-page.tsx:1164-1168`. `ClassSession.teacherId` `packages/db/prisma/schema.prisma:373-374`. Procedure đổi GV **một buổi lẻ**: **khong tim thay**. | **THIEU** GV trên buổi. `ClassSession` không có `teacherId` `schema.prisma:731-771`. Có `classBatch.assignTeacher` `apps/api/src/class/class-batch-router.ts:351-371` — đổi GV **cả lớp**; UI `apps/admin/src/pages/classes/class-detail.tsx:70-94,489-494`. `classSession.list` trả `teacherId` của **batch** `class-session-router.ts:176,283`. | **BAT BUOC** nếu giữ mô hình nhiều khung/nhiều GV. `assignTeacher` đích **không** thay được “đổi GV buổi/khung”. |
| Neo unit lớp `currentUnitId` + `currentUnitAnchor` lúc tạo | Bắt buộc NOT NULL `packages/db/prisma/schema.prisma:294-297`; create ghi `:151-152` | Có, **nullable**. Schema `packages/db/prisma/schema.prisma:673-676`. `createClassWithUnits` ghi `:167-169`. `classBatch.create` legacy **không ghi** `:194-206`. | **BAT BUOC** — không neo thì không đếm 4-buổi/unit. Đích đã có trên đường UI mới. |
| Chỉnh neo tay (`setCurrentUnit`): neo mới = (unit chọn, hôm nay), restamp buổi tương lai, sinh bù nếu từng chạm trần | `setCurrentUnit` `apps/api/src/routers/class-batch.ts:411-492` (update neo `:471-473`); UI `apps/web/src/admin/class-detail-page.tsx:177` | **THIEU**. `rg setCurrentUnit` trong `apps/api/src/lms-ops` chỉ đọc `currentUnitId` (grant/roster), không mutation. UI detail gán unit **từng buổi** qua `classSession.assignUnit` `apps/admin/src/pages/classes/class-detail.tsx:185-221,310-322` — **không** đổi neo lớp. | **BAT BUOC** — vận hành thật chỉnh unit khi lớp lệch/nhảy. `assignUnit` từng buổi phá dãy 4-buổi nếu dùng thay neo. |
| Unit tiến theo số buổi hợp lệ: buổi non-cancelled thứ k từ neo mang unit `anchor + floor(k/4)` (4 buổi/unit); hủy buổi làm buổi sau lùi | Domain `packages/domain/src/unit-progression.ts:1-14,36-50` (`SESSIONS_PER_UNIT=4` `:15`); ghi qua `restampBatchUnits` `session-generator.ts:153-256` (gọi sau sinh/hủy/hồi sinh/đổi khung/chỉnh neo) | Có công thức tương đương, trục gap-aware. Domain `packages/domain-lms/src/unit-progression.ts:1-14,123-149`; ghi `restampBatchSessions` `apps/api/src/lms-ops/stamp-sessions.ts:24-73` — gọi lúc tạo unit-aware `:207-212`, hủy buổi `:93-98`, sweep 0-present `session-done-sweep.ts:131-136`. **Không** gọi khi thêm/xóa khung (vì không có API khung). | **BAT BUOC** — đây là cách tính “tháng học” nguồn. Đích đã port toán + restamp trên hủy; thiếu restamp khi đổi tập buổi do khung. |
| Sửa lệch unit lịch sử (`realignHistory`): chọn buổi mốc = buổi P của unit U → suy neo + restamp force | `realignHistory` `apps/api/src/routers/class-batch.ts:494-677`; domain `resolveReferenceAnchor` `packages/domain/src/unit-progression.ts:122-140` | Domain có `resolveReferenceAnchor` `packages/domain-lms/src/unit-progression.ts:225-258`. Procedure API: **khong tim thay** (`rg realignHistory` trong `apps/api/src` = 0). | **NEN CO** — sửa lớp migrate/lệch; không phải thao tác ngày thường. |

---

## Năng lực đích có thêm (ngoài chuẩn nguồn, cùng phạm vi)

Không tính là “đích đủ hơn nguồn”; ghi để khỏi nhầm thiếu.

| Năng lực đích | file:dòng | Ghi chú |
|---|---|---|
| Xác nhận buổi `planned` → `confirmed` | `apps/api/src/class/class-session-router.ts:310-333` | Nguồn có enum `confirmed` nhưng **khong tim thay** procedure confirm trong `class-batch.ts`. Comment nguồn: `mark()` không đổi status sang confirmed (`class-batch.ts:1036-1037`). |
| Gán unit từng buổi (`assignUnit`) | `class-session-router.ts:341-367` | Nguồn derive từ neo, không picker từng buổi. |
| `SessionStatus.done` + `doneAt` + sweep 0-present tự hủy | schema `:137-141`; sweep `session-done-sweep.ts:88-99` | Nguồn không có `done`. Sweep đích hủy **không** gắn reason. |
| Phòng + xung đột phòng lúc sinh | `class-batch-router.ts:226-232`; `room-conflict.ts` | Nguồn không có `Room` trên lớp/buổi trong schema đã đọc. |
| Nới `endDate` rồi sinh lại | `schedule-router.ts:49-54` | Nguồn không có `endDate` trên `ClassBatch` (`schema.prisma:286-310`). |

---

## DE XUAT

Thứ tự ưu tiên khi port chuẩn nguồn → đích (chỉ việc trong phạm vi lớp/buổi/lịch):

1. **Đóng lớp + mở lại lớp** — thêm `classBatch.close` / `classBatch.reopen` và writer `status` (`active`/`running` ↔ `closed`). Không có hai lệnh này thì vòng đời lớp đích chỉ là tạo rồi để treo.
2. **`SessionCancelReason` + cột `cancelReason`** — bốn giá trị nguồn. Mọi đường hủy (tay, gỡ khung, đóng lớp, trần, sweep) phải ghi reason. Reopen/revive phụ thuộc cột này.
3. **CRUD khung sau khi lớp đã chạy** (`addSlot` / `removeSlot` / `editSlot`) kèm `effectiveFrom` + `ScheduleSlot.teacherId`. Gỡ khung phải hủy buổi tương lai `slot_removed` rồi restamp.
4. **Hồi sinh chọn lọc** — port khối `session-generator.ts:84-118` (revive `slot_removed` khi khung trở lại) và khối `class-batch.ts:788-800` (revive `class_closed` khi reopen). Không dùng `skipDuplicates` làm “revive”.
5. **Sinh buổi cuốn chiếu + trần sức chứa** — `ensureSessionsUntil` (hoặc tương đương) thay vì chỉ `[startDate,endDate]`. Nếu chủ hệ thống **cố ý** giữ `endDate` ERP thì ghi rõ quyết định; lúc đó vẫn cần trần khi restamp và vẫn cần `effectiveFrom` cho khung mới.
6. **`setCurrentUnit`** — đổi neo lớp + restamp. Khóa hoặc bỏ `classSession.assignUnit` như đường chỉnh tiến trình (để picker chỉ dùng sửa lệch có kiểm soát, hoặc thay bằng `realignHistory`).
7. **Đổi GV theo khung/buổi** — đừng dùng `classBatch.assignTeacher` thay. Cần `teacherId` trên slot (và buổi), cascade buổi tương lai chưa điểm danh.
8. **`discard`/`undiscard`** và **`realignHistory`** — sau khi 1–7 chạy; discard tách xóa-nhầm khỏi đóng; realign sửa lớp lệch/migrate.
9. **Không port** bước “mở lớp” `planned`/`open` → `running` — nguồn không vận hành bước này.

---

## Unresolved

- Đích nên giữ `status` string `active/closed` hay đổi enum `running/closed` cho khớp nguồn: ngoài phạm vi scout (quyết định schema).
- UI đích vẽ `planned/completed` (`class-detail.tsx:33-66`) trong khi schema comment chỉ `active/closed` — không có writer, chưa rõ nhãn nào là ý sản phẩm.
- Nguồn không có procedure đổi GV **một buổi lẻ** (chỉ qua khung). Nếu đích cần “thay GV đúng 1 buổi”, đó là năng lực **mới**, không có ở chuẩn.

Status: DONE
Summary: Nguồn có vòng đời lớp/buổi/lịch đủ close↔reopen, CRUD khung + effectiveFrom, 4 lý do hủy và revive chọn lọc; đích tạo được lớp+sinh buổi cố định và hủy buổi có restamp nhưng thiếu đóng/mở lại, reason, khung sau tạo, revive, setCurrentUnit và GV theo buổi.
