# VALIDATE — UX vận hành màn xếp dãy bài (B5+B6)

**Ngày:** 2026-08-13  
**Phạm vi:** chỉ đọc. Không sửa repo, không commit.  
**Nhánh:** `feat/lms-exercise-library`  
**Kỹ năng:** `/ak:scenario` (12 chiều) + `/ak:ui-ux-pro-max` (a11y, empty, disabled, search, color-not-only)  
**Nguồn plan:** `plans/260813-0053-thu-vien-bai-tap-va-xep-day/plan.md`  
**Nguồn B6:** mục 4 `plans/reports/brainstorm-260813-0053-thu-vien-bai-tap-b5-b6.md`  
**Nguồn ngôn ngữ UI:** `apps/admin/src/pages/teaching/exercises.tsx`, `exercise-detail.tsx`, `apps/admin/src/pages/classes/class-detail.tsx`, cộng nav/route/API đang chạy.

Thiết kế generic từ `--design-system` của skill (Calistoga / motion-driven / CTA cam) **không dùng**. Admin đã khoá ngôn ngữ **CMC Console** (`docs/design-system-console.md`, `docs/ux-resource-centric-structure.md`). Báo cáo này bám Console + hành vi API thật.

---

## Kết luận ngắn

Màn xếp dãy **sống cùng lớp**, nhưng **không nhét vào tab chi tiết lớp**. Làm **màn làm việc riêng**, vào từ phiếu lớp, URL con của `ClassBatch`. Thư viện tiếp tục là `/teaching/exercises`. Phần đã phát phải khoá bằng **chữ + icon + disabled**, không chỉ đổi màu. Thư viện phân trang **20** (đã có) và **ship tìm kiếm từ ngày đầu**, không chờ “đủ lớn”.

Ba hợp đồng API mà UI dễ làm sai:

1. `assignExerciseSequence.exerciseIds` là **đuôi chưa phát**, không phải cả dãy. Gửi lại bài đã phát sẽ **nhân bản** chúng vào vị trí mới.
2. API **cấm dãy rỗng** (`min(1)`). Lớp chưa xếp = chưa từng lưu, không phải “lưu 0 bài”.
3. Sau B5, fallback “bài homework theo unit đóng dấu buổi” **chết** vì `Exercise` mất `curriculumUnitId`. Lớp chưa có dãy = **không có bài nào được phát**. Empty state phải là cảnh báo cứng.

---

## 1. Màn xếp dãy sống cùng màn nào?

### Điều hướng hiện có (đo từ code)

| Màn | URL | Frame | Quyền menu | Việc đang làm |
|-----|-----|-------|------------|----------------|
| Thư viện / danh sách bài | `/teaching/exercises` | `ListPage` + `FilterBar` + `DataTable` + `ListPagination` 20 | `exercise.manage` (chỉ GĐĐT) | Index: lọc, tạo dialog, mở phiếu. Không HITL trên list. |
| Phiếu bài | `/teaching/exercises/:id` | `DetailPage` + `EntityHeader` + `HighlightStrip` + `WorkflowStatusbar` | cùng `exercise.manage` | Công bố / Đóng qua `ConfirmDialog` |
| Chi tiết lớp | `/admin/classes/:id` | `DetailPage` + 3 tab nội bộ | `class.create` (cũng chỉ GĐĐT) | Tổng quan, học viên, buổi + gán unit |
| Chi tiết buổi | `/teaching/sessions/:id?tab=` | `DetailPage` + tab URL | lịch / điểm danh | Điểm danh, nhận xét, nhật ký |
| Chấm bài | `/teaching/grading` | `ListPage` + `MasterDetail` 2 cột | `submission.grade` | Hàng đợi trái, phiếu phải |
| Xếp lớp | `/finance/class-placement` | `ListPage` work-surface riêng | `enrollment.enroll` | Gán HS vào lớp — **không** là tab của HS hay lớp |

Nav **Giảng dạy** (`nav-registry.ts`): Lịch dạy, Điểm danh, Chấm bài, Nhật ký, Nhận xét, **Bài tập**.  
Nav **Lớp & Học sinh**: Học viên, Lớp học, Khoá học, Phụ huynh.  
Không có lá “Xếp dãy bài”. `links.classBatch(id)` = `/admin/classes/:id`. `links.exercise(id)` = `/teaching/exercises/:id`.

