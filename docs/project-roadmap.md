# CMC EDU v2 — Project Roadmap (vision đích cuối + milestone sống)

> Nguồn sự thật cho **hướng đi sau go-live**. Chốt với PO 2026-07-08, cập nhật 2026-07-10 (Astryx migration spike GO).
> Milestone **quality-gated, không date-gated** — qua milestone khi exit criteria đo được pass,
> không ép deadline. Plan chi tiết tạo **just-in-time** khi milestone sắp bắt đầu (tránh drift —
> bài học plans 260706-1803 / 260707-2128). Trạng thái build lịch sử P0→P5: TL31.

---

## 1. Định nghĩa Kết quả Cuối cùng (Definition of Final Done)

CMC EDU v2 đạt đích khi **cả 5** điều sau đúng:

1. **Nghiệp vụ khép kín 100%** — mọi hàng Ma trận Truy vết (TL25) đủ Vai trò→WF→API→UI→Test→ADR,
   không ô mồ côi. P4 đóng nốt: lịch test, after-sale case, họp PH đầy-cuối (TL28).
2. **AI agent là công dân thật** — recon agent HOTL + teacher-assist draft chạy trên dữ liệu thật
   qua MCP + RLS + audit; eval (TL29 §5) đạt ngưỡng mới mở auto; không quyền duyệt tiền;
   không gửi PII/ảnh trẻ ra LLM không kiểm soát (TL08 §7, TL30).
3. **Hạ tầng production thật** — VPS thật (hết local-sim), TLS/DNS thật, backup R2/S3 remote +
   restore drill định kỳ pass (RT-13), runbook second-person.
4. **Multi-facility** — tất cả cơ sở CMC hiện có chạy trên cùng stack; RLS isolation chứng minh
   bằng vận hành thật (không chỉ test âm tính).
5. **Vòng học hỏi đóng** — incident/postmortem template dùng thật; mọi thay đổi qua PR + gates;
   không hotfix tay trên prod.

**Loại khỏi phạm vi v2** (giữ nguyên quyết định TL16): huy hiệu · bảng xếp hạng · chứng chỉ tự động ·
duyệt lên cấp. SaaS hoá/multi-tenant ngoài CMC: **không trong vision này** (cần brainstorm riêng nếu đặt ra).

## 2. UI Design System Migration: Phase 2 COMPLETE (2026-07-10)

Ngoài các milestone dọc tuyến tính M0→M4, **UI migration spike đã hoàn thành Phase 2**:
- **Phase 1 (GO):** Mantine v7 → Astryx (beta) — verified không phá build, CSS footprint tốt hơn, zero supply-chain risk.
- **Phase 2 (complete):** All 10 components migrated, theme rebuilt (cmcTheme → AstryxCmcProvider CSS-only), peerDependencies updated (@astryxdesign/core@0.1.4 + @stylexjs/stylex@0.18.3). MantineProvider + AstryxCmcProvider coexist (strangler). Workspace clean: build + typecheck + test green. Browser e2e specs added (admin-shell.ui.spec.ts, lms-login.ui.spec.ts): 4 passing, 1 fixme (pre-existing session-context bug unrelated to Astryx), 0 failing. Fixed 3 pre-existing bugs via PR #27 (tRPC basePath, RLS wrapper, session timing).
- **Phạm vi:** Strangler pattern qua Phase 2-4; bỏ Mantine chỉ ở Phase 5 (không chặn milestone trước).
- **Plan:** `plans/260710-0236-astryx-ui-migration/` (5 pha, gitignored).

Công việc này **song song với M0-M4**, không kéo timeline M0 go-live.

---

## 3. Bản đồ milestone

