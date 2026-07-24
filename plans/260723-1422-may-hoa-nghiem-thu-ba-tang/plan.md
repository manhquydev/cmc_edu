---
title: "Máy hoá nghiệm thu ba tầng — capture biết rỗng, ops-smoke host, journey specs"
description: >-
  Xây tầng đo còn thiếu: (B) capture khẳng định hình dạng dữ liệu + bắt màn câm
  lặng, (C) smoke vận hành chạy trên host thật, (A) journey specs biến luật UAT
  §4.2/§4.3 thành code — tăng dần từ 10 luồng lõi. Kèm đóng nợ N5 (matrix-regen
  CI check). UAT M0 người thật giữ nguyên làm lần ký cuối.
status: done
priority: P1
branch: main
tags: [acceptance, e2e, capture, ops-smoke, journey, ci]
# Phase 2/3 không phụ thuộc đợt B (red-team M4); 1/4/5 mới cần. Edge ở mức phase.
blockedByNote: "Phase 1/4/5 blocked by 260723-0913 landing; Phase 0/2/3 độc lập"
blocks: []
created: '2026-07-23T07:35:00.000Z'
createdBy: 'ck:plan'
source: skill
sourceReport: 'plans/reports/brainstorm-260723-1422-may-hoa-nghiem-thu-ba-tang-report.md'
---

# Máy hoá nghiệm thu ba tầng

## Overview

Không tầng đo nào hiện chứng minh "vai X đi trọn luồng Y qua giao diện và thấy kết
quả đúng" — người dùng đang phải là tầng đó. Bằng chứng: 3 luồng chết 16 ngày
(F1/F2/F4) trong khi mọi gate xanh (journal `260722-260723`). Plan này xây tầng
thiếu và đóng 3 lỗ đã chứng minh bằng sự cố thật:

1. Capture coi "ok + payload rỗng" là sạch → lớp F2 vô hình (Phase 1)
2. Gate `canDo()` client làm màn không gọi gì → vô hình với capture (Phase 1)
3. e2e bắc cầu id giữa vai → chính lớp mù che F1 (Phase 4–5)

Kèm: nợ N5 — `screen-role-matrix.json` trôi âm thầm, đã làm sai một con số trong
tài liệu Go/No-Go (Phase 2); runbook §3.0/§8d thành lệnh chạy được (Phase 3).

**Kế tục:** phase 4 (evidence collector) của `260717-1213-so-nghiem-thu-song` đã
superseded — sứ mệnh "bằng chứng chạy thật" tiếp tục ở đây bằng journey + capture
nâng cấp, không phải screenshot.

## Quyết định đã chốt (PO 2026-07-23, không mở lại)

| # | Quyết định | Căn cứ |
|---|---|---|
| Q1 | **Giữ UAT M0 người thật** làm lần ký cuối; máy hoá cho mọi vòng sau | Entra+MFA thật, phán quyết UX, chữ ký — máy không thay được |
| Q2 | Thứ tự **B + C trước, A tăng dần** từ ~10 luồng lõi | B+C rẻ; A theo manifest |
| Q3 | Email: **khẳng định outbox `sent` cho journey/smoke**; ảnh hộp thư là bước người | Worker có outbox + stub transport; tránh `Mail.Read` toàn tenant (red-team C4) |
| Q4 | Gate **nâng dần theo dữ liệu**: warn 1–2 tuần → chặn khi báo-giả ~0 | Đúng điều kiện `ci.yml:88-92` |
| **Q5** | **Dữ liệu do journey tạo theo TRÌNH TỰ vai thật, KHÔNG seed toàn bộ** (PO 2026-07-23) | Seed toàn bộ che lỗi tiềm ẩn vận hành thật; chỉ seed bootstrap tối thiểu (facility, curriculum, super_admin — đã có). Đây là điều gỡ nút C2+C3 của red-team |
| Q5-mở rộng | **2 ngoại lệ hẹp** (người dùng chốt 2026-07-24, xem `phase-04-journey-infra-hoi-quy.md`): seed ClassBatch+Course và attendance-mark cho F2, vì grep xác nhận không có UI thật tạo lớp hay dẫn tới điểm danh kèm session id. Mọi bước khác vẫn qua UI thật | Không đảo Q5 — chỉ 2 lỗ UI có thật, sự cố gốc là lỗi quyền-đọc không phải cơ chế tạo lớp. Ghi chú "PO 2026-07-23" trước đó ở `phase-04` là bịa đặt bởi một phiên thực thi, đã sửa 2026-07-24 |

