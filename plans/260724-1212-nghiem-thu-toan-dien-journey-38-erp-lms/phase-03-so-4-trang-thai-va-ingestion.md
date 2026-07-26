---
phase: 3
title: "Sổ trạng thái máy-chứng: ingestion vào AcceptanceState có sẵn (TDD)"
status: done
completed: '2026-07-24'
report: 'plans/reports/phase-03-ingestion-so-may-chung-260724-1545-report.md'
priority: P1
effort: "2.5d"
dependencies: []
---

# Phase 3: Sổ trạng thái máy-chứng — ingestion vào `AcceptanceState` có sẵn

## Overview
Nâng `acceptance:report` để trạng thái "đã chứng minh chạy" per-flow đến từ kết quả Playwright thật (D3/C1). **Thiết kế lại sau red-team RT-12:** KHÔNG thêm chiều trạng thái thứ ba — renderer đã có sẵn `AcceptanceState = 'proven' | 'built-unproven' | 'not-yet'` với TODO EvidenceIndex chờ cắm (`templates/acceptance-tab.ts:17-23`, badge ⬤ "Đã chứng minh chạy" tại `:27`). Ingestion cắm vào đúng ổ đó; người xem thấy MỘT trạng thái + badge lý do.

## Requirements
- Functional:
  - (a) Parser `ingest-playwright-results.ts` trả **facts thuần từ results**: per spec-path → `pass | fail | skipped(annotations: fixme/skip) | absent`. KHÔNG biết manifest (RT-12: `no-ui-path` là metadata manifest, xử lý ở verify).
  - (b) `verify.ts` compose: facts × `manifest.journey` × `statusReason` → `acceptanceState` cuối: `proven` (mọi test pass, KHÔNG tính vacuous — spec toàn fixme/skip KHÔNG BAO GIỜ proven, RT-12), `built-unproven` (+ badge phân loại: "đỏ-fixme có lý do" | **"đỏ chưa triage"** khi fail mà manifest thiếu statusReason — RT-13: render to, KHÔNG FAIL tool), `not-yet`; flow có `statusReason.code='no-ui-path'` hiển thị badge riêng kèm bằng chứng.
  - (c) **Provenance (RT-2):** results phải chứa git SHA (env-inject lúc chạy) + project + danh sách spec; verify: SHA ≠ HEAD → toàn bộ tụt `built-unproven("stale")`; thiếu spec đã khai trong manifest → flag "partial run", không dùng cho sổ v1.
  - (d) `verify` **FAIL** chỉ với dối cấu trúc: `journey:` trỏ file không tồn tại, hoặc mapping vi phạm H2 mà Phase 2 đã đánh dấu (RT-13 thu hẹp phạm vi FAIL).
  - (e) **Reporter gate (RT-4):** json reporter CHỈ bật khi `PLAYWRIGHT_UI=1` (cùng gate với project ui-chromium) — run api không bao giờ ghi đè `journeys.json`; output path theo project.
  - (f) **Nguồn chính danh (RT-3 + validate V1, user 2026-07-24):** mở rộng job `ui-e2e` chạy **full `ui-chromium` MỖI PUSH** + upload `journeys.json` làm artifact CI, GIỮ warn-first (`continue-on-error` giữ nguyên — không nâng gate). Sổ v1 chỉ sinh từ artifact này. Nếu job vượt ngưỡng D2 → thang F-B: nightly rồi shard (quyết định lại có số đo, không âm thầm đổi).
  - (g) **Điều kiện tiên quyết (validate V3) — ĐÃ CHẨN ĐOÁN, KHÔNG SỬA ĐƯỢC TỪ REPO (V4, user 2026-07-24):** nguyên nhân CI fail 3–4s là **billing**, không phải workflow: mọi run từ 2026-07-17 fail với 0 step chạy (mới nhất `30077288512` trên `a57e71d`), YAML hợp lệ (job được tạo), Actions `enabled`, repo private → hết Actions minutes/spending limit. Chỉ sửa được trong GitHub web billing; `gh` thiếu scope `user`. **Hệ quả (V4):** (f) vẫn được viết thành code nhưng đánh dấu CHƯA XÁC MINH; sổ v1 treo "blocked on CI billing" tới khi user khôi phục minutes, rồi regen từ artifact CI đầu tiên. KHÔNG khai xanh chay, KHÔNG hạ nguồn chính danh xuống local. <!-- Updated: Session 2 - V4 -->  
- Non-functional: enum `FlowStatus` tĩnh (`built|partial|missing`) không đổi; render 2 tab tiếng Việt; `verification.json` không có consumer ngoài (đã grep) nên thêm field an toàn.

