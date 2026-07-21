---
phase: 6
title: "Pilot stabilization ≥2 tuần"
status: pending
priority: P1
dependencies: [2, 3, 4, 5]
---

# Phase 6: Pilot stabilization ≥2 tuần

## Context links
- Exit criteria M1: `docs/project-roadmap.md:35`
- Vòng học hỏi đóng (incident/postmortem, no hotfix tay): `docs/project-roadmap.md:24`
- Journal pattern: `docs/journals/` (vd `260709-golive-sprint-session-summary.md`)

## Overview
- **Date:** 2026-07-10 · **Priority:** P1
- **Description:** Vận hành pilot 1 cơ sở ≥2 tuần trên VPS thật; fix-forward protocol (mỗi fix 1 PR +
  gates); incident/postmortem template dùng thật; exit = M1 row roadmap.
- **Implementation status:** pending (blocked-by Phase 2,3,4,5 — soak trên binary hardened + backup định kỳ)
- **Review status:** not reviewed

## Key Insights
- Đây là phase **calendar-bound** (≥2 tuần) không code-bound — đồng hồ đếm chỉ chạy khi stack VPS healthy +
  backup định kỳ + hardening land (nên blocked-by 2,3,4,5). Reset đồng hồ nếu CRITICAL xảy ra.
- "Không CRITICAL" cần **định nghĩa CRITICAL** (severity rubric) để phán exit khách quan — không để cảm tính.
- Fix-forward = **no hotfix tay trên prod** (roadmap:24); mọi fix qua PR + gates + `migrate deploy`/redeploy
  theo runbook §2. Local-sim rollback (P3) có thể teardown khi VPS ổn định qua tuần đầu (user xác nhận).
- Incident dùng thật = mỗi sự cố ghi postmortem template (không phải chỉ có template rỗng).

## Requirements
- **≥2 tuần liên tục không sự cố CRITICAL** trên VPS thật (đồng hồ reset nếu CRITICAL).
- Stack VPS healthy suốt: service up, boot-checks pass, TLS valid, backup cron chạy đều.
- Restore drill pass với R2 remote (từ P5, tái xác nhận trong cửa sổ soak).
- Runbook cập nhật (từ P5) phản ánh thực tế vận hành pilot (bổ sung incident thật gặp).
- Mỗi fix trong soak: 1 branch/PR + gates (typecheck 26 · build 14 · unit · e2e Mode-B) + redeploy runbook §2.
- Incident/postmortem template tồn tại + dùng cho mọi sự cố ≥ MAJOR trong soak.

### [M8] Định nghĩa severity — VALIDATED 2026-07-10 (user chốt)
| Severity | Nghĩa | Ảnh hưởng exit |
|---|---|---|
| CRITICAL | Mất dữ liệu · RLS/isolation bị phá · auth bypass · stack down > 30 phút · PII trẻ em rò | **Reset đồng hồ 2 tuần** |
| MAJOR | Chức năng chính gãy có workaround · degraded | Fix-forward, không reset (trừ khi lặp) |
| MINOR | Cosmetic · edge case hiếm | Backlog |

- **Incident log location [M8]**: `docs/journals/` (postmortem mỗi incident MAJOR+, pattern journal có sẵn);
  index gọn ở runbook §4. Không tạo hệ thống tracking mới (YAGNI).
- **Healthcheck cron [M8]**: cron đơn giản trên VPS host — mỗi 5' `curl -sf https://<domain>/health` +
  `docker compose ps` unhealthy → ghi log/alert (email/webhook). Đo được "stack VPS healthy" khách quan
  thay vì kiểm tra tay. Reuse pattern cron backup P5.

## Architecture
Không thêm cấu trúc mới — vận hành `cmcv2-prod` trên VPS. Quan sát: `docker compose ps`, `/health`,
nginx log, backup log, boot-checks. Fix qua PR → `git pull` + rebuild + `up -d --no-deps` (runbook §2.1)
hoặc `migrate deploy` (§2.2). Incident → postmortem journal.

## Related code files
- `docs/runbook-deploy.md §2-4` (routine ops + incident response — dùng khi soak)
- `docs/journals/` (postmortem incident thật)
- `docs/project-roadmap.md:35` (cập nhật cột Trạng thái M1 khi exit)
- Code fix trong soak → theo module liên quan, fix-forward (không xác định trước).