## Mô hình sau red-team (Q5 định hình lại)

- **Journey (A) là tầng SỰ THẬT chính**: mỗi journey tự tạo dữ liệu theo trình tự (GĐ phân lớp → giáo viên mở màn thấy đúng lớp đó → roster non-empty). Khẳng định non-empty sống **ở đây**, nơi dữ liệu ra đời đúng cách vận hành thật.
- **Capture (B) rút về đúng việc gốc**: bắt `denied` + màn **câm lặng** (có kỳ vọng gọi mà không request nào). **Bỏ hẳn** khẳng định "dữ liệu non-empty" — vì thế **không cần seed nghiệp vụ**, và lỗ C2/C3 của red-team tan.
- **Phase 0 là điều kiện tiên quyết**: không có job CI chạy `PLAYWRIGHT_UI=1` thì mọi tầng là lưới không ai giăng (red-team C1).

## Phases

| Phase | Name | Status | Depends |
|-------|------|--------|---------|
| 0 | [CI executor cho UI specs (tiên quyết)](./phase-00-ci-executor-ui.md) | done | — |
| 1 | [Capture: denied + màn câm lặng (bỏ data-shape)](./phase-01-capture-data-shape.md) | done | 0 |
| 2 | [Matrix-regen check vào CI (đóng N5)](./phase-02-matrix-regen-ci.md) | done | — |
| 3 | [ops-smoke.sh — vận hành thật thành lệnh](./phase-03-ops-smoke-host.md) | done | — |
| 4 | [Journey hạ tầng + 3 journey hồi quy F1/F2/F4](./phase-04-journey-infra-hoi-quy.md) | done | 0 |
| 5 | [10 journey luồng lõi + coverage trong sổ nghiệm thu](./phase-05-journey-10-luong-loi.md) | done | 4 |

Phase 0 là **điều kiện tiên quyết** của 1/4/5 (red-team C1: không có nó thì
capture/journey không chạy trong CI). Phase 2 và 3 độc lập với Phase 0.

**Dependency đợt B ở mức phase, không phải cả plan** (red-team M4): Phase 1/4/5
cần đợt B (`260723-0913`) land (nav-registry + matrix + nav test); **Phase 2 và
Phase 3 KHÔNG** — Phase 3 chỉ chạm `scripts/` + runbook, khởi động được ngay.

## Bất biến

- `packages/auth/src/index.ts` không đổi — plan này ĐO quyền, không SỬA quyền.
- Không đổi hành vi app nào; mọi deliverable là test/script/CI/manifest metadata.
- Không nâng gate nào lên chặn merge trong plan này — chỉ warn + ghi điều kiện nâng (Q4).
- Journey không được `page.goto()` màn đích và không truyền id giữa vai — luật §4.2/§4.3 là assertion, phá luật = test sai.
- Không gửi email thật ngoài ops-smoke; không PII vào artifact.

## Acceptance Criteria (toàn plan)