Tab lớp (`overview | students | sessions`) là **state React**, không lên URL. Tab buổi thì `?tab=` — deep-link được. `class-detail` đã dày: `EntityHeader` + `HighlightStrip` + `WorkflowStatusbar` + 3 tab; tab Buổi đã có picker unit + xác nhận/huỷ.

Quyền hôm nay: GĐĐT vừa `class.create` vừa `exercise.manage`. Giáo viên có `exercise.view` nhưng **không** thấy menu Bài tập (menu theo `manage`). Giáo viên không phải người xếp dãy.

### Ba lựa chọn

**A. Tab thứ 4 trên chi tiết lớp** (`/admin/classes/:id` + tab “Dãy bài”)

- Cộng: đúng chỗ “của lớp”; GĐĐT đang đứng ở lớp.
- Trừ: editor 2 cột + xem trước lịch không vừa khung form chứng từ. Tab lớp chưa deep-link. Trộn quản trị lớp (GV, sĩ số, buổi) với soạn nội dung. Đổi tab khi bẩn form khó. Brainstorm đã gọi đây là **màn 2**, không phải tab.

**B. Lá nav mới “Xếp dãy bài” dưới Giảng dạy**

- Cộng: tìm được từ menu.
- Trừ: trái `docs/ux-resource-centric-structure.md` mục 5 — “One workflow model → one nav leaf”. Dãy không phải loại chứng từ mới; nó là form của lớp. Nav Giảng dạy đã 6 lá. Pattern “Xếp lớp” là work-surface, **không** thêm lá nếu vào được từ phiếu nguồn.

**C. Màn làm việc riêng, vào từ phiếu lớp (khuyến nghị)**

Giống **Xếp lớp** và **chi tiết buổi**: resource-centric, URL riêng, không phình nav.

| | |
|---|---|
| URL | `/admin/classes/:classBatchId/exercise-sequence` |
| Breadcrumb | Lớp & Học sinh → Lớp học → `{mã lớp}` → Xếp dãy bài |
| Frame | `ListPage density="ops"` kiểu chấm bài (`MasterDetail` 2 cột, `minHeight: 520`) + thanh lưu dính (`FormPage` / `.console-actions`) |
| Quyền | `exercise.manage`. CTA trên phiếu lớp ẩn nếu không có quyền. |
| Màn 3 (xem trước lịch) | Cùng route: `SectionBlock` dưới dãy, hoặc `?preview=1`. **Không** lá nav thứ ba. |

**Vào từ đâu**

1. **Chính:** `EntityHeader` / `PageHeader.actions` trên chi tiết lớp — nút `variant="primary"` **“Xếp dãy bài”**. Cùng chỗ đang để “Tổng quan lớp” / “Về danh sách”.
2. **Tóm tắt chỉ đọc** trên tab Tổng quan: `Callout` hoặc 1 ô `HighlightStrip` — `Dãy bài: 8 · đã phát 3 · còn 5 buổi chưa có bài`. Bấm “Xếp dãy” đi sang màn C.
3. **Thư viện:** cột “đang nằm trong dãy lớp nào” (brainstorm màn 1) → link sang màn C của lớp đó. Không mở editor nhúng trong thư viện.
4. **Không** thêm lá sidebar. Back luôn về `/admin/classes/:id` (nút “Về lớp”, cùng ngữ “Về danh sách” của phiếu bài).

**Sống cùng ai, một câu:** thư viện = catalogue (`/teaching/exercises`); xếp dãy = form của lớp, **cạnh** chi tiết lớp chứ không **trong** tab; xem trước lịch = mặt của cùng form.

---

## 2. Ca biên — hành vi đúng

Công thức vận hành (từ `exercise-sequence.ts` + `exercise-delivery.ts`):