## Implementation Steps
1. **[M8]** Severity rubric ĐÃ CHỐT (bảng trên, X=30 phút — validation 2026-07-10); ghi vào runbook §4 — mốc phán exit.
2. Tạo/xác nhận incident/postmortem template (journal-writer pattern) tại `docs/journals/` — dùng thật, không rỗng.
2b. **[M8]** Cài healthcheck cron VPS (mỗi 5' `/health` + `docker compose ps`) → log/alert khi unhealthy.
3. Bắt đầu đồng hồ soak khi P2,3,4,5 done + stack healthy. Ghi ngày bắt đầu.
4. Vận hành: theo dõi health/log/backup định kỳ; pilot 1 cơ sở dùng thật (5 role staff + PH/HS LMS).
5. Mỗi sự cố: phân loại severity; MAJOR+ → postmortem; fix-forward 1 PR + gates + redeploy runbook §2;
   CRITICAL → reset đồng hồ 2 tuần + postmortem bắt buộc.
6. Sau tuần đầu VPS ổn định + backup verify: teardown local-sim rollback (user xác nhận) — giải phóng máy dev.
7. Định kỳ: xác nhận restore drill cron pass; TLS còn valid; backup mới trên R2.
8. Exit: ≥2 tuần không CRITICAL + tất cả success criteria → cập nhật roadmap:35 cột Trạng thái M1 =
   Complete; changelog; chuẩn bị pipeline M2 (P4 completion, brainstorm just-in-time).

## Todo list
- [ ] [M8] Ghi severity rubric đã chốt (X=30 phút) vào runbook §4
- [ ] Incident/postmortem template tại docs/journals/ dùng thật
- [ ] [M8] Healthcheck cron VPS (/health + compose ps) + alert
- [ ] Đồng hồ soak bắt đầu (stack healthy + P2-5 done)
- [ ] Vận hành + theo dõi health/backup ≥2 tuần
- [ ] Mỗi fix: 1 PR + gates + redeploy runbook §2 (no hotfix tay)
- [ ] Teardown local-sim rollback (sau tuần đầu, user xác nhận)
- [ ] Restore drill + TLS + backup định kỳ tái xác nhận trong soak
- [ ] Exit: roadmap:35 = Complete + changelog

## Success Criteria
- [ ] ≥2 tuần liên tục **không CRITICAL** (theo rubric validated 2026-07-10, X=30 phút)
- [ ] Stack VPS healthy suốt cửa sổ, đo bằng healthcheck cron [M8] (health/boot-checks/TLS/backup cron)
- [ ] Restore drill pass với R2 remote trong cửa sổ soak
- [ ] Runbook cập nhật phản ánh vận hành thật (incident gặp)
- [ ] Mọi fix qua PR + gates (không hotfix tay); postmortem cho MAJOR+
- [ ] roadmap:35 cột Trạng thái M1 = Complete + changelog cập nhật

## Risk Assessment
| Rủi ro | L×I | Mitigation |
|---|---|---|
| CRITICAL lặp → soak không bao giờ đủ 2 tuần | Med×High | Root-cause postmortem mỗi lần; nếu lặp cùng nguyên nhân → dừng thêm feature, ổn định trước |
| Hotfix tay trên prod (áp lực) → drift | Med×High | Runbook cấm; mọi fix qua PR+gates; boot-check bắt env sai |
| Teardown local-sim sớm khi VPS chưa chắc | Low×High | Chỉ teardown sau tuần đầu + user xác nhận; backup R2 là DR path |
| Severity phán cảm tính → exit sai | Med×Med | Rubric chốt trước (bước 1); mốc khách quan |
| TLS/backup lặng lẽ hỏng giữa soak | Med×High | Theo dõi định kỳ; alert thiếu backup mới / cert sắp hết hạn |

## Security Considerations
- No hotfix tay = mọi thay đổi qua PR chịu review + gates (RLS/5-role/zod/no-secret giữ nguyên).
- PII trẻ em rò = CRITICAL (reset đồng hồ) — giám sát log không lộ payload.
- super_admin MFA giữ bật suốt soak; không dùng account thường ngày (F-S6).
- Backup encrypted + escrow suốt soak; restore drill định kỳ chứng minh DR còn hoạt động.

## Next steps
M1 Complete → brainstorm-nhẹ + `/ck:plan` M2 (P4 completion: WF-P4-04 lịch test, WF-P4-05 after-sale,
họp PH audit đầy-cuối) theo pipeline P-3 báo cáo brainstorm 260710-0215. Cập nhật roadmap.
