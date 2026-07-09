# Tài liệu 17 — Liên kết Vai trò & Luồng nghiệp vụ (mô hình 4 vai trò v2)

> Bản viết lại theo mô hình vai trò v2 (ADR-D) và các bất biến đã chuẩn hoá. Thay thế bản cũ
> (viết trước khi đọc sâu repo — còn role "Học vụ/Admin" và luồng tạo tài khoản tay, nay đã bỏ).
> Vai trò v2: **GĐKD (quản lý sale) · GĐĐT (quản lý giáo viên) · Sale · Giáo viên · IT**; LMS =
> phụ huynh/học sinh. Nguồn vai trò: TL14. Quyết định: TL16.

---

## 1. Bản đồ vai trò v2 (gọn)

| Vai trò | App | Việc lõi (phần con người thật sự cần) | Quản lý bởi |
|---|---|---|---|
| **Sale** | ERP | Tư vấn, chốt, tạo phiếu thu **nháp** | GĐKD |
| **Giáo viên** | ERP | Dạy, điểm danh, chấm bài, **nhận xét học sinh** | GĐĐT |
| **GĐ Kinh doanh** | ERP | **Duyệt cổng tiền**, xem doanh thu, xử ngoại lệ KD | — (gốc) |
| **GĐ Đào tạo** | ERP | Duyệt lịch/ca, tạo lớp, mắt-thứ-hai duyệt tiền vượt ngưỡng | — (gốc) |
| **IT (super_admin)** | ERP | Cấu hình cơ sở/IP/ca, người dùng | — |
| **Phụ huynh / Học sinh** | LMS | Xem lịch, kết quả, bài tập | — |

`cskh`, `ctv_mkt`, `ke_toan`, `hr`: tạm gác (ADR-D). Từ amendment 2026-07-08 (commit `57ee539`),
việc gác được **enforce bằng code**: 0 quyền trong registry, `user.updateRoles` reject, UI không
hiển thị, invariant test khoá — không chỉ là quy ước tài liệu. "Quản lý" = quan hệ `managerId`,
không phải role.

---

## 2. Luồng lõi 1 — Tuyển sinh → Sinh tài khoản (provisioning TỰ ĐỘNG)

Sale → GĐKD (cổng tiền) → **hệ thống tự sinh tài khoản** → phụ huynh. Nguồn: QĐ 0024, 0033, 0037.
Con người chỉ **xem & duyệt**, không đi tạo tài khoản tay.

```mermaid
flowchart TD
    subgraph SALE["🧑‍💼 Sale"]
        A1["Cơ hội O1→O4 (tư vấn, học thử)"] --> A2["Chốt → nút 'Tạo phiếu thu từ cơ hội'<br/>điền sẵn từ Opportunity (0037)"]
        A2 --> A3["Phiếu thu NHÁP (opportunityId tự gắn)"]
    end
    subgraph GD["✅ GĐ Kinh doanh — CỔNG TIỀN"]
        B1{receiptApprove?}
        B1 -->|Vượt ngưỡng| B2["Cần mắt-thứ-hai: GĐĐT (ADR-B)"]
        B1 -->|Từ chối| B3["Trả lại điều chỉnh"]
    end
    subgraph SYS["⚙️ Hệ thống (tự động, trong/kề transaction tiền)"]
        C1["Opp → O5_ENROLLED + closedAt"] --> C2["Provision ParentAccount (phone 84xxx)<br/>+ StudentAccount + Guardian (0033)"]
        C2 --> C3["Enrollment → active (từ reserved)"]
        C3 --> C4["Gửi email PH (outbox)"]
    end
    subgraph PH["👨‍👩‍👧 Phụ huynh (LMS)"]
        D1["Đăng nhập: SĐT + OTP/mật khẩu"] --> D2["Chọn con → xem lịch/kết quả"]
    end
    A3 --> B1
    B2 --> C1
    B1 -->|Duyệt| C1
    B3 --> A3
    C4 --> D1
    classDef s fill:#E3F2FD,stroke:#1565C0,color:#0D47A1;
    classDef g fill:#E8F5E9,stroke:#2E7D32,color:#1B5E20;
    classDef y fill:#ECEFF1,stroke:#455A64,color:#263238;
    classDef p fill:#FCE4EC,stroke:#AD1457,color:#880E4F;
    class A1,A2,A3 s; class B1,B2,B3 g; class C1,C2,C3,C4 y; class D1,D2 p;
```

**Điểm mấu chốt:** không có role "Học vụ" tạo tài khoản tay — provisioning **tự động** khi GĐKD duyệt
phiếu (con người chỉ duyệt). `reserved`→`active` do Receipt lái (ADR-A).

---

## 3. Luồng lõi 2 — Vận hành lớp (Giáo viên là trung tâm)

```mermaid
flowchart LR
    A["GĐĐT tạo lớp<br/>(class.create)"] --> B["Hệ thống TỰ sinh buổi học<br/>(đủ ngày+slot)"]
    B --> C["Giáo viên: điểm danh<br/>(gate trên enrollment active)"]
    C --> D["Giáo viên: chấm bài + nhận xét<br/>(agent soạn nháp → GV chốt)"]
    D --> E["Ảnh lớp/kết quả → PH (LMS)"]
    classDef t fill:#E3F2FD,stroke:#1565C0,color:#0D47A1;
    class A,B,C,D,E t;
```

Con người cần: **giáo viên dạy, điểm danh, nhận xét**. Máy lo: sinh buổi học, gửi kết quả. AI: soạn
nháp nhận xét (GV chốt — dữ liệu trẻ, TL08 §7).

---

## 4. Luồng lõi 3 — Duyệt ca (managerId, không role "quản lý")

```mermaid
flowchart LR
    A["Nhân viên tạo phiếu ca<br/>(ticket-lock 1 phiếu)"] --> B{"Người duyệt = managerId"}
    B -->|sale| C["GĐKD duyệt"]
    B -->|giáo viên| D["GĐĐT duyệt"]
    B -.->|fallback| E["super_admin"]
    C & D --> F["Chốt (chống tự-duyệt, QĐ 0027)"]
    classDef x fill:#FFF8E1,stroke:#F9A825,color:#F57F17;
    class A,B,C,D,E,F x;
```

Cấp trên–cấp dưới theo `managerId`: sale→GĐKD, giáo viên→GĐĐT. Không có role `quan_ly`.

---

## 5. Ma trận tương tác vai trò (tóm tắt bàn giao)

| Từ | Bàn giao | Tới | Qua cổng |
|---|---|---|---|
| Sale | Phiếu thu nháp (gắn opp) | GĐKD | `receiptApprove` |
| GĐKD | Kích hoạt provisioning (tự động) | Hệ thống → PH | `receiptApprove` |
| GĐĐT | Tạo lớp → auto sinh buổi | Giáo viên | `class.create` |
| Giáo viên | Điểm danh/nhận xét | PH (LMS) | `attendance/assessment` |
| Nhân viên | Phiếu ca | managerId (GĐKD/GĐĐT) | `shiftRegistration.approve` |

> Liên kết: TL14 (vai trò) · TL16 (ADR) · TL01 (bất biến) · TL04/13 (agent) · TL06 (URL escalate).
