# Plan: Nâng cấp CRM tuyển sinh CMC — Báo cáo, Chống rơi lead, Nhập lead hàng loạt

Trạng thái: **IN PROGRESS** — P1 đang implement trên `feature/crm-p1-bao-cao-tuyen-sinh`
Ngày tạo: 2026-08-08 · Branch gốc: `develop`

> **Đối tượng đọc:** người nghiệm thu sản phẩm (không phải lập trình viên). Phần chính (§1–§10) dùng ngôn ngữ nghiệp vụ. Chi tiết kỹ thuật gom ở §11 và trong mục "Phụ lục kỹ thuật" cuối mỗi file phase.

---

## 1. Bối cảnh một câu

CRM tuyển sinh của CMC hiện chạy tốt và đã nghiệm thu (hành trình *người quan tâm → tư vấn → kiểm tra → đóng học phí → nhập học*). Plan này **chỉ THÊM 4 tính năng**, **không sửa quy trình đang chạy**, để giải quyết 3 nỗi đau: (1) không có báo cáo để ra quyết định, (2) lead bị bỏ quên âm thầm, (3) nhập lead theo lô lớn phải gõ tay từng người.

## 2. Sẽ tích hợp gì

| # | Tính năng | Ai dùng | Giải quyết nỗi đau |
|---|---|---|---|
| P1 | **Báo cáo tuyển sinh** | GĐKD + tư vấn viên | Không có số liệu: rớt vì lý do gì, kênh nào ra học viên, ai chốt tốt |
| P2 | **Cảnh báo cơ hội "đang nguội"** | Tư vấn viên + quản lý | Cơ hội để lâu không ai đụng → rơi âm thầm |
| P3 | **Nhập lead hàng loạt** | Tư vấn viên | Lead vào theo lô (hội thảo/fanpage) phải gõ tay từng người |
| P4 | **Nhắc việc theo cơ hội** | Tư vấn viên | Quên gọi lại / quên bước tiếp theo |

Thứ tự làm: **P1 → P2 → P3 → P4** (đã chốt). Lý do: P1 rẻ và an toàn nhất, đồng thời tạo **số liệu nền** để về sau chứng minh P2/P4 có giảm rơi lead; P3 (nhập hàng loạt) giá trị vận hành cao nên xếp trên P4.

## 3. Hệ thống hoạt động thế nào: TRƯỚC và SAU

**Không đổi (cam kết nghiệm thu):** quy trình 5 bước phễu `Mới → Đã liên hệ → Đã hẹn kiểm tra → Đã kiểm tra → Đã nhập học`; đóng học phí → tự động nhập học; chống trùng theo số điện thoại; phân quyền; tách dữ liệu theo từng cơ sở.

| Việc | TRƯỚC | SAU |
|---|---|---|
| Ra quyết định tuyển sinh | Cảm tính, không số liệu | GĐKD mở **trang báo cáo**: tỷ lệ chuyển đổi phễu, lý do mất, hiệu quả theo kênh & theo nhân viên |
| Cơ hội bị bỏ quên | Không phát hiện | Gắn **nhãn "đang nguội"** khi để lâu quá X ngày không chuyển bước |
| Nhập lead theo lô | Gõ tay từng người | **Dán danh sách**, hệ thống tự chống trùng, gắn nguồn, báo lỗi dòng nào sai |
| Nhắc việc | Tự nhớ | Đặt **"việc cần làm + ngày hẹn"**; đến hạn hiện ở màn hình đầu ca |

## 4. Cách nghiệm thu (tiêu chí đạt)

- **P1:** GĐKD trả lời <1 phút, ngay trên màn hình (không xuất Excel tay): "rớt nhiều nhất vì lý do gì", "kênh nào ra nhiều học viên nhất", "tỷ lệ chuyển đổi theo từng tư vấn viên". **Tư vấn viên xem được bức tranh chung của cơ sở** (tổng phễu, lý do mất, hiệu quả kênh) **nhưng KPI theo người chỉ thấy của chính mình**; GĐKD thấy toàn đội.
- **P2:** Tạo một cơ hội, để quá ngưỡng ngày → hiện nhãn "đang nguội" trên phễu; khi có thao tác (chuyển bước / đánh mất / **đã hẹn việc-kế-tiếp trong tương lai**) → nhãn biến mất.
- **P3:** Dán danh sách N người → hệ thống hiện xem trước "tạo X, bỏ trùng Y, lỗi Z (dòng nào, vì sao)"; xác nhận → tạo đúng số cơ hội mới, gắn đúng nguồn; trùng số điện thoại (đã có cơ hội đang mở, hoặc trùng trong file) bị bỏ.
- **P4:** Đặt việc cần làm + ngày hẹn trên một cơ hội → đến hạn thấy ở màn hình đầu ca của đúng người phụ trách; cơ hội đã nhập học/đã mất **không** hiện nhắc.