- 1 buổi không huỷ, đã kết thúc, đã đóng dấu unit → phát **đúng 1 bài** (`SessionExercise.classSessionId @unique`).
- Biên đóng băng = `MAX(SessionExercise.position)` (`deliveredCount`). Vị trí `≤ deliveredCount` không ghi đè.
- `nextDeliverablePosition` tái sử dụng **lỗ** (buổi huỷ / chưa phát), không nhảy cóc.
- Payload lưu = `exerciseIds` **sau** biên. Test tích hợp: sau khi phát vị trí 1, gửi `[exAlt]` → vị trí 1 giữ bài cũ, vị trí 2 = `exAlt`.
- Chỉ `status = 'published'` vào dãy mới. `pg_advisory_xact_lock(..., 91004)` serialize ghi; **ghi sau thắng** phần đuôi.
- `folderNameAtAssign` **chưa có** trên `ClassExerciseItem` (schema hiện: `position` + `exerciseId`). Plan bắt buộc thêm — UI phải hiển thị snapshot, không join tên thư mục sống.
- `Exercise` **không có trường tên**. List hôm nay đọc được nhờ cột unit. Sau khi bỏ unit, không có tên thì thư viện + dãy thành UUID + loại — không vận hành được. Cần tên bài (hoặc nhãn bắt buộc) trước khi dựng màn; đây là lỗ quyền hạn sản phẩm, không phải việc “tự bịa label”.

**Số buổi còn lại (để cảnh báo):**

```
còn_buổi = số ClassSession của lớp
           status ≠ cancelled
           chưa có SessionExercise
           (endTime > now  OR  chưa kết thúc — tức buổi vẫn sẽ cần bài)

còn_chỗ_dãy = số vị trí dãy chưa có SessionExercise
            ≈ (dãy.length − số vị trí đã phát, tính cả lỗ)

cảnh_báo_ngắn ⇔ còn_chỗ_dãy < còn_buổi
```

Không đếm buổi đã huỷ. Không tự lặp bài (R3 plan).

### 2.1 Lớp chưa có dãy

| | |
|---|---|
| Severity | **Critical** sau B5 |
| Trigger | `listExerciseSequence.items = []`. API `assign` từ chối mảng rỗng. |
| Hành vi đúng | Cột phải: `EmptyState` title **“Lớp chưa có dãy bài”**, description **“Mỗi buổi phát 1 bài. Chưa xếp thì sau B5 không còn bài fallback theo unit — học sinh sẽ không có bài.”** CTA: “Kéo bài đã công bố từ thư viện”. Nút Lưu **disabled** đến khi ≥ 1 bài published. `Callout tone="danger"` trên đầu, không phải `info`. Tab Tổng quan lớp: cùng Callout + nút “Xếp dãy bài”. Không copy empty list bài tập (“Nhấn Tạo bài tập”) — đây không phải lúc tạo catalogue. |
| Không làm | Không im lặng. Không bịa dãy. Không lặp bài. Không cho lưu 0 phần tử (API 400). |

### 2.2 Dãy ngắn hơn số buổi còn lại

| | |
|---|---|
| Severity | **High** (hết bài giữa khoá) |
| Trigger | `còn_chỗ_dãy < còn_buổi` khi đang sửa hoặc lúc mở màn. |
| Hành vi đúng | `Callout tone="warning"` **cố định trên đầu cột dãy**, không toast biến mất: **“Dãy còn {n} bài, lớp còn {m} buổi chưa phát. Lớp sẽ hết bài từ buổi {ngày}.”** HighlightStrip: `Còn thiếu {m−n} buổi`. Vẫn **cho lưu** (plan: cảnh báo, không chặn). Preview lịch: các buổi thiếu tô hàng `StatusBadge` “Hết bài” + chữ, không chỉ tô đỏ. Nút Lưu không đổi thành destructive. |
| Không làm | Không tự lặp. Không chặn lưu. Không chỉ đổi màu hàng. |

### 2.3 Bài trong dãy bị ẩn / chuyển draft / đóng

| | |
|---|---|
| Severity | **Critical** nếu đã phát; **High** nếu chưa phát |
| Trigger | `ClassExerciseItem` vẫn trỏ `exerciseId` (`onDelete: Restrict`). `writeSequenceUpdate` chỉ kiểm tra published trên **payload mới**. `deliverForSession` **không** kiểm tra status. `open-tier` / nộp bài **đòi** `status = 'published'` → HS không thấy / không nộp được bài đã phát. |
| Hành vi đúng | Mỗi hàng dãy join status hiện tại. Frozen + không còn published: hàng khoá + `StatusBadge` “Nháp”/“Đã đóng” + `Callout tone="danger"` **“Đã phát nhưng học sinh không mở được — công bố lại bài, không sửa được chỗ này.”** Link “Mở phiếu” → `/teaching/exercises/:id`. Đuôi chưa phát mà bài về draft: `Badge` cảnh báo, **không** cho giữ khi lưu — phải gỡ / thay (API sẽ 400 nếu gửi lại). Cột trái thư viện: draft/closed **không kéo được** (disabled + chữ “Chưa công bố”), không ẩn nút không giải thích. Thư viện màn 1: cột “đang trong dãy lớp X” vẫn hiện dù bài đã ẩn. |
| Không làm | Không xoá `ClassExerciseItem` khi đóng bài. Không mở khoá phần đã phát để “sửa hộ”. Không im lặng để buổi phát bài ma. |

