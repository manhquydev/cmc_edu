---
phase: 3
title: "Brevo trên host UAT — rotate, allowlist, gửi email thật"
status: pending
priority: P1
dependencies: [1, 2, 4]
---

# Phase 3: Brevo trên host UAT — rotate, allowlist, gửi email thật

> **Viết lại 2026-07-23 sau red-team.** Bản đầu thiếu **bước quyết định** (thêm IP của VPS vào allowlist Brevo), grep **nhầm biến**, không có rollback, và redeploy được phép chạy **trước** khi Phase 1 land. Chi tiết ở §Bản đầu sai gì.

## Overview

Phase vận hành, **không viết code**. Đưa Brevo từ trạng thái "chưa từng gửi thành công một email thật nào từ VPS" tới "có ảnh hộp thư nhận", trước khi tập hợp người chạy UAT.

**Vì sao chạy trước UAT:** tiêu chí Go/No-Go đòi ≥1 email Brevo và ≥1 Graph **vào tới hộp thư người nhận**. Fail lúc đã gom đủ người 7 vai = mất cả buổi. Fail ở đây chỉ lùi lịch.

## Bản đầu sai gì (giữ lại để không lặp)

| Bản đầu viết | Sự thật | Nguồn |
|---|---|---|
| Kiểm `grep -c '^BREVO_SENDER_EMAIL='` — trả 0 là "dấu hiệu dứt điểm" | Dòng bị nuốt là **`GRAPH_TENANT_ID`**. Lệnh đó trả **1** trên đúng file hỏng ⇒ báo "sạch" rồi đi tiếp | journal `:63` |
| Không nhắc allowlist IP | Brevo **bật IP-allowlist**. Việc "thêm IP outbound của VPS" là bước (1) trong 3 việc còn lại, **chưa bao giờ làm** | journal `:71-75` |
| *"Không dán khoá mới (khoá cũ không sai)"* | Khoá SMTP+API thật **đã bị dán vào một phiên chat** và nhật ký ghi phải rotate. Runbook §8d cũng đòi rotate | journal `:77`; `runbook:272` |
| API boot được ⇒ email gửi được | `assertRequiredEnvForProd` **chỉ chạy ở API**; **worker** mới là process gửi mail và không gọi nó | `server.ts:137` |
| Phụ thuộc `[2]` | Redeploy có thể chạy **trước Phase 1** ⇒ UAT day không có menu, §4.3 vỡ đúng 4 màn vừa thêm | — |
| Bằng chứng = ảnh hộp thư phụ huynh, lưu trong `reports/` | Địa chỉ phụ huynh thật + OTP **commit vào git**, trong sản phẩm xử lý dữ liệu trẻ em. Và `cmc_prod` rỗng nên luồng OTP đòi seed một phụ huynh thật vào prod | `runbook:295` |

## Requirements

**Functional**
- Khoá Brevo **mới** (rotate) đang hoạt động trên host UAT.
- IP outbound của VPS nằm trong authorised-IPs của Brevo, **đã verify từ chính host**.
- `.env.prod` không còn dòng nào nuốt dòng kế tiếp.
- ≥1 email Brevo thật gửi từ **worker** tới hộp thư nhân sự kiểm được.

**Bằng chứng bắt buộc**
- **Ảnh chụp hộp thư nhận** — không phải mã 2xx, không phải log "sent".
- Gửi tới **hộp thư nhân sự** trên `STAFF_EMAIL_DOMAIN`, **không** phải phụ huynh thật. Che địa chỉ và mọi mã OTP trước khi lưu.
- Lưu **ngoài repo**; trong `reports/` chỉ ghi *"ảnh lưu tại <vị trí>, chụp lúc <giờ>"* + commit hash đang chạy.

**Không làm** — bằng chứng có PII (địa chỉ thật, OTP, tên trẻ em) **không được commit vào git**.

## Architecture

Thứ tự bắt buộc. Đảo bất kỳ bước nào cũng mất thời gian chẩn đoán một lỗi đã biết trước nguyên nhân:

```
0. Phase 1, 2, 4 đã merge vào main        ← nếu chưa, DỪNG (xem §Vì sao phụ thuộc 1,2,4)
1. sao lưu .env.prod                       ← cp .env.prod .env.prod.bak-<TS>
2. kiểm cấu trúc toàn file                 ← đếm dòng vs đếm phép gán
3. sửa dòng nuốt dòng nếu có
4. rotate khoá Brevo + thêm IP VPS vào allowlist
5. verify GET /v3/account = 200 TỪ CHÍNH HOST   ← trước khi redeploy
6. ghi lại git ref đang chạy (đích rollback)
7. redeploy api + worker từ main
8. xác nhận API boot + WORKER sống
9. chạy lại e2e (runbook §8d đòi, giữa bước 0 và 1)
10. gửi email thật + chụp hộp thư
```

