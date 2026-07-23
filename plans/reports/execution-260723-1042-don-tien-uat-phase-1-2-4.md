# Thực thi Đợt B — Phase 1, 2, 4 (Phase 3 chưa chạy được)

**Ngày:** 2026-07-23
**Plan:** `plans/260723-0913-don-tien-uat-truoc-phase-4/`
**Nhánh:** `main`, chưa commit

## Kết quả

| Phase | Trạng thái | Bằng chứng |
|---|---|---|
| 1 — Nav cho màn URL-only | ✅ xong | admin 396 test xanh; ma trận regenerate |
| 2 — Boot-check nuốt dòng | ✅ xong | api 988 test xanh; kiểm qua đường Docker thật |
| 4 — Đồng bộ tài liệu | ✅ xong | `acceptance:report` giữ 37/1, findings 0 |
| 3 — Brevo trên host UAT | ⛔ **chưa chạy** | Không có quyền truy cập — xem bàn giao |

Toàn repo: `pnpm test` **22/22 task**, `pnpm typecheck` **27/27**, `pnpm lint` sạch.
Bất biến: `git diff packages/auth/src/index.ts` **rỗng**.

## Hạ tầng phải tự dựng

Bộ test `@cmc/api` cần Postgres; không có DB thì **784/986 test đỏ** vì thiếu `DATABASE_URL` — lỗi môi trường, không phải hồi quy. Dựng lại đúng CI bằng Docker: `postgres:16-alpine` (image `postgres:16` không có sẵn, mạng bị chặn), `prisma migrate deploy`, đặt mật khẩu role `cmc_app`, ghi `packages/db/prisma/.env`.

Container còn chạy: `docker rm -f cmc-test-pg` khi xong. Cả `packages/db/prisma/.env` lẫn `acceptance-report/` đều **gitignore** — kiểm bằng `git check-ignore`, không có credential nào lọt vào commit.

## Ba chỗ plan dự báo sai (đo lại, không suy đoán)

**1. Ma trận: 98, không phải 96.** Và `102` vốn đã sai từ trước.

Artifact commit trong git **đã cũ sẵn** trước khi đợt này chạm vào: nó vẫn khai `/finance/refund` có nav entry gate cho GĐKD, trong khi `24ef2e3` (2026-07-23) đã gỡ entry đó — sinh sau lần regenerate 2026-07-22 đúng một ngày. Chứng minh: `git show HEAD:apps/admin/src/shell/nav-registry.ts | grep -c "id: 'refund'"` = **0**, còn artifact vẫn có cặp đó.

`102 − 7 + 3 = 98` · `pairCount` 118 → 114. Mất 7 chứ không phải 6 vì `gift.upsert` của D5 loại **cả `sale`**, không chỉ `giao_vien`.

**2. Phase 2 làm vỡ test plan không lường.** `setProdBase()` đặt `BREVO_API_KEY = 'x'`, khẳng định định dạng `xkeysib-` từ chối ngay. Plan chỉ cảnh báo `sso-routes.test.ts`. Đã sửa fixture thành khoá đúng hình dạng.

**3. `EMBEDDED_ASSIGNMENT` bản đầu chặn nhầm ~1/6 bí mật hợp lệ.** Xem dưới.

## Hai lỗi HIGH do code review bắt, đã kiểm độc lập rồi mới sửa

### H1 — Regex chặn nhầm base64, có đường dẫn tới mất dữ liệu

`/[A-Z][A-Z0-9_]{2,}=/` khớp **padding base64 đứng sau một cụm chữ hoa** (`…abcDEFG==`). Đo 20.000 giá trị mỗi loại:

| Sinh bằng | Bản đầu chặn nhầm | Sau khi sửa |
|---|---|---|
| `openssl rand -base64 16` | 13.8% | 0% |
| `openssl rand -base64 32` | **16.8%** | 0% |
| `openssl rand -base64 48` | 0% | 0% |
| `openssl rand -base64 64` | 13.7% | 0% |

`-base64 48` (không có padding) là lý do duy nhất việc này chưa nổ — nhưng **`BACKUP_ENCRYPTION_PASSPHRASE` không có lệnh sinh nào được ghi trong tài liệu**. Nguy hiểm thật không phải "API không boot" mà là phản xạ tự nhiên của người vận hành khi thấy *"malformed BACKUP_ENCRYPTION_PASSPHRASE"*: **sinh lại khoá** ⇒ mọi bản backup đã mã hoá thành **không giải mã được vĩnh viễn**.

Sửa: `/[A-Z][A-Z0-9_]{2,}=[^=]/`. Dòng nuốt thật luôn có ký tự đầu của giá trị kế tiếp sau `=`; padding thì không. Hình dạng sự cố vẫn bị bắt. Còn sót: dòng nuốt mà biến kế tiếp có **giá trị rỗng** (`…OTHER=` cuối chuỗi) — chấp nhận, và khẳng định định dạng Brevo vẫn phủ được ca của chính khoá từng hỏng.

