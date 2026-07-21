---
phase: 4
title: "Docker Log Rotation + Verification"
status: completed
priority: P2
dependencies: [1, 2, 3]
effort: "0.25 day"
---

# Phase 4: Docker Log Rotation + Verification

## Overview

Chặn rủi ro đầy đĩa VPS: Docker mặc định dùng `json-file` driver không giới hạn dung
lượng — container lỗi lặp có thể ăn hết đĩa và giết cả stack. Thêm `logging:` block
cho mọi service trong `docker-compose.prod.yml`, sau đó chạy verification toàn plan.
Chỉ sửa file config — KHÔNG deploy (dự án chưa live, tôn trọng quyết định hoãn infra).

## Requirements

- Functional: mọi service trong `docker-compose.prod.yml` có log rotation
  (json-file, `max-size: "10m"`, `max-file: "3"` — ~30MB trần/service, đủ cho
  điều tra sự cố gần nhất mà không cần log shipping).
- Non-functional: YAML hợp lệ; không đổi bất kỳ key nào khác của services.

## Architecture

Dùng YAML anchor để DRY thay vì lặp block từng service:

```yaml
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  api:
    logging: *default-logging
  # ... áp cho mọi service
```

Nginx service cũng nhận block này (stdout/stderr của container); file log nội bộ
`/var/log/nginx/*.log` trong container là chuyện khác — ngoài phạm vi, đã ghi nhận
trong brainstorm là chấp nhận được ở giai đoạn chưa live.

## Related Code Files

- Modify: `docker-compose.prod.yml` (thêm x-logging anchor + logging key mỗi service)

## Implementation Steps

1. Đọc `docker-compose.prod.yml`, liệt kê đủ services TỪ FILE THẬT — không dựa kỳ
   vọng (red-team AD-4: bản plan trước đoán sai — có service `minio` profile-gated
   tại `docker-compose.prod.yml:145`, không có socat sidecar nào trong file này).
   Services profile-gated (minio) VẪN phải nhận logging block — profile chỉ quyết
   định có chạy hay không, không miễn trừ rotation.
2. Thêm anchor `x-logging` + `logging: *default-logging` cho từng service.
3. Validate: `docker compose -f docker-compose.prod.yml config --quiet` (chạy qua
   Git Bash theo quirk local-sim của dự án; nếu docker không sẵn trong session,
   dùng YAML parse check và ghi rõ trong báo cáo là chưa chạy compose validate).
4. **Verification toàn plan (gate cuối):**
   a. `pnpm typecheck` toàn monorepo.
   b. `pnpm --filter @cmc/llm test` + `pnpm --filter @cmc/api test` (FULL suite —
      phase 2 đã yêu cầu; filter là `@cmc/api`, KHÔNG phải `api` — red-team AD-3:
      filter sai match 0 package và pass rỗng silent).
   c. `gitnexus_detect_changes()` — đối chiếu file/symbol thay đổi với danh sách
      Related Code Files của cả 4 phase; mọi lệch phải giải trình.
   d. Cập nhật `docs/project-changelog.md` một entry gọn cho đợt remediation này
      (đủ điều kiện update docs: đổi security posture + hành vi audit).

## Success Criteria

- [x] Mọi service có log rotation (7/7); compose config validate pass
- [x] Typecheck (26/26 packages) + 3 nhóm test xanh (`@cmc/llm` 15/15, `@cmc/api` 897/897)
- [x] `gitnexus_detect_changes()` khớp scope khai báo, không diff lạ (11 files, LOW risk)
- [x] Changelog entry cho đợt remediation ([2026-07-19] project-changelog.md)

## Risk Assessment

- **YAML anchor không được version compose cũ hỗ trợ?** `x-` extension fields chuẩn
  từ compose spec 3.4+ — stack này dùng compose v2 CLI, an toàn. Validate bước 3 chốt.
- **Docker không chạy được trong session Windows**: fallback đã ghi ở bước 3 —
  không được im lặng bỏ qua validate.