### 2.4 Thư mục đổi tên / ẩn sau khi gán

| | |
|---|---|
| Severity | **High** nếu UI join tên sống |
| Trigger | Folder `name` đổi hoặc `archivedAt` set. Plan: đóng dấu `folderNameAtAssign` giống giá bán. |
| Hành vi đúng | Hàng dãy luôn hiện **tên lúc gán**. Nếu tên sống ≠ snapshot: chữ phụ `Text type="supporting"` “Thư mục hiện tên: {mới}” — không thay nhãn chính. Folder ẩn: snapshot vẫn hiện; không hiện lỗ trống. Cột trái: folder ẩn không còn trong cây (hoặc nhóm “Đã ẩn”) nhưng bài đã gán không biến mất khỏi dãy. |
| Không làm | Không re-resolve tên folder khi render dãy. Không cascade ẩn folder thành xoá item. |

### 2.5 Hai người (hoặc hai tab) cùng sửa dãy

| | |
|---|---|
| Severity | **High** (đuôi bị ghi đè câm) |
| Trigger | Hai GĐĐT, hoặc một người hai tab. Lock 91004 chỉ serialize transaction, **không** có version/ETag. `listExerciseSequence` trả `{ items }` không `deliveredCount`, không `updatedAt`. |
| Hành vi đúng | Mở màn: hiện “Đã phát {k} bài — phần này không sửa được”. Trước lưu: refetch sequence; nếu đuôi server ≠ đuôi lúc load → `Banner status="error"` **“Người khác vừa lưu dãy. Phần đã phát không đổi. Tải lại rồi xếp tiếp.”** + nút “Tải lại”. Không merge câm. Dirty leave: `ConfirmDialog` “Huỷ thay đổi chưa lưu?” (cùng ConfirmDialog Công bố/Đóng). Lưu ok: `useToast` “Đã lưu dãy bài” (như xếp lớp “Đã xếp lớp”). Disable nút Lưu khi `isPending`. |
| Không làm | Không last-write-wins câm. Không khoá cả trang bằng websocket (quá phạm vi). Nên bổ sung `deliveredCount` + hash đuôi vào `listExerciseSequence` — UI không đoán nổi từ `{position, exerciseId}`. |

### 2.6 Lớp đã phát hết dãy nhưng còn buổi

| | |
|---|---|
| Severity | **High** |
| Trigger | `nextDeliverablePosition` = `null`. `deliverForSession` trả `null` (không lỗi). Worker đếm `skipped`. |
| Hành vi đúng | `Callout tone="danger"` **“Đã phát hết {n} bài. Còn {m} buổi chưa có bài (buổi kế: {ngày}). Thêm bài vào cuối dãy.”** Preview: hàng buổi còn lại “Không có bài — dãy đã hết”. CTA chính: focus cột trái / nút “Thêm bài”. Phần đã phát vẫn khoá. Không hiện empty “Chưa có dãy”. |
| Không làm | Không tự lấy bài đầu lặp lại. Không 500. Không để lớp “chạy tiếp” mà ops không biết. |

### 2.7 Sửa dãy khi đang giữa unit

| | |
|---|---|
| Severity | **Medium** (dễ hiểu nhầm “cả unit bị khoá”) |
| Trigger | Unit 4 buổi; đã phát 1–2 buổi của unit. Biên đóng băng theo **position đã phát**, không theo unit. |
| Hành vi đúng | Cho sửa mọi vị trí `> deliveredCount`, kể cả buổi còn lại của **cùng unit**. Preview nhóm theo unit: “Unit hiện tại · buổi 2/4 đã phát · buổi 3 ← vị trí 7 (sửa được)”. `Callout tone="info"` **“Chỉ khoá bài đã phát. Ba buổi còn lại của unit này vẫn đổi được.”** Kéo/xoá đuôi: `ConfirmDialog` nếu `droppedCount > 0` — “{k} bài chưa phát sẽ ra khỏi dãy. Bài đã phát không đổi.” (xác nhận, không chặn). |
| Không làm | Không khoá cả unit. Không restamp unit khi đổi dãy (API đã tách). Không hiện unit như thể là thư mục của dãy. |

