# Brainstorm — máy hoá nghiệm thu: ba tầng, manifest làm xương sống

**Ngày:** 2026-07-23 · **Trạng thái:** chốt hướng, chờ plan
**Người quyết:** PO (4 quyết định qua AskUserQuestion, đều theo khuyến nghị)

## Vấn đề thật (problem-first)

Yêu cầu gốc: "nghiệm thu không cần người thủ công, xác thực đồng bộ logic↔UI, biết tình trạng vận hành thật, nghi ngờ `acceptance-report`".

Vấn đề ẩn dưới: **không tầng đo nào chứng minh "vai X đi trọn luồng Y qua giao diện và thấy kết quả đúng"** — và người dùng đang phải là tầng đó. Bằng chứng: 3 luồng chết 16 ngày (F1/F2/F4) trong khi mọi gate xanh (journal `260722-260723`, "công cụ đo nói dối 4 lần").

## Phán quyết về `acceptance-report`

**Hiệu quả cho đúng một việc: đo SỰ TỒN TẠI + chống drift** (procedure/route/model tồn tại, placeholder bị bắt, orphan lộ ra). Nó không chạy code — `verify.ts` scan text tại HEAD. "38/38 built" từng bị đọc nhầm thành "38/38 working" — lỗi phạm trù, không phải lỗi công cụ. **Giữ nguyên vai, không mở rộng thành máy đo hành vi.**

## Bốn tầng hiện có và ba lỗ đã chứng minh bằng sự cố

| Tầng | Trả lời | Lỗ |
|---|---|---|
| acceptance:report | built chưa? | không đo hành vi (by design) |
| 1.384 unit/integration | logic đúng? | không đo UI |
| 12 e2e spec | vài luồng chạy? | bắc cầu id giữa vai — chính lớp mù che F1 |
| capture 102 cặp | màn nào bị denied? | (1) "ok + rỗng" = sạch → lớp F2 vô hình; (2) gate `canDo()` client không sinh request → vô hình |

Thêm: e2e + acceptance:report đều `continue-on-error` — tầng đo không chặn thì không bảo vệ.

## Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Thay UAT M0 hay giữ? | **Giữ UAT M0 người thật làm lần ký cuối**; máy hoá cho mọi vòng sau. Entra+MFA thật, phán quyết UX, chữ ký — máy không thay được |
| Q2 | Ghép hướng | **B + C trước, A tăng dần từ ~10 luồng lõi** |
| Q3 | Email proof | **MailHog local cho CI/journey; smoke trên host gửi 1 Brevo thật vào hộp sink + đọc lại qua IMAP/Graph** |
| Q4 | CI gate | **Nâng dần theo dữ liệu** — cảnh báo 1–2 tuần, chặn khi báo-giả ~0 (đúng điều kiện `ci.yml:88-92`) |

## Thiết kế

**Xương sống:** `flow-manifest.ts` mở rộng — mỗi flow khai `journey` (spec bảo chứng); màn×vai khai kỳ vọng dữ liệu. Đây là cơ chế "đồng bộ logic↔UI": tầng static biết tầng hành vi nào bảo chứng nó, coverage hiện trong report.

### Đợt 1 — B: capture biết "rỗng"
- `apps/e2e/src/screen-role-expectations.ts`: (màn, vai) → procedures phải **non-empty** với seed cố định. Tối thiểu (~15–20 dòng), không phủ 100%.
- CallRecord thêm `empty`; vi phạm expectation ⇒ finding.
- Màn×vai có expectation mà **không gọi gì** ⇒ finding (đóng lỗ `canDo()` client).

### Đợt 1 — C: `scripts/ops-smoke.sh`
Chạy trên host sau deploy, <5 phút: api + worker sống riêng từng process · log không FATAL · SSO redirect ra Microsoft (không login) · Brevo `/v3/account` 200 từ host · 1 email thật → hộp sink nhân sự → xác nhận đến qua Graph/IMAP · đếm row đúng role + GUC. Runbook §3.0/§8d trỏ vào script. Secrets chỉ trên host.

### Đợt 2 — A: journey specs (tăng dần)
- `apps/e2e/tests/journeys/` + 2 helper: **menu-first** (bấm side-nav, không goto — luật §4.3 thành code) · **tự-tìm-qua-danh-sách** (không truyền id giữa vai — luật §4.2 thành code).
- Bộ đầu ~10: P1-01→03 (tiền) · 3 journey hồi quy F1/F2/F4 · P3-01/02 · P4-01. Email qua MailHog.
- Manifest field `journey`; acceptance:report hiện journey coverage (chưa chặn).

### Kèm theo
- CI job regenerate `screen-role-matrix.json` + fail on diff — **đóng nợ N5**.
- Lộ trình nâng gate: từng tầng warn → block.

## Tiêu chí nghiệm thu của chính hệ đo

1. **Falsification:** revert fix `class.read` trên nhánh thử → tầng B **phải đỏ**. Chưa bắt được lỗi đã biết = chưa được tin.
2. `ops-smoke.sh` PASS thật trên host UAT trước buổi UAT.
3. 10 journey xanh trên stack prod-config.
4. Sau M0: vòng hồi quy không cần người; người chỉ còn ở ký Go/No-Go + phán quyết UX.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Journey flaky | Seed cố định, menu helper deterministic, không `networkidle` (bài học đã ghi trong capture) |
| Expectations thành gánh bảo trì | Tối thiểu 1–2 procedure/màn, chỉ chỗ trọng yếu |
| Quota Brevo 300/ngày | Chỉ smoke gửi thật (~1/lần deploy) |
| Gate mới flaky chặn nhầm merge | Warn trước, block sau khi có dữ liệu |
| Máy hoá xong bỏ luôn người ở chỗ cần người | Q1 chốt rõ: judgment UX + sign-off vẫn là người |

## Không làm (non-goals)

- Không thay buổi UAT M0.
- Không mở rộng acceptance:report thành máy đo hành vi.
- Không automation Entra login thật + MFA.
- Không phủ 38/38 journey ngay — tăng dần theo manifest.

## Câu hỏi chưa giải

1. Hộp thư sink nhân sự nào dùng cho smoke — cần tạo mailbox riêng trên `STAFF_EMAIL_DOMAIN`? (cần trước khi viết C)
2. MailHog vào `docker-compose` dev hay compose riêng cho e2e?
3. Journey chạy trên CI cần stack đầy đủ (api+admin+db) — dùng job e2e sẵn có hay job riêng?
