---
phase: 6
title: "Đợt ghi danh + vận hành lớp"
status: partial
completed: '2026-07-25 — P1-01 xanh 4×; P2-01/02/03/05 no-ui-path (V5); sổ 13/38'
remaining: 'P2-04 (exercise publish/close), P2-06 (grading), P2-08 GV-half (session evidence) — cần seed CurriculumUnit/Submission đã duyệt'
report: 'plans/reports/phase-06-part1-ghi-danh-260725-1045-report.md'
priority: P1
effort: "3-5d"
dependencies: [5]
---

# Phase 6: Đợt ghi danh + vận hành lớp

## Overview
Đợt 2 theo D4: flow thuộc cột `đợt`="ghi-danh" + "vận-hành-lớp" trong triage Phase 2 (phễu CRM, ghi danh lớp 2, provision parent/student, điểm danh, session evidence, exercise/chấm, session-assessment) chưa có journey. Kế thừa 2 ngoại lệ seed hẹp đã user-duyệt 2026-07-24 (ClassBatch+Course, attendance-mark — plan 260723-1422 phase-04) khi flow đụng đúng hai lỗ đó; mọi lỗ MỚI phải qua nghi thức riêng.

## Requirements
- Functional: như Phase 5, áp cho flow enrollment + teaching; chuỗi provision parent/student phải được chứng minh qua UI thật tới điểm bàn giao cho Phase 8 (đuôi LMS đọc tiếp).
- Non-functional: giữ nguyên khuôn TDD/negative như Phase 5; spec dùng ngoại-lệ-seed cũ phải trích dẫn đúng ghi chú duyệt trong phase-04 plan 260723-1422 (comment trong spec giải thích bất biến, không nhắc ID plan trong tên test).

## Architecture
Như Phase 5. Lưu ý flow điểm danh: gate thật là `attendance.mark` (đã sửa khỏi `classRoster.read` — falsification F2 cũ); journey mới không được nới lỏng assertion đó.

## Related Code Files
- Create: `apps/e2e/tests/journeys/<flow>.journey.ui.spec.ts` theo triage; helper mới nếu đạt ngưỡng
- Modify: `scripts/acceptance-report/flow-manifest.ts` (journey + statusReason)

## Implementation Steps
1. Lặp khuôn Phase 5 bước 1–4 cho từng flow đợt này.
2. Chuỗi provision: sale ghi danh → chứng minh parent/student account sinh ra và HIỂN THỊ được ở màn admin tương ứng (điểm nối Phase 8).
3. Kết đợt (nghi thức RT-9): 4× spec-của-đợt + 1× full suite; regen report.

## Success Criteria
- [ ] 100% flow đợt ghi-danh + vận-hành-lớp "viết-được" có journey; flow đỏ đúng nghi thức statusReason
- [ ] Chuỗi provision parent/student chứng minh qua UI, sẵn cho Phase 8
- [ ] 4× spec-của-đợt xanh liên tiếp + 1× full suite xanh; sổ cập nhật từ results file

## Risk Assessment
- Đây là cluster từng có 3 luồng chết 16 ngày (F1/F2/F4) → chính là nơi kỳ vọng NHIỀU flow đỏ nhất; kỷ luật quét-hết-rồi-sửa dễ lung lay ("sửa nhanh cái này thôi") — bất biến plan: KHÔNG sửa app, ghi sổ đi tiếp.
- Runtime đợt này dài nhất (nhiều vai/bước) → đối chiếu quyết định F-B Phase 1; nếu vượt dự phóng, cập nhật số thật vào report Phase 1.
