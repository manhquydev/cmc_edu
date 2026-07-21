# 260721 — CRM assessment + remediation plan qua 3 vòng red-team về 0 Critical/High

## Bối cảnh
PO yêu cầu brainstorm làm rõ hệ thống CRM: đánh giá công tâm luồng vận hành theo 4 trục (toàn vẹn dữ liệu, mồ côi, rủi ro, tính chuyên nghiệp vs 5 role thật). Ràng buộc bằng chứng do PO đặt: **chỉ tin code/schema, không tin docs**.

## Kết quả
- **Báo cáo đánh giá**: `plans/reports/brainstorm-260720-2229-crm-operational-integrity-assessment-report.md` — 15 findings (2 CRITICAL: sale không thể tạo lead từ UI; race cancel-provisioning orphan Student). Điểm mạnh thật: RLS+FORCE, O5 chỉ qua receiptApprove, provisioning idempotent.
- **Plan khắc phục**: `plans/260720-2229-crm-remediation-full-scope/` — 10 phase, thứ tự thực thi 1→2→3→4→8→5→6→7→9→10, 7 quyết định PO chốt trong phiên (walk-in auto-opp O5, entrance test gắn Opportunity, owner+source, notes CUT, post-sale audit DEFERRED, PH placeholder, auto-dedup).
- **Pipeline gate**: red-team vòng 1 (4 reviewer, 15 cluster accepted — trong đó phase 1 nháp đầu TRÙNG C1 remediation đã ship + vi phạm void-semantics LOCKED; phase 5 dựa trên cột `ParentAccount.name` không tồn tại) → validate (4 quyết định) → red-team vòng 2 (1C+3H mới: CHECK constraint ReconciliationFlag.kind, Guardian/StudentAccount ngoài withFacility, markLost stamp lostReason lên O5, walk-in link sau advance block) → vòng 3: **VERDICT 0 Critical / 0 High**.

## Bài học kỹ thuật
1. **Red-team bắt được lỗi "plan trùng việc đã ship"** — nháp phase 1 xây lại 3 lớp guard đã tồn tại ở `enrollment/activate-enrollment.ts:106` + `worker/reconcile-orphaned-receipts.ts`. Scout kỹ trước khi viết phase money-path.
2. **Hai reviewer độc lập cùng bắt một fact sai** (ParentAccount.name) là tín hiệu chất lượng của evidence-gated review; finding không file:line bị auto-reject giữ noise thấp.
3. **CHECK constraint trên cột kind/status** là bẫy khi thêm giá trị mới — 23514 không bị P2002-catch nuốt.
4. UI stub comment nói "chưa có backend" trong khi backend đã ship (after-sale, meeting router) — hai phía FE/BE mất đồng bộ, cần grep cả hai trước khi tin comment.

## Trạng thái
Plan implementation-eligible, chưa cook. Bước sau: `/ck:cook D:\project\vip\CMC\plans\260720-2229-crm-remediation-full-scope\plan.md` (nên `/clear` trước để context sạch).
