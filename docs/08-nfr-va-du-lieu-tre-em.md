# Tài liệu 08 — Yêu cầu Phi chức năng (NFR) & Ràng buộc Dữ liệu Trẻ em

> Gom các ràng buộc chất lượng đang nằm rải trong decisions thành một nơi. Đây là "luật nền" mọi
> tính năng phải tuân, và là cột đánh giá ở cổng "Sẵn sàng Build" (TL00 §5).
> Đặc biệt: dữ liệu trẻ 3–11 tuổi có ràng buộc riêng — mục §7.

---

## 1. Hiệu năng (Performance)

| Chỉ tiêu | Mục tiêu | Ghi chú |
|---|---|---|
| Thời gian tải trang list (p95) | < 1.5s | prefetch route + streaming skeleton |
| Thao tác ghi (duyệt phiếu, điểm danh) p95 | < 800ms | transaction tiền phải gọn (TL3 §A) |
| Sinh session khi tạo lớp | < 2s cho 1 học kỳ | trong transaction tạo lớp |
| Trang chi tiết (student/receipt) p95 | < 1s | tab nạp lười theo sub-route |

## 2. Sẵn sàng & Bền vững (Availability & Durability) — **nợ TL3 phải trả khi rewrite**

| Yêu cầu | Chuẩn v2 |
|---|---|
| Backup DB | **Off-box** (S3/object-store), tự động sau mỗi lần; test restore định kỳ. KHÔNG chỉ để trên VPS. |
| Blob (PDF, ảnh check-in) | Object store có replication/backup, KHÔNG local-disk. |
| Mất mát cho phép (RPO) | ≤ 24h giai đoạn đầu, tiến tới ≤ 1h |
| Phục hồi (RTO) | ≤ 4h |
| Idempotency | Mọi consumer (email, agent) idempotent — chạy lại không nhân đôi hệ quả. |

## 3. Bảo mật (Security)

| Yêu cầu | Chuẩn |
|---|---|
| Phân quyền | RBAC registry tập trung `module→action→Role[]`; **không hardcode role array ở client** (nợ TL3). Route + gate là một (`can()`). |
| Cô lập dữ liệu | RLS theo `facilityId` trên mọi query nghiệp vụ. |
| PII nhạy cảm (CCCD, số TK) | **Mã hoá cột** khi lưu (v2 trả nợ QĐ 0026); mask khi đọc; audit ghi tên field. |
| Đăng nhập | Staff = SSO (password break-glass); PH/HS = phone/OTP (QĐ 0031, 0033). |
| Cổng tiền | SoD + compensating control (ngưỡng duyệt, review tháng, Reconciliation agent HOTL). |
| Secrets | Trong secret manager, không trong repo/.env commit. |

## 4. Kiểm toán & Truy vết (Auditability)

- Mọi hành động ghi/duyệt (kể cả agent) vào **audit trail**: ai/agent nào, khi nào, làm gì, bản ghi nào.
- Phiếu "tạo & tự duyệt" phải audit nổi bật (compensating control SoD).
- Sổ tiền (receipt/refund) append-only; sửa = thêm dòng, không update/delete.

## 5. Khả dụng & Trải nghiệm (Usability)

- Task-first, kết quả hiển thị, progressive disclosure, một cửa, ngôn ngữ người dùng (TL2).
- Deep-link cold-start được (TL6).
- i18n: tiếng Việt là chính; chuỗi tách khỏi code.

## 6. Khả năng bảo trì & Kiểm thử (Maintainability)

| Yêu cầu | Chuẩn |
|---|---|
| Nguồn sự thật đơn | RBAC, workflow-mode, glossary mỗi thứ 1 nơi; nơi khác trỏ về. |
| Test pyramid | Bồi đáy unit cho hàm tiền (KPI/lương/phạt); integration cho RLS/flow; e2e critical path. Coverage target đặt theo module. |
| ADR | Mọi quyết định kiến trúc/nghiệp vụ có ADR; sửa số trùng (`0032`). |
| CI gate | Typecheck + test + verify-RLS chặn merge (dựng Jenkins theo DEBT). |

## 7. ⚠️ Ràng buộc Dữ liệu Trẻ em (3–11 tuổi) — bắt buộc

Doanh nghiệp phục vụ trẻ nhỏ; đây là ràng buộc *cứng*, không phải khuyến nghị:

- **Tối thiểu hoá dữ liệu:** chỉ thu thập dữ liệu trẻ thực sự cần cho vận hành học tập. Không thu
  thừa; không dùng dữ liệu trẻ cho mục đích ngoài giáo dục.
- **Đồng thuận của phụ huynh:** dữ liệu/ảnh của trẻ (vd `SessionEvidencePhoto`, ảnh lớp gửi PH) gắn
  với người giám hộ; cần cơ chế đồng thuận & thu hồi đồng thuận.
- **Quyền truy cập hẹp:** ảnh/nhận xét/hồ sơ trẻ chỉ mở cho vai trò có nhu cầu (GV lớp, giám đốc,
  PH của chính trẻ). Không mở rộng mặc định.
- **AI không tự quyết về trẻ:** agent chỉ *soạn nháp* nhận xét/đánh giá; **GV/con người chốt**
  (TL4 §6). Không auto-gửi nội dung đánh giá trẻ mà không người duyệt.
- **An toàn (safeguarding):** tình huống liên quan an toàn trẻ luôn là HITL/người; không tự động hoá.
- **Lưu trữ & xoá:** chính sách retention rõ ràng cho dữ liệu trẻ; xoá được khi hết mục đích/hết
  quan hệ học tập.
- **Nhật ký truy cập dữ liệu trẻ:** truy cập ảnh/hồ sơ trẻ nên được audit để phát hiện lạm dụng.

## 8. Cách dùng NFR này

Mỗi tính năng ở cổng DoR (TL00 §5) phải trả lời: đạt performance target nào; có chạm PII/dữ liệu
trẻ không (nếu có → áp §7); có rollback cho luồng tiền không; có audit không; có test phủ không.

> Liên kết: TL1 (bất biến) · TL3 (nợ cần trả) · TL4 (ranh giới AI) · TL00 (cổng DoR).