### 2.8 Ca thêm (scenario, cùng màn)

| # | Chiều | Ca | Sev | Hành vi đúng |
|---|--------|----|-----|----------------|
| 8 | Input | Kéo bài draft / trùng bài | High | Drop reject + Banner gần cột phải: “Chỉ bài đã công bố; mỗi bài một lần.” API: unique + published. |
| 9 | Input | Dãy > 200 bài | Med | Chặn ở UI trước khi 400. Callout “Tối đa 200 bài / lớp.” |
| 10 | Timing | Lưu lúc worker vừa phát thêm 1 buổi | High | Refetch: biên khoá tăng 1. Hàng vừa phát nhảy sang vùng khoá. Toast không nói “lưu cả dãy” nếu đuôi bị cắt. |
| 11 | State | Rời trang khi đang kéo | Med | Huỷ drag; nếu dirty thì ConfirmDialog. |
| 12 | State | Mở URL lớp không tồn tại / sai facility | Med | `ResultPanel status="error"` + “Về danh sách lớp” — cùng phiếu bài không mở được. |
| 13 | Auth | Giáo viên gõ URL sequence | High | `EmptyState` “Không có quyền” + icon `shield` — copy `class-detail` khi thiếu `class.create`. |
| 14 | Auth | Token hết hạn giữa chừng | High | Mutation error → Banner + không xoá draft local; sau login không ghi đè câm. |
| 15 | Data | `listExerciseSequence` chỉ `{position, exerciseId}` (nợ RT3-06) | High | UI **không** hiện UUID. Phải join `exercise.list/get` + snapshot folder. Plan API phải mở DTO trước khi cook màn. |
| 16 | Data | Lỗ vị trí (buổi huỷ, SE xoá) | Med | Preview ghi “vị trí 2 sẽ phát vào buổi kế (lỗ)”, không đánh số lại phần đã phát. |
| 17 | Env | Viewport < 1024, 2 cột | Med | Stack dọc: thư viện trên, dãy dưới, preview sheet. Không cuộn ngang. Kéo vẫn có nút “Thêm / Lên / Xuống” (gesture-alternative). |
| 18 | Env | Keyboard / screen reader | High | Không chỉ drag. Mỗi hàng: Thêm, Lên, Xuống, Gỡ. Phần khoá `aria-disabled` + “Đã phát buổi DD/MM”. |
| 19 | Error | Mất mạng lúc lưu | Med | Banner lỗi + Retry. Giữ draft local. |
| 20 | Business | Lớp `completed` / `cancelled` | Med | Mở read-only. Callout “Lớp đã kết thúc — xem dãy, không sửa.” Cùng ngữ `SessionUnitPicker isDisabled` khi buổi `done`/`cancelled`. |
| 21 | Business | Cùng bài trên 2 lớp | Low | Cho phép (catalogue dùng chung). Thư viện hiện “Có trong 2 lớp”. |
| 22 | Integration | Payload gửi nhầm cả prefix đã phát | Critical | Bug im lặng: nhân bản bài. UI chỉ gửi đuôi. Test: sau 1 phát, save không đổi vị trí 1. |

### Tóm scenario

| Sev | Số |
|-----|----|
| Critical | 3 (empty sau B5; bài draft đã phát; payload nhầm prefix) |
| High | 10 |
| Medium | 8 |
| Low | 1 |
| **Tổng** | **22** trên 10/12 chiều |

Bỏ: Compliance (không PII mới), Environment proxy/VPN. Scale 1M không thực tế — thư viện trung tâm đào tạo, không catalogue công.

---

## 3. Thư viện: bao nhiêu bài thì cần phân trang / tìm?

**Không chờ ngưỡng “rồi hãy thêm”. Làm theo list bài tập đang chạy.**

