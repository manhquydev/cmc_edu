# Brainstorm Report — Đóng M0 → GO + audit luồng nghiệp vụ trước UAT

Date: 2026-07-08 · Mode: standard · Branch: main · Decision: chèn phase audit nghiệp vụ vào M0 trước UAT; chốt 4 phụ thuộc ngoài repo

## 1. Problem statement

M0 go-live sprint (plan `260707-2308`) đã xong Phase 1 (SSO, PR #24–#26) + Phase 2 phần lớn
(stack `cmcv2-prod` 7 container healthy, SSO smoke pass). Còn lại tới GO: 4 phụ thuộc ngoài repo
chưa chốt + Phase 3 UAT chưa chạy. Giữa phiên, user thêm yêu cầu: **kế hoạch check luồng nghiệp vụ
ERP theo vai trò — tính năng từng vai, tương tác/phụ thuộc liên vai, soi mâu thuẫn + luồng mồ côi**.

## 2. Quyết định user (2 vòng AskUserQuestion)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Restore drill G5 (thiếu R2/S3 creds) | **Cấp creds Cloudflare R2 ngay** — drill chạy trước GO, giữ nguyên gate |
| 2 | Gate G7 second-person runbook | **Dời sang M1** — deploy VPS thật là clean-room run tự nhiên; biên bản ghi "deferred to M1" |
| 3 | Mailbox Graph licensed | **Đã có, test được ngay** — giữ nguyên plan gốc (≥1 email Graph live trong UAT) |
| 4 | Vị trí audit nghiệp vụ | **A: trước UAT, trong M0** — GO lùi ~1 ngày, UAT test đúng chỗ rủi ro |
| 5 | Phạm vi audit | **Cả 4**: trace 28 WF ↔ code · soi 9 role ↔ nghiệp vụ · bản đồ chuỗi liên vai · đối chiếu mâu thuẫn tài liệu |
| — | Phạm vi UAT (7 người vs rút gọn) | **Để mở** — quyết khi có kịch bản UAT từ audit output |

## 3. Bằng chứng ban đầu (scout 2026-07-08 — lý do audit đáng làm trước GO)

- **Registry 9 role** (`packages/auth/src/index.ts:10-20`): `super_admin · giam_doc_kinh_doanh ·
  giam_doc_dao_tao · sale · giao_vien · ke_toan · cskh · ctv_mkt · hr`. User tưởng không có HR → sai.
- **Nghi vấn role mồ côi**: `cskh`, `ctv_mkt`, `hr` không xuất hiện tên trong 28 WF của TL25.
- **Nghi vấn mâu thuẫn SoD-tiền**: TL25 P1-03 người duyệt phiếu = **GĐKD**; UAT checklist §2.4 giao
  **Kế toán** duyệt → hai tài liệu lệch nhau, cần soi `finance.receiptApprove` cấp cho role nào thật.
- TL25 tuyên bố "không mồ côi" nhưng cột Test ghi "file sẽ viết — chưa tồn tại" → tuyên bố trên giấy,
  chưa kiểm chứng ngược code đang chạy.

## 4. Approaches evaluated (vị trí audit)

| Phương án | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Audit trước UAT (trong M0)** | Rẻ (~1 buổi, agent-assisted); bắt đứt gãy trước khi tốn lịch người thật; sinh kịch bản UAT chuỗi liên vai | GO lùi ~1 ngày | ✅ **CHỌN** |
| B. GO trước, audit ở M2 | GO nhanh nhất | Pilot mở với nghi vấn SoD-tiền chưa xác minh; UAT test vai rời rạc | ❌ |
| C. Click-through thủ công 28 luồng | Trực quan | = làm UAT 2 lần, trùng công (DRY) | ❌ |

## 5. Final solution

**M0 sửa đổi — chèn phase audit giữa Phase 2 và Phase 3** (plan `260707-2308`):

1. **Phase 2 đóng nốt**: user cấp creds R2 (bucket + API token) → restore drill RT-13 → G5 ✓;
   seed super_admin; tick gate G1–G10 (G7 đánh dấu deferred-M1).
2. **Phase 2.5 MỚI — Audit luồng nghiệp vụ** (4 hạng mục):
   - Trace 28 WF TL25 ↔ code: quyền `can()` ↔ API router ↔ UI route ↔ test tồn tại & pass — tìm ô mồ côi thật.
   - Soi 9 role: quyền được cấp · WF sử dụng · UI truy cập — trả lời dứt điểm cskh/ctv_mkt/hr mồ côi không, kế toán duyệt gì thật.
   - Bản đồ chuỗi liên vai (sale→GĐ→hệ thống→PH...) — kiểm chứng từng khớp nối có code + test phủ.
   - Đối chiếu mâu thuẫn TL25 ↔ UAT checklist ↔ code ↔ ADR — danh sách mâu thuẫn + nguồn sự thật đề xuất.
   - Output: báo cáo mồ côi/mâu thuẫn (findings phân CRITICAL/HIGH/MEDIUM) + **kịch bản UAT chuỗi
     liên vai** thay/bổ sung Section 2. Finding CRITICAL chạm tiền/auth → fix-forward trước UAT.
3. **Phase 3 UAT**: chạy theo kịch bản từ audit; email live Brevo + Graph (đã sẵn); e2e 2-run;
   biên bản go/no-go.

## 6. Risks

- Audit lộ finding CRITICAL nhiều → GO lùi hơn 1 ngày; mitigation: cap fix-forward theo protocol
  2 vòng, finding không chạm tiền/auth/dữ-liệu-trẻ được ghi nợ sang M2.
- Trace tự động dựa agent có thể false-positive/negative → mỗi finding phải kèm file:line verify.
- Drill R2 lần đầu có thể lộ lỗi script với R2 endpoint (khác AWS S3 chuẩn) → thử sớm ngay khi có creds.

## 7. Success metrics

- Báo cáo audit: 28/28 WF có verdict (đủ/mồ côi ô nào), 9/9 role có hồ sơ quyền-vs-nghiệp-vụ,
  ≥1 bản đồ chuỗi liên vai, danh sách mâu thuẫn có nguồn-sự-thật đề xuất.
- 2 nghi vấn đã biết (role cskh/ctv_mkt/hr; Kế toán-vs-GĐKD duyệt phiếu) có kết luận dứt điểm.
- G5 restore drill PASS với R2 remote; G1–G10 tick đủ (G7 = deferred-M1); biên bản GO ký.

## 8. Next steps

1. `/ck:plan` cập nhật plan `260707-2308`: thêm phase file audit (2.5) + sửa phase 2/3 theo quyết định trên.
2. User cấp creds R2 (song song, không chặn audit).
3. Sau audit → chốt phạm vi UAT người thật (7 vai vs rút gọn) dựa trên kịch bản sinh ra.

## Unresolved questions

- Phạm vi UAT người thật (7 vs 2–3 người đóng vai) — quyết sau audit.
- Danh tính email Entra thật cho seed super_admin (cần khi Phase 2 bước 8).
- Carried từ trước: độ phủ thực tế "họp PH" (audit lần này sẽ chạm P4-03, có thể trả lời luôn).
