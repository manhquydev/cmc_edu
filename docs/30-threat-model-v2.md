# Tài liệu 30 — Threat Model v2 (G5, STRIDE)

> Mô hình mối đe doạ cho hệ chạm **tiền** và **dữ liệu trẻ em** — hai tài sản nhạy nhất — cộng auth và
> tầng AI agent. Dùng STRIDE; mỗi mối đe doạ gắn giảm thiểu + ADR/NFR đã có. Đây là G5.

---

## 1. Tài sản & ranh giới tin cậy

**Tài sản:** (1) **Tiền** — receipt/refund/payroll; (2) **Dữ liệu trẻ** — PII HS, ảnh lớp, nhận xét;
(3) **Auth/phiên** — SSO staff, OTP phụ huynh; (4) **Audit** — nhật ký chống chối bỏ.
**Ranh giới:** client↔API (tRPC gate) · API↔DB (RLS) · API↔LLM ngoài (che PII) · người↔agent (MCP gate).

## 2. STRIDE — mối đe doạ & giảm thiểu

### Spoofing (giả danh)
| T | Đe doạ | Giảm thiểu |
|---|---|---|
| T1 | **Giả IP để chấm công** ngoài công ty (ADR0039 dựa IP) | Tin `x-forwarded-for` chỉ từ proxy tin cậy; log ip+method; phiếu thủ công cần manager duyệt |
| T2 | Giả phiên PH/OTP | OTP 6 số hết hạn ngắn; rate-limit; SSO staff qua Entra |
| T3 | Giả danh agent gọi tool | Agent là principal có credential riêng; MCP qua gate; không tool ngoài registry |

### Tampering (sửa trái phép)
| T4 | Sửa `netAmount`/refund vượt cap | netAmount đóng băng (QĐ0028); `SUM(refund) ≤ netAmount` `FOR UPDATE`; sổ append-only |
| T5 | Sửa `annotationLayer`/điểm bài của HS khác | RLS + quyền; unique `[exercise,student]`; chấm chỉ GV |
| T6 | Sửa/xoá audit | Audit append-only; không API xoá |

### Repudiation (chối bỏ)
| T7 | "Tôi không duyệt phiếu đó" | Audit ghi ai/agent-khi-gì-bản ghi nào; kể cả tạo & tự-duyệt |
| T8 | Agent hành động không dấu vết | Mọi lượt agent audit (prompt version, model, tool) — TL13 |

### Information Disclosure (lộ thông tin) — **trọng tâm dữ liệu trẻ**
| T9 | **Lộ PII/ảnh trẻ ra LLM ngoài** | Che/token hoá PII trước khi gửi; không gửi ảnh trẻ; ưu tiên model nội bộ (TL08§7, TL13§5) |
| T10 | PH thấy dữ liệu con nhầm | GuardianLinkRequest phải `approved` mới thấy (WF-P1-06); RLS |
| T11 | `internalNote` lộ ra PH | Chỉ `summary`+ảnh publish; internalNote không expose (WF-P2-08) |
| T12 | Rò chéo cơ sở | RLS theo `facilityId`; facilityId suy server-side (không tin client) |
| T13 | PII plaintext (CCCD/số TK) | **Mã hoá cột** v2 (trả nợ QĐ0026); mask khi đọc; audit field |

### Denial of Service
| T14 | Spam OTP/chấm công/redeem | Rate-limit + cooldown (đã có ở check-in); backoff |
| T15 | Agent/LLM quá tải/chi phí | Token budget, circuit breaker, hàng đợi (TL13§6) |

### Elevation of Privilege (leo thang)
| T16 | **Role-array hardcode client** → bỏ gate | Gate server `requirePermission`; client chỉ hiển thị (trả nợ TL03) |
| T17 | Agent vượt quyền (tự duyệt tiền) | Agent quyền hẹp; **không** có `receiptApprove` (TL14§6); recon chỉ đọc |
| T18 | **Prompt injection** từ nội dung ngoài (tin nhắn lead, email PH) điều khiển agent | Nội dung ngoài là DỮ LIỆU không phải lệnh; tách trong prompt; validate output (TL13§8) |
| T19 | Sale tự duyệt phiếu (SoD) | Người tạo ≠ người duyệt; ngưỡng → GĐĐT; recon HOTL (ADR-B) |
| T20 | Tự duyệt ca/chấm công | `assertAssignedApprover`; không tự duyệt (QĐ0027, ADR0039/0040) |

## 3. Ưu tiên xử lý (rủi ro cao trước)

**Cao (làm ở P0–P1):** T4/T19 (toàn vẹn tiền + SoD), T9/T13 (lộ dữ liệu trẻ/PII), T16 (RBAC drift),
T12 (RLS). **Trung:** T1 (IP spoof), T18 (prompt injection), T10/T11 (dữ liệu trẻ nhầm). **Thấp:** T14/T15.

## 4. Liên hệ với thiết kế đã có

Phần lớn giảm thiểu **đã nằm trong ADR/NFR**: SoD (ADR-B), provisioning atomic (0041), netAmount
(QĐ0028), RLS/mã hoá PII (TL08§3), agent guardrail + che PII (TL13§5,§8), audit (TL08§4). Threat model
này **gom lại theo góc tấn công** để đội build không bỏ sót khi hiện thực.

## 5. Việc kiểm chứng

Mỗi mối đe doạ cao có **test âm tính** (§4 TL29): vượt-rào phải thất bại. Threat model rà lại mỗi khi
thêm tính năng chạm tiền/dữ liệu trẻ/agent (cổng DoR).

> Liên kết: TL08 (NFR/dữ liệu trẻ) · TL13 (agent guardrail) · TL16/22 (ADR) · TL03 (nợ bảo mật) · TL29 (test âm tính).