> Mỗi phase phân biệt rõ 2 tầng: **(a) Nghiệm thu tính năng** — demo được ngay, dùng làm điều kiện chấp nhận/merge; **(b) Chỉ số kết quả nghiệp vụ** — đo sau ~4 tuần, phụ thuộc thói quen người dùng, chỉ để theo dõi, **không chặn sign-off**.

## 5. Ranh giới an toàn

- **P2 KHÔNG đụng vào luồng học phí** (vùng nhạy cảm nhất, đã nghiệm thu "đúng số học"). Chỉ ghi mốc đổi bước ở quy trình phễu bình thường. → xóa bỏ rủi ro lớn nhất. (Red-team đã kiểm code: mọi cửa đổi bước O1→O4 đi qua một chỗ dùng chung, không sót.)
  - Hệ quả nghiệp vụ chấp nhận có chủ đích: học viên **vừa bị hủy phiếu học phí** (quay lại phễu) sẽ hiện "đang nguội" ngay — đúng thực tế vì đây là lead cần chăm gấp nhất.
- **P2 và P4 phối hợp, không đá nhau:** cơ hội đã có **việc-kế-tiếp hẹn ở tương lai** thì KHÔNG bị coi là "đang nguội" (tránh báo động giả khi tư vấn viên đang chăm đúng cách). P4 (làm sau) chịu trách nhiệm cập nhật điều kiện này cho P2.
- **Mỗi tính năng làm & nghiệm thu độc lập** rồi mới sang tính năng sau (không gộp; chi tiết quy trình kỹ thuật ở §11).
- **Không dựng khung thông báo/tác vụ tổng quát**, không thư viện biểu đồ mới, không bảng lịch sử đổi bước — chỉ thêm đúng thứ mỗi tính năng cần (KISS/YAGNI).
- P4 nhắc việc **chỉ hiện trong ứng dụng** (không gửi email — kênh email qua M365 đang tạm tắt cùng Entra SSO).

## 6. Phases

| # | File | Trạng thái | Có đổi dữ liệu? | Rủi ro |
|---|---|---|---|---|
| 01 — P1 Báo cáo | `phase-01-bao-cao-tuyen-sinh.md` | in-progress | Không | Rất thấp (chỉ đọc) |
| 02 — P2 Cảnh báo nguội | `phase-02-canh-bao-nguoi.md` | pending | 1 cột (mốc đổi bước) | Thấp (không đụng học phí) |
| 03 — P3 Nhập hàng loạt | `phase-03-nhap-lead-hang-loat.md` | pending | Không (thêm logic tạo lead theo lô) | Trung bình (dữ liệu vào nhiều + chống trùng mới) |
| 04 — P4 Nhắc việc | `phase-04-nhac-viec.md` | pending | 2 cột (việc + ngày hẹn) | Thấp |

**Thứ tự vs phụ thuộc:** phần lớn là **thứ tự thực thi đã chốt**, không phải phụ thuộc chức năng. P2 và P3 độc lập (không cần P1). Ngoại lệ: **P4 phụ thuộc chức năng P2** cho đúng 1 tiêu chí nghiệm thu ("cơ hội có việc-kế-tiếp tương lai không bị gắn nhãn nguội" chỉ demo được khi P2 đã có). P1 đứng đầu vì tạo số liệu nền + an toàn, không phải vì các phase sau bị chặn kỹ thuật.

## 7. Chuẩn bị nghiệm thu & vận hành (đừng bỏ sót)

- **P1:** chuẩn bị **dữ liệu mẫu đa dạng** trong môi trường demo (đủ loại nguồn/lý do mất) để buổi nghiệm thu thấy số thật, không phải màn trống.
- **P3:** cung cấp **mẫu danh sách + hướng dẫn cột** cho tư vấn viên.
- **P2/P4:** cần **đào tạo ngắn cho tư vấn viên** (đầu ca xem nhắc việc + cảnh báo nguội) — đây là điều kiện tiên quyết để đạt chỉ số kết quả nghiệp vụ ở tầng (b).

