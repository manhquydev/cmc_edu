---
title: "Roadmap execution M1–M4: pilot+VPS thật → P4 completion → P5 AI → multi-facility"
description: "Kế hoạch thực thi 4 milestone sau go-live (docs/project-roadmap.md). M0 go-live sprint (plan 260707-2308) đang chạy; plan này chi tiết hoá M1→M4. Quality-gated, không date-gated. Chốt vision PO 2026-07-08 (brainstorm 260708-0358)."
status: pending
priority: P1
branch: "main"
tags: [roadmap, pilot, vps, p4, p5-ai, multi-facility, go-live]
blockedBy: ["project:260707-2308-golive-sprint-land-sso-env-uat (M0 phải GO trước M1)"]
created: "2026-07-08T00:00:00.000Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260708-0358-project-vision-endstate-roadmap-report.md"
---

# Roadmap execution M1–M4

## Overview

Hiện thực hoá **Definition of Final Done** (docs/project-roadmap.md §1) qua 4 milestone tuyến tính
sau khi M0 (go-live sprint, plan 260707-2308) ký GO. Mỗi milestone **quality-gated**: qua khi exit
criteria đo được pass, không ép deadline (user chốt "không deadline cứng — chất lượng trước").

**Nguyên tắc kế thừa (bất biến xuyên suốt, không milestone nào nới):**
RLS `withFacility`+`cmc_app` · `can()` registry 9-role (ADR-D) · zod + 5 mã lỗi · không commit secrets ·
dev-header chỉ non-prod · timestamptz/ICT · sổ tiền/sao append-mindset · AI draft-only + che PII + consent ảnh trẻ (TL08§7).

**Độ chi tiết plan giảm dần theo độ xa** (honest — M3/M4 phụ thuộc dữ liệu pilot + danh sách cơ sở chưa có):
M1/M2 chi tiết đủ execute; M3/M4 structural, phase file chi tiết tạo just-in-time khi milestone tới.

## Milestones (phases)

| Phase | Milestone | Status | Chi tiết |
|-------|-----------|--------|----------|
| 1 | [M1 Pilot + VPS thật](./phase-01-m1-pilot-vps.md) | Pending | Full |
| 2 | [M2 P4 completion](./phase-02-m2-p4-completion.md) | Pending | Full |
| 3 | [M3 P5 AI crawl→walk](./phase-03-m3-p5-ai-crawl-walk.md) | Pending | Structural |
| 4 | [M4 Multi-facility rollout](./phase-04-m4-multi-facility.md) | Pending | Structural |

Phụ thuộc: M0(GO) → M1 → M2 → M3 → M4. Ngoại lệ: hạng mục M3 draft-only (không tiền/không dữ-liệu-trẻ-ra-ngoài)
được thí điểm sớm trên data pilot nếu M2 kéo dài — quyết tại phase M3.

## Dependencies

- **M0 go-live** (`project:260707-2308`) phải ký GO trước M1. M0 Phase-1 SSO đã merge (PR #24);
  Phase-2 ENV đang chạy (stack cmcv2-prod healthy trên local-sim, SSO smoke pass); **Phase-3 =
  Flow-Audit nghiệp vụ (chèn 2026-07-08, brainstorm 260708-0906)** chưa; Phase-4 UAT chưa.
- **Ngoài repo (stop-conditions):**
  - VPS thật (mua/thuê + DNS + firewall) — M1 bước 1. Chưa có.
  - R2/S3 remote backup creds — M1 bước 4 (restore drill RT-13); đã block từ M0 Phase-2 bước 7.
  - Danh sách + số cơ sở CMC thật — M4 bước 1. Chưa chốt (user: "tất cả cơ sở CMC hiện có").
  - LLM key production đủ quota cho eval — M3 (đã có LLM thật ở PD-1, cần xác nhận quota).

## Acceptance (toàn plan = Definition of Final Done, docs/project-roadmap.md §1)

- M1: pilot 1 cơ sở ≥2 tuần 0-CRITICAL; stack trên VPS thật healthy; TLS/DNS thật; restore drill pass với R2/S3 remote.
- M2: acceptance TL28 (WF-P4-01..05) pass; trace matrix TL25 cụm P4 không ô trống; gates xanh.
- M3: eval agent đạt ngưỡng TL29§5; override-rate + PII-guard verify; agent qua MCP chịu gate/RLS/audit; không quyền duyệt tiền.
- M4: tất cả cơ sở CMC live; cross-facility isolation audit pass trên vận hành thật (không chỉ test âm tính).

## Execution protocol (mọi milestone — kế thừa 260707-2308 + master roadmap)

1. Branch `feat/<milestone-slug>` từ main; gates (typecheck/test/build) xanh trước PR.
2. Harness mỗi phase: `ck:cook` → `ck:code-review` (adversarial nếu chạm tiền/auth/dữ-liệu-trẻ) →
   `ck:test` → `ck:fix`/`ck:debug` nếu lỗi → `ck:scenario` (edge cases trước UAT) → `ck:docs` → `ck:watzup`.
3. Cap review→fix 2 vòng; vòng 3 = stop-condition.
4. Fix-forward: mỗi fix 1 PR nhỏ; không big-bang (docs/31 §nguyên tắc).
5. Cập nhật `docs/project-roadmap.md` cột Trạng thái khi milestone chuyển pha (roadmap = trạng thái sống).

**Stop-conditions:** creds sai · migration mất dữ liệu · thao tác phá huỷ ngoài repo · e2e nghi trỏ DB thật ·
review-fix quá 2 vòng · CRITICAL cần quyết định sản phẩm chưa pre-resolved.

## Red-team + validate

Plan này qua adversarial red-team + critical-questions validate (report trong `./reports/`).
Findings bake vào phase files trước khi execute M1.
