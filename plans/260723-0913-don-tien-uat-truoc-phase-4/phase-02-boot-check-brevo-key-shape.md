---
phase: 2
title: "Chặn giá trị bí mật nuốt dòng ngay lúc boot"
status: done
priority: P1
dependencies: []
---

# Phase 2: Chặn giá trị bí mật nuốt dòng ngay lúc boot

> **Viết lại 2026-07-23 sau red-team.** Bản đầu dựng lại sự cố sai và đề xuất một điều kiện **không bắt được chính lỗi nó sinh ra để bắt**. Cả 3 reviewer độc lập chỉ ra cùng chỗ. Chi tiết ở §Bản đầu sai gì.

## Overview

`.env.prod` có dòng `BREVO_API_KEY=` thiếu ký tự xuống dòng cuối dòng, làm nó **nuốt luôn dòng kế tiếp**. Hình dạng thật, chép từ nhật ký sự cố:

```
BREVO_API_KEY=xkeysib-<REDACTED>GRAPH_TENANT_ID="<REDACTED>"
```

Kết quả: `process.env.BREVO_API_KEY` = `xkeysib-XXXGRAPH_TENANT_ID="YYY"` — **một dòng vật lý, không có `\n`, không có khoảng trắng thừa**. Brevo trả `401`. OTP phụ huynh chết 12 ngày.

Phase này bắt **hình dạng cấu trúc** của lỗi đó: một bí mật một-dòng mà giá trị chứa một phép gán `TÊN=` nhúng bên trong.

## Bản đầu sai gì (giữ lại để không lặp)

| Bản đầu viết | Sự thật | Nguồn |
|---|---|---|
| Giá trị chứa ký tự xuống dòng ⇒ `v !== v.trim()` bắt được | **Không có xuống dòng nào.** Thiếu newline làm hai dòng dính thành một; `trim()` và `/[\r\n]/` đều trả `false` | `docs/journals/260711-build-regression-brevo-otp-fix.md:61-63` |
| *"Cả hai lớp kiểm chỉ hỏi biến có tồn tại không"* là nguyên nhân gốc | Nguyên nhân gốc **khác**: biến bị nuốt là `GRAPH_TENANT_ID`, mà nó **có** trong `required` — nhưng chỉ khi `SSO_ENABLED=true`. Tháng 7 SSO chưa bật, nên `missing` không kích. Không phải "mù hình dạng", mà là **điều kiện** | `apps/api/src/boot-checks.ts:195-206` |
| Test fixture `'xkeysib-abc123\nBREVO_SENDER_EMAIL=...'` | Chuỗi đó **có** `\n` nên test sẽ xanh giả. Fixture phải là chuỗi một dòng từ nhật ký | như trên |
| Helper test tên `setProdEnv` | Không tồn tại. File dùng `setProdBase()` **không tham số**, kèm mảng `KEYS` + `beforeEach/afterEach` lưu-khôi phục | `apps/api/src/boot-checks.test.ts:75-105` |
| 6 bí mật một dòng là đủ | Bỏ sót `GRAPH_TENANT_ID` (chính biến bị nuốt), `LMS_SESSION_SECRET`, `STAFF_SESSION_SECRET`, `BACKUP_ENCRYPTION_PASSPHRASE`. Cái cuối hỏng thì backup mã hoá xong **không ai giải mã được**, chỉ lộ ra lúc restore thật | `scripts/env-check.sh:17,34,36,41`; `scripts/backup-db.sh:20,56` |

## Requirements

**Functional**
- Ở production, `assertRequiredEnvForProd()` fail khi một bí mật một-dòng có giá trị chứa **phép gán nhúng** (`/[A-Z][A-Z0-9_]{2,}=/`), hoặc chứa xuống dòng, hoặc có khoảng trắng đầu/cuối.
- `BREVO_API_KEY` thêm một khẳng định định dạng: `/^xkeysib-[A-Za-z0-9-]+$/`.
- Thông báo lỗi nêu **tên biến và loại lỗi**, **không in giá trị** — hợp đồng ở `boot-checks.ts:166` (*"Reports only variable NAMES, never values"*).

**Non-functional**
- Không thêm biến bắt buộc mới vào `required`.
- Chỉ chạy khi `NODE_ENV === 'production'`.

## Architecture

Thêm một bước sau bước kiểm `missing` (`boot-checks.ts:204`):

