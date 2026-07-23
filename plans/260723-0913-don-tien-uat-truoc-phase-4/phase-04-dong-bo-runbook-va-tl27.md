---
phase: 4
title: "Đồng bộ tài liệu với hiện trạng"
status: done
priority: P2
dependencies: [1]
---

# Phase 4: Đồng bộ tài liệu với hiện trạng

## Overview

Thuần tài liệu. `docs/runbook-uat-golive.md` hiện **mâu thuẫn với chính nó**: §8 tuyên bố một thứ đang chặn mà §8c ngay dưới nói đã giải quyết. Người chạy UAT đọc tới §8 sẽ dừng lại hỏi — đúng lúc không nên phải hỏi ai.

Kèm theo: TL27 và TL25 mâu thuẫn về actor P3-02, PO đã chốt hướng 2026-07-23.

Phase này chạy **sau Phase 1** vì cảnh báo trong §5 về "màn không có nav entry" sẽ thành sai khi nav được thêm.

## Requirements

**Functional**
- §8 không còn tuyên bố "CHẶN" cho việc đã xong, nhưng **giữ lại lịch sử** — xoá trắng làm mất bối cảnh vì sao 4 luồng từng không phân công được cho ai.
- §9 chỉ còn gate **thật sự chưa đóng**.
- §5 cảnh báo về màn không nav phản ánh đúng tình trạng sau Phase 1.
- TL27 khớp TL25 về actor P3-02.

**Non-functional**
- Không sinh lại §5 bằng tay. Nếu checklist đổi, sinh lại từ `acceptance-report/verification.json` như bản gốc (`runbook:4` ghi rõ *"không chép tay"*).

## Architecture

Nguyên tắc sửa: **đính chính tại chỗ, không xoá lịch sử.** Đây là văn phong đã dùng nhất quán trong repo (xem các khối *"⚠️ Đính chính 2026-07-23"* trong `docs/system-architecture.md`). Một runbook nói *"việc này từng chặn, đã giải quyết ngày X vì lý do Y"* dạy được người đọc; một runbook im lặng thì không.

## Related Code Files

- Modify: `docs/runbook-uat-golive.md` — **§1** (số tổ hợp runtime capture), §5 cảnh báo nav, §8, **§8d** (blocker rotate khoá), §9
- Modify: `docs/27-workflow-spec-p3.md` — **viết lại** vai trò `super_admin` ở `:47` cho khớp `:66-67`, **không xoá**
- Modify: `docs/25-ma-tran-truy-vet-p1.md:39` — nâng lên cho khớp TL27 (thêm vế escalation), thay vì hạ TL27 xuống
- Không sửa: `scripts/acceptance-report/flow-manifest.ts`

### Ba mục bản đầu bỏ sót (phát hiện red-team)

**§1 — con số bằng chứng.** §1 ghi *"runtime capture 102 tổ hợp màn×vai (0 denied)"*. Phase 1 thêm 4 nav entry ⇒ ma trận co còn **96**. Không sửa thì tài liệu Go/No-Go dùng một con số sai để biện minh cho việc **không** kiểm tay lại nghiệp vụ.

**§8d — blocker rotate khoá Brevo.** §8d ghi 🔴 *"Brevo key phải rotate + verify TRƯỚC bước 5"*. Nếu §8d không nằm trong phạm vi thì tiêu chí nghiệm thu của chính phase này (*"đọc một mạch không mâu thuẫn"*) **bất khả thi**. PO chốt 2026-07-23: **rotate + thêm IP VPS vào allowlist** (Phase 3 thực hiện) ⇒ §8d cập nhật thành đã-giải-quyết kèm ngày, và bổ sung dòng allowlist mà bản gốc không có.

**TL27 — viết lại, không xoá** *(đảo quyết định D1 sau bằng chứng mới)*. `super_admin` **không** phải bypass trang trí ở P3-02: phiếu của người **không có track** (giám đốc hoặc super_admin) thì `super_admin` là **đường duyệt duy nhất** — `checkin/router.ts:158`, test khoá `manual-punch-approval-track.test.ts:212`, và chính TL27:66-67 ghi rõ. Xoá ở `:47` sẽ tạo mâu thuẫn mới bên trong TL27, cách nhau 20 dòng.

## Implementation Steps

**Bước 1 — §8.** Hiện đang là *"🔴 CHẶN — phải giải quyết TRƯỚC khi xếp lịch UAT"* với nội dung *"2 luồng KHÔNG có actor hợp lệ nào: P3-01, P4-03"*. Sai từ commit `a754edf`: manifest đã dịch `nhan_vien` thành vai thật, và §5 **đã có** đủ dòng cho cả hai luồng ở cả 4 vai.

Sửa: đổi tiêu đề §8 thành dạng đã-giải-quyết, giữ nguyên phần giải thích `nhan_vien` là lỗi dịch (đó là bài học), thêm một dòng ghi rõ ngày và commit đã đóng nó, trỏ sang §8c.

**Bước 2 — §9.** Ba checkbox sau đã đóng 2026-07-23, đang làm người đọc tưởng còn treo:
- `§8 đã giải quyết: P3-01 và P4-03 có actor thật` → đã xong (`a754edf`)
- `§8c: P4-04/giao_vien đã có phán quyết PO` → đã xong (PO chốt: bỏ `giao_vien`, không nới quyền)
- `§8c: 21 unreachable-procedure đã được phân loại` → **chuyển thể, không xoá** (xem dưới)

Đổi thành mục "đã đóng trước UAT" có ghi ngày. Giữ nguyên các gate còn thật sự mở (email, redeploy, e2e sau redeploy, PII-guard, đếm row, biên bản).