### Vì sao phụ thuộc [1, 2, 4]

Bản đầu chỉ phụ thuộc `[2]`, và tuyên bố redeploy này **cũng là bước 0 REDEPLOY** của runbook §3.0. Hai điều đó không tương thích: nếu redeploy chạy khi Phase 1 chưa land thì prod **không có 4 nav entry**, người test UAT vào §4.3 *"vào màn bằng menu"* sẽ không tìm ra màn — đúng lỗi đang đi sửa. Và gate §9 *"commit đang chạy trên prod = `main` tại thời điểm UAT"* thành sai, buộc redeploy lần nữa, lúc đó tuyên bố "bước 0 đã xong" thành vô nghĩa.

⇒ **Phase 3 chạy cuối cùng.** Redeploy một lần, từ `main` đã có đủ cả 3 phase kia.

## Related Code Files

Không sửa file nào trong repo. Chạm vào:
- `.env.prod` **trên host UAT** (ngoài repo, gitignore `.gitignore:55`)
- Dashboard Brevo (rotate khoá, authorised-IPs)
- `scripts/env-check.sh` — chạy để đối chiếu, không sửa

## Implementation Steps

**Bước 0 — xác nhận Phase 1, 2, 4 đã merge.** `git log --oneline -5` trên `main`. Chưa đủ thì dừng.

**Bước 1 — sao lưu file trước khi sửa:** `cp .env.prod .env.prod.bak-$(date +%Y%m%d-%H%M%S)`. File gitignore, không có bản sao ở đâu khác; sửa tay mà không sao lưu là không có đường về.

**Bước 2 — kiểm cấu trúc TOÀN FILE, không grep một biến đoán trước:**

```bash
# Số dòng có phép gán phải bằng số dòng không-rỗng-không-comment.
# Lệch = có dòng nuốt dòng khác.
grep -c '^[A-Z_][A-Z0-9_]*=' .env.prod
grep -vc '^\s*$\|^\s*#' .env.prod

# Chỉ đích danh dòng mang HAI phép gán — đây là lỗi cần tìm:
grep -n '^[A-Z_][A-Z0-9_]*=.*[A-Z][A-Z0-9_][A-Z0-9_]*=' .env.prod | cut -d: -f1

# Xác nhận biến từng bị nuốt có mặt như một dòng riêng:
grep -c '^GRAPH_TENANT_ID=' .env.prod   # phải = 1
```

> Lệnh thứ hai in **số dòng**, không in nội dung. Không lệnh nào in giá trị bí mật.

**Bước 3 — sửa dòng bị nuốt nếu có.** Thêm ký tự xuống dòng, xác nhận lại bằng bước 2.

**Bước 4 — rotate khoá + allowlist (PO chốt 2026-07-23):**
- Tạo khoá API Brevo mới trên dashboard, thu hồi khoá cũ (khoá cũ từng bị dán vào một phiên chat).
- Lấy IP outbound của host: `curl -s ifconfig.me` **chạy trên host**, không phải máy dev.
- Thêm IP đó vào authorised-IPs của Brevo.
- Ghi khoá mới vào `.env.prod`, **kiểm lại bằng bước 2** (đây chính là thao tác ghi từng làm hỏng file lần trước).

