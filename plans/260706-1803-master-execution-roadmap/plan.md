# Master Execution Roadmap — CMC EDU v2 (backend-first, trừ UI) — v2 sau red-team + validate

> **[ARCHIVED 2026-07-12] SUPERSEDED by `plans/260708-0504-roadmap-m1-m4-execution/` + `docs/project-roadmap.md`.**
> Kept for history. Phase statuses below are frozen at 2026-07-06 wording — do NOT resume from here.
> Live roadmap: `docs/project-roadmap.md` (M0→M4). Live sprint plans: see `plans/260707-*` and `plans/260710-*` / `plans/260711-*`.

> (Original preface, historical:) Kế hoạch thực thi TUẦN TỰ KHÔNG HỎI LẠI trừ stop-condition. Đã qua red-team (2C/5H/12M) + plan-validate;
> mọi finding đã chuẩn hoá vào bản này (reports: `from-red-team-to-planner-260706-1817-...` +
> `from-plan-validator-to-planner-260706-1817-...`).
> Nền: main = P0+P1 hardened; branch `feat/p2-foundation-class-ops` = P2-Foundation (chưa merge).
> Nguồn: TL25 (28 WF) · TL26/27/28 · TL29 · TL30 · TL31 · ADR A-D/0038-0042.

## Status

| Phase | Nội dung | Story | Trạng thái |
|---|---|---|---|
| G1 | Gate + merge P2-Foundation | US-011 | pending |
| T1 | Điểm danh + session lifecycle (cancel/makeup) + e2e skeleton + **CI** | US-012,013 | pending |
| T2 | Bài tập PDF + mở ADR0038 + chấm (Grade/computeFinalGrade) + sao | US-014..017 | pending |
| T3 | Nhận xét AI-draft + học bạ tháng + ảnh lớp + **consent ảnh trẻ** | US-018,019 | pending |
| P3-I | AppUser + FK backfill + chấm công IP (WF-P3-01/02) | US-020,021 | pending |
| P3-II | Ca (WF-P3-03/04) + lương/KPI (WF-P3-05/06) + teacher-scoping | US-022..024 | pending |
| P4 | Đổi quà/Họp PH/Test/After-sale (WF-P4-01..05) | US-025..029 | pending |
| P5 | Recon rule-based (US-010) + MCP skeleton | US-010 | pending |
| PD | Pre-deploy debt (SSO, transport, store, backup, CI-hardening) | (per-item) | pending — cần creds user |
| UI | Giao diện | — | chờ wireframe |

Phụ thuộc: G1→T1→T2→(T3,P4) · P3-I sau G1 (mặc định sau T2) · P3-II sau P3-I · P5 sau T2 · PD cuối (CI-lite đã kéo lên T1).

## Execution protocol (mọi phase)

