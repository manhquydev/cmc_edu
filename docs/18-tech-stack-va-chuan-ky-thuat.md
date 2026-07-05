# Tài liệu 18 — Tech Stack & Chuẩn Kỹ thuật (v2)

> Ngăn xếp công nghệ + chuẩn code + cấu trúc repo, để dev/agent build đúng nền. Version bám thật
> từ `package.json` repo (2026-07-05). Đây là "technical doc" nền cho toàn dự án.

---

## 1. Ngăn xếp (đúng version repo)

| Tầng | Công nghệ | Version | Ghi chú |
|---|---|---|---|
| **Monorepo** | pnpm workspaces + Turborepo | pnpm 10.24 · turbo 2.3 | Node **≥22**, ESM |
| **Ngôn ngữ** | TypeScript | 5.7 | strict; type-safe end-to-end |
| **Frontend** | **Vite + React + react-router-dom** | Vite 6 · React 19 · router 7 | **SPA, KHÔNG Next.js**; path-based routing (ADR 0016) |
| **UI** | Mantine + CSS custom properties | Mantine 7.15 | tokens `@cmc/ui` (TL12) |
| **API** | tRPC + zod | tRPC 11 · zod 3 | hợp đồng FE↔BE (TL11) |
| **DB / ORM** | PostgreSQL + Prisma | Prisma 6 | RLS theo `facilityId` |
| **Auth** | Microsoft Entra SSO (`@azure/msal-node`) | msal 2.16 | staff SSO; LMS phone/OTP |
| **Email** | MS Graph + Brevo | — | transactional outbox |
| **Test** | Vitest + Playwright | vitest 2.1 · playwright 1.49 | unit/integration + e2e |
| **CI/CD** | Jenkins (kế hoạch) | — | pipeline: typecheck→test→verify-RLS→build (DEBT) |
| **Infra** | VPS + Cloudflare | — | Full TLS, origin self-signed (ADR 0029) |
| **Object store** | MinIO/S3 (kế hoạch) | — | blob + backup off-box (trả nợ TL3) |

## 2. Packages (workspace `packages/*`)

| Package | Vai trò |
|---|---|
| `@cmc/auth` | **Permission registry** (`can()`, `requirePermission`) — nguồn phân quyền duy nhất |
| `@cmc/ui` | Design system: tokens, primitive component (TL12) |
| `@cmc/db` | Prisma schema, seed, migration |
| `domain-academic` · `domain-finance` · `domain-grading` · `domain-payroll` · `domain-rewards` | Logic nghiệp vụ thuần (nơi bồi unit test) |
| `audit` | Nhật ký kiểm toán (nền SoD + agent oversight) |

## 3. Cấu trúc repo

```
apps/
  admin/   → ERP SPA (Vite+React, react-router) — 4 vai trò + IT
  lms/     → LMS SPA — phụ huynh/học sinh
  api/     → tRPC server (routers = miền)
  e2e/     → Playwright
packages/  → auth · ui · db · domain-* · audit
docs/      → tài liệu (bộ TL00–TL18)
```

## 4. Tầng AI (v2 — mới)

| Thành phần | Công nghệ |
|---|---|
| Tool layer | **MCP server** bọc tRPC procedure (TL13) |
| Orchestration | Supervisor + Worker agents |
| LLM | **Provider-agnostic** (`LLMClient`): Claude / OpenAI qua API; phân tầng model (TL13 §2) |
| Guardrail | Che PII/dữ liệu trẻ trước khi gửi LLM ngoài (TL08 §7, TL13 §5) |

## 5. Chuẩn code

- **Lint/format:** ESLint 9 + Prettier 3; TypeScript strict; ESM (`type: module`).
- **Phân quyền:** luôn `requirePermission`/`can()` — **không hardcode role array** (nợ TL3).
- **Procedure:** đặt tên `module.action`; input `zod`; lỗi dùng 5 mã `TRPCError` (TL11).
- **Nguồn sự thật đơn:** RBAC (`@cmc/auth`), glossary (TL07), IA (ADR-C) — nơi khác trỏ về.
- **Test:** hàm tiền/lương bồi unit trong `domain-*`; RLS/flow integration; critical path e2e.
- **ADR:** mọi quyết định kiến trúc/nghiệp vụ có ADR (docs/decisions), sửa số trùng `0032`.

## 6. ⚠️ Quyết định frontend v2 cần chốt

TL06 (URL/routing) trước đây map sang **Next.js App Router** — nhưng stack thật là **Vite +
react-router-dom v7** (không có Next.js). Hai lựa chọn cho v2:
- **(a) Giữ Vite + react-router v7** (khuyến nghị — liên tục với v1, ít rủi ro): URL grammar TL06
  §1–6 vẫn nguyên; chỉ triển khai bằng route config react-router (đã sửa TL06 §7).
- **(b) Chuyển Next.js** (nếu cần SSR/SEO): thay đổi lớn hơn; cân nhắc sau.

→ Mặc định **(a)**. URL grammar (path-based, `/students/:id`, query cho view-state) **độc lập
framework** nên không đổi dù chọn hướng nào.

> Liên kết: TL09 (C4) · TL11 (API) · TL12 (design) · TL13 (AI) · TL06 (routing) · TL03 (nợ hạ tầng).