**Bước 5 — verify TRƯỚC khi redeploy, từ chính host:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "api-key: $BREVO_API_KEY" https://api.brevo.com/v3/account
```

- `200` ⇒ khoá đúng **và** IP đã được cho phép. Đi tiếp.
- `401 unrecognised IP address` ⇒ **allowlist**, không phải khoá. Quay lại bước 4, đừng đụng `.env.prod`.
- `401 Key not found` ⇒ khoá hoặc hình dạng dòng. Quay lại bước 2.

> Phân nhánh này là thứ bản đầu thiếu: cùng mã 401, hai nguyên nhân khác hẳn, và bản đầu mồi người vận hành đi sai hướng.

**Bước 6 — ghi đích rollback.** `git rev-parse HEAD` hiện đang chạy trên prod (ghi vào biên bản trước khi đổi). `docker-compose.prod.yml` dùng `build:` chứ không pin image tag, nên rollback = `git checkout <ref cũ>` + rebuild `api worker` (`runbook-deploy.md:169-178`) — mất nhiều phút, phải biết trước quay về đâu.

**Bước 7 — redeploy `api` + `worker`** từ `main`. Ghi `git rev-parse HEAD` mới.

**Bước 8 — xác nhận boot, phân biệt được nguyên nhân:**

```bash
docker compose -f docker-compose.prod.yml logs api    | grep -i 'FATAL' || echo "api: no FATAL"
docker compose -f docker-compose.prod.yml logs worker | tail -30
```

- Có `FATAL: malformed env var(s)` ⇒ boot-check Phase 2 vừa bắt được ⇒ quay lại bước 2.
- Có `FATAL` khác ⇒ **không phải** lỗi env; đọc nguyên văn, đừng sửa `.env.prod`.
- **Bắt buộc kiểm worker riêng** — worker không chạy `assertRequiredEnvForProd`, API sống không nói gì về nó.
- **Tiêu chí dừng: 20 phút.** Quá mốc mà chưa xanh ⇒ rollback về ref bước 6, báo lại, không tiếp tục dò.

**Bước 9 — chạy lại e2e sau redeploy** (runbook §8d đòi chèn giữa bước 0 và 1). Bản đầu chiếm mất chỗ của bước 0 mà không chạy e2e.

**Bước 10 — gửi 1 email Brevo thật** tới **hộp thư nhân sự** trên `STAFF_EMAIL_DOMAIN`. Chụp hộp thư nhận, che địa chỉ và mã. Xác nhận log worker có dòng gửi thành công tương ứng.

**Bước 11 — lưu bằng chứng.** Ảnh lưu **ngoài repo**; `reports/` chỉ ghi vị trí, giờ chụp, commit hash đang chạy, kết quả `env-check.sh`, mã HTTP bước 5.

## Success Criteria

- [ ] Phase 1, 2, 4 đã có trên `main` trước khi redeploy
- [ ] `.env.prod` đã sao lưu trước khi sửa
- [ ] Kiểm cấu trúc toàn file: số phép gán = số dòng thực; **0 dòng mang hai phép gán**; `grep -c '^GRAPH_TENANT_ID=' == 1`
- [ ] Khoá Brevo đã rotate; khoá cũ đã thu hồi
- [ ] IP outbound của host nằm trong authorised-IPs; `GET /v3/account` trả **200 từ chính host** trước khi redeploy
- [ ] Đích rollback (git ref cũ) đã ghi trước khi redeploy
- [ ] API boot không FATAL **và** worker sống — kiểm riêng từng process
- [ ] e2e chạy lại sau redeploy, xanh
- [ ] ≥1 email Brevo thật vào hộp thư **nhân sự**, có ảnh (che PII, lưu ngoài repo) + log worker khớp
- [ ] Không có địa chỉ phụ huynh thật, tên trẻ em, hay mã OTP nào được commit

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Ghi khoá mới lại làm hỏng dòng như lần trước | **Cao** | Bước 4 bắt buộc chạy lại kiểm cấu trúc bước 2 ngay sau khi ghi; boot-check Phase 2 là lưới thứ hai |
| Đọc 401-allowlist thành 401-khoá rồi sửa nhầm file | **Cao** | Bước 5 phân nhánh theo **nội dung** thông báo, chạy **trước** redeploy |
| Redeploy hỏng, không có đường về | **Cao** | Bước 1 sao lưu env; bước 6 ghi git ref; tiêu chí dừng 20 phút; rollback theo `runbook-deploy.md:169-178` |
| Kết luận "gửi được" từ việc API boot | **Cao** | Bước 8 kiểm worker riêng; bước 10 đòi log worker khớp với ảnh hộp thư |
| Lộ PII (địa chỉ phụ huynh, OTP, tên trẻ em) qua artifact | **Cao nếu xảy ra** | Gửi tới hộp thư nhân sự; che trước khi lưu; lưu ngoài repo; `reports/` chỉ ghi vị trí |
| In giá trị bí mật ra terminal/log | TB | Mọi lệnh bước 2 chỉ in số đếm và số dòng |
| `cmc_prod` không còn rỗng như đo 2026-07-22 | TB | **Đo lại** trước bước 7 bằng bảng đếm row runbook §6, chạy bằng role `postgres` |
| Brevo free plan 300 lượt/ngày | Thấp | Ghi nhận; UAT 7 vai không chạm trần, nhưng đừng dùng để test lặp |