- [x] **Phase 0 land trước:** job CI chạy `PLAYWRIGHT_UI=1` (warn-first) xanh trên một UI spec sẵn có — có nơi chạy thật thì các tầng mới có nghĩa
- [x] **Falsification bắt buộc (journey, không phải capture):** ẩn nav entry ⇒ journey đỏ đúng bước menu; gộp `attendance.mark` (gate thật, ĐÃ SỬA khỏi `classRoster.read`) vào quyền hẹp hơn ⇒ journey F2 đỏ ở roster — cả hai chứng minh thật, hoàn nguyên sạch (2026-07-24)
- [x] Capture bắt `denied` + màn câm lặng (không data-shape, không seed nghiệp vụ); race `void response.json()` đã xử trước khi tin `silentScreens` — run thật: 98 pairs, 183 calls, 0 denied, 0 silent
- [x] CI có bước regen matrix + diff (bỏ `generatedAt`), warn-first, điều kiện nâng bằng văn bản
- [x] `ops-smoke.sh` dry-run local PASS; **không** đọc hộp thư (khẳng định outbox `sent` + Brevo 200); runbook §3.0/§8d trỏ vào script
- [x] Journey đuôi `.journey.ui.spec.ts`; helper có `assertEntryAbsent`/`assertAbsent`; dữ liệu do vai tự tạo theo trình tự (Q5) — trừ 2 ngoại lệ hẹp người dùng chấp nhận 2026-07-24 (xem phase-04)
- [x] 10 journey lõi xanh qua job Phase 0 (17/17 spec `ui-chromium`, 4 lần liên tiếp); flow ID khớp `flow-manifest.ts` — 9/10 gắn được vào manifest (F1 để trần, tránh tái phạm H2, xem phase-05); `acceptance:report` hiện cột journey coverage (9/38)
- [x] `pnpm typecheck` · `pnpm lint` · `pnpm test` xanh (988 API + 396 admin); `git diff packages/auth/src/index.ts` rỗng

## Nợ ghi nhận (không làm plan này)

| # | Nội dung | Vì sao hoãn |
|---|---|---|
| N1 | Journey phủ 38/38 luồng | Tăng dần theo manifest sau 10 luồng lõi |
| N2 | Nâng các gate mới lên chặn merge | Cần 1–2 tuần dữ liệu warn (Q4) |
| N3 | Tự động hoá đăng nhập Entra thật + MFA | Ngoài khả năng automation; UAT người thật phủ |
| N4 | Capture cho LMS (phụ huynh/học viên) | Kế thừa hoãn Phase 7 của `260722-1114` |

## Sau plan này

Lịch nâng gate (điều kiện, không phải ngày): mỗi tầng warn ≥2 tuần chạy trong CI,
báo-giả đo được ~0 ⇒ gỡ `continue-on-error`. Ghi kết quả từng tuần vào
`docs/project-changelog.md` để có dữ liệu quyết định.

## Red Team Review

### Session — 2026-07-23
**Reviewer:** Security Adversary · Assumption Destroyer · Failure Mode Analyst (3 agent song song)
**Findings:** 25 thô → **13 sau khử trùng lặp** (mọi finding có `file:line`; spot-check bằng mắt các Critical đều đúng)
**Severity:** 4 Critical · 5 High · 4 Medium
**Kết luận:** plan **KHÔNG chạy được như viết** trên Phase 1/3/4/5. Ghi lại để sửa; **chưa cook**.