> **Không xoá trắng gate thứ ba.** §8c ngay bên cạnh nó ghi rõ *"hai giới hạn phải đọc là **chưa phủ**, KHÔNG phải sạch"*: **26 procedure ngoài tầm registry** và **2 cặp (luồng, vai) không kết luận được**. Bỏ hẳn dòng checklist là thao tác một chiều — không ai thêm lại. Chuyển thành:
> *"21 unreachable-procedure đã phân loại (2026-07-23, không có lỗi quyền nào); **26 procedure ngoài tầm registry vẫn chưa đánh giá** — chấp nhận cho UAT có chữ ký PO, theo dõi ở nợ N1."*
> Giữ được một ô tick cho phần thật sự còn mở. `actorAudit.findings == 0` **không** phải bằng chứng ngược lại: audit theo thiết kế không nhìn được 26 procedure đó.

**Bước 3 — §5 cảnh báo nav.** Đoạn *"Một số màn không có nav entry (`/finance/new`, `/finance/class-placement`, `/admin/courses`, các màn engagement)"* sẽ sai sau Phase 1. Sự thật mới:
- `/finance/new` — **có** nút từ `/finance` (`receipt-list.tsx:133`), chưa bao giờ cần nav
- `/finance/class-placement`, `/admin/courses`, `engagement/gifts`, `engagement/rewards` — **đã có nav** (Phase 1)
- `/admin/engagement/leaderboard` — **cố ý không có nav**, là màn giữ chỗ

Viết lại đoạn này cho đúng, giữ luật §4.3 "vào bằng menu" **áp dụng đầy đủ** cho các màn vừa có nav.

**Bước 4 — TL27 + TL25, viết lại chứ không xoá.** `docs/27-workflow-spec-p3.md:47` ghi `Actors: ... super_admin (mọi phiếu)`. Sửa thành hai vai trò tách bạch, khớp `:66-67` và khớp code:
- người duyệt **thông thường**: GĐKD (phiếu của sale) / GĐĐT (phiếu của giáo viên) — theo track, ADR 0043;
- `super_admin`: **người duyệt cho phiếu không có track** (chủ phiếu là giám đốc hoặc super_admin) — không phải người duyệt phổ thông.

Rồi **nâng `docs/25-ma-tran-truy-vet-p1.md:39`** lên cho khớp (hiện ghi `nhân viên / GĐ track`, thiếu vế escalation — và vẫn còn chữ "nhân viên" thô mà `a754edf` vừa gỡ khỏi manifest).

Ghi rõ phần thuộc phạm vi UAT: `super_admin` **không** thêm dòng P3-02 thường vào §5; nếu muốn nghiệm cả ca phiếu-của-giám-đốc thì đó là một dòng riêng, PO quyết.

**Bước 5 — §1.** Sửa *"runtime capture 102 tổ hợp màn×vai"* thành số thật sau Phase 1 (dự kiến **96**), lấy từ `pairCount` mà Phase 1 ghi lại. Kèm một câu vì sao giảm: 4 màn có nav gate nên không còn được mọi vai thăm dò.

**Bước 6 — §8d.** Cập nhật dòng 🔴 rotate: PO chốt 2026-07-23 **rotate + thêm IP VPS vào authorised-IPs**, Phase 3 thực hiện. Bổ sung vế allowlist mà bản gốc không có — đó mới là nguyên nhân 401 quan sát được, không phải khoá.

**Bước 7 — chạy `pnpm acceptance:report`**, xác nhận **37 built / 1 partial** và `actorAudit.findings` vẫn **0**. *(Lưu ý: tiêu chí này không thể sai vì phase này không đụng manifest — nó là phép kiểm hồi quy rẻ, **không** phải bằng chứng phase chạy đúng.)* Nếu §5 cần sinh lại thì sinh từ `verification.json`, không gõ tay.

**Bước 8 — đọc `docs/runbook-uat-golive.md` từ đầu tới cuối một mạch**, tìm mâu thuẫn còn sót. Đây là tiêu chí nghiệm thu thật của phase.

## Success Criteria

- [ ] §8 không còn tuyên bố "CHẶN" cho việc đã xong, **và vẫn giữ** lời giải thích lỗi dịch `nhan_vien`
- [ ] §9: 2 gate đã đóng ghi kèm ngày; gate thứ ba **chuyển thể** giữ lại phần 26 procedure chưa đánh giá
- [ ] §5 mô tả đúng tình trạng nav sau Phase 1, gồm `/admin/engagement/leaderboard` cố ý không có nav
- [ ] §1 mang số tổ hợp đúng sau Phase 1
- [ ] §8d phản ánh quyết định rotate + allowlist, có ngày
- [ ] TL27:47 và TL27:66-67 **không mâu thuẫn nhau**; TL25:39 khớp TL27; `super_admin` được mô tả là người duyệt phiếu không-track, không bị xoá
- [ ] `pnpm acceptance:report` giữ 37/1, `actorAudit.findings` 0
- [ ] Đọc runbook một mạch không gặp mâu thuẫn nào — gồm cả §1, §8d

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Xoá §8 làm mất bài học `nhan_vien` là lỗi dịch | TB | Nguyên tắc §Architecture: đính chính tại chỗ, không xoá lịch sử |
| Sửa §5 bằng tay làm lệch khỏi `verification.json` | TB | Bước 5: sinh lại từ JSON, không gõ tay. `runbook:4` đã ghi ràng buộc này |
| Bỏ nhầm một gate §9 còn đang mở | **Cao nếu xảy ra** | Chỉ đụng đúng 3 gate liệt ở bước 2; bước 6 đọc lại toàn văn |
| Sửa TL27 xong quên manifest cũng khai super_admin | Thấp | Đã kiểm 2026-07-23: manifest P3-02 **không** khai `super_admin`, TL27 mới là chỗ lệch |