1. Branch `feat/<phase-slug>` từ main mới nhất; nếu main đã tiến → **rebase + rerun gates** trước PR.
2. Harness: `intake` + `story add` per WF (verify = test path) → in_progress.
3. Build qua fullstack-developer subagent (prompt scoped); main agent **verify độc lập** (gates + story verify + grep spot-check bất biến).
4. **Review gate theo risk:** T1 (child-data write) = adversarial scoped · T2/T3/P3-II-lương/**P4a-sao** = adversarial bắt buộc · P3-I = adversarial spot trên auth-substrate · G1/P4b-c/P5 = reviewer 1 vòng · Mỗi 2 phase = 1 vòng flow-continuity/orphan. **Cap review→fix 2 vòng**; vòng 3 = stop-condition.
5. Xanh (typecheck/test/build/coverage/migrate) → story proof + trace → commit → push → PR → merge → xoá branch → changelog entry.
6. Tự sang phase kế. **Module tiền mới → mở rộng coverage-threshold trong vitest.config cùng phase** (payroll ≥90 như finance).

**Stop-conditions:** CRITICAL cần quyết định sản phẩm chưa pre-resolved · cần credentials (SSO/LLM/Brevo/S3) · thao tác phá huỷ ngoài repo · migration nguy cơ mất dữ liệu thật · đổi scope/kiến trúc · review-fix quá 2 vòng.

**Quy tắc vận hành thêm (từ validate):**
- **Main đỏ:** fix-forward ngay, chặn phase mới tới khi xanh; không fix được trong 1 lượt → revert merge.
- **Flake:** rerun 1 lần; tái diễn → sửa isolation/serialize (dev Postgres chung), KHÔNG xoá/nới test.
- **Doc-conflict** (docs ↔ code ↔ plan vênh): code-reality thắng + ghi decision note; nếu product-facing → stop-condition. (Tiền lệ: blockLms.)
- **Phase-split:** subagent gần cạn context → cắt tại ranh giới story, PR riêng, không nhồi.

**Bất biến xuyên suốt:** RLS `withFacility` + policy + GRANT cmc_app cho mọi bảng facility mới (gồm cả bảng dữ-liệu-trẻ/sổ-sao) · authz `can()` registry · zod + 5 mã lỗi · I1-I11 + ADR-A/B/0038-0042 · TL08 §7 (AI draft-only; che PII; **consent ảnh trẻ**) · sổ điểm/sao append-mindset · timestamptz/ICT · migration hand-written + deploy.

## Phase files
phase-01-gate-merge-p2-foundation.md · phase-02-t1-attendance-e2e-skeleton.md · phase-03-t2-exercises-grading-stars.md · phase-04-t3-assessment-ai-evidence.md · phase-05-p3-hr-shifts-payroll.md (P3-I + P3-II) · phase-06-p4-engagement-aftersale.md · phase-07-p5-recon-mcp.md · phase-08-predeploy-debt.md

## Pre-resolved defaults (v2 — bổ sung sau validate; đổi được nếu báo trước phase liên quan)
- **"GĐ" = `giam_doc_kinh_doanh` + `giam_doc_dao_tao`** (+super_admin bypass). Roster pinned: `user.manage`=super_admin · `compensation.upsertRate`/`kpi.approve`/`gift.upsert`/`student.setLifecycle`=GĐKD+GĐĐT+super_admin. `enrollment.blockLms` GIỮ NGUYÊN (roster trùng — setLifecycle là dạng tổng quát, không xoá blockLms/test).
- **PDF upload = HTTP multipart route riêng** trên api server (ngoài tRPC; cùng auth header + permission check; trả blobRef dùng trong tRPC). PDF ≤10MB, mime validate.
- **Sao = flat `starReward` cộng 1 lần tại lần grade đầu** (không theo điểm); StarTransaction có facilityId+RLS, append-only mindset.
- **`Gift.minLevel` BỎ** (LevelProgress đã descope TL19 §6d — không có nguồn level; deviation vs TL20 §5 ghi nhận).
- **"Phạt post-tax" (QĐ0025):** v2 KHÔNG tính thuế; bất biến = phạt là dòng khấu trừ ĐỘC LẬP trừ sau mọi thành phần lương, không bao giờ trộn vào variablePay/base/KPI (để khi thêm thuế sau không méo trường thu nhập chịu thuế). Punch không có ca approved → ghi nhận, KHÔNG phạt, gắn cờ review.
- e2e = Playwright API-driven, server tự spawn port ephemeral, `APP_DATABASE_URL` từ env, facility riêng per-run + cleanup. **CI = GitHub Actions** (postgres service; typecheck+test trên PR — deviation vs TL29-Jenkins, ghi nhận) — vào từ T1.
- LLM stub tới khi user cấp key; P5 recon rule-based, ngưỡng mặc định: self-approve mọi mức → cờ · >2 refund/receipt hoặc SUM refund >80% cap → cờ · approved thiếu provisioning >1h → cờ. Agent principal: KHÔNG thêm role vào ROLES (cần ADR riêng ở walk-phase); worker chạy system-job, audit actor `ai:recon`, đọc per-facility qua withFacility.
- Ngưỡng mắt-thứ-hai giữ 20tr VND. Worker interval 60s dev.
