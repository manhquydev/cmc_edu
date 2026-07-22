---
phase: 6
title: "Merge runtime-verification + cap lai proven"
status: pending
priority: P2
dependencies: [5]
---

# Phase 6: Merge runtime-verification + cấp lại proven

## Overview

Branch `test/independent-runtime-verification-38-flows` (5 commit, chưa merge) chứa hạ tầng tốt — `proveFlow`, reporter atomic, `runtime-evidence.json`, spec UI per-flow — nhưng mọi nhãn `proven` đều thu bằng `super_admin` nên vô giá trị về phân quyền. Phase này giữ hạ tầng, thay vai, **xoá sạch nhãn cũ**, cấp lại từ đầu.

Quyết định D4 của PO: giữ hạ tầng, không vứt branch.

## Requirements

**Functional**
- Hạ tầng `proveFlow` + reporter + `runtime-evidence.json` vào được main.
- Mọi nhãn `proven` cũ bị xoá; nhãn mới chỉ cấp khi bằng chứng thu bằng **vai nghiệp vụ đúng**.
- Guard Phase 5 chạy xanh trên cây sau merge.

**Non-functional**
- Không kéo theo giả định sai nào từ 5 commit cũ.
- `runtime-evidence.json` vẫn committed vào git (diff-reviewable), screenshot vẫn local-only.

## Architecture

Trạng thái branch (đã khảo sát):

```
9e53b3c docs: publish runtime verification evidence
c339f4a test: cover privileged runtime authorization gates
805549d fix: merge supplemental runtime evidence at run end
c5fdefc test: scope runtime DB assertions by facility
003be3d test: add independent runtime proof ledger
```

`runtime-evidence.json` hiện: 35 proven / 3 blocked, `runBatch: ir38-c339f4a-final-20260720`.

3 flow `blocked` vì UI là placeholder: `/finance/refund` (P1-08), `/crm/post-sale-meeting` (P4-03), `/crm/aftersale` (P4-05). **Lưu ý:** trên main hiện tại, `post-sale-meeting` và `aftersale` **đã được implement** (test khẳng định không còn placeholder); chỉ `/finance/refund` còn là placeholder. Nghĩa là evidence cũ đã lỗi thời — thêm một lý do phải cấp lại thay vì tin nhãn cũ.

**Thứ tự an toàn:** merge hạ tầng trước, xoá nhãn, sửa auth theo flow, rồi mới chạy lại để cấp nhãn mới. Không merge kèm nhãn cũ rồi mới sửa — sẽ có khoảng thời gian main mang nhãn sai.

## Related Code Files

- Merge từ branch: `apps/e2e/src/prove-flow.ts`, reporter, `apps/e2e/tests/*runtime-proofs*.spec.ts`, `flow-ui-routes.ui.spec.ts`
- Modify sau merge: `flow-ui-routes.ui.spec.ts` — bỏ `beforeEach` `super_admin` dùng chung, thay bằng auth per-flow theo `actorRoles` của manifest
- Modify: `acceptance-report/runtime-evidence.json` — reset trước khi cấp lại
- Modify: `scripts/acceptance-report/verify.ts` — đọc evidence, hiển thị tier `proven`

## Implementation Steps

1. Merge branch vào một nhánh làm việc (không thẳng main). Giải quyết xung đột với các thay đổi Phase 1–3 ở `verify.ts`/`types.ts`.
2. **Xoá sạch `runtime-evidence.json`** (hoặc reset về rỗng) ngay trong commit merge — không để nhãn cũ tồn tại trên nhánh đích dù chỉ tạm thời.
3. Sửa `flow-ui-routes.ui.spec.ts`: thay `beforeEach` cấp `super_admin` cho tất cả bằng auth **per-flow**, vai lấy từ `actorRoles` của manifest (Phase 1 đã làm trường này đáng tin). Flow `ADM-*` giữ `super_admin` hợp lệ.
4. Rà lại phần assert của spec UI: hiện chỉ kiểm "heading hiện + không có chữ 'Tính năng chưa áp dụng'". Với vai thật, cần assert thêm **màn dùng được** — ví dụ dropdown có option, bảng có cột — chứ không chỉ render.
5. Chạy guard Phase 5 → phải xanh.
6. Chạy lại toàn bộ để cấp nhãn mới. **Kỳ vọng: số `proven` sẽ THẤP HƠN 35.** Con số giảm là dấu hiệu tốt — nó có nghĩa nhãn mới nói thật.
7. Đối chiếu nhãn mới với 3 flow placeholder + kết quả Phase 3; mâu thuẫn nào phải giải thích được.
8. Cập nhật `verify.ts` để hiển thị tier `proven` kèm tuổi commit (D7 của plan gốc: `proven` yêu cầu `evidence.commit === HEAD`).
9. Merge vào main. Cập nhật `plans/260717-1213-so-nghiem-thu-song`: đóng hoặc đánh dấu Phase 4 superseded.

## Test / Validation

- Guard Phase 5 xanh trên cây sau merge.
- `pnpm typecheck` + `pnpm lint` + `pnpm test` + e2e (2 chế độ, chạy riêng) xanh.
- `runtime-evidence.json` mới: **không nhãn nào** của flow P1–P4 mang `super_admin`.
- Rà tay: mỗi flow chuyển từ `proven` (cũ) sang không-proven (mới) phải có lý do rõ — hoặc luồng thật sự chưa dùng được, hoặc spec chưa viết xong. Cả hai đều phải ghi.

## Success Criteria

- [ ] Hạ tầng `proveFlow` + reporter + evidence vào main, không kéo theo nhãn cũ
- [ ] `flow-ui-routes.ui.spec.ts` auth per-flow theo manifest; `ADM-*` là ngoại lệ duy nhất dùng `super_admin`
- [ ] Spec UI assert "dùng được", không chỉ "render được"
- [ ] Guard Phase 5 xanh
- [ ] `runtime-evidence.json` mới sinh từ đầu; mọi chênh lệch so với 35 proven cũ đều có lý do ghi lại
- [ ] `plans/260717-1213-so-nghiem-thu-song` được cập nhật trạng thái Phase 4
- [ ] Toàn bộ gate xanh; báo cáo cuối nêu rõ số flow thật sự `proven` bằng vai nghiệp vụ

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Merge kéo theo giả định sai ẩn trong 5 commit | **Cao** | Merge vào nhánh làm việc trước; đọc diff từng commit, không merge mù; guard Phase 5 chạy ngay sau merge |
| Nhãn cũ sống sót trên main dù chỉ tạm thời | Cao | Xoá evidence **trong chính commit merge** (bước 2), không để sang commit sau |
| Số proven giảm mạnh bị hiểu là "làm hỏng" | Trung bình | Nêu trước trong plan: giảm là dấu hiệu nhãn nói thật; báo cáo cuối giải thích rõ cho PO |
| Xung đột với thay đổi Phase 1–3 ở `verify.ts`/`types.ts` | Trung bình | Phase 6 chạy sau cùng; giải quyết xung đột thủ công, chạy full gate sau merge |
| Spec UI assert quá lỏng, `proven` lại thành nhãn rỗng | Cao | Bước 4 là success criteria riêng, không phải việc phụ |