| # | Milestone | Phạm vi chính | Exit criteria (đo được) | Plan | Trạng thái |
|---|---|---|---|---|---|
| **M0** | Go-live sprint | Land SSO (PR #24) → ENV `cmcv2-prod` local-sim → UAT 2-run + người thật | Biên bản GO ký; e2e critical 2/2 PASS prod-config; email live Brevo+Graph; tracker #8/#9/#10 completed | `plans/260707-2308-golive-sprint-land-sso-env-uat` | **Đang chạy** — Phase 1 PR #24 CI xanh |
| **M1** | Pilot ổn định + VPS thật | Vận hành pilot 1 cơ sở; fix-forward; chuyển VPS thật + TLS/DNS thật; backup R2/S3 remote | ≥2 tuần không CRITICAL; stack trên VPS thật healthy; restore drill pass với R2/S3 remote; runbook cập nhật | tạo khi M0 GO | Chưa |
| **M2** | P4 completion | Lịch test (WF-P4-04) · after-sale case (WF-P4-05) · họp PH audit đầy-cuối · đóng ô trống TL25 cụm P4 | Acceptance TL28 pass; trace matrix P4 không ô trống; gates xanh | tạo khi M1 gần xong | Chưa |
| **M3** | P5 AI crawl→walk | Recon agent HOTL trên data pilot thật · teacher-assist draft→GV chốt · eval plan viết + chạy | Eval đạt ngưỡng TL29 §5; override-rate đo được; PII-guard verify; agent qua MCP chịu gate/RLS/audit | tạo khi M2 gần xong | Chưa |
| **M4** | Multi-facility rollout | Onboard toàn bộ cơ sở CMC còn lại (seed + runbook per-facility) | Tất cả cơ sở live; cross-facility isolation audit pass trên vận hành thật | tạo khi M3 gần xong | Chưa |

Phụ thuộc tuyến tính M0→M1→M2→M3→M4. Ngoại lệ cho phép: hạng mục M3 dạng draft-only (không tiền,
không dữ liệu trẻ ra ngoài) được thí điểm sớm trên data pilot nếu M2 kéo dài — quyết tại plan M3.

## 4. Nguyên tắc vận hành roadmap

- **Just-in-time planning**: plan milestone kế tiếp chỉ tạo khi milestone hiện tại gần exit —
  brainstorm-nhẹ → `/ck:plan` → red-team nếu chạm tiền/auth/dữ-liệu-trẻ → cook.
- **Cập nhật trạng thái tại đây** (cột Trạng thái + link plan) mỗi khi milestone chuyển pha;
  file này là trạng thái sống, TL31 giữ nguyên làm bản đồ thi công gốc.
- **Bất biến xuyên suốt** (không milestone nào được nới): RLS `withFacility`+`cmc_app` ·
  enum 9 giá trị · registry/gán `ACTIVE_ROLES` 5 role (ADR-D amendment) · zod + 5 mã lỗi · không commit secrets · dev-header chỉ non-prod ·
  timestamptz/ICT · sổ tiền/sao append-mindset.
- **Stop-conditions kế thừa** (plan 260707-2128): creds sai · migration mất dữ liệu ·
  thao tác phá huỷ ngoài repo · e2e nghi trỏ DB thật.

## 5. Phụ thuộc ngoài repo (theo dõi)

| Hạng mục | Cần cho | Trạng thái 2026-07-08 |
|---|---|---|
| R2/S3 remote creds (backup) | M0 Phase-2 drill / chậm nhất M1 | Chưa có — user cấp sau |
| Mailbox Graph licensed | M0 Phase-3 email live | Cần xác nhận |
| Lịch + người UAT thật | M0 Phase-3 | Điều phối ngoài repo |
| VPS thật (mua/thuê + DNS) | M1 | Chưa |
| Danh sách + số cơ sở CMC | M4 | Chốt khi lập plan M4 |

> Liên kết: TL31 (phased build gốc) · TL25 (traceability) · TL04/13 (AI strategy) · TL29 (test/eval) ·
> TL30 (threat) · `docs/project-changelog.md` (lịch sử).
