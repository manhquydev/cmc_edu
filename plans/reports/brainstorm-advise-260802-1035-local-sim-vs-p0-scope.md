---
title: "Local-sim vs prod-on-machine + P0 scope (brainstorm/advise draft)"
date: 2026-08-02
time: "10:35"
type: report
status: awaiting-user-confirm
skills: [ak-brainstorm, ak-advise, ak-research, ak-devops]
---

# Brainstorm + Advise draft: local-sim, public repo, P0 scope

## Scout verified (2026-08-02)

| Fact | Evidence |
|------|----------|
| Stack project name | `cmcv2-prod` |
| Compose files **actually loaded** | `docker-compose.prod.yml` **+** `infra/compose.local-sim.yml` |
| Services up | nginx, api, worker, admin, lms, postgres (healthy) |
| Host ports open | `0.0.0.0:80,443,3000,5432` (not localhost-only) |
| API process user | empty/`root` (no USER in Dockerfiles) |
| CI workflow `permissions:` block | **absent** |
| Repo | public (user decision: keep during development) |

---

## 1. Local-sim là gì?

**Local-sim** = chạy **đúng stack production** (images multi-stage, `NODE_ENV=production`, nginx TLS, rate-limit, strip dev headers, cookie `Secure`) **trên máy dev**, với **vài nới lỏng có chủ đích** để dev/test được.

Lệnh thiết kế:

```bash
docker compose -p cmcv2-prod --env-file .env.prod \
  -f docker-compose.prod.yml \
  -f infra/compose.local-sim.yml \
  up -d --build
```

### Hai lớp file

```text
docker-compose.prod.yml     ← "máy chủ thật" (baseline)
infra/compose.local-sim.yml ← "delta local" (override, chồng lên prod)
```

### So sánh

