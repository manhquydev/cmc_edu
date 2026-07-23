---
title: "Đợt B — dọn tiền-UAT trước khi chạy Phase 4 người thật"
description: >-
  Bốn việc chốt cứng phải xong trước khi tập hợp người chạy UAT: lối vào menu cho
  các màn chỉ vào được bằng gõ URL, chặn BREVO_API_KEY dính dòng ngay lúc boot +
  gửi email thật trên host, và đồng bộ tài liệu đang mâu thuẫn với chính nó.
status: pending
priority: P1
branch: main
tags: [uat, go-live, nav, email, docs]
blockedBy: []
blocks: [260707-2308-golive-sprint-land-sso-env-uat, 260723-1422-may-hoa-nghiem-thu-ba-tang]
created: '2026-07-23T02:20:00.000Z'
createdBy: 'ck:plan --tdd'
source: skill
sourceReport: 'plans/reports/brainstorm-tinh-trang-du-an-260723-0913-don-tien-uat-roi-dong-m0-report.md'
---

# Đợt B — dọn tiền-UAT trước khi chạy Phase 4 người thật

## Overview

M0 là mốc duy nhất đang chặn dự án, và Phase 4 UAT người thật **chưa từng chạy** kể từ 2026-07-07. Đợt này dọn 4 thứ sẽ làm hỏng buổi UAT nếu để nguyên — rồi mới xếp lịch.

Điều kiện thực tế đã có (PO xác nhận 2026-07-23): **đủ người thật cho từng vai + host prod**.

Nguồn: `plans/reports/brainstorm-tinh-trang-du-an-260723-0913-don-tien-uat-roi-dong-m0-report.md`

## Vì sao 4 việc này, không phải việc khác

| Việc | Nếu bỏ qua thì sao |
|---|---|
| Nav cho màn URL-only | Luật UAT §4.3 *"vào màn bằng menu"* **rỗng nghĩa** với P4-01 và P4-02 — người test không tìm ra màn, hoặc phải được đưa URL, đúng thứ runbook cấm. Thêm: `/finance/class-placement` hiện **không có gate nào ở tầng route** |
| Chặn giá trị bí mật nuốt dòng | Đã giết OTP phụ huynh **12 ngày**. Thiếu newline làm một dòng nuốt dòng kế tiếp — giá trị thu được là **một dòng, không xuống dòng, không khoảng trắng**, nên không lớp kiểm nào thấy. Phát hiện lúc UAT = mất cả buổi đã tập hợp người |
| Rotate khoá + allowlist IP + gửi email thật | Tiêu chí Go/No-Go đòi **ảnh hộp thư nhận**. IP của VPS **chưa bao giờ** được thêm vào authorised-IPs của Brevo, nên chưa từng có email thật nào gửi được từ đó. Chạy trước để nếu fail thì lùi lịch, chứ không lùi giữa buổi |
| Đồng bộ runbook §1/§5/§8/§8d/§9 + TL27/TL25 | §8 còn ghi *"🔴 CHẶN"* cho việc đã xong; §9 còn 3 checkbox đã đóng; §8d còn đòi rotate; §1 mang số tổ hợp sẽ sai sau Phase 1. Người chạy UAT gặp mâu thuẫn sẽ dừng lại hỏi |

## Phases

| Phase | Name | Status | Depends |
|-------|------|--------|---------|
| 1 | [Nav cho màn chỉ vào được bằng URL](./phase-01-nav-man-url-only.md) | **done** 2026-07-23 | — |
| 2 | [Chặn giá trị bí mật nuốt dòng ngay lúc boot](./phase-02-boot-check-brevo-key-shape.md) | **done** 2026-07-23 | — |
| 4 | [Đồng bộ tài liệu với hiện trạng](./phase-04-dong-bo-runbook-va-tl27.md) | **done** 2026-07-23 | 1 |
| 3 | [Brevo trên host UAT — rotate, allowlist, gửi email thật](./phase-03-brevo-host-uat-email-that.md) | **pending — chặn bởi quyền truy cập** | **1, 2, 4** |

> **Phase 3 chưa chạy được.** Cần shell trên VPS UAT, dashboard Brevo, và hộp thư nhân sự — phiên thực thi 2026-07-23 không có thứ nào. Bàn giao + những gì đã kiểm hộ: [`plans/reports/handover-260723-1042-phase-03-brevo-host-uat-operator.md`](../reports/handover-260723-1042-phase-03-brevo-host-uat-operator.md).

Phase 1 và 2 độc lập, chạy song song được. Phase 4 sau Phase 1 (cảnh báo §5 về màn không nav, và con số §1, chỉ đúng sau khi nav được thêm).

