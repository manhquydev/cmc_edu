---
phase: 1
title: "Capture: denied + màn câm lặng (bỏ data-shape)"
status: done
priority: P2
dependencies: [0]
---

# Phase 1: Capture — denied + màn câm lặng (bỏ data-shape)

> **Viết lại 2026-07-23 sau red-team (C2, C3, M1) + quyết định Q5.** Bản đầu định
> khẳng định "dữ liệu non-empty" trong capture — sai hai đường: định nghĩa rỗng
> mù với shape `{items:[]}` thật của cả 3 màn sự cố (C2), và seed hiện tại không
> cấp dữ liệu nghiệp vụ nên không phân biệt được seeded/unseeded (C3). Q5 chốt:
> **non-empty là việc của journey** (Phase 4, nơi dữ liệu ra đời theo trình tự
> vai thật). Capture rút về đúng việc gốc.

## Overview

Runtime capture giữ đúng một việc nó làm tốt: mở mọi màn bằng mọi vai và ghi lại
call bị `denied`. Phase này thêm **một** lớp: màn **câm lặng** — vai vào được màn
mà không phát ra request nào (gate `canDo()` client chặn trước khi gọi). Không
đụng tới dữ liệu, nên **không cần seed nghiệp vụ**.

## Requirements

**Functional**
- Giữ nguyên phát hiện `denied`/`notFound` sẵn có.
- Thêm phát hiện **màn câm lặng**: khai một tập (path, role) **kỳ vọng có ít nhất một request** (vì vai đó có quyền và màn đó phải gọi gì đó khi mount). Cặp nào 0 request ⇒ finding `silentScreens`.
- **Bỏ hoàn toàn** khẳng định payload non-empty (không `empty` flag, không `listField`, không expectation dữ liệu).

**Non-functional**
- Không seed nghiệp vụ mới (Q5); dùng đúng danh tính `capture-<role>` sẵn có.
- Sửa race trước khi tin `silentScreens` (M1): capture hiện `void response.json()` không await + chờ cứng 1.2s ⇒ 0-request có thể là do đóng context sớm, không phải màn câm. Phải await mọi promise json (hoặc `page.waitForLoadState` có bound) trước khi kết luận 0 request.

## Architecture

`silentScreens` cần một mốc "màn này ĐÁNG LẼ phải gọi gì": danh sách (path, role)
mà (a) vai qua được gate route, (b) màn có ít nhất một query on-mount. Danh sách
này KHÔNG phải dữ liệu nghiệp vụ — chỉ là "có gọi hay không", đo được với danh
tính tổng hợp trên DB trống. Đặt cạnh matrix trong `apps/e2e/src/`.

> **Sửa sau code review (2026-07-24):** đoạn dưới đây đã sai khi viết — implementation
> thật (`screen-should-call.ts`) chỉ khai `classBatch.list`, query ĐẦU TIÊN
> on-mount, KHÔNG phải `classBatch.listStudents` (query lồng, chỉ gọi sau khi
> chọn lớp — sweep này không lái tương tác đó). `silentScreens` cho cặp
> session-assessment vì vậy chỉ bắt "màn chết ngay lúc mount", KHÔNG bắt đúng
> gate `classRoster.read` mà sự cố F2 gốc hỏng — việc đó là Phase 4 (journey
> thật lái tương tác + falsify đúng gate). Giữ đoạn gốc bên dưới để thấy lý do
> sai, không xoá.

Vì sao đây đủ để bắt lớp F2 *(giả định sai — xem ghi chú trên)*: khi giáo viên bị gate `canDo('classRoster','read')`
sai ở client, màn session-assessment sẽ **không gọi** `classBatch.listStudents`
⇒ `silentScreens` bắt. Còn ca "gọi được nhưng trả rỗng vì thiếu lớp" là việc
journey (Phase 4) — đúng phân vai Q5.

## Related Code Files

- Create: `apps/e2e/src/screen-should-call.ts` — (path, role) → phải có ≥1 request
- Modify: `apps/e2e/tests/screen-role-capture.ui.spec.ts` — await json promises, thêm `silentScreens`, cập nhật khối comment giới hạn
- Đọc trước: `apps/e2e/tests/screen-role-capture.ui.spec.ts:140-170` (race hiện tại), `apps/e2e/src/screen-role-matrix.ts`
- Không sửa: `packages/auth/src/index.ts`, matrix json, seed

## Implementation Steps

1. Đọc capture spec trọn vẹn; xác định chính xác chỗ `void response.json()` và `waitForTimeout(1200)` (race M1).
2. Sửa race: gom mọi promise json vào mảng, `await Promise.allSettled` trước khi đóng context; chỉ sau đó mới tính tập procedure đã gọi cho cặp (path, role).
3. Viết `screen-should-call.ts`: khởi điểm khai 3 màn sự cố ở đúng vai — `/finance/class-placement` (GĐKD·GĐĐT·sale), `/teaching/session-assessment` (giao_vien·GĐĐT — consumer `classRoster.read`), `/hr/payroll` (2 GĐ). Mỗi mục = "phải có ≥1 request".
4. Capture: sau sweep, cặp có trong `screen-should-call` mà 0 request ⇒ `silentScreens`; ghi vào JSON cạnh `denied`.
5. **Falsification (lớp câm lặng):** nhánh thử local, thêm một `canDo(...)` sai (chặn client) vào một trong 3 màn (KHÔNG commit) → capture → `silentScreens` phải ≠ rỗng đúng màn đó. Hoàn nguyên. *(Rebuild admin trước khi chạy — nếu không, bản cũ vẫn gọi, đọc như "falsification fail".)*
6. Run chuẩn (DB bootstrap tối thiểu, không seed nghiệp vụ): `denied` = 0, `silentScreens` = 0.
7. Cập nhật khối comment giới hạn: lỗ `denied` + câm lặng đã đóng; ca "gọi được nhưng rỗng" **cố ý** để cho journey, ghi rõ.
8. `pnpm --filter @cmc/e2e typecheck` · `pnpm lint`.

## Success Criteria

- [x] Race `void response.json()` đã xử; `silentScreens` chỉ tin sau khi mọi json settled
- [x] Falsification lớp câm lặng đỏ đúng màn (rebuild admin trước), rồi hoàn nguyên
- [x] Run chuẩn: 0 denied, 0 silentScreens, KHÔNG cần seed nghiệp vụ
- [x] `screen-should-call.ts` phủ 3 màn F1/F2/F4 đúng vai
- [x] Không thêm khẳng định data-shape; comment giới hạn ghi rõ "non-empty là việc journey"
- [x] typecheck + lint xanh

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| `silentScreens` báo giả do race chưa xử hết | Cao | Bước 2 await allSettled là điều kiện tiên quyết của bước 4 |
| Màn thật sự không gọi gì on-mount (form trống hợp lệ) bị khai nhầm phải-gọi | TB | Danh sách khởi điểm chỉ 3 màn đã biết chắc gọi; thêm mục phải kèm bằng chứng màn có query on-mount |
| Falsification quên rebuild admin ⇒ đọc sai | Cao nếu xảy ra | Bước 5 ghi rõ rebuild; giống bài học capture cũ |
| Lẫn với việc journey (Phase 4) | Thấp | Comment + AC ghi ranh giới: capture = câm/denied, journey = non-empty |