| Khía cạnh | Pure prod (chỉ `docker-compose.prod.yml`) | Local-sim (prod + override) — **máy bạn đang dùng** |
|-----------|-------------------------------------------|-----------------------------------------------------|
| Mục tiêu | VPS/server công khai | Dev/UAT sát prod trên laptop |
| nginx config | `nginx.conf` (HSTS, `YOUR_DOMAIN`) | `nginx.local-sim.conf` (localhost/vhost, **không HSTS**, rate auth cao hơn) |
| TLS | Cert thật (Let's Encrypt) | Self-signed localhost (browser warning 1 lần) |
| Postgres host port | **Không publish** (chỉ trong Docker network) | **`5432:5432`** — host chạy prisma migrate/seed |
| API host port | Không publish (chỉ qua nginx) | **`3000:3000`** — probe/security test bypass nginx |
| SPA | prod nginx routing | + spa-fallback volume vá deep-link |
| App behavior | production | **cùng production** (bundle thật, không dev login) |

### Bạn muốn gì — map đúng chưa?

> "production trên máy để phát triển, sau này production sát thực tế server nhất"

**Đó chính là local-sim.** Không phải `pnpm dev` (Vite + dev headers). Không phải pure prod thiếu port host (sẽ khó migrate từ shell máy).

Luồng dài hạn hợp lý:

```text
Hiện tại (dev machine)
  local-sim = prod compose + local deltas
       │
       │  harden images/compose (non-root, limits…) — dùng chung cả 2
       ▼
Sau này (VPS thật)
  CHỈ docker-compose.prod.yml  (bỏ -f compose.local-sim.yml)
  → không mở 5432/3000 ra host, domain + cert thật
```

**Một codebase / một Dockerfile / một prod compose** — local-sim chỉ là lớp override mỏng. Đó là cách "sát server nhất" mà vẫn dev được.

### Cái audit gọi D2 (Postgres 0.0.0.0:5432)

Trên **local-sim** đây **không phải bug** — override **cố ý** publish.  
Vấn đề thật: bind `0.0.0.0` = LAN/WAN có thể chạm DB nếu firewall mở. An toàn hơn cho "prod-on-machine": bind **`127.0.0.1:5432`** (và tùy chọn `127.0.0.1:3000`) — host tools vẫn dùng, máy khác trong mạng thì không.

---

## 2. Repo public — accepted

**Quyết định user:** giữ public trong giai đoạn phát triển.

Hệ quả (ghi nhận, không tranh cãi):

- Self-hosted runner **không** làm (runbook + GitHub: public + self-hosted = nguy hiểm).
- Free Actions minutes đủ dùng khi public.
- Secrets deploy **không** đưa vào GitHub Actions secrets nếu workflow có thể bị fork-PR abuse — hiện CI không deploy, OK.
- Workflow `permissions: contents: read` vẫn **nên** làm (defense-in-depth, không cần private).

---

## 3. P0 #1–2 + workflow permissions — định nghĩa kỹ TRƯỚC khi plan

### P0 #1 — Non-root containers (`USER` trong Dockerfile)

| | |
|--|--|
| **Làm gì** | Runtime stage của `Dockerfile.api` + `Dockerfile.worker`: tạo user/group cố định (vd UID 1001), `chown`, `USER cmc`. Rebuild api/worker. |
| **Không làm** | Không đụng admin/lms nginx images (đã chạy dưới user nginx trong image base, khác path). Không `read_only: true` ở bước 1 (Node có thể cần write tmp). Không vault/K8s. |
| **File** | `infra/docker/Dockerfile.api`, `infra/docker/Dockerfile.worker` only (optional compose `security_opt` = scope mở rộng, tách phase). |
| **Rủi ro** | Volume mount host owned by root → permission denied; healthcheck `wget` vẫn OK nếu binary trong image; Prisma/file blob path `/data` local-sim volume phải writable by UID 1001. |
| **Verify** | `docker compose … exec api whoami` ≠ root; health healthy; login + 1 tRPC call; worker health 200. |
| **Ảnh hưởng local-sim vs prod** | Cùng image → **cả hai** an toàn hơn. |

### P0 #2 — Host port discipline (REFRAME — không phải "xóa 5432")

Audit cũ nói "đóng 5432". Với mục tiêu **local-sim prod-on-machine**, xóa 5432 **phá** host prisma migrate/seed.

| Option | Việc làm | DX host prisma | Sát pure-prod | An toàn mạng |
|--------|----------|----------------|---------------|--------------|
| **A (recommended)** | Local-sim: `127.0.0.1:5432:5432` (+ optional `127.0.0.1:3000:3000`). Prod file: **giữ không publish** postgres/api. | Giữ | Gần hơn pure (LAN không thấy) | Cao hơn hiện tại |
| B | Document only — không đổi port | Giữ | Thấp | Thấp (0.0.0.0) |
| C | Xóa host ports local-sim | Phải `docker exec` / socat | Cao nhất | Cao nhất |

**Định nghĩa P0 #2 đề xuất (nếu user chọn A):**

- Sửa **chỉ** `infra/compose.local-sim.yml` ports bind localhost.
- **Không** thêm ports postgres vào `docker-compose.prod.yml`.
- Verify: `ss -lntp` shows `127.0.0.1:5432` not `0.0.0.0:5432`; `psql`/`prisma` từ host vẫn connect; stack healthy.

### Workflow permissions

| | |
|--|--|
| **Làm gì** | Thêm top-level vào `.github/workflows/ci.yml`: `permissions: contents: read` (và nếu artifact upload cần, job-level `actions: write` / `checks: write` tối thiểu). |
| **Không làm** | Không private repo. Không self-hosted. Không đổi required checks. Không thêm deploy job. |
| **Rủi ro** | Thấp; nếu upload-artifact cần write và thiếu permission → job fail — cần đọc action docs khi plan. |
| **Verify** | CI green trên push; artifact journey + trivy vẫn upload. |

### Ngoài scope P0 (dù "hay")

- Slim image 1.13GB → 300MB (P1)
- CodeQL UI enable (user manual / separate)
- Resource limits compose (có thể gộp P0.5 nếu muốn)
- CD/GHCR, observability, private repo

---

## Brainstorm contract (draft — chờ xác nhận)

**Outcome:** Môi trường local-sim (prod-on-machine) harden hơn: container api/worker không chạy root; cổng DB/API local-sim chỉ loopback; CI workflow least-privilege permissions — vẫn public repo, vẫn DX migrate từ host.

**Constraints:**

- Repo **public** (cố định giai đoạn này)
- Giữ local-sim model (prod + override), không ép pure-prod-only trên laptop
- Không self-hosted runner
- YAGNI: không K8s, không slim image trong batch này trừ khi user mở scope
- Không commit secrets

**Non-goals:**

- Private repo / self-hosted
- Image size / Trivy image / CodeQL (trừ note runbook)
- CD deploy automation
- Xóa hẳn host ports local-sim (trừ khi user chọn option C)

**Acceptance (measurable):**

1. `docker compose -p cmcv2-prod exec -T api whoami` → non-root  
2. `docker compose -p cmcv2-prod exec -T worker whoami` → non-root  
3. api + worker health = healthy sau rebuild  
4. (nếu A) `ss -lntp | grep 5432` shows 127.0.0.1 only  
5. Host still can connect DB for migrate (documented command)  
6. `ci.yml` has top-level `permissions:` least privilege  
7. CI run green after change (or document Actions minute failure separately)

---

## Advise verdict (provisional)

Làm P0 với **option A cho ports** là đúng mục tiêu "prod sát server trên máy dev": harden image (chung VPS sau này) + thu hẹp attack surface local mà **không** hy sinh DX. Giữ public repo là hợp lý khi đang dev; chỉ đừng gắn self-hosted.

**Chưa implement** cho đến khi user confirm option ports + contract.
