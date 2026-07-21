# Brainstorm — Sequencing "Plan đang dở" cho /cook implement

**Date:** 2026-07-11 17:20 · **Mode:** brainstorm (deep-sequencing, user delegated decision) · **Branch:** main @ 291b2fd

## Vấn đề
User: sắp xếp thứ tự triển khai 4 plan đang dở rồi /cook implement. Scout cho thấy phần lớn "unfinished" KHÔNG phải code /cook làm được.

## Phân loại (scout evidence)
| Plan | Còn mở | Bản chất | /cook? |
|------|--------|----------|--------|
| ui-implementation (91%) | 6 | 4 blocked-on-Postgres (test/e2e), 3 descoped YAGNI/no-endpoint | ❌ verify+descope, không phải code |
| erp-lms-workflow-closure | 4 plan.md + 7 phase-05 | 4 doc-truth **đã done, chỉ chưa tick** (verify: TL20/25/28 + roadmap M2 + session-me.test @a998d5c); 7 e2e cần stack/DB | ✅ đã reconcile; ❌ e2e cần DB |
| golive-sprint (73%) | 6 | 1 env-gate + 5 UAT go/no-go (e2e ×2, email Brevo thật, UAT người thật, ký) | ❌ ops+manual, cần rotate key trước |
| m1-pilot-stability (16%) | 70 | 100% ops: provision VPS, deploy, cutover, backup cron, soak 2 tuần | ❌ hoàn toàn không phải /cook |

## Insight cốt lõi
1. "Unfinished" ≠ "code chưa viết". Chỉ ~0 code work thật trong 4 plan; nhiều mục done-nhưng-chưa-tick / blocked / descoped / ops.
2. PostgreSQL local stop = nút thắt keystone: chặn 3 verify + mở khoá 7 e2e-smoke. Bật DB (`net start postgresql-x64-18`, admin) là đòn bẩy rẻ nhất.
3. Việc code /cook đúng nghĩa lớn nhất KHÔNG nằm trong 4 plan — là **build-out ~30 màn ERP lên template premium** (scope mới, chưa có plan).

## Sequencing quyết định
- **Tier 0 (done phiên này):** tick 4 doc-truth box erp-lms (đã verify). erp-lms core = closed.
- **Tier 1 (cần user, rẻ, đòn bẩy cao):** user bật Postgres → agent chạy verify blocked (ui phase-01a/08, erp-lms phase-05 e2e-smoke) → fix nếu lộ lỗi code thật.
- **Tier 2 (agent code chính, cần plan riêng):** premium build-out ~30 màn ERP. Không chặn go-live. Cần brainstorm→plan→cook (không bổ nhào không plan).
- **Tier 3 (user/ops, agent chỉ prep):** go-live pilot = golive-sprint UAT + m1-pilot VPS. Gated trên: rotate key Brevo, provision VPS, UAT người thật, soak 2 tuần.

**Phân luồng:** Tier 2 (agent) chạy song song Tier 3 (user ops) — không chặn nhau, premium không đụng backend nên không phá ổn định go-live.

## Việc treo cho user
- Rotate BREVO_API_KEY + Graph secret (còn treo từ phiên merge).
- Bật Postgres local để mở khoá Tier 1.
- Quyết chiến lược: build-out premium (Tier 2, agent) vs ưu tiên go-live (Tier 3, ops) — hay chạy song song.

## Câu hỏi mở
1. Tier 2 premium build-out: dùng /ck:plan --tdd (refactor màn hiện có, giữ hành vi) đúng không?
2. Có bật DB chạy Tier 1 verify trước khi vào Tier 2 không?