| Cơ chế | Ngưỡng | Vì sao |
|--------|--------|--------|
| `ListPagination` | **20 / trang, từ ngày đầu** | `exercises.tsx` `pageSize = 20`. Cùng số: lớp, khoá, user, quà, hoàn tiền, facilities. Học viên là 10 vì `student.lookup`. |
| `FilterBar` status + loại | **Đã có — giữ** | `draft / published / closed` + homework / đầu vào / định kỳ. |
| `FilterBar` `q` (tên / thư mục) | **Ship ngày đầu.** Bắt buộc khi folder hoặc list published **> 20** | G1: list đa bản ghi có search. Cột trái màn xếp hẹp hơn bảng — 20 hàng đã không quét nổi. Debounce như `classBatch.list` / `course.list`, không chờ 2 ký tự (ngưỡng 2 chỉ của `student.lookup`). |
| Ảo hoá list | **≥ 50 hàng trong một folder** | Quy tắc skill `virtualize-lists`. Một cấp folder phẳng hiếm khi chạm nếu đã paginate 20. |
| Cây folder | **Không paginate** | Một cấp, số folder ≪ số bài. Folder ẩn không đếm. |

Cột trái màn xếp: **chỉ published**, search luôn hiện, page 20 (hoặc “tải thêm”), không kéo draft.

Empty / no-result (skill): “Không có bài khớp bộ lọc. Xoá lọc hoặc công bố bài nháp.” — không để bảng trắng, không chỉ “0”.

Lỗ: `Exercise` chưa có tên. Search `q` vô nghĩa nếu chỉ còn UUID + `type`. Phải có nhãn trước khi làm search.

---

## 4. Khoá phần đã phát — phải hiểu ngay

Skill: **không chỉ màu** (High). Disabled = opacity + cursor + ngữ nghĩa. Session picker đã làm đúng: `isDisabled` khi buổi `cancelled`/`done`, hàng huỷ `opacity: 0.5`.

**Cấu trúc cột dãy — hai vùng, có nhãn, có đường cắt:**

```
┌ Phần đã phát (khoá) ─────────────────┐
│ 1  [khoá]  Bài A   Đã phát · 12/08   │  ← không kéo, không gỡ, không lên/xuống
│ 2  [khoá]  Bài B   Đã phát · 15/08   │
├ Phần chưa phát ──────────────────────┤
│ 3  ≡      Bài C   Buổi kế · 19/08    │  ← sửa được
│ 4  ≡      Bài D   22/08              │
└──────────────────────────────────────┘
```

Bắt buộc, xếp theo mức hiểu ngay:

1. **Chữ trên vùng:** “Phần đã phát (khoá)” / “Phần chưa phát”. Không dựa vào người đoán.
2. **Icon + nhãn hàng:** `LineIcon` (`shield` hoặc `check-circle` — **chưa có icon lock**; đừng vẽ emoji, đừng thêm icon lẻ nếu chưa thêm key vào `line-icon.tsx`) + `StatusBadge` “Đã phát”. Secondary: ngày buổi.
3. **Disabled thật:** `isDisabled` / `aria-disabled`, `opacity` ~0.5, `cursor: not-allowed`, handle kéo ẩn. Click hàng khoá → không mở menu sửa; có thể “Mở phiếu” (ghost) để xem bài.
4. **HighlightStrip** trên đầu màn (cùng phiếu bài / phiếu lớp): `Đã phát 2/8` · `Buổi kế: 19/08` · `Vị trí kế: 3`. Số dùng `tabular`.
5. **Callout info** một dòng: “Bài đã phát không đổi thứ tự. Kéo chỉ phần dưới.”

Không đủ: chỉ xám hàng, chỉ khoá kéo, chỉ tooltip. Giáo viên/GĐĐT nhìn 2 giây phải nói được “hai bài đầu hết sửa”.

Thanh lưu: primary **“Lưu dãy”** chỉ đụng đuôi. Không ghi “Lưu 8 bài” nếu 2 bài không nằm trong payload.

---

## 5. Ngôn ngữ / component sẵn — dùng lại, đừng vẽ

Nguồn: `docs/design-system-console.md`, `CONSOLE-COMPONENT-MAP.md`, `@cmc/ui`.