### H2 — Hàng module đưa `sale` vào đúng ngõ cụt D5 sinh ra để tránh

`side-nav.tsx:40` cho hàng module là **nút điều hướng** tới `mod.path`, và các mục con chỉ bung ra **sau khi** module active. Nhóm **Gắn kết** trỏ `path: '/admin/engagement/gifts'`.

Với `sale`: nhóm hiện (nhờ con `rewards.manage`) ⇒ muốn tới Đổi thưởng **buộc phải bấm nhóm trước** ⇒ rơi vào Quà tặng ⇒ gate route là `gift.list` **có** sale nên vào được ⇒ đọc được danh mục, nhưng `gift.upsert` 403 ở mọi thao tác. Đúng nguyên văn ngõ cụt D5 mô tả, chỉ lùi một cấp: **D5 khoá mục con, quên hàng module.**

Sửa: `path: '/admin/engagement/rewards'`. Đúng vì `gift.upsert` ⊂ `rewards.manage` — mọi vai thấy nhóm đều dùng được Đổi thưởng, chiều ngược lại thì không. Ma trận e2e **không đổi** (regenerate lại: 114/98 y nguyên).

*(Hai reviewer độc lập cùng chỉ ra chỗ này.)*

## Ngõ cụt thứ hai — có sẵn từ trước, **không** sửa trong đợt này

Test mới `lands every role on a module screen it can actually operate` bắt luôn một ca cũ: **`sale` bấm nhóm "Tài chính & Điều hành" rơi vào `/finance`**, hàng đợi phiếu thu mà ADR-B cố ý không cho sale (`finance.receiptList` loại sale). Sale nhận một màn mà mọi query 403.

Không sửa, vì đổi màn đáp của nhóm tài chính là **quyết định sản phẩm**, không phải sửa lỗi — và phạm trần cứng của plan. Đã ghi thành **ngoại lệ tường minh** trong test (`KNOWN_UNUSABLE_LANDINGS`): nếu ai đó sửa, test **đỏ** để nhắc xoá ngoại lệ. Không phải allowlist im lặng.

Runbook §5 đã thêm bảng "đừng ghi FAIL khi menu ẩn đúng quyền" để người test sale không ghi FAIL nhầm vào hành vi đúng.

## Lỗi tài liệu do audit bắt, đã sửa

| Lỗi | Sửa |
|---|---|
| §1 hàn con số mới **98** vào kết quả đo cũ **`0 denied`** — capture chỉ chạy 102 cặp ngày 2026-07-22, 3 cặp `/finance/refund` mới **chưa từng mở lần nào** | Tách bạch: `102/0 denied` là **kết quả đo** (giữ nguyên, có ngày); `98` là **phạm vi hiện tại, chưa capture lại**. Ghi rõ *đừng viết "98 tổ hợp, 0 denied"* |
| §8 + §9 viết P4-03 phủ **"cả 4 vai"** — sai, `parentMeeting.manage` **không có `giao_vien`** | P3-01 4 vai / P4-03 3 vai, nêu rõ key |
| `docs/codebase-summary.md:10` vẫn mang 102 ⇒ repo lại có hai câu trả lời | Bổ sung ngày đo + trỏ sang runbook §1 |
| TL27 nói phần Actors "cùng nội dung" với §Exceptions — không đúng: Exceptions cho `super_admin` duyệt **mọi** phiếu | Viết lại: duyệt được mọi phiếu, **và** là đường **duy nhất** với phiếu không track; thêm hệ quả luật cấm tự duyệt (phiếu của super_admin cần **một super_admin khác**) |
| TL25:93 còn chữ `nhân viên` thô mà `a754edf` đã gỡ khỏi manifest | Thay bằng vai thật |
| Comment `finance.routes.tsx` nói `PermissionGate` chặn được giáo viên đọc tên trẻ em — sai, đó là biên UI, API vẫn cho `student.lookup` | Viết lại đúng phạm vi bảo vệ |
| Test `returns 6th Quản trị group ONLY for super_admin` — nay là nhóm **thứ 7**, và vế "ONLY" chưa từng được khẳng định | Đổi tên + `toHaveLength(7)` + 4 ca phủ định |
| Docstring `nav-route-resolution.test.ts` hứa bắt được "rơi vào ComingSoon" — thật ra chỉ chứng minh **đăng ký route** | Ghi rõ giới hạn: `/admin` và `/hr` đăng ký hợp lệ nhưng index render `ComingSoon` |

## Kiểm chứng vượt mức plan yêu cầu

**Boot-check chạy đúng trên đường prod thật, không chỉ trong vitest.** `docker-compose.prod.yml` nạp `.env.prod` bằng `env_file:` cho **cả `api` lẫn `worker`** ⇒ Docker tự parse, không phải dotenv. Cho Docker đọc một file thiếu newline cuối dòng:

