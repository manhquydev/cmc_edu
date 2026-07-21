# Brainstorm Report — Đánh giá mức độ sẵn sàng vận hành thật & hướng build tiếp

Date: 2026-07-07 · Mode: standard (no --html/--wiki) · Branch: main · Decision: Hướng A (Go-live sprint)

## 1. Problem statement

Câu hỏi: dự án CMC EDU v2 hiện hoạt động tới mức độ nào so với mục tiêu vận hành thật, và hướng build tiếp theo là gì.

## 2. Hiện trạng (facts — verified từ code/git/plans)

### Đã xong (merged main, PR #1–#23)
- **P0–P3 full-stack**: P1 identity/enrollment (CRM O1–O5, cổng tiền GĐKD, provisioning atomic), P2 vận hành lớp (auto-sinh buổi, điểm danh, bài tập PDF annotation, chấm+sao), P3 HR (chấm công IP trusted-proxy, ca, payroll, KPI), Phase 06 admin CRUD 15 routes, Phase 07 LMS portal (parent OTP phone/email + student password 2-tier).
- **P4 một phần**: đổi quà sao/gift ✅; họp PH có test (`parent-meeting.test.ts`) — cần xác nhận độ phủ; lịch test + after-sale case chưa thấy.
- **P5 AI mức draft**: LLM thật (OpenAI-compatible), AI draft assessment HITL, PII guard, MCP server package.
- **Tích hợp live**: email Brevo + Graph (cả 2 transport), env contract fail-closed + boot-check, RT-1..15 security findings resolved.
- **Gates trên working tree (verify 2026-07-07 23:23)**: typecheck 26/26 ✅ · test 462 passed / 13 skipped ✅ · build 14/14 ✅.

### Đang dở — uncommitted trên main working tree (22 files, ~682 dòng)
- **Entra SSO staff auth trọn gói**: `apps/api/src/auth/` (sso-routes, staff-session + 13 tests), migration `staff_role_enum_and_assignment` (enum Role 9 giá trị + `AppUser.roles`), role-drift test, admin UI gán role, e2e staff Mode-B cookie injection, env/docker/runbook/UAT-checklist updates.
- **Kết luận verify**: code hoàn chỉnh, gates xanh — trạng thái "done, chưa land". Đây là blocker RT-CRITICAL (prod tắt dev-header → staff không login được nếu chưa có SSO).

### Chưa làm (chặn go-live)
- Land stack SSO qua PR (adversarial review vì là code auth).
- Task #8 ENV: dựng stack `cmcv2-prod` (local giả lập VPS — user xác nhận), backup off-box, restore drill (RT-13), isolation check, seed, runbook second-person.
- Task #9 UAT: e2e critical 2 lần xanh liên tiếp trên prod-config (UAT checklist Run 1/2 đang TRỐNG), email live send Brevo+Graph, UAT người thật theo docs/29, biên bản go/no-go.
- **Drift trạng thái**: plan `260707-2128` ghi 4 phases "completed" nhưng tracker #8/#9/#10 pending + checklist trống → plan status flipped sớm; cần đối chiếu lại khi land.

### Phụ thuộc ngoài repo (user xác nhận 2026-07-07)
- Azure app registration: ✅ đã cấu hình, creds trong .env.
- S3/MinIO: ✅ đã chốt.
- VPS: dùng **full local setup giả lập VPS** — chấp nhận cho pilot; VPS thật là bước sau.

## 3. Đánh giá mức độ

**~85–90% tới vận hành pilot.** Feature-complete P1–P3 + LMS, pre-production. Phần còn lại (land SSO, prod env verified, UAT ký) là phần rủi ro cao nhất — chưa có bằng chứng vận hành nào trên prod-config.

## 4. Approaches evaluated

| Hướng | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Go-live sprint** | Ngắn nhất tới giá trị thật; dữ liệu thật định hướng P4/P5 | Cần thao tác ngoài repo (đã chốt xong phần lớn) | ✅ **CHỌN** |
| B. Hoàn thiện P4 trước | Sản phẩm đầy đủ hơn khi ra mắt | Trì hoãn 1–2 tuần cho luồng không chặn lõi; vi phạm "không big-bang" (docs/31) | ❌ |
| C. Song song sau GO | — | Là bước sau của A, không phải thay thế | Kế tiếp A |

## 5. Final recommended solution — Go-live sprint (A → C)

1. **Land SSO stack** (uncommitted → branch `feat/staff-sso-golive` → PR, adversarial review auth, gates xanh, merge, changelog). Sửa drift trạng thái plan 260707-2128 nếu phát hiện phần chưa khớp.
2. **ENV (task #8)**: dựng `cmcv2-prod` local-giả-lập-VPS, backup off-box, restore drill pass, isolation check, gate G1–G10 checklist (gồm G9 TEST_OTP_SEAM absent, G10 hai secret khác nhau).
3. **UAT (task #9)**: env-guard xác nhận không trỏ DB live → e2e critical Run 1 + Run 2 liên tiếp PASS (staff Mode-B cookie + LMS Mode-B bearer) → email live 1 Brevo + 1 Graph → UAT người thật (gồm staff Entra login thật + role nav) → fix-forward từng PR nhỏ → ký go/no-go.
4. **Sau GO (hướng C)**: pilot 1 cơ sở; build P4 còn thiếu (lịch test, after-sale, hoàn thiện họp PH) + P5 agent crawl-walk-run trên dữ liệu thật; chuyển sang VPS thật khi pilot ổn.

## 6. Risks
- Chạy e2e nhầm DB thật → env-guard bắt buộc, dừng nếu nghi ngờ.
- Code auth land không qua adversarial review → giữ protocol plan 260707-2128.
- Graph live send cần mailbox licensed — stop-condition UAT nếu thiếu.
- RT-ε: roles trong cookie là snapshot lúc login (maxAge ~8h) — đã chấp nhận, ghi trong runbook.

## 7. Success metrics
- SSO PR merged, main xanh (typecheck/test/build).
- Restore drill + isolation check PASS; G1–G10 tick đủ.
- UAT checklist Run 1/2 = PASS, biên bản go/no-go ký GO.
- Pilot 1 cơ sở chạy ≥1 tuần không sự cố CRITICAL.

## 8. Next steps
- Lập plan thực thi go-live sprint (kế thừa task #8/#9, plan 260707-2128) qua `/ck:plan`.

## Unresolved questions
- Độ phủ thực tế của "họp PH" (có test nhưng chưa audit UI/luồng đầy-cuối) — kiểm khi lập plan P4.
- Lịch + nhân sự UAT người thật — điều phối ngoài repo.