## Architecture
```
PLAYWRIGHT_UI=1 playwright (ui-chromium, json reporter gated) ─┐
  + env GIT_SHA ghi vào results metadata                       ├→ apps/e2e/test-results/journeys.json (gitignored)
CI job ui-e2e (full suite MỖI PUSH — V1): upload artifact ─────┘
ingest-playwright-results.ts (thuần, không đọc manifest):
  results → { sha, project, specs: {path → pass|fail|skipped(annot)|absent} }
verify.ts compose:
  no results / SHA lệch / partial → built-unproven (badge: unproven|stale|partial)
  spec fail | all-fixme | all-skip → built-unproven (badge: đỏ-fixme(lý do) | ĐỎ CHƯA TRIAGE)
  all tests pass (≥1 test thật)   → proven  ⬤
  no journey + statusReason=no-ui-path → not-yet (badge no-ui-path + bằng chứng)
  FAIL tool CHỈ khi: journey file ma | mapping H2 sai đã đánh dấu
```

## Related Code Files
- Modify: `scripts/acceptance-report/types.ts` (facts type + statusReason — KHÔNG đổi FlowStatus), `verify.ts` (compose + FAIL rules hẹp), `flow-manifest.ts` (statusReason từ Phase 2; sửa mapping H2 nếu Phase 2 phát hiện), `templates/acceptance-tab.ts` (điền TODO EvidenceIndex, badge lý do), `templates/builder-tab.ts` (counts)
- Create: `scripts/acceptance-report/ingest-playwright-results.ts`, `scripts/acceptance-report/__fixtures__/*.json`
- Config: `apps/e2e/playwright.config.ts` (json reporter GATED theo `PLAYWRIGHT_UI`), `.github/workflows/ci.yml` (sửa lỗi fail-2s trước — V3; job ui-e2e full suite mỗi push + upload artifact, warn-first — V1)
- **Test host (RT-12):** `scripts/package.json` hiện KHÔNG có test script/vitest — thêm devDep vitest + script `test`, xác nhận root `turbo run test` nhặt được. Budget nằm trong effort phase.

## Implementation Steps (TDD — đỏ trước)
1. Dựng test host cho `scripts/` (vitest + wiring); chạy 1 test rỗng xanh để chứng minh host sống.
2. **Viết fixtures + test đỏ** cho parser & compose: pass→proven; fail-có-reason→đỏ-fixme; fail-không-reason→ĐỎ CHƯA TRIAGE (không throw); **all-fixme→không bao giờ proven**; all-skip→không proven; mixed pass+skip→định nghĩa rõ (proven chỉ khi mọi test không-skip pass và ≥1 pass); spec absent→unproven; file vắng→unproven-all; SHA lệch→stale; thiếu spec khai→partial; journey file ma→verify FAIL. (Fixtures thay thế "falsification sống" thủ công — RT-12/Scope#6.)
3. Types + parser + compose cho tới khi fixtures xanh.
4. Điền TODO EvidenceIndex trong `acceptance-tab.ts` (badge ⬤ proven sáng từ ingestion), cập nhật builder-tab counts; regen report local, soi 2 tab bằng mắt.
5. Gate json reporter theo `PLAYWRIGHT_UI` trong playwright.config; chạy 1 spec UI local xác nhận results sinh đúng + 1 run api xác nhận KHÔNG đụng file.
6. CI (validate V1/V3): TRƯỚC HẾT chẩn đoán + sửa lỗi CI main fail ~2s; rồi mở rộng job `ui-e2e` chạy full ui-chromium mỗi push + `actions/upload-artifact` journeys.json; giữ `continue-on-error`. Không chạy được tới cùng trên CI trong phase này thì ghi trạng thái job thật vào report phase — KHÔNG khai xanh chay.
7. `pnpm typecheck · lint · test` xanh.

## Success Criteria
- [ ] Toàn bộ fixture tests xanh, gồm all-fixme≠proven, SHA-stale, partial-run
- [ ] `proven` chỉ sinh từ results hợp lệ (SHA khớp + đủ spec); đỏ-thiếu-lý-do render "ĐỎ CHƯA TRIAGE" mà tool vẫn render trọn sổ
- [ ] Run api không ghi đè journeys.json (chứng minh bằng run thật)
- [ ] Nguyên nhân CI main fail ~2s được chẩn đoán + sửa (V3); job CI full ui-chromium mỗi push tồn tại, upload artifact, warn-first; trạng thái run đầu ghi trung thực
- [ ] `FlowStatus` cũ không đổi; typecheck/lint/test xanh

## Risk Assessment
- 1 spec phủ nhiều flow: giữ quan hệ qua `manifest.journey` (1 flow ↔ 1 spec path; nhiều flow trỏ cùng spec chỉ khi Phase 2 xác nhận giao thật theo H2).
- Kết quả stale: SHA-binding hạ cấp về stale thay vì cảnh báo suông (RT-2); tuổi bằng chứng vẫn hiển thị.
- Threat model trung thực: cơ chế này NÂNG CHI PHÍ tự lừa (phải giả cả SHA + đủ tập spec), không tuyên bố "bất khả giả mạo"; lớp chống cuối là sổ v1 chỉ nhận artifact CI (RT-2/3).
