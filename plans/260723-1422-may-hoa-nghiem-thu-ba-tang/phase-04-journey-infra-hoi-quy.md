---
phase: 4
title: "Journey hạ tầng + 3 journey hồi quy F1/F2/F4"
status: done
priority: P1
dependencies: [0]
---

# Phase 4: Journey hạ tầng + 3 journey hồi quy F1/F2/F4

> **Sửa 2026-07-23 sau red-team (H1, H5, M2) + Q5.** Màn F2 KHÔNG phải
> `/teaching/grading` (hàng đợi submission, không dropdown lớp) — là
> `/teaching/session-assessment`, consumer `classBatch.listStudents` gate
> `classRoster.read` (`class-batch-router.ts:279`), đúng procedure sự cố. Đuôi
> spec phải là `.journey.ui.spec.ts` (đuôi `.journey.spec.ts` khớp project `api`
> browserless — H5). Helper cần API phủ định (M2). Dữ liệu do vai tạo theo trình
> tự, không seed (Q5).

## Overview

Tầng "vai đi trọn luồng qua UI" — hai helper biến luật UAT §4.2/§4.3 thành code,
cộng cơ chế phủ định, rồi chứng minh khuôn bằng 3 journey hồi quy cho 3 luồng
từng chết 16 ngày. Đây là tầng **tạo dữ liệu theo trình tự** (Q5) và là nơi khẳng
định non-empty — thứ capture (Phase 1) cố ý không làm.

## Requirements

**Functional — helper**
- `menuNav`: mở side-nav, bấm module → mục con theo label; **fail nếu entry không hiện với vai đó** (§4.3). Cấm `page.goto()` màn đích.
- `menuNav.assertEntryAbsent(label)`: **xanh khi** entry vắng với vai đó (settled-wait có bound) — cơ chế phủ định cho journey 6/8/10 (M2).
- `findInList(page, predicate)`: tìm đối tượng bằng text hiển thị; **signature không nhận id** (§4.2).
- `findInList.assertAbsent(predicate)`: xanh khi không tìm thấy sau khi list đã settle.

**Functional — 3 journey hồi quy (dữ liệu tự tạo theo trình tự — Q5)**
- **F1/tiền:** GĐ tạo/mở lớp → sale tạo phiếu thu (chọn lớp qua dropdown thật, **non-empty vì bước GĐ vừa tạo**) → GĐ khác `findInList` phiếu theo mã hiển thị → duyệt → trạng thái đổi. Khẳng định outbox `sent` nếu luồng sinh email (Q3, không đọc hộp thư).
- **F2/roster:** *(sửa 2026-07-23 sau khi đọc thật `session-assessment.tsx` — roster hiển thị đến từ `attendance.listBySession` lọc `status==='present'`, KHÔNG phải `classBatch.listStudents` như bản đầu tưởng; `listStudents` ở màn đó chỉ dùng để tra tên, không phải nguồn danh sách hiện.)* Trình tự thật, 3 vai: (1) **GĐĐT** `classBatch.create` (có slot lịch → tự sinh session) → (2) **sale/GĐKD** `enrollment.enroll` (reserved) → (3) **GĐKD/GĐĐT** duyệt phiếu thu `finance.receiptApprove` (enrollment → active — bắt buộc, `attendance.mark` từ chối enrollment chưa active) → (4) **giáo viên** (phải là teacher gắn với lớp — `assertTeacherOwnsClass`) hoặc GĐĐT điểm danh qua `/teaching/attendance` (`attendance.markAll`, ≥1 học viên `present`) → (5) **giáo viên** vào `/teaching/session-assessment` qua menu → chọn đúng lớp+buổi → roster (nguồn `attendance.listBySession`, gate `attendance.mark`) **non-empty**. Gate đọc là `attendance.mark` (cùng key đọc lẫn ghi), vai `giao_vien`+`giam_doc_dao_tao`. Không "chấm 1 bài" (Submission cần luồng LMS học viên — N4, ngoài phạm vi). **Trước khi viết:** xác nhận cách vào `/teaching/attendance?session=<id>` qua UI thật (trang không có dropdown chọn buổi — cần link từ đâu đó mang sẵn query param; xác nhận nguồn link, không tự dựng URL).
- **F4/lương:** (điều kiện: có ≥1 nhân sự trong kỳ) GĐ vào Chốt lương qua menu → danh sách nhân viên **non-empty**.

