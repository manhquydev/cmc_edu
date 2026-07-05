# Tài liệu 09 — Kiến trúc C4 (v2, có tầng AI Agent)

> Bức tranh kiến trúc chuẩn **C4** (Context → Container → Component) cho bản viết lại v2. Đặt sẵn
> tầng agent + MCP từ đầu (AI-native), nhưng giữ nguyên các bất biến v1 (TL1).
> Bám ADR `0001` (stack) + TL4 (agent) + TL05 (miền năng lực).

---

## 1. C4 — Mức 1: Context (ai dùng, hệ nối gì)

```mermaid
flowchart TB
    STAFF["👤 Nhân sự<br/>(sale, GV, giám đốc, kế toán, IT)"]
    PARENT["👨‍👩‍👧 Phụ huynh / Học sinh"]
    AGENT["🤖 AI Agents<br/>(admissions, finance, ops, comms, teacher-assist)"]

    SYS["🏫 CMC EDU Platform (v2)"]

    SSO["Microsoft Entra (SSO)"]
    GRAPH["MS Graph (email nội bộ)"]
    BREVO["Brevo (email ngoài)"]
    ZALO["Zalo (comms — tương lai)"]
    OBJ["Object Store (backup, blob)"]

    STAFF --> SYS
    PARENT --> SYS
    AGENT --> SYS
    SYS --> SSO & GRAPH & BREVO & ZALO & OBJ

    classDef p fill:#E3F2FD,stroke:#1565C0,color:#0D47A1;
    classDef a fill:#EDE7F6,stroke:#5E35B1,color:#311B92;
    classDef s fill:#ECEFF1,stroke:#455A64,color:#263238;
    class STAFF,PARENT p; class AGENT a; class SSO,GRAPH,BREVO,ZALO,OBJ s;
```

## 2. C4 — Mức 2: Container (các khối triển khai)

```mermaid
flowchart TB
    subgraph CLIENT["Client"]
        ADMIN["Admin SPA<br/>(Vite + React + react-router)<br/>path-based routing (TL6/TL18)"]
        LMS["LMS SPA<br/>(phụ huynh/học sinh)"]
    end

    subgraph SERVER["Server"]
        API["API (tRPC)<br/>permission gate + RLS + audit"]
        MCP["MCP Tool Server<br/>bọc tRPC procedures thành tool"]
        ORCH["Agent Orchestrator<br/>(Supervisor + Workers)"]
        OUTBOX["Outbox Worker<br/>(email relay, idempotent)"]
        RECON["Reconciliation Worker (HOTL)"]
    end

    DB[("Postgres<br/>+ RLS + audit")]
    BLOB[("Object Store")]

    ADMIN --> API
    LMS --> API
    ORCH --> MCP --> API
    API --> DB
    API --> OUTBOX --> DB
    RECON --> API
    API --> BLOB

    classDef c fill:#E3F2FD,stroke:#1565C0,color:#0D47A1;
    classDef s fill:#FFF3E0,stroke:#EF6C00,color:#E65100;
    classDef a fill:#EDE7F6,stroke:#5E35B1,color:#311B92;
    classDef d fill:#ECEFF1,stroke:#455A64,color:#263238;
    class ADMIN,LMS c; class API,OUTBOX s; class MCP,ORCH,RECON a; class DB,BLOB d;
```

**Điểm mấu chốt:** agent KHÔNG có đường tắt tới DB — chúng đi qua **MCP → tRPC API**, chịu đúng
permission/RLS/audit như người (TL4 §4). Đây là điều giữ hệ an toàn khi thêm AI.

## 3. C4 — Mức 3: Component (bên trong API, theo miền)

```mermaid
flowchart LR
    subgraph API["API (tRPC routers = component)"]
        direction TB
        A1["Academic<br/>(class, schedule, attendance,<br/>assessment, grade)"]
        A2["CRM<br/>(opportunity, contact, aftersale)"]
        A3["Finance<br/>(receipt, refund, provisioning)"]
        A4["HR/Payroll<br/>(payslip, punch, shift, kpi)"]
        A5["Identity<br/>(user, student, guardian, facility)"]
        A6["Engagement<br/>(email, notif, badge, meeting)"]
        A7["Platform<br/>(auth, audit, dashboard, search)"]
    end
    AUTH["@cmc/auth<br/>(permission registry — nguồn sự thật)"]
    A1 & A2 & A3 & A4 & A5 & A6 --> AUTH
    A7 --> AUTH

    classDef m fill:#E8F5E9,stroke:#2E7D32,color:#1B5E20;
    classDef auth fill:#FFF8E1,stroke:#F9A825,color:#F57F17;
    class A1,A2,A3,A4,A5,A6,A7 m; class AUTH auth;
```

## 4. Quyết định kiến trúc chốt cho v2

| # | Quyết định | Lý do |
|---|---|---|
| K1 | Monorepo: `apps/admin`, `apps/lms`, `apps/api`, `packages/*` | Giữ mô hình v1 đã hiệu quả |
| K2 | tRPC là hợp đồng FE↔BE duy nhất | Type-safe end-to-end; là "API contract" cho test |
| K3 | Permission registry tập trung (`@cmc/auth`) | Route + agent + UI dùng chung `can()` — chống drift (nợ TL3) |
| K4 | RLS `facilityId` ở tầng DB | Cô lập cơ sở không phụ thuộc app-code |
| K5 | **MCP Tool Server** bọc tRPC | Agent dùng đúng procedure có gate — không mở mặt tấn công |
| K6 | Outbox cho mọi side-effect (email, event) | Đảm bảo gửi ít nhất một lần; consumer idempotent |
| K7 | **Provisioning tách khỏi transaction tiền** (idempotent) | Trả nợ TL3 §A: lỗi provisioning không rollback tiền |
| K8 | Object store cho blob + backup off-box | Trả nợ TL3 §I (bền vững) |
| K9 | Cột `oversightMode` + audit sẵn cho agent | AI-native từ đầu, bật tự chủ dần |

## 5. Luồng dữ liệu tiêu biểu (ghi danh)

`Sale (Admin SPA)` → `crm.opportunity` → nút "Tạo phiếu thu từ cơ hội" →
`finance.receipts/new?opportunityId=` → `finance.receiptApprove` (cổng tiền) →
[transaction tiền: đăng tiền + auto-O5] → [bước idempotent: provisioning student/parent] →
`Outbox` → email PH. Reconciliation worker (HOTL) đọc audit, gắn cờ bất thường → URL sâu tới người.

## 6. Không gồm (out of scope kiến trúc)

- Harness AI-dev của bạn (`HARNESS_*`, ClaudeKit) — công cụ phát triển, không phải runtime sản phẩm.
- Callio/Zalo là tích hợp tương lai, đặt sau interface, chưa phải lõi.

> Liên kết: TL05 (miền) · TL4 (agent chi tiết) · TL6 (routing) · TL10 (data model) · TL1 (bất biến).
