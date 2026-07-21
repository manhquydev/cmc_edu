# Brainstorm — Go-live coordination: land stack an toàn, không sót việc/sót code

- Date: 2026-07-07 18:30 (ICT)
- Branch: feat/uat-session-injection
- Modes: (none — no --html/--wiki)
- Terminal handoff: /ck:plan (default) → red-team → validate → optimize

## Problem statement

Điều phối giai đoạn go-live: nắm chính xác trạng thái, land 4-PR stack vào main an
toàn, KHÔNG sót việc (tracker lệch code) và KHÔNG sót code (env contract lệch, integration còn stub).
Mục tiêu user chốt: **đồng bộ tracker + land stack → go-live**.

## Scout findings (bằng chứng)

### Git / PR topology
- 4 PR mở (#13 pd1, #14 pd2, #15 env, #16 uat) — **stack tuyến tính** pd1 ⊂ pd2 ⊂ env ⊂ uat, đều target `main`.
- Cả 4 PR **e2e FAILURE** trên CI (typecheck+unit SUCCESS, CodeRabbit SUCCESS).
- `feat/uat-session-injection` (HEAD) chứa toàn bộ stack + 2 commit fix chưa push
  (`1fa9fd2` fix e2e-green, `6994fc8` gkg). Ahead main 7, ahead origin 2.
- Fix e2e ở ĐỈNH stack; bug boot-check sinh ở pd2 (`252f4da`) — cách 3 commit → pd2/env tự thân đỏ CI.

### Env contract mismatch (core "sót code")
| Integration | Code đọc | .env có | Trạng thái |
|---|---|---|---|
| LLM | `LLM_API_KEY` | ❌ | Stub — draftAssessment trả chuỗi cố định, real path là TODO; thiếu BASE_URL/MODEL |
| S3 | `S3_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY/REGION` | ❌ | Chưa cấu hình → local-disk fallback |
| Email/Graph | `GRAPH_CLIENT_ID/TENANT_ID/SENDER_EMAIL` | ENTRA_*/GRAPH_SENDER_HR|NOTIFY|PAYROLL | Tên biến lệch → không đọc được |
| Brevo | `BREVO_API_KEY` | ✅ | Khớp |
| LMS session | `LMS_SESSION_SECRET` | ❌ | Dev-default không an toàn |
| Trusted proxy | `TRUSTED_PROXY_CIDRS` | ❌ | Chưa cấu hình |
| SSO | ENTRA_*/SSO_ENABLED | ✅ | User loại khỏi test tạm; context.ts còn TODO |

LLM user muốn: endpoint `https://router.clawcmc.io.vn/v1`, model `ag/gemini-3.5-flash-low` (key trong .env, KHÔNG commit).

### Tracker drift
- Task list: #6 in_progress, #7/#8/#9 pending — code đã commit xong hết.
- `golive/plan.md` status=pending; phase 2-5 ghi "In-Progress PR open".
- `ui-implementation/plan.md` status=in-progress, 8 phase "done" nhưng nhiều phase "integration tests BLOCKED: needs DB".

### Markers treo
- `context.ts`: Entra SSO còn TODO (chỉ dev-header).
- `upload-route.ts`: `TODO(RT-3-ownership)` — chưa verify blobRef ownership (bảo mật).
- `lms-auth-two-tier.test.ts`: `describe.skip` (cần DB); `lms-auth.spec.ts` test-seam OTP skip (xanh khi TEST_OTP_SEAM=1).
- UAT checklist go-live: toàn bộ chưa tick (prod stack chưa dựng, restore-drill/UAT chưa chạy).

## Risk map
- R1 Merge stack sai thứ tự → merge PR đỏ / main đỏ giữa chừng.
- R2 Tracker vs code lệch → làm lại hoặc bỏ verify.
- R3 "Done code" ≠ "done thật" → tưởng go-live được nhưng integration còn stub.
- R4 Fix chưa push → mất commit, cả stack đỏ.
- R5 TODO bảo mật (RT-3) lọt prod.

## Decisions (user 2026-07-07)
1. **Merge**: Gộp qua #16, đóng #13/#14/#15 (Option A).
2. **Integration**: đều có creds; test tạm loại SSO; cho phép env-check xem đã có gì; LLM dùng router.clawcmc + gemini-3.5-flash-low.
3. **Goal**: đồng bộ tracker + land stack → go-live.

## Approaches evaluated (merge strategy)
- **A. Gộp qua #16** (CHỌN): 1 merge mang trọn stack; sau push fix #16 xanh; đóng 3 PR con, xoá nhánh. KISS, main xanh 1 nhịp. Mất review granular (nhưng CodeRabbit đã chạy cả 4).
- B. Merge tuần tự bottom-up: giữ history nhưng phải rebase fix xuống pd1 cho mỗi PR xanh — nhiều thao tác git, rủi ro cao.
- C. Giữ stack, rebase fix xuống pd2: trung dung, phẫu thuật git đáng kể.

## Recommended solution — Go-live coordination v2 (5 phase)
- **P0 Land stack**: push 2 fix → #16 CI xanh → merge #16 → đóng #13/#14/#15 → xoá nhánh con → main xanh.
- **P1 Env-contract reconciliation** (loại SSO): sửa GRAPH_*↔ENTRA_* lệch, bổ sung S3_*, LLM_* (BASE_URL/MODEL), LMS_SESSION_SECRET, TRUSTED_PROXY_CIDRS; env-check fail-closed; cập nhật `.env.example`.
- **P2 Đóng stub integration**: LLM thật (router.clawcmc) trong packages/llm; verify email Graph/Brevo gửi thật; S3 bucket thật; đóng TODO(RT-3-ownership).
- **P3 Đồng bộ tracker**: task list + golive/plan.md + ui-implementation/plan.md khớp code-reality; changelog.
- **P4 UAT + go/no-go**: dựng cmcv2-prod, restore-drill, e2e critical 2 lần xanh, UAT người-thật docs/29, biên bản go/no-go.

## Success criteria
- main xanh (typecheck+unit+e2e), 4 PR đóng, nhánh con xoá.
- Mọi biến code đọc đều có trong .env/.env.example (trừ SSO tạm off); env-check pass.
- LLM/S3/email gửi/ghi thật được verify; RT-3 đóng.
- Tracker (task+plan+changelog) khớp code-reality.
- UAT checklist: e2e 2 lần xanh + restore-drill + go/no-go ký.

## Constraints / invariants
- Không commit secrets (.env đã gitignore — confirmed). RLS withFacility + cmc_app; can() registry; zod + 5 mã lỗi; AI draft-only + che PII + consent ảnh trẻ; timestamptz/ICT.

## Unresolved questions
- SSO: bật lại verify khi nào (P1 loại tạm) — cần user chốt trước P4 go-live.
- Email Graph sender: dùng GRAPH_SENDER_HR/NOTIFY/PAYROLL (đa sender) hay gộp 1 GRAPH_SENDER_EMAIL — ảnh hưởng cách sửa contract ở P1.
- LLM: có cần biến LLM_BASE_URL/LLM_MODEL riêng (code hiện chỉ có LLM_API_KEY) — P2 sẽ mở rộng contract.
