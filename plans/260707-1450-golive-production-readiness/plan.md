---
title: "Go-live production readiness: G0 xanh hoá main, tích hợp thật, hardening, môi trường prod cô lập, UAT"
description: "Thực thi phase PD của master roadmap + dựng môi trường prod mới cô lập, hướng vận hành thật. TDD: tests-first mỗi phase."
status: superseded
supersededBy: "project:260707-1830-golive-coordination-land-stack"
priority: P1
branch: "main"
tags: [go-live, predeploy, sso, email, storage, docker, uat, tdd]
blockedBy: []
blocks: []
created: "2026-07-07T08:08:29.114Z"
createdBy: "ck:plan"
source: skill
---

> **SUPERSEDED 2026-07-07** bởi `plans/260707-1830-golive-coordination-land-stack/`.
> Phase cũ (G0/PD-1/PD-2/ENV/UAT) mô tả work nay đã commit trên stack `feat/uat-session-injection`.
> Plan kế thừa phản ánh thực tế: land stack qua #16, env-reconcile, đóng stub, sync tracker, UAT.
> Không thực thi plan này song song.

# Go-live production readiness

## Overview

Backend (PR #1–#11) + UI (9 phase) đã code-complete; typecheck 26/26 xanh. Blocker vận hành thật = 4 tích hợp đang stub (Entra SSO, email, object store, LLM) + hardening + môi trường prod. Plan này thực thi `phase-08-predeploy-debt.md` của master roadmap (nay đã có đủ credentials) + dựng stack Docker Compose prod **cô lập hoàn toàn** khỏi `cmcnew-prod-*`.

Nguồn: `plans/reports/brainstorm-260707-1450-production-readiness-roadmap-report.md` (quyết định user 2026-07-07: VPS Docker Compose · đủ 4 credentials · vận hành theo harness/docs · stack mới cô lập).

**Protocol (kế thừa master roadmap):** branch `feat/<phase>` từ main mới nhất · harness intake+story per WF · gates xanh (typecheck/test/build/coverage) · PR merge · xoá branch · changelog. **TDD:** mỗi phase viết test âm tính/hợp đồng TRƯỚC khi cắm tích hợp thật. Stop-conditions: creds sai/thiếu · migration mất dữ liệu · review-fix >2 vòng · thao tác phá huỷ ngoài repo.

**Bất biến:** RLS `withFacility` + `cmc_app` · `can()` registry · zod + 5 mã lỗi · AI draft-only + che PII + consent ảnh trẻ (TL08 §7) · timestamptz/ICT · không commit secrets (mọi creds qua env/secret manager).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [G0 — Xanh hoá main + dọn nhánh](./phase-01-g0-xanh-ho-main-d-n-nh-nh.md) | Completed (PR #12 merged c444200) |
| 2 | [PD-1 — Tích hợp thật (SSO/email/storage/LLM)](./phase-02-pd-1-t-ch-h-p-th-t-sso-email-storage-llm.md) | In-Progress (PR #13 open, 255c485) |
| 3 | [PD-2 — Hardening pre-deploy](./phase-03-pd-2-hardening-pre-deploy.md) | In-Progress (PR #14 open, 252f4da, based on PD-1) |
| 4 | [ENV — Stack prod Docker Compose cô lập + backup](./phase-04-env-stack-prod-docker-compose-c-l-p-backup.md) | In-Progress (PR #15 open, 11175ed, based on PD-1+PD-2) |
| 5 | [UAT — E2E staging + go/no-go](./phase-05-uat-e2e-staging-go-no-go.md) | In-Progress (PR #16 open, 1ee7b66, based on PD-1+PD-2+ENV) |

Thứ tự: G0 → PD-1 → PD-2 → ENV → UAT (tuần tự; PD-2 có thể chen song song PD-1 ở các mục không đụng auth). Ước lượng tổng: 1.5–2.5 tuần.

## Dependencies

- Thực thi `plans/260706-1803-master-execution-roadmap/phase-08-predeploy-debt.md` (PD checklist) — master roadmap các phase build đã xong qua PR #1–#11; plan này là bước kế tiếp, không bị chặn.
- Credentials user cấp khi vào PD-1/ENV: Entra tenant/client-id/secret · Brevo/Graph keys · S3/MinIO endpoint+keys · LLM key. **Nhận qua env, không đưa vào repo/plan.**

## Acceptance (toàn plan)

- CI xanh trên main; 0 nhánh remote stale.
- Staff login qua Entra thật; OTP phụ huynh nhận qua email thật; PDF/ảnh qua S3/MinIO thật.
- RLS boot-check pass với `cmc_app` trên stack prod; restore DB thành công từ backup off-box.
- Stack prod cô lập (project name/network/volume/port riêng) chạy healthy; runbook deploy trong `docs/`.
- UAT theo `docs/29-test-plan.md` pass → quyết định go/no-go có biên bản.

## Red Team Review

### Session — 2026-07-07
**Findings:** 15 (15 accepted, 0 rejected) — 3 reviewer (Security Adversary / Failure Mode Analyst / Assumption Destroyer), tất cả có evidence file:line.
**Severity breakdown:** 4 Critical, 6 High, 5 Medium.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| RT-1 | LMS auth "giữ nguyên" nhưng token base64 chưa ký, chỉ dev-header populate ở prod | Critical | Accept | Phase 2 |
| RT-2 | Backdoor `ALLOW_DEV_AUTH=1` bật impersonation ở prod; plan ghi sai gate | Critical | Accept | Phase 2/4/5 |
| RT-3 | GET ảnh trẻ (`upload-route.ts:68-99`) KHÔNG auth, không phase nào chạm | Critical | Accept | Phase 2 |
| RT-4 | E2E tự spawn server + dev-header + không Entra → không trỏ staging được | Critical | Accept | Phase 5 |
| RT-5 | Trusted-proxy nhắm sai file; code thật ở `context.ts:89-96`; đụng Phase 2 | High | Accept | Phase 3 |
| RT-6 | Email routing cần đổi contract relay; worker dùng ConsoleTransport ở prod; retry cần migration + vô hạn | High | Accept | Phase 2 |
| RT-7 | RLS boot-check chỉ bắt superuser bỏ owner; probe 0-row vô nghĩa trên DB rỗng | High | Accept | Phase 3 |
| RT-8 | Row outbox kẹt `sending` vĩnh viễn sau crash giữa chừng | High | Accept | Phase 2/4 |
| RT-9 | Worker miễn boot-check; healthcheck đo liveness không đo correctness | High | Accept | Phase 3/4 |
| RT-10 | PII masking LLM chỉ comment, không enforce tại boundary | High | Accept | Phase 2 |
| RT-11 | session.me: mapping Entra→AppUser→roles chưa đặc tả, risk trust client roles | Medium | Accept | Phase 2 |
| RT-12 | Phase 1 push 2 commit lớn thẳng main trước branch protection | Medium | Accept | Phase 1 |
| RT-13 | Backup "off-box" có thể on-box + mâu thuẫn port | Medium | Accept | Phase 4 |
| RT-14 | CI e2e đã tồn tại non-blocking; "thêm" sai, phải promote | Medium | Accept | Phase 3 |
| RT-15 | Storage factory tạo mới mỗi request → S3 client churn | Medium | Accept | Phase 2 |

Ghi chú: remote có 7 nhánh `feat/*` (không phải 8) — đã sửa Phase 1.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01..05.
- Decision deltas checked: 15 (+ dev-auth gate mô tả, LMS auth scope, e2e staging khả thi, backup off-box, CI e2e promote, branch count).
- Reconciled stale references: dev-header gate `NODE_ENV!=='production'` → `|| ALLOW_DEV_AUTH==='1'` (mọi phase); "LMS giữ nguyên" → LMS session ký thật (Phase 2); "e2e trỏ staging URL" → work item A/B (Phase 5); "backup off-box" → host khác + assert (Phase 4); "thêm e2e job" → promote job cũ (Phase 3); `context.ts` cross-phase collision Phase 2↔3 đã ghi note tuần tự.
- Unresolved contradictions: 0.

## Validation Log

### Session 1 — 2026-07-07
Verification: bỏ qua Step 2.5 (red-team đã verify với evidence file:line, Failed: 0). 4 câu hỏi quyết định.

| # | Quyết định | Chọn | Áp vào |
|---|---|---|---|
| V1 | VPS stack prod | **VPS RIÊNG cho cmcv2** (khác máy cmcnew-*) → 443/80 sạch, backup off-box dễ | Phase 4 (port entry gate resolved) |
| V2 | `ALLOW_DEV_AUTH` sau SSO | **GỠ HẲN hatch** khỏi `context.ts:42-43` sau khi Entra+LMS session xong | Phase 2 (+ kéo theo e2e session-injection) |
| V3 | e2e mode UAT | **B: local prod-config + manual auth**, automated flows dùng **session-injection** (do V2 bỏ dev-header) | Phase 5 |
| V4 | Timing LLM | **BẬT NGAY từ go-live** (draft-only + guard PII) | Phase 2 + Phase 5 (UAT cover AI nhận xét) |

**Reconcile V2×V3:** gỡ hẳn `ALLOW_DEV_AUTH` nghĩa là e2e KHÔNG còn dùng `x-dev-user` được ở prod-config. Mode B do đó dùng **session-injection**: global-setup mint session token ký hợp lệ (cùng signing secret) cho staff flows; Entra + LMS OTP verify manual. Cần helper session-injection trong `apps/e2e/` — ghi vào Phase 5.

### Whole-Plan Consistency Sweep (post-validation)
- Files reread: plan.md, phase-01..05.
- Decision deltas checked: 4 (VPS riêng, gỡ hatch, e2e mode B + session-injection, LLM go-live).
- Reconciled: Phase 4 port "quyết tại entry gate" → chốt VPS riêng 443/80; Phase 2 "hoặc gỡ hẳn hatch" → cam kết gỡ hẳn; Phase 5 mode B → session-injection (không dev-header) do V2; LLM từ "unresolved sau UAT" → bật go-live, UAT cover.
- Unresolved contradictions: 0.

## Unresolved questions

- VPS cụ thể (IP/specs/domain/TLS) của máy riêng cmcv2 — cần địa chỉ khi vào ENV (chiến lược đã chốt: máy riêng).
