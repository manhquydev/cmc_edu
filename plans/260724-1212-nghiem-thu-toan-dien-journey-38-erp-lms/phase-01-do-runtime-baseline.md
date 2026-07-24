---
phase: 1
title: "Đo runtime baseline + quyết định F-B"
status: done
completed: '2026-07-24'
report: 'plans/reports/phase-timing-baseline-260724-1511-report.md'
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Đo runtime baseline + quyết định F-B

## Overview
Đo runtime thật của **13** UI specs hiện có (10 journey + `admin-shell` + `lms-login` + `screen-role-capture`; RT-14 sửa số 17 sai) trên local synthetic-seed env, ngoại suy ~40+ specs, rồi ra verdict D2 (60–90') ở mức **PROVISIONAL** — chốt cứng chỉ sau lần chạy full-suite CI đầu tiên (runner GitHub 2-core thường chậm 2–4× máy dev). Không có số đo CI nào tồn tại (job `ui-e2e` hiện chỉ chạy 1 spec, ci.yml:266).

## Requirements
- Functional: bảng timing per-spec + tổng; dự phóng cho số spec sau triage (Phase 2 cấp con số chính xác, tạm dùng ~40).
- Non-functional: đo trên máy dev hiện tại, ghi rõ cấu hình (CPU/RAM) để diễn giải khi so với runner CI.

## Architecture
Playwright đã có sẵn JSON reporter. Chạy `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` với `--reporter=json` (output vào file gitignored), parse `duration` per spec. Không sửa code sản phẩm hay test.

## Related Code Files
- Không sửa file nào. Output: `plans/reports/phase-timing-baseline-260724-{hhmm}-report.md` (bảng timing + quyết định).

## Implementation Steps (TDD-shape: số đo trước, kiến trúc sau)
1. Dựng env: `SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh --fresh`, export APP_DATABASE_URL/DATABASE_URL (cả hai — bài học `assertNotProdDatabase`).
2. Chạy full `ui-chromium` 2 lần với JSON reporter; lần 1 warm build, lấy số lần 2.
3. Bảng: spec | duration | số vai | số bước UI. **Median tính RIÊNG trên 10 journey specs** (RT-14: spec capture là artifact generator, cost profile khác — liệt kê riêng, không vào median).
4. Dự phóng: `median-journey × (số spec dự kiến sau triage)` + overhead build 2 preview servers; nhân thêm hệ số runner CI 2–4× thành dải [thấp, cao].
5. **Decision gate D2 (PROVISIONAL):** dải-cao ≤90' → giữ job full-suite mỗi push (V1) với serial `workers:1`. >90' → lùi theo thang F-B: nightly schedule, rồi shard matrix (thiết kế shard thuộc plan sau). Verdict chốt cứng SAU lần chạy full-suite CI đầu tiên (Phase 3 dựng job, RT-3/V1); Phase 5-7 cập nhật số thật mỗi đợt. <!-- Updated: Validation Session 1 - V1 per-push -->
6. Ghi quyết định + số đo vào report và cập nhật ô "Quyết định F-B" trong plan.md.

## Success Criteria
- [ ] Bảng timing thật cho 13/13 spec (2 lần chạy, lấy lần 2; median trên 10 journey)
- [ ] Dự phóng dải [thấp, cao] có công thức + hệ số CI hiện rõ
- [ ] Verdict serial/nightly/shard ghi thành văn, đánh dấu PROVISIONAL kèm điều kiện chốt cứng

## Risk Assessment
- Máy dev nhanh hơn runner GitHub 2–4× → đã nhân hệ số vào dải dự phóng; verdict provisional cho tới số CI thật.
- Specs flake khi đo → chạy 2 lần; nếu lệch >30% giữa 2 lần, chạy lần 3 và ghi chú.
