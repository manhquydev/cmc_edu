# Phase 3 — bàn giao cho người vận hành có quyền trên host UAT

**Ngày:** 2026-07-23
**Phase:** `plans/260723-0913-don-tien-uat-truoc-phase-4/phase-03-brevo-host-uat-email-that.md`
**Trạng thái:** `pending` — **không thực hiện được trong phiên làm việc này**

## Vì sao không làm được ở đây

Phase 3 là phase **vận hành**, không viết code. Nó cần bốn thứ mà phiên này không có:

| Cần | Tình trạng trong phiên | Kiểm bằng |
|---|---|---|
| Shell trên VPS UAT | Không có. `~/.ssh/config` chỉ có một host không liên quan | `grep -i '^Host ' ~/.ssh/config` |
| `.env.prod` | Không tồn tại trong máy này (đúng như thiết kế — gitignore) | `ls -la .env.prod` → không có |
| Dashboard Brevo (rotate khoá, authorised-IPs) | Không có tài khoản | — |
| Hộp thư nhân sự để chụp ảnh nhận | Không có | — |

Docker có chạy trong máy này, nhưng chỉ là các container không liên quan tới dự án; chồng `cmcv2-prod` nằm trên VPS khác.

⇒ Mọi bước của Phase 3 phải do người có quyền trên host thực hiện. Phase file đã đủ chi tiết để chạy; tài liệu này chỉ bổ sung **những gì phiên này đã kiểm được thay cho họ** và **một cảnh báo mới**.

## Điều kiện chặn đã thoả

Phase 3 phụ thuộc `[1, 2, 4]`. Cả ba đã xong và xanh trong phiên này (xem báo cáo thực thi). Người vận hành vẫn phải tự xác nhận chúng **đã có trên `main`** trước khi redeploy — bước 0 của phase file.

## Đã kiểm hộ: boot-check Phase 2 thật sự bắt được sự cố thật

Đây là điều đáng lo nhất của Phase 2 — điều kiện có bắt đúng hình dạng lỗi không, hay chỉ bắt một hình dạng tưởng tượng. Phiên này kiểm bằng **chính đường mà prod dùng**, không chỉ bằng test đơn vị:

**1. Docker `env_file` sinh ra đúng hình dạng sự cố.** `docker-compose.prod.yml` nạp `.env.prod` cho cả `api` lẫn `worker` bằng `env_file:`, tức **Docker tự parse**, không phải dotenv. Dựng một file thiếu newline cuối dòng rồi cho Docker đọc:

```
BREVO_API_KEY=xkeysib-abc123GRAPH_TENANT_ID="0000-tenant"
OTHER=ok
```

Kết quả process nhận được:

```
BREVO_API_KEY=[xkeysib-abc123GRAPH_TENANT_ID="0000-tenant"]
GRAPH_TENANT_ID=[]
```

Hai điều được xác nhận:
- Giá trị là **một dòng, không có `\n`** — đúng như nhật ký sự cố mô tả, và đúng lý do `trim()` không bắt được.
- `GRAPH_TENANT_ID` thành **rỗng**. Đây chính là vì sao lớp kiểm `missing` im lặng suốt 12 ngày: tháng 7 `SSO_ENABLED` chưa bật nên `GRAPH_TENANT_ID` không nằm trong `required`.

**2. Boot-check mới fail đúng trên giá trị đó.** Cho `assertRequiredEnvForProd()` ăn đúng chuỗi Docker vừa sinh:

```
FATAL: malformed env var(s) in production: BREVO_API_KEY. A value contains an
embedded assignment, a line break, or stray whitespace — check that every line
in .env.prod ends with a newline.
```

Không có mảnh giá trị khoá nào trong thông báo.

⇒ Nếu `.env.prod` trên host còn dòng nuốt dòng, **API sẽ không boot** sau redeploy, và log sẽ nói thẳng biến nào. Đó là chủ ý (phase file §Risk), không phải sự cố deploy.

## ⚠️ Cảnh báo chưa có trong phase file: `worker` KHÔNG chạy boot-check này

`assertRequiredEnvForProd()` chỉ được gọi ở `apps/api/src/server.ts`. **`worker` không gọi nó** — và worker mới là process gửi mail Brevo.

Hệ quả cụ thể cho bước 8:

- `api` boot sạch ⇒ chỉ chứng minh `.env.prod` **đúng hình dạng**, không chứng minh worker gửi được mail.
- Nếu dòng bị nuốt là một biến worker cần, `api` vẫn có thể FATAL (vì cùng đọc một file) — nhưng **chiều ngược lại không đúng**: worker có thể sống mà vẫn không gửi được.

⇒ Bước 8 phải kiểm **worker riêng**, và bước 10 phải đối chiếu **log worker** với ảnh hộp thư. Không suy ra từ việc API sống. (Đây là finding #9 của red-team, đã ghi trong phase file — nhắc lại vì nó là chỗ dễ tự lừa nhất trong cả phase.)

Việc worker thiếu boot-check là **nợ N6-liền-kề**, cố ý không sửa trong đợt này (thêm check vào worker sẽ thêm biến bắt buộc mới, phạm bất biến đợt B).

## Nhắc lại ba bẫy chết người (đã có trong phase file, không được bỏ)

1. **Grep đúng biến.** Dòng bị nuốt là `GRAPH_TENANT_ID`, không phải `BREVO_SENDER_EMAIL`. Lệnh grep của bản đầu trả `1` trên đúng file hỏng ⇒ báo "sạch" rồi đi tiếp. Dùng bộ lệnh kiểm **toàn file** ở bước 2 của phase file.
2. **401 có hai nguyên nhân.** `401 unrecognised IP address` là **allowlist** (IP outbound của VPS chưa bao giờ được thêm) — sửa `.env.prod` sẽ không giúp gì. `401 Key not found` mới là khoá/hình dạng dòng. Phân nhánh theo **nội dung** thông báo, ở bước 5, **trước** redeploy.
3. **Bằng chứng không được chứa PII.** Gửi tới hộp thư **nhân sự** trên `STAFF_EMAIL_DOMAIN`, không phải phụ huynh thật. Che địa chỉ và mã OTP. **Lưu ảnh ngoài repo**; trong `plans/reports/` chỉ ghi vị trí + giờ chụp + commit hash.

## Redeploy đúng một lần

`docs/runbook-uat-golive.md` §3 bước 0 nay ghi rõ: bước 0 REDEPLOY **do Phase 3 thực hiện**, từ `main` đã có cả Phase 1/2/4, và **không redeploy lần nữa** giữa Phase 3 và buổi UAT — nếu không, gate §9 *"commit đang chạy trên prod = `main` tại thời điểm UAT"* thành sai và phải chạy lại e2e.

Ghi commit hash Phase 3 deploy vào biên bản UAT.

## Việc cần người vận hành làm

Chạy nguyên `phase-03-brevo-host-uat-email-that.md` từ bước 0 tới bước 11. Không rút gọn bước 5 (verify `GET /v3/account` = 200 **từ chính host**, trước redeploy) — đó là bước duy nhất tách được "hỏng khoá" khỏi "hỏng allowlist" khi chưa tốn một lần deploy.

## Câu hỏi cần trả lời khi chạy xong

1. `GET /v3/account` trả gì ở lần đầu, **trước** khi rotate? (phân biệt được allowlist vs khoá — dữ liệu này chưa ai có)
2. `.env.prod` có bao nhiêu dòng mang hai phép gán? (nếu >0, ghi lại biến nào — cho biết sự cố tháng 7 có phải cá biệt không)
3. Worker log có dòng gửi thành công khớp giờ với ảnh hộp thư không?