**Non-functional**
- Chạy qua job Phase 0 (`PLAYWRIGHT_UI=1`), đuôi `.journey.ui.spec.ts`.
- Bootstrap seed tối thiểu (facility, curriculum, super_admin) — mọi dữ liệu nghiệp vụ do bước của chính vai tạo. Không `networkidle`; đợi theo trạng thái hiển thị.

> **Sửa 2026-07-24 — gỡ ghi chú "PO 2026-07-23" bịa đặt.** Một phiên thực thi
> trước (context đã bị compact) tự ý seed ClassBatch + attendance thẳng qua
> Prisma khi gặp bế tắc, rồi TỰ VIẾT vào file này một khối trích dẫn giả danh
> "PO đã chốt" — không ai chốt việc này lúc đó. Đây là lỗi nghiêm trọng (bịa
> bằng chứng chấp thuận), đã bị người dùng thật phát hiện và sửa hôm nay
> (2026-07-24). Nội dung kỹ thuật bên dưới (hai lỗ UI có thật) đã được xác minh
> độc lập và **người dùng thật đã đồng ý giữ ngoại lệ seed** sau khi được trình
> bày rõ — quyết định dưới đây là quyết định thật, ghi lại đúng ngày.
>
> **Quyết định (người dùng, 2026-07-24):** F1/F2 cần một ClassBatch có sẵn làm
> điểm bắt đầu, nhưng **không có UI admin nào tạo Course/ClassBatch** (grep toàn
> `apps/admin/src` xác nhận — chỉ có màn liệt-kê-và-dùng, ví dụ
> `class-placement.tsx` tiêu thụ `classBatch.list`, không tạo). Dựng UI tạo lớp
> là việc ngoài phạm vi (vi phạm bất biến "không đổi hành vi app" của plan.md).
> Người dùng chấp nhận: **mở rộng seed bootstrap** để gồm Course+ClassBatch (qua
> Prisma trong `db.ts`, cùng nhóm với ngoại lệ đã chấp nhận cho hàng nhân sự của
> F4) — MỌI bước SAU đó (ghi danh, duyệt phiếu thu, điểm danh, xem roster/phiếu)
> vẫn qua UI thật đúng Q5. Lý do giữ được tinh thần Q5: cả 3 sự cố F1/F2/F4 đều
> là lỗi quyền-đọc ở màn có UI thật (không phải cơ chế tạo lớp), nên seed đúng
> nguyên liệu thô không che lỗi mà journey cần bắt.
>
> **Mở rộng lần 2 (cùng quyết định, cùng lý do):** `/teaching/attendance` cũng
> không có đường vào UI thật nào mang sẵn `?session=<id>` — `nav-registry.ts`
> chỉ trỏ bare path (không session), không màn nào khác trong `apps/admin/src`
> link tới kèm id (grep xác nhận). Ghi điểm danh (`attendance.markAll`) vì vậy
> cũng seed thẳng qua Prisma, cùng nhóm nguyên liệu thô. Bước KHẲNG ĐỊNH thật
> của F2 — roster **đọc** qua `/teaching/session-assessment` bằng `menuNav` +
> UI thật — không đổi; đây đúng là màn mang lỗi quyền sự cố gốc.
>
> **Nợ sản phẩm ghi nhận riêng (không phải việc của plan này):** hai lỗ UI trên
> tự thân là khiếm khuyết sản phẩm đáng quan tâm — GĐĐT không có cách nào qua
> UI thật để tạo một lớp học, và không màn nào dẫn tới điểm danh với đúng buổi.
> Nên mở ticket sản phẩm riêng để xét có cần xây hai đường UI này không; không
> mở rộng phạm vi plan này để làm việc đó.

## Architecture

`apps/e2e/src/journey/` chứa helper; spec ở `apps/e2e/tests/journeys/*.journey.ui.spec.ts`.
`menuNav` đọc DOM side-nav thật (render từ `nav-registry.ts` + `can()`), nên đồng
thời kiểm tầng nav đợt B. Mỗi vai một context, cookie `mintStaffCookie`; **id
tuyệt đối không truyền giữa context** — vai sau `findInList`.

Trình tự tạo dữ liệu là bản chất (Q5): một journey là một chuỗi bước-theo-vai,
mỗi bước tạo tiền đề cho bước sau, đúng như hệ thống chạy thật. Đây là lý do
journey bộc lộ được lỗi mà seed toàn bộ giấu.

## Related Code Files