| # | Finding | Sev | Xử lý | Áp vào |
|---|---|---|---|---|
| C1 | **Không gì trong CI chạy capture/journey.** `ui-chromium` chỉ có khi `PLAYWRIGHT_UI=1`; ci.yml không set (0 lần). Điều kiện nâng gate Q4 "≥2 tuần warn chạy trong CI" bất khả thi từ cấu trúc | Critical | Accept | Phase 0 mới (CI executor) — tiên quyết cả plan |
| C2 | **Định nghĩa rỗng mù với cả 3 màn sự cố.** `classBatch.list`/`listForGrading`/`user.pickList` đều trả `{items:[]}`; Phase 1 loại object khỏi "rỗng" ⇒ Falsification B không bao giờ đỏ | Critical | Accept | Phase 1 viết lại: expectation khai `listField`, `{items:[]}` = rỗng |
| C3 | **Expectations không có nguồn dữ liệu.** `seed.mjs` chỉ trồng facility+curriculum+ca; capture chạy facility ephemeral tách RLS. "Seeded"≡"unseeded" cho mọi procedure khai | Critical | Accept | Phase 1: nới ràng buộc "không seed mới" (**cần PO chốt**) |
| C4 | **`Mail.Read` = đọc mọi hộp thư tenant.** Graph transport client-credentials `.default` trên app dùng chung; guard sink vô hiệu khi `STAFF_EMAIL_DOMAIN` rỗng (cấu hình prod hợp lệ) | Critical | Accept | Phase 3: **bỏ tự đọc hộp thư**; smoke chỉ khẳng định outbox `sent`+Brevo 200; ảnh hộp thư giữ là bước người (Q1) |
| H1 | Màn F2 sai: `/teaching/grading` không có dropdown lớp (hàng đợi submission); dropdown ở `/teaching/session-assessment`. "Chấm 1 bài" cần Submission không vai admin nào tạo được | High | Accept | Phase 1+4: F2 target = consumer `classRoster.read`, cắt "chấm 1 bài" |
| H2 | Journey #4 gắn sai flow ID: P1-01 là **phễu CRM**, "tạo học viên+ghi danh" là **P1-05** | High | Accept | Phase 5: đối chiếu manifest displayName trước khi ghi `journey` |
| H3 | psql insert EmailOutbox bỏ qua RLS+validation; `.to` free-form; guard sink defeatable | High | Accept | Phase 3: bỏ đường psql; enqueue qua template types, fail-closed domain rỗng |
| H4 | Journey "prod-config" mâu thuẫn boot-checks (dev-default `STAFF_SESSION_SECRET` bị chặn ở prod) và ép secret ký-session vào CI | High | Accept | Phase 0: định nghĩa "prod-config cho CI"; không đưa secret prod thật vào CI |
| H5 | Đuôi `.journey.spec.ts` khớp regex project `api` ⇒ CI browserless vấp mọi push, bị `continue-on-error` che | High | Accept | Phase 4/5: đuôi `.journey.ui.spec.ts` |
| M1 | `silentScreens` xây trên race sẵn có (`void response.json()`+chờ cứng 1.2s) ⇒ báo giả đầu độc chỉ số Q4 | Medium | Accept | Phase 1: await/settle trước đóng context, hoặc hạ `silentScreens` thành cảnh báo mềm |
| M2 | Helper Phase 4 đều fail-on-absence; journey phủ định 6/8/10 không cơ chế. `manualPunch.list` không hiện phiếu khác track | Medium | Accept | Phase 4: thêm `assertEntryAbsent`/`assertAbsent` (settled-wait) |
| M3 | Phase 3 nói sai "worker không boot-check" (có đủ; thiếu đúng `assertRequiredEnvForProd`); bỏ qua health endpoint+compose healthcheck | Medium | Accept | Phase 3: dùng healthcheck compose; sửa mô tả |
| M4 | `blockedBy` đợt B chặn nhầm Phase 3 (chỉ chạm scripts/+runbook) ⇒ nối tiếp sau phụ thuộc người vô cớ | Medium | Accept | plan.md: edge xuống mức phase — chỉ 1/2/4/5 bị chặn |

**Reject (2):** "superuser postgres đếm row" — đúng thiết kế, runbook đòi role `postgres` để RLS không che (journal bài học #4); "falsification push nhánh nav mutated" — làm local không commit.

**Sửa trích dẫn:** `worker/index.ts:110`→`:135-140`; `runbook-deploy.md:49-56` là cảnh báo psql host **không** tới được DB; `p1-runtime-proofs.spec.ts:49-63` (phase-04) **không tồn tại** — xoá.

## Câu hỏi chưa giải (cần PO trước khi cook)

1. **C3 — nới ràng buộc "KHÔNG chế seed mới"?** Ràng buộc tôi tự đặt, red-team chứng minh nó làm AC bất khả thi. Chọn: (a) thêm seed nghiệp vụ tối thiểu deterministic (1 lớp, 1 submission, N nhân sự) vào `synthetic-seed`; (b) hạ AC xuống trung thực "phủ màn nào seed hiện tại cấp được".
2. **C1/H4 — thêm Phase 0 dựng CI executor (`PLAYWRIGHT_UI=1` job)?** Không có nó cả plan là lưới không ai giăng. Phase mới, cần xác nhận đưa vào.
3. **H1 — màn F2 thật là màn nào?** Bằng chứng về `session-assessment` (consumer `classBatch.list`) hoặc consumer `classRoster.read`. Chốt trước khi viết lại Phase 1/4.