**Phase 3 chạy CUỐI** *(sửa sau red-team)*. Bản đầu cho nó phụ thuộc mỗi Phase 2, đồng thời tuyên bố redeploy của nó là bước 0 REDEPLOY của runbook. Hai điều đó không tương thích: redeploy khi Phase 1 chưa land ⇒ prod không có nav entry ⇒ người test UAT theo §4.3 *"vào màn bằng menu"* không tìm ra màn, đúng lỗi đang đi sửa; và gate §9 *"commit trên prod = `main` tại thời điểm UAT"* thành sai. Redeploy **một lần**, từ `main` đã có cả ba phase kia.

## Bất biến — không đổi trong đợt này

- **`packages/auth/src/index.ts` không đổi một dòng.** Không nới quyền nào. Mọi entry nav gate bằng key **đã tồn tại**.
- Không đụng `schema.prisma`, không migration.
- **Không nâng CI gate `acceptance:report` lên chặn merge.** `ci.yml:88-92` ghi rõ điều kiện nâng là "vài tuần chạy chứng minh chỉ báo drift thật"; gate mới thêm 2026-07-22, được 1 ngày. Nâng bây giờ là đảo một quyết định có lý do mà không có bằng chứng mới.
- Không làm tính năng M2 (lịch họp PH theo lớp).

**Trần cứng:** phát sinh ngoài 4 phase ⇒ ghi vào §Nợ ghi nhận, **không** làm trong đợt này.

## Quyết định đã chốt (không mở lại nếu không có bằng chứng mới)

| # | Quyết định | Căn cứ |
|---|---|---|
| ~~D1~~ | ~~`super_admin` **không** là actor P3-02, xoá khỏi TL27:47~~ | **ĐẢO 2026-07-23 sau red-team** → xem D1′ |
| **D1′** | TL27:47 **viết lại, không xoá**: `super_admin` là người duyệt cho **phiếu không có track** (chủ phiếu là giám đốc/super_admin), không phải người duyệt phổ thông. Nâng TL25:39 lên cho khớp | Bằng chứng mới: `checkin/router.ts:158` cho thấy đó là **đường duyệt duy nhất** của một lớp phiếu; test khoá `manual-punch-approval-track.test.ts:212`; TL27:66-67 đã ghi. Xoá ở `:47` tạo mâu thuẫn mới cách 20 dòng. PO chốt lại 2026-07-23 |
| D2 | `/finance/class-placement` **được** thêm nav | PO 2026-07-23. Màn đã xây mà không lối vào nào thì công xây là bỏ |
| D3 | `/admin/engagement/leaderboard` **KHÔNG** thêm nav | Đo 2026-07-23: là `EmptyState` coming-soon (`leaderboard.tsx:18`), cùng loại `/finance/refund` mà sổ nghiệm thu vừa hạ khỏi `built`. Thêm nav = lặp lại lỗi commit `24ef2e3` |
| **D4** | Khoá Brevo: **rotate + thêm IP outbound của VPS vào authorised-IPs** | PO 2026-07-23. Runbook §8d đòi rotate; nhật ký `260711:77` ghi khoá SMTP+API thật đã bị dán vào một phiên chat. Allowlist là nguyên nhân 401 **thật sự quan sát được** (`260711:71`), chưa bao giờ xử lý |
| **D5** | `/admin/engagement/gifts` gate bằng `gift.upsert` (2 GĐ), không phải `gift.list` | Màn cấu hình P4-02; mutation duy nhất là `gift.upsert`; manifest khai P4-02 chỉ 2 GĐ. Gate bằng `gift.list` đưa sale vào màn mọi hành động đều 403. Sale giữ lối vào P4-01 qua `rewards.manage` |

## Acceptance Criteria (toàn đợt)

- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm test` xanh
- [ ] `git diff packages/auth/src/index.ts` **rỗng**
- [ ] `nav-registry.test.ts` phủ 4 entry mới **theo từng vai**, gồm ca vai KHÔNG có quyền thì KHÔNG thấy entry
- [ ] Có test khẳng định **mọi `path` trong nav giải được thành route đã đăng ký**
- [ ] `finance.routes.tsx` có `PermissionGate` cho `class-placement`
- [x] **`apps/e2e/screen-role-matrix.json` đã regenerate + commit**; `pairCount` trước/sau ghi lại; runbook §1 mang số mới
      → **Đo thật 2026-07-23: `pairCount` 118 → 114; không-tham-số 102 → 98** (dự báo 96 của bản plan **sai**). Lệch vì hai lẽ: (a) `gift.upsert` của D5 loại **cả `sale`** khỏi `gifts` nên mất **7** cặp chứ không phải 6; (b) artifact đã **cũ sẵn** — vẫn khai `/finance/refund` có nav entry mà `24ef2e3` đã gỡ, nên regenerate **thêm lại 3** cặp. `102 − 7 + 3 = 98`.
- [ ] Boot fail khi giá trị bí mật **chứa phép gán nhúng** (chuỗi một dòng, đúng hình dạng sự cố thật) — không chỉ ca có `\n`
- [ ] Rotate khoá Brevo xong; `GET /v3/account` trả **200 từ chính host UAT** trước khi redeploy
- [ ] API boot **và** worker sống — kiểm riêng từng process
- [ ] e2e chạy lại sau redeploy, xanh
- [ ] ≥1 email Brevo thật vào hộp thư **nhân sự**, có ảnh (che PII, **lưu ngoài repo**) + log worker khớp
- [ ] Đọc `docs/runbook-uat-golive.md` một mạch không gặp mâu thuẫn — gồm cả §1 và §8d
- [ ] TL27:47 không mâu thuẫn TL27:66-67; TL25:39 khớp TL27

> `pnpm acceptance:report` giữ 37/1 và `actorAudit.findings` 0 là **phép kiểm hồi quy rẻ, không phải bằng chứng đợt này chạy đúng** — không phase nào có đường làm nó đổi (`verify.ts` không đọc `nav-registry.ts`; Phase 4 không đụng manifest). Artifact **thật sự** trôi là `screen-role-matrix.json`, đã đưa lên thành tiêu chí riêng ở trên.

## Nợ ghi nhận (không làm đợt này)

| # | Nội dung | Vì sao hoãn |
|---|---|---|
| N1 | Sổ nghiệm thu chỉ bắt orphan **procedure**, không bắt orphan **route** — `/finance/class-placement` là màn đã xây không luồng nào khai, lọt qua toàn bộ hệ đo | Mở rộng hệ đo là hướng C đã bị loại; cân nhắc khi CI gate được nâng |
| N2 | Nâng CI gate `acceptance:report` lên chặn merge | Chưa đủ thời gian chạy theo điều kiện đã ghi trong `ci.yml` |
| N3 | Tính năng M2: lịch họp PH theo lớp + nhắc + GV xem để chuẩn bị | PO chốt hoãn sau go-live 2026-07-23; cần sửa schema `ParentMeeting` |
| N4 | `/admin/engagement/leaderboard` xây thật rồi mới thêm nav | Hiện là màn giữ chỗ (D3) |
| N5 | `apps/e2e/screen-role-matrix.json` không có script/CI nào regenerate hay kiểm hạn — trôi âm thầm mỗi khi `nav-registry.ts` đổi | Đợt này regenerate tay và commit; wire vào CI là việc riêng, cùng họ với N2 |
| N6 | `boot-checks.ts:163` tự nhận là *"runtime twin of scripts/env-check.sh"* nhưng `required` thiếu `STAFF_SESSION_SECRET`, `BACKUP_ENCRYPTION_PASSPHRASE` | Lệch có sẵn từ trước; sửa sẽ thêm biến bắt buộc mới, phạm bất biến của đợt B |

## Red Team Review

### Session — 2026-07-23
**Reviewer:** Security Adversary · Assumption Destroyer · Failure Mode Analyst (3 agent song song, tier Standard)
**Findings:** 29 thô → **16 sau khử trùng** (16 accepted, 0 rejected — mọi finding đều có trích dẫn `file:line`)
**Severity:** 4 Critical · 7 High · 5 Medium

| # | Finding | Sev | Xử lý | Áp vào |
|---|---|---|---|---|
| 1 | Điều kiện boot-check **không bắt được hình dạng sự cố thật** — giá trị nuốt dòng là MỘT dòng, không có `\n`; `trim()` và `/[\r\n]/` đều trả false | Critical | Accept | Phase 2 (viết lại) |
| 2 | Chẩn đoán Phase 3 grep **nhầm biến** — dòng bị nuốt là `GRAPH_TENANT_ID`; lệnh cũ trả 1 trên đúng file hỏng | Critical | Accept | Phase 3 (viết lại) |
| 3 | Thiếu bước **thêm IP VPS vào Brevo allowlist** — blocker đã ghi trong nhật ký, chưa bao giờ làm | Critical | Accept | Phase 3 + D4 |
| 4 | Thứ tự phase cho phép **redeploy prod trước khi Phase 1 land** ⇒ UAT không có menu | Critical | Accept | plan.md, Phase 3 deps `[1,2,4]` |
| 5 | `finance.routes.tsx` **không có `PermissionGate`** ⇒ nav là gate duy nhất của `/finance/class-placement`; plan khẳng định ngược lại | High | Accept | Phase 1 (thêm gate) |
| 6 | `screen-role-matrix.json` sinh bằng parse `nav-registry.ts`, commit trong git, **không CI nào regenerate**; ma trận co 102→96 và runbook §1 thành sai | High | Accept | Phase 1 + Phase 4 §1 |
| 7 | Module `engagement` **không có route** ⇒ bấm header rơi vào `ComingSoon` | High | Accept | Phase 1 (path + test path↔route) |
| 8 | Phase 3 **không có rollback, không tiêu chí abort**, không phân biệt FATAL boot-check với lỗi deploy khác | High | Accept | Phase 3 (bước 1,6,8) |
| 9 | **Worker không gọi `assertRequiredEnvForProd`** — API boot không chứng minh gì về process gửi mail | High | Accept | Phase 2 §Architecture, Phase 3 bước 8 |
| 10 | §8d (🔴 rotate khoá) ngoài phạm vi Phase 4 ⇒ tiêu chí "đọc một mạch không mâu thuẫn" **bất khả thi** | High | Accept | Phase 4 + D4 |
| 11 | D1 xoá `super_admin` khỏi P3-02 — nhưng code bắt buộc nó cho phiếu không-track | High | Accept (PO đảo) | D1′, Phase 4 bước 4 |
| 12 | Test `returns exactly 5 groups` **không có assert đếm** ⇒ dự báo "chắc chắn vỡ" của plan là sai; tên test thành nói dối | Medium | Accept | Phase 1 bước 3b |
| 13 | `setProdEnv` không tồn tại (thật là `setProdBase()` không tham số); `sso-routes.test.ts` là caller thứ hai chưa liệt | Medium | Accept | Phase 2 bước 0 + Related Files |
| 14 | Danh sách bí mật bỏ sót `GRAPH_TENANT_ID`, `LMS_SESSION_SECRET`, `STAFF_SESSION_SECRET`, `BACKUP_ENCRYPTION_PASSPHRASE` | Medium | Accept | Phase 2 (6→14 biến) |
| 15 | Bằng chứng UAT = hộp thư phụ huynh thật + OTP **commit vào git**, sản phẩm xử lý dữ liệu trẻ em | Medium | Accept | Phase 3 (hộp thư nhân sự, lưu ngoài repo) |
| 16 | Gate `gift.list` đưa sale vào màn cấu hình mọi hành động 403; tiêu chí `acceptance:report` không thể sai nên chứng minh rỗng; vài trích dẫn dòng lệch (`auth:140-143`, `boot-checks:183`, `ci.yml:88-92`) | Medium | Accept | D5, plan.md, Phase 1/2 |

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01`, `phase-02`, `phase-03`, `phase-04`
- Decision deltas: 5 (D1→D1′ · D4 rotate+allowlist · D5 gift.upsert · Phase 3 deps `[1,2,4]` · phạm vi Phase 4 +§1 +§8d)
- Reconciled stale references: 9 — bảng Phases, phần "Sau đợt này" (bước 0 REDEPLOY nay do Phase 3 thực hiện), tiêu chí `acceptance:report`, bảng key Phase 1, tiêu đề Phase 2/3, §Nợ ghi nhận
- **Unresolved contradictions: 0**