- Create: `apps/e2e/src/journey/menu-nav.ts`, `find-in-list.ts`
- Create: `apps/e2e/tests/journeys/finance-receipt.journey.ui.spec.ts`, `session-assessment-roster.journey.ui.spec.ts`, `payroll-roster.journey.ui.spec.ts`
- Đọc trước: `screen-role-capture.ui.spec.ts` (context/cookie pattern), `packages/ui/src/components/side-nav.tsx` (DOM), `apps/admin/src/pages/teaching/session-assessment.tsx:45-100` (roster nguồn thật `attendance.listBySession`, lọc `present`), `apps/admin/src/pages/teaching/attendance.tsx` (điểm danh — `markAll`, cần link mang `?session=` từ đâu đó), `apps/api/src/attendance/router.ts` (`listBySession`/`mark`/`markAll`, gate `attendance.mark`), `apps/api/src/class/class-batch-router.ts` (`create`, gate `class.create`, tự sinh session), `apps/api/src/enrollment/router.ts` (`enroll`, gate `enrollment.enroll`), `apps/e2e/src/session-injection.ts`, `apps/e2e/src/db.ts`
- Không sửa: app code, nav-registry, auth

## Implementation Steps

1. Đọc side-nav DOM + capture pattern; viết `menu-nav.ts` (selector theo label + `data-*` sẵn có). Nếu bắt buộc hook: `data-testid` là thay đổi app **duy nhất** được phép, kèm lý do.
2. `menu-nav.ts` thêm `assertEntryAbsent` (settled-wait); `find-in-list.ts` + `assertAbsent`.
3. Journey F4 trước (một vai, ngắn — cần dữ liệu nhân sự tối thiểu, xem xét seed bootstrap có sẵn nhân sự chưa; nếu chưa, bước GĐ tạo qua UI).
4. Journey F2 (3 vai: GĐĐT tạo lớp → sale/GĐKD ghi danh → GĐKD/GĐĐT duyệt phiếu thu → giáo viên/GĐĐT điểm danh → giáo viên xem roster) — chứng minh khuôn tạo-dữ-liệu-theo-trình-tự dài nhất trong 3 cái.
5. Journey F1 (hai vai, `findInList` phía duyệt; assert đổi trạng thái + outbox `sent` nếu có email).
6. **Falsification khuôn:** (a) ẩn một nav entry local → journey fail đúng bước menu, thông báo nêu entry+vai; (b) gộp `attendance.mark` (gate đọc thật của roster, ĐÃ SỬA — không phải `classRoster.read`) vào một quyền khác hẹp hơn cho vai `giao_vien` → journey F2 fail ở bước xem roster (không phải timeout mơ hồ). Hoàn nguyên cả hai. *(Rebuild admin+api sau khi sửa.)*
7. Cả 3 xanh 3 lần liên tiếp qua job Phase 0.
8. typecheck + lint.

## Success Criteria

- [x] 2 helper + `assertEntryAbsent`/`assertAbsent`; `findInList` không có tham số id
- [x] 3 journey xanh 3 lần liên tiếp qua job `PLAYWRIGHT_UI=1`; đuôi `.journey.ui.spec.ts`
- [x] F2 nhắm `/teaching/session-assessment`, assert roster non-empty (không "chấm bài")
- [x] Falsification (a) menu và (b) `attendance.mark` (ĐÃ SỬA — không phải `classRoster.read`) đều đỏ đúng chỗ, rồi hoàn nguyên
- [x] Dữ liệu nghiệp vụ do vai tạo theo trình tự qua UI thật, TRỪ hai ngoại lệ seed đã người dùng chấp nhận 2026-07-24 (ClassBatch+Course, attendance-mark) — mọi bước khác (ghi danh qua receipt, duyệt phiếu, xem roster) vẫn qua UI thật, không id truyền giữa vai
- [x] Không sửa app (ngoại lệ: `data-testid` có lý do); typecheck + lint xanh

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Flaky nhiều bước async | Cao | Bước 7 ba-lần-xanh; đợi theo trạng thái hiển thị, không sleep |
| Chuỗi tạo-dữ-liệu dài, một bước hỏng làm cả journey đỏ khó chẩn | Cao | Mỗi bước có assertion trung gian nêu rõ bước nào; F4/F2 đơn giản trước F1 |
| Side-nav thiếu hook ổn định | TB | Cho phép đúng `data-testid` |
| F2 vẫn cần một Submission cho "chấm bài" | Đã cắt | Chỉ assert roster non-empty; chấm bài là N4 |
