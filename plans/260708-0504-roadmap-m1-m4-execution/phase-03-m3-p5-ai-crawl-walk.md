---
phase: 3
title: "M3 P5 AI crawl→walk"
status: pending
priority: P1
dependencies: [2]
detail: structural
---

# Phase 3 (M3) — P5 AI agent crawl→walk (structural)

> **Structural plan** — phase file chi tiết tạo just-in-time khi M2 gần xong. Lý do: eval agent cần
> **dữ liệu pilot thật** (M1) để đo override-rate/accuracy; chi tiết viết trước = hư cấu (đúng nguyên
> tắc just-in-time roadmap doc §3). Dưới đây là khung + ràng buộc bất biến.

## Overview
Đưa AI agent từ mức draft (đã có ở PD-1: LLM thật, AI-draft assessment HITL, PII-guard, MCP server
package) lên **crawl→walk** trên dữ liệu pilot thật: recon agent HOTL + teacher-assist draft→GV chốt,
có eval đo được. **Không** mở auto (run) trong M3 — chỉ tới khi eval đạt ngưỡng (TL29§5).

## Scout hiện trạng (2026-07-08)
- Đã có: `packages/llm` (LLM thật OpenAI-compatible), `packages/mcp-server`, AI-draft assessment HITL,
  PII-guard, recon rule-based (master roadmap P5 mô tả).
- Thiếu: eval plan chạy được (TL29§5 — "viết mới khi tới pha AI"), eval harness đo accuracy/override-rate.

## Ràng buộc bất biến (không nới — TL04/13/30, TL08§7)
- Agent hành động qua **đúng tRPC API + `can()` registry** (không định nghĩa quyền riêng); qua MCP chịu gate/RLS/audit.
- Agent principal `ai:*` — **KHÔNG thêm role vào ROLES** (cần ADR riêng nếu muốn; ADR-D giữ 9 role).
- **KHÔNG quyền duyệt tiền** (recon = HOTL compensating control, không tự approve).
- **KHÔNG gửi PII/ảnh trẻ** ra LLM ngoài không kiểm soát (TL08§7, TL30 prompt-injection).
- Draft-only tới khi eval đạt ngưỡng → mới bật auto (crawl→walk→run, TL04§8).

## Khung bước (chi tiết hoá khi tới milestone)
1. Viết **eval plan** (TL29§5): metric accuracy + override-rate + false-positive; dataset từ pilot thật.
2. Recon agent HOTL: chạy trên data pilot; đo cờ đúng/sai; audit actor `ai:recon`; đọc per-facility qua withFacility.
3. Teacher-assist draft→GV chốt: đo tỉ lệ GV sửa; PII-guard verify trên nhận xét thật.
4. Eval gate: đạt ngưỡng TL29§5 → ghi nhận; chưa đạt → giữ draft, không mở auto.
5. Harness: cook → adversarial code-review (AI + tiền/dữ-liệu-trẻ) → test → scenario (prompt-injection edge) → docs.

## Success Criteria (sơ bộ — chốt tại phase detail)
- [ ] Eval plan viết + chạy trên data pilot; metric đo được.
- [ ] Recon HOTL + teacher-assist draft chạy; override-rate + PII-guard verify.
- [ ] Agent qua MCP chịu gate/RLS/audit; không quyền duyệt tiền; không role mới trong ROLES.
- [ ] Eval đạt ngưỡng TL29§5 (hoặc ghi rõ chưa đạt → giữ draft).

## Risk Assessment
- Dữ liệu pilot ít → eval không đủ mẫu; ngoại lệ: thí điểm draft-only sớm nếu M2 kéo dài (roadmap §2).
- Prompt-injection / PII leak → TL30 threat + PII-guard test bắt buộc.
- Cám dỗ mở auto sớm → gate eval cứng, crawl→walk→run không nhảy cóc.