| Việc | Dùng sẵn | Không |
|------|----------|--------|
| Khung màn xếp | `ListPage density="ops"` + `PageHeader` breadcrumb + `MasterDetail` (đã có ở chấm bài, `listWidth` 300–360) | Tự viết split-pane, tự tính `100vh` |
| Tóm tắt lớp / dãy | `EntityHeader` + `HighlightStrip` (4 ô) + `StatusBadge` soft | Card KPI mới |
| Cảnh báo hết bài / dãy ngắn / draft ma | `Callout` (`schedule.tsx` đã dùng) + `Banner` lỗi mutation | Toast-only cho rủi ro hết bài |
| Empty / 403 / URL sai | `EmptyState` + `LineIcon name="shield"` / `ResultPanel` | Trang trắng |
| Lưu / huỷ / rời trang bẩn | `ConfirmDialog` + `useToast` success + `.console-actions` / `FormPage` | Modal tự chế |
| Thư viện | `FilterBar` + `DataTable` + `ListPagination` 20 + `BulkActionBar` (nếu chọn nhiều) + `Dialog` tạo bài | Mega-menu search Odoo (G1 parked) |
| Folder trái | `Panel` (title + count) hoặc cột `MasterDetail` | Nested tree (plan: phẳng 1 cấp) |
| Preview buổi → bài | `DataTable` + `SectionBlock` + `Badge` trạng thái buổi (`planned/confirmed/done/cancelled` đã có trên class-detail) | Chart / Gantt |
| Trạng thái bài | Cùng map phiếu bài: Nháp / Đã công bố / Đã đóng; `WorkflowStatusbar` chỉ trên phiếu bài, **không** trên dãy |
| Icon | `LineIcon` outline đơn sắc. Nav bài = `clipboard` | Emoji, lock icon tự vẽ nếu chưa thêm key |
| Deep link | `@cmc/links` — thêm `exerciseSequence(classBatchId)` trước khi hardcode path (rule 7 resource-centric) | Path rải trong JSX |
| Chọn lớp (nếu vào từ chỗ khác) | `AsyncEntityCombobox` / `use-class-batch-options` (xếp lớp) | `<select>` thô |
| Loading | `Skeleton` / `Spinner` + “Đang tải…” (phiếu bài) | Spinner chặn cả shell |

Kéo thả: **không** có primitive drag trong `@cmc/ui`. `KanbanBoard` là cột CRM, `editable=false` trên lịch. Nếu kéo: phải có nút Thêm / Lên / Xuống / Gỡ (skill `gesture-alternative` + keyboard). Đừng chặn màn vì chưa có dnd library.

**Copy tiếng Việt đã ổn — giữ, đừng viết giọng khác:**

- “Về danh sách” / “Về lớp”
- “Mở phiếu”
- “Công bố” / “Đóng”
- “Chưa có bài tập nào. Nhấn Tạo bài tập để bắt đầu.”
- “Không có quyền truy cập” + mô tả quyền
- Empty buổi: “Chưa có buổi học nào.”
- Toast xếp lớp: “Đã xếp lớp” → dãy: **“Đã lưu dãy bài”**

Mật độ: `density="ops"`, chữ 14px Console, không hero / không motion-driven.

---

## Việc UI cần API làm trước (không đoán)

1. `listExerciseSequence` trả thêm: `deliveredCount`, ngày buổi gắn từng position đã phát, DTO bài (nhãn, type, status, `folderNameAtAssign`), `updatedAt`/hash đuôi.
2. Trường **tên bài** (hoặc nhãn bắt buộc) trên `Exercise` — không có thì thư viện + search + dãy không đọc được sau khi bỏ unit.
3. `folderNameAtAssign` trên `ClassExerciseItem` (plan đã ghi, schema chưa có).
4. Công thức `còn_buổi` server-side (đừng để UI tự trừ session list thiếu delivery).
5. Sau B5: xác nhận fallback unit-homework **cắt**; empty dãy = không phát. Copy empty state phụ thuộc điều này.

---

## Checklist nấu màn (khi được phép sửa)

- [ ] Route `/admin/classes/:id/exercise-sequence` + `links.*` + breadcrumb; CTA từ class-detail; không lá nav mới
- [ ] `MasterDetail` + chỉ gửi đuôi `exerciseIds`
- [ ] Hai vùng khoá/chưa phát: chữ + badge + disabled + ngày buổi
- [ ] Callout: chưa có dãy (danger) · dãy ngắn (warning) · hết dãy còn buổi (danger) · giữa unit (info)
- [ ] ConfirmDialog rời trang bẩn + khi `droppedCount > 0`
- [ ] Conflict refetch trước lưu
- [ ] Thư viện: page 20 + `q` + filter status/type; picker chỉ published
- [ ] Keyboard alternatives cho kéo
- [ ] Giáo viên 403 EmptyState
- [ ] Lớp completed/cancelled = read-only