## 8. Tiêu chí chấp nhận toàn plan (mức nghiệp vụ)

- Mỗi tính năng phải chạy qua bộ kiểm thử tự động và **không làm hỏng các luồng đã nghiệm thu** (đóng học phí→nhập học, phễu, chăm sóc sau bán).
- Việc tách dữ liệu theo từng cơ sở được giữ nguyên trên mọi màn hình/thao tác mới.
- (Chi tiết cổng kiểm thử kỹ thuật: xem §11.)

## 9. Chủ động KHÔNG làm (chống FOMO — xác nhận bởi advisor + brainstorm + red-team)

Chấm điểm khách hàng bằng AI · mua/enrich dữ liệu ngoài (vi phạm quyền riêng tư học đường) · học phí trả góp kiểu subscription · engine trường tùy biến động · marketing automation/gửi email hàng loạt · đa tiền tệ · phễu cấu hình đa nhánh · engine chia lead tự động phức tạp · khung thông báo/tác vụ tổng quát · bảng lịch sử đổi bước · thư viện biểu đồ mới · chạy-nền quét định kỳ cho P2 (tính trực tiếp khi mở màn hình là đủ). Chi tiết + lý do: `plans/reports/research-260808-2046-crm-benchmark-cmc-vs-odoo-trycomp.md` (Tier B/C).

## 10. Việc cần làm sau khi merge P1

Xếp lịch **UAT với người dùng thật** (GĐKD) dùng chính màn hình Báo cáo làm điểm bắt đầu — theo AGENTS.md, UAT người thật đang quan trọng hơn tính năng mới. Đừng để trôi.

---

## 11. Phụ lục kỹ thuật cho người triển khai

- **Cổng CI (bắt buộc):** mỗi tính năng = 1 PR riêng, không gộp; phải xanh `typecheck-and-test` VÀ `ui-e2e` (cả hai required trên `main`), merge xong mới sang phase sau. Mỗi phase bổ sung 1 journey ui-e2e, phản ánh proven trong `pnpm acceptance:report`.
- **Không hồi quy MỌI journey đã proven tính đến phase hiện tại** — gồm cả journey do phase trước thêm, không cố định ở con số 3. Nền: `crm-receipt` (verified-correct), `crm-opportunity-lost`, `aftersale-case-lifecycle`. Lưu ý: khi P4 sửa điều kiện "nguội", `crm-rotting` (do P2 thêm) là journey rủi-ro-hồi-quy cao nhất — phải chạy lại.
- **Trước khi sửa `pipeline.tsx`/`cockpit.tsx`:** grep selector mà journey cũ đang bám; thêm phần tử mới bằng `data-testid` riêng, KHÔNG đổi cấu trúc cũ.
- **GitNexus (CLAUDE.md):** `impact(...)` trước khi sửa mỗi symbol; `detect_changes({scope:"compare", base_ref:"main"})` trước commit; cảnh báo nếu HIGH/CRITICAL. Dán kết quả vào PR description.
- **Kiểm thử phụ thuộc thời gian (P2/P4):** không mock clock. Dùng **seed lùi ngày ở tầng DB** để test "nhãn biến mất/đến hạn"; ngưỡng qua env chỉ đủ chứng minh "nhãn xuất hiện". Pin rõ toán tử biên (nguội khi *tuổi > ngưỡng*, tức `stageChangedAt < now - ngưỡng`).
- **RLS:** mọi truy vấn/aggregate chạy trong `withFacility`; nếu dùng SQL thô thì tự thêm `facilityId`. Lọc own-only (KPI theo người của sale) là **logic tầng thủ tục**, registry chỉ mở cửa vai trò.
- RLS `facilityId` giữ nguyên trên mọi bảng/thao tác mới.

## Nguồn phân tích

- Nghiên cứu benchmark: `plans/reports/research-260808-2046-crm-benchmark-cmc-vs-odoo-trycomp.md`
- Xác nhận nền + advisory (advisor, brainstormer) + red-team #1 (correctness/an-toàn + scope/nhất-quán): kết quả đã tích hợp vào các file phase.
- Báo cáo tiến độ/validation: `plans/260808-2217-crm-followup-and-analytics/reports/`