```
BREVO_API_KEY=[xkeysib-abc123GRAPH_TENANT_ID="0000-tenant"]
GRAPH_TENANT_ID=[]
```

Xác nhận hai điều: giá trị là **một dòng** (nên `trim()` mù), và `GRAPH_TENANT_ID` thành **rỗng** — đúng lý do lớp `missing` im lặng 12 ngày (tháng 7 `SSO_ENABLED` chưa bật nên biến đó không nằm trong `required`). Cho `assertRequiredEnvForProd()` ăn đúng chuỗi đó ⇒ FATAL, **không rò mảnh khoá nào**.

**Test path↔route được kiểm bằng cách phá code.** Đổi tạm module path về `/admin/engagement` (route không tồn tại) ⇒ test **đỏ đúng chỗ**; hoàn nguyên. Test không xanh giả.

**Chiều nguy hiểm nhất — nav có làm lộ màn cho vai chưa từng vào được không?** Không. Diff cặp trước/sau: chỉ `/finance/refund` "mở thêm" cho 3 vai, mà đó là đính chính artifact cũ — màn này không có gate route, là EmptyState, và §7 đã loại khỏi UAT. Bốn màn thật **chỉ bị thu hẹp**.

## Chưa làm — cần quyết định

**1. `worker` không chạy boot-check.** `assertRequiredEnvForProd` chỉ gọi ở `server.ts:137`; **worker mới là process gửi mail Brevo**. Phase 2 **cố ý** ghi đây là giới hạn và đẩy bằng chứng sang Phase 3 (log gửi thật) — không tự đảo quyết định đó.

Bằng chứng mới thu được: api và worker đọc **cùng một `.env.prod`**, nên giá trị hỏng làm **API FATAL** ⇒ lần deploy vẫn bị chặn. Khoảng trống chỉ còn ở ca người vận hành bỏ qua FATAL của API mà vẫn chạy worker. Đóng lại tốn 2 dòng (export hàm + gọi cạnh check sẵn có ở `worker/index.ts:137-138`) và **không** thêm biến bắt buộc nào. **Cần PO/kỹ thuật quyết** có làm trong đợt này hay ghi nợ.

**2. Ngõ cụt `finance-ops` → `/finance` với `sale`.** Đổi màn đáp của nhóm là quyết định sản phẩm. Ứng viên dùng được cho cả GĐKD/GĐĐT/sale: `/finance/class-placement` (`enrollment.enroll`) hoặc `/crm/aftersale` (`afterSale.manage`). `/crm` **không** hợp vì GĐĐT không có `crm.opportunityList`.

**3. `BACKUP_ENCRYPTION_PASSPHRASE` có nên nằm trong boot-check của API không?** API **không hề đọc** biến này — chỉ script shell dùng. Giữ lại thì mở rộng diện API chết lúc boot mà không đổi lấy an toàn runtime nào. Cân nhắc bỏ, để `scripts/env-check.sh:36` lo.

## Nợ mới ghi nhận

- Hàng module của `/admin` và `/hr` đăng ký hợp lệ nhưng index render `ComingSoon` — bấm nhóm là ra màn trống. Có sẵn từ trước; test path↔route **không** bắt được lớp lỗi này.
- `scan-nav-entries.ts` phụ thuộc **thứ tự xuất hiện** trong mã nguồn (module trước con) để cặp trùng path giải về entry **có gate**. Đúng hôm nay, không ghi ở đâu, và đang gánh cả tính đúng của ma trận.
- Ma trận nay cố ý phá tiền đề "gate nav == gate route" ở `gifts` (nav `gift.upsert`, route `gift.list`). Cặp `(gifts, sale)` — cặp duy nhất có thể phát hiện H2 — đã biến mất khỏi capture.

## Câu hỏi chưa giải

1. Có đóng khoảng trống boot-check của `worker` trong đợt này không, hay ghi nợ? (2 dòng, không thêm biến bắt buộc)
2. Nhóm "Tài chính & Điều hành" nên đáp vào màn nào cho `sale`, hay chấp nhận hiện trạng?
3. `BACKUP_ENCRYPTION_PASSPHRASE` giữ hay bỏ khỏi boot-check của API?
4. `.env.prod` trên host thật: ba bí mật `BACKUP_ENCRYPTION_PASSPHRASE`, `LMS_SESSION_SECRET`, `STAFF_SESSION_SECRET` có kết thúc bằng `=` không? Nếu có, **kiểm trước khi redeploy** — Phase 3 bước 4 là lúc hợp lý nhất.
5. Có wire regenerate `screen-role-matrix.json` vào `pnpm` script/CI không (nợ N5)? Đợt này đã chứng minh nó trôi âm thầm và làm sai một con số trong tài liệu Go/No-Go.