## Câu hỏi chưa giải

1. `/finance/class-placement` thuộc luồng nào trong TL25? Thêm nav xong có cần bổ sung dòng checklist §5 tương ứng không — hay để UAT phát hiện.
2. UAT `super_admin` (5 luồng ADM-01→05): người thật hay nghiệm bằng ảnh chụp? Có nghiệm ca **phiếu chấm công của giám đốc** (chỉ super_admin duyệt được, D1′) không?
3. `screen-role-matrix.json` không có script/CI nào regenerate — nên wire vào `pnpm` script hay để tay? *(Nợ N5.)*

## Sau đợt này

Chạy Phase 4 của `plans/260707-2308-golive-sprint-land-sso-env-uat` theo `docs/runbook-uat-golive.md`.

**Bước 0 REDEPLOY do Phase 3 của đợt này thực hiện** — Phase 3 redeploy từ `main` đã có cả 3 phase kia, ghi lại commit hash, và chạy e2e sau redeploy. Ghi hash đó vào biên bản UAT; **không redeploy lần nữa** giữa Phase 3 và buổi UAT, nếu không §9 lại lệch.

Hai điểm dễ chết còn lại, nhắc vì chúng vô hiệu hoá cả buổi:

1. **`restore-drill.sh` KHÔNG reset `cmc_prod`** — có guard cứng từ chối đích đó, vẫn in `RESTORE DRILL PASSED`.
2. **Đếm row bằng role `postgres`** — RLS FORCE làm `cmc_app` trả count 0 không báo lỗi.
