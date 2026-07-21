---
phase: 3
title: "P2 Learning Runtime Proofs"
status: pending
priority: P2
dependencies: [1]
effort: "2d"
---

# Phase 3: P2 Learning Runtime Proofs

## Overview

Runtime proof cho 8 flows P2 (lớp học → điểm danh → bài tập → chấm → nhận xét → evidence cho PH). <!-- Updated: Red Team R2 - R2-1, supersede V2 --> Signed-auth mode: server dev-env nên LLM stub hoạt động native — KHÔNG cần seam, KHÔNG sửa packages/llm.

## Requirements

- Functional: 8/8 flows P2 có verdict.
- Non-functional: dựng class/session bằng `schedule.generateSessions` thật; 1 flow = 1 `test()` (rt#6); assert theo ID in-test (rt#5).

## Architecture

Dây chuyền: classBatch (P2-01) → attendance (P2-02) → exercise (P2-03/04) → submit (P2-05) → grade+sao (P2-06) → assessment (P2-07) → session evidence (P2-08). `describe.serial`, mỗi flow 1 test, downstream `blocked` khi precondition vỡ. Annotate-vs-new theo coverage matrix Phase 1.

**P2-07 LLM (rt#4 → R2-1 supersede V2):** <!-- Updated: Red Team R2 - R2-1 --> Với signed-auth mode (dev-env), stub deterministic của `packages/llm` được chọn tự nhiên khi không có key (index.ts:61-79) — `LLM_STUB_PROD_FORBIDDEN` không kích hoạt. P2-07 chạy full signed-auth: draftComment (stub) → confirm/discard/listBySession → reportCard.getForChild, verdict proven được. KHÔNG sửa packages/llm. Guard egress (R2-7): global-setup strip `LLM_API_KEY` khỏi env server + fail-closed nếu key hiện diện trong shell.

## Related Code Files

- Reuse + annotate (theo matrix): `apps/e2e/tests/attendance.spec.ts`, `attendance-grading.spec.ts` (P2-02/P2-06 — matrix quyết phần nào)
- Create: `apps/e2e/tests/p2-learning-lifecycle.spec.ts` (P2-01, P2-03, P2-04, P2-05, phần thiếu P2-06), `apps/e2e/tests/p2-assessment-evidence.spec.ts` (P2-07, P2-08)
- UI screenshots trong functional UI specs (rt#15), không spec screenshot-only

## Implementation Steps

1. Theo coverage matrix: annotate specs attendance sẵn có; phần thiếu vào spec mới; không double-annotate.
2. `p2-learning-lifecycle.spec.ts` (GĐĐT → giao_vien → hoc_vien; mỗi flow 1 test trong serial):
   - P2-01: course.list + room.create → classBatch.create → generateSessions → assert ClassSession đúng lịch; assignTeacher/addMakeup/cancel nhánh phụ.
   - P2-02 (phần thiếu): mark/markAll/listBySession.
   - P2-04: exercise.create → publish (curriculumUnit) → close nhánh phụ.
   - P2-03: openForStudent theo tiến độ — assert bài chưa tới progress KHÔNG mở.
   - P2-05: saveDraft → submit. P2-06: grade → assert StarTransaction cộng sao đúng (theo ID in-test).
3. `p2-assessment-evidence.spec.ts`:
   - P2-07: draftComment (stub native dev-env) → confirm/discard/listBySession → reportCard.getForChild — toàn bộ signed-auth.
   - P2-08: sessionEvidence.upsert/addPhoto/publish → setPhotoConsent cả 2 nhánh on/off → listForChild assert PH thấy đúng theo consent. (SessionEvidence/Photo đã nằm trong teardown extension Phase 1.)
4. UI proof + screenshot trong functional UI specs cho uiRoutes claimed P2 — LƯU Ý gate synthetic sentinel (Phase 1/rt#9) phải pass trước khi chụp `/parent/evidence/:studentId`.
5. Chạy 1 lần chuẩn; re-run targeted chỉ khi flaky flag (rt#15).

## Success Criteria

- [ ] 8/8 flows P2 có verdict; consent-gating P2-08 assert cả 2 nhánh.
- [ ] P2-03 assert đúng rule tiến độ.
- [ ] P2-07 proven full signed-auth qua stub native; global-setup fail-closed chặn LLM_API_KEY (không sửa packages/llm).
- [ ] Upload path (`/upload`) hoạt động cho ảnh/PDF; lỗi storage → fix tầng env/test, không sửa storage production.

## Risk Assessment

- Stub LLM output deterministic nhưng schema có thể lệch prod → ghi rõ trong report đây là proof plumbing, không proof chất lượng LLM.
- Ảnh evidence là synthetic — gate sentinel (rt#9) bắt buộc pass trước screenshot, fail-closed.