```
required chưa set?          → FATAL: missing required env var(s)   (đã có)
giá trị nuốt dòng / dị dạng? → FATAL: malformed env var(s)          (thêm)
```

Danh sách áp dụng — bí mật/định danh **một dòng, không bao giờ hợp lệ khi chứa khoảng trắng hay dấu `=`**:

`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER_EMAIL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `LMS_SESSION_SECRET`, `STAFF_SESSION_SECRET`, `BACKUP_ENCRYPTION_PASSPHRASE`

> **Không** áp cho `CORS_ORIGINS`, `TRUSTED_PROXY_CIDRS` (danh sách, khoảng trắng có thể hợp lệ) và `APP_DATABASE_URL`/`DATABASE_URL` (URL, không siết thêm ngoài dự tính).
>
> Chỉ kiểm biến **đã set** — biến chưa set do bước `missing` xử lý, không báo trùng.

**Giới hạn phải ghi rõ, không được quên:** `assertRequiredEnvForProd` **chỉ được gọi ở API** (`apps/api/src/server.ts:137`). **Worker không gọi nó** — mà worker mới là process gửi mail Brevo. ⇒ *API boot thành công KHÔNG chứng minh gì về worker.* Phase 3 phải kiểm worker riêng bằng log gửi thật, không suy ra từ việc API sống.

## Related Code Files

- Modify: `apps/api/src/boot-checks.ts`
- Modify: `apps/api/src/boot-checks.test.ts` — test trước
- **Kiểm tác động (bản đầu bỏ sót):** `apps/api/src/auth/sso-routes.test.ts:160-184` cũng gọi `assertRequiredEnvForProd` với `SSO_ENABLED=true` và env prod đầy đủ. Nếu fixture ở đó đặt bất kỳ biến nào trong danh sách với khoảng trắng thừa, test đó sẽ vỡ — kiểm trước khi sửa.
- Ghi nợ (không sửa): `boot-checks.ts:163` tự nhận là *"runtime twin of scripts/env-check.sh"* nhưng `required` thiếu `STAFF_SESSION_SECRET`, `BACKUP_ENCRYPTION_PASSPHRASE`. Lệch có sẵn, không mở rộng phạm vi để sửa.

## Implementation Steps

**Bước 0 — đọc `boot-checks.test.ts` trước.** Nắm đúng `setProdBase()` (không tham số), mảng `KEYS`, và cơ chế lưu-khôi phục `process.env` ở `:75-105`. Bản đầu bịa ra một helper không tồn tại; đừng lặp lại.

**Bước 1 — viết test TRƯỚC, chạy để thấy đỏ.** Fixture **phải** là chuỗi một dòng đúng hình dạng thật:

```ts
it('rejects a secret that swallowed the next line of the env file', () => {
  setProdBase();
  // Hình dạng thật của sự cố 12 ngày: thiếu newline cuối dòng nên giá trị
  // nuốt luôn phép gán kế tiếp. MỘT dòng vật lý — không có \n để mà bắt.
  process.env['BREVO_API_KEY'] = 'xkeysib-abc123GRAPH_TENANT_ID="00000000-0000-0000-0000-000000000000"';
  expect(() => assertRequiredEnvForProd()).toThrow(/BREVO_API_KEY/);
});

it('rejects a secret containing a line break', () => { /* mạng lưới phụ */ });
it('rejects a secret with leading or trailing whitespace', () => { /* mạng lưới phụ */ });

it('names the variable but never prints its value', () => {
  setProdBase();
  process.env['BREVO_API_KEY'] = 'xkeysib-SECRETVALUEGRAPH_TENANT_ID="x"';
  try {
    assertRequiredEnvForProd();
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(String(e)).toContain('BREVO_API_KEY');
    expect(String(e)).not.toContain('SECRETVALUE');
  }
});

