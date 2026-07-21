# Phase T3 — Nhận xét AI-draft + Học bạ tháng + Ảnh lớp + Consent ảnh trẻ (WF-P2-07..08) (v2)

## Goal
Hai luồng dữ-liệu-trẻ nhạy nhất: nhận xét (AI chỉ nháp, GV chốt) + bằng chứng buổi học gửi PH — **kèm consent ảnh trẻ (C2 fix)** và học bạ tháng (H1 phần đọc).

## Nguồn spec
TL26 WF-P2-07/08 · **TL08 §7 (CỨNG — gồm consent + thu hồi)** · TL13 · TL19 §6-6b · TL25 P2-07/08.

## Scope

### Assessment (WF-P2-07)
- Schema: `QualitativeAssessment` (facilityId+RLS; studentId, classSessionId? **hoặc `period` = tháng học bạ 'YYYY-MM'** — pre-resolved; content, status draft|confirmed|discarded, draftedBy ai|teacher, confidence?, confirmedById?, confirmedAt?).
- `@cmc/llm`: interface `LLMClient` — **stub deterministic dev** (không mạng); provider thật khi user cấp key (stop-condition). Prompt versioned + negative-constraint list; **che PII: token hoá tên trẻ, context tối thiểu, audit những gì gửi** (TL13 §5).
- Procedures: `assessment.draftComment` (perm `assessment.draft` — giao_vien/GĐĐT) · `assessment.confirm` (giao_vien — sửa + chốt) · `assessment.discard` · **`assessment.listForChild` (lms — CHỈ `confirmed`, filter approved-guardian; fix validate: đường "PH thấy")**.
- **Học bạ tháng:** `reportCard.getForChild` (lms) — tổng hợp FinalGrade (T2) + tỉ lệ chuyên cần + nhận xét confirmed theo `period`. (H1 phần aggregation — T3 own.)
- **Bất biến (test):** không auto-publish; draft không lộ LMS; PII không vào prompt provider ngoài (mock provider ghi prompt).

### Session evidence + Consent (WF-P2-08 + C2)
- Schema: `SessionEvidence` (facilityId+RLS; classSessionId unique, summary, internalNote, status draft|published, publishedById?, publishedAt?) + `SessionEvidencePhoto` (blobRef qua @cmc/storage).
- **Consent (C2 — TL08 §7):** field `photoConsent Boolean @default(false)` + `photoConsentAt/RevokedAt` trên `Guardian`. `guardian.setPhotoConsent` (lms — PH cấp/THU HỒI cho con mình). **Gate đọc:** ảnh evidence chỉ trả về cho PH nếu approved-guardian **và consent active**; thu hồi → ảnh ẩn ngay (test). *Ghi chú documented:* enforcement mức "trẻ nào TRONG ảnh" cần tagging/UI — defer UI phase, ghi decision note.
- Procedures: `sessionEvidence.upsert` (giao_vien) · `publish` · LMS read: chỉ `published`, đúng con, **internalNote không bao giờ serialize ra LMS** (field-level test) · audit childDataRead.

## Review gate
**Adversarial bắt buộc** (child-data cao nhất): internalNote/draft leak, cross-batch photo, consent bypass, prompt PII.

## Harness
Intake high-risk · **US-018** assessment+reportCard (verify=`vitest run src/assessment/draft-confirm.test.ts`) · **US-019** evidence+consent (verify=`vitest run src/session-evidence/publish.test.ts`).

## Acceptance
Không auto-publish · internalNote ẩn tuyệt đối · consent gate + revoke hoạt động · reportCard đúng period · PII không ra provider ngoài · stub chạy không key · e2e GV draft→confirm→PH thấy (+consent flow) · merge protocol.

## Stop-condition riêng
LLM key thật (roadmap chạy tiếp với stub).