it('accepts a well-formed key', () => {
  setProdBase();
  process.env['BREVO_API_KEY'] = 'xkeysib-abc123def456';
  expect(() => assertRequiredEnvForProd()).not.toThrow();
});
```

**Bước 2 — chạy test.** Ca "nuốt dòng" và ca "không in giá trị" phải **đỏ**; ca hợp lệ **xanh**. Nếu ca nuốt dòng đã xanh sẵn thì điều kiện của bạn đang bắt nhầm thứ khác — dừng lại, đừng đi tiếp.

**Bước 3 — sửa `boot-checks.ts`:**

```ts
// Thiếu newline cuối dòng trong .env.prod làm một dòng nuốt luôn dòng kế tiếp:
//   BREVO_API_KEY=xkeysib-XXXGRAPH_TENANT_ID="YYY"
// Giá trị thu được là MỘT dòng, không xuống dòng, không khoảng trắng thừa —
// nên cả bước "thiếu biến" ở trên lẫn một phép kiểm trim() đều cho nó đi qua.
// Dấu hiệu bắt được là cấu trúc: một phép gán TÊN= nằm trong giá trị.
const EMBEDDED_ASSIGNMENT = /[A-Z][A-Z0-9_]{2,}=/;

const SINGLE_LINE_SECRETS = [
  'BREVO_API_KEY', 'BREVO_SENDER_EMAIL',
  'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET',
  'GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_SENDER_EMAIL',
  'S3_ACCESS_KEY', 'S3_SECRET_KEY',
  'LMS_SESSION_SECRET', 'STAFF_SESSION_SECRET', 'BACKUP_ENCRYPTION_PASSPHRASE',
];

const malformed = SINGLE_LINE_SECRETS.filter((name) => {
  const v = process.env[name];
  if (v === undefined) return false;               // bước `missing` đã lo
  return EMBEDDED_ASSIGNMENT.test(v) || /[\r\n]/.test(v) || v !== v.trim();
});

// Brevo có định dạng khoá công bố; một khoá đã nuốt dòng không còn khớp nó.
const brevo = process.env['BREVO_API_KEY'];
if (brevo !== undefined && !/^xkeysib-[A-Za-z0-9-]+$/.test(brevo)) {
  malformed.push('BREVO_API_KEY (format)');
}

if (malformed.length > 0) {
  throw new Error(
    `FATAL: malformed env var(s) in production: ${[...new Set(malformed)].join(', ')}. ` +
      'Value contains an embedded assignment, a line break, or stray whitespace — ' +
      'check each line ends with a newline in .env.prod.',
  );
}
```

**Bước 4 — chạy lại test, xanh.** Rồi `pnpm --filter @cmc/api test` toàn bộ, đặc biệt xem `sso-routes.test.ts` có vỡ không.

**Bước 5 — `pnpm typecheck && pnpm lint`.**

## Success Criteria

- [ ] Test ca **một dòng nuốt phép gán** (không có `\n`) đỏ trước, xanh sau — đây là tiêu chí quan trọng nhất của phase
- [ ] Test khẳng định thông báo lỗi **không chứa giá trị khoá**
- [ ] Test ca khoá hợp lệ vẫn xanh
- [ ] `apps/api/src/auth/sso-routes.test.ts` vẫn xanh
- [ ] Danh sách phủ đủ 14 biến, gồm `GRAPH_TENANT_ID` và `BACKUP_ENCRYPTION_PASSPHRASE`
- [ ] Không thêm biến vào `required`
- [ ] `pnpm --filter @cmc/api test` · `pnpm typecheck` · `pnpm lint` xanh
- [ ] Phase file ghi rõ giới hạn: **worker không chạy check này**

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Điều kiện lại không bắt được hình dạng thật (lỗi bản đầu) | **Cao** | Fixture là chuỗi một dòng chép từ nhật ký; bước 2 bắt buộc xác nhận nó ĐỎ trước khi đi tiếp |
| `EMBEDDED_ASSIGNMENT` báo giả trên giá trị hợp lệ | TB | Không áp cho danh sách/URL. Ca hợp lệ có test. Nếu một bí mật thật chứa `=` (ví dụ base64 padding cuối), regex đòi `[A-Z][A-Z0-9_]{2,}=` nên `abc==` **không** khớp — vẫn phải kiểm khi chạy `sso-routes.test.ts` |
| Rò giá trị bí mật vào log lúc boot fail | **Cao nếu xảy ra** | Chỉ ghép tên biến; có test riêng khẳng định |
| Prod hiện có key dị dạng ⇒ redeploy xong không boot | TB | **Chủ ý.** Phase 3 kiểm và sửa `.env.prod` **trước** khi redeploy, và có bước rollback |
| Tưởng API boot được nghĩa là gửi mail được | **Cao** | Ghi thành giới hạn ở §Architecture; Phase 3 kiểm worker bằng log gửi thật |
