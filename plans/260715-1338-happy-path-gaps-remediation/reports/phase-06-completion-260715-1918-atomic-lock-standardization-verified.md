# Phase 6 (Atomic-Lock Standardization) — Hoàn tất

**Ngày:** 2026-07-15 · **TDD:** đỏ→xanh đủ 4 hạng mục · **Regression:** 809/809 test (92 file, xanh 2 lần liên tiếp) · **Typecheck:** 26/26 package

## Thay đổi code

### 1. `submission.grade` concurrency (Học vụ #5)
| File | Thay đổi |
|---|---|
| `apps/api/src/submission/router.ts` | `findFirst`+`update` → `updateMany({where:{id,facilityId,status:submission.status}, ...})` compare-and-swap trên GIÁ TRỊ status vừa đọc (không phải literal cứng như `assessment.confirm`, vì regrade `graded→graded` hợp lệ); `count===0` → `conflict(...)` |
| Test mới: `submission/grade.test.ts` — 2 grade đồng thời cùng submission → 1 CONFLICT; regrade tuần tự (đọc lại mỗi lần) KHÔNG bị coi là conflict |

### 2. `ReconciliationFlag` unique thật (H5)
| File | Thay đổi |
|---|---|
| `packages/db/prisma/migrations/20260715170000_h5_reconciliation_flag_open_unique/migration.sql` | Bước 1: data-migration gộp flag `open` trùng sẵn có (giữ `createdAt` sớm nhất, còn lại chuyển `dismissed`). Bước 2: `CREATE UNIQUE INDEX ... WHERE status='open'` (partial, raw SQL — Prisma DSL không mô tả được) |
| `packages/db/prisma/schema.prisma` | Comment `ReconciliationFlag` ghi rõ constraint raw-SQL không mirror qua `@@unique` |
| `apps/api/src/worker/reconcile-finance-flags.ts` | Không đổi logic — `maybeCreateFlag`'s P2002-catch đã có sẵn, giờ mới có tác dụng thật |
| Test mới: `worker/reconcile-finance-flags.test.ts` — 2 `maybeCreateFlag` chạy trong 2 transaction riêng cùng key → chỉ 1 flag tồn tại |
| Xác minh thủ công qua psql: trước migration, insert trùng (receiptId thật) THÀNH CÔNG cả 2; sau migration, insert thứ 2 bị `unique_violation` |

### 3. OTP lock + rate-limit (NS #6, #7)
| File | Thay đổi |
|---|---|
| `apps/api/src/lms-auth/router.ts` | `requestOtp`/`requestOtpEmail` bọc trong `$transaction`, lấy `pg_advisory_xact_lock(hashtext(identifier))` trước cooldown-check (serialize 2 request đồng thời cùng SĐT/email); thêm rate-limit `OTP_RATE_LIMIT_MAX_PER_WINDOW=5` / `OTP_RATE_LIMIT_WINDOW_MINUTES=15` (rolling window, tự tạo hiệu ứng soft-block ~15' khi vượt, không cần cờ block riêng) |
| Test mới: `lms-auth/login.test.ts` — 6 request trong 15' → request thứ 6 bị chặn (cả phone lẫn email); 2 request đồng thời cùng phone → chỉ 1 row `pending` còn lại |

### 4. email-reaper slow-vs-crash (Gắn kết #2)
| File | Thay đổi |
|---|---|
| `apps/api/src/worker/relay-email-outbox.ts` | `SENDING_REAP_TIMEOUT_MS` 5→15 phút; comment ghi rõ quyết định CHỐT qua validate: chấp nhận at-least-once (Brevo/Graph không hỗ trợ idempotency-key client-cấp qua REST API sẵn có — không đầu tư lock phân tán) |
| Test mới: `worker/relay-email-outbox.test.ts` — row `sending` cập nhật 6' trước KHÔNG bị reap (chậm, chưa crash); row 20' trước VẪN bị reap (crash thật) |

## Vấn đề hạ tầng gặp phải (không phải lỗi code)
1. **Máy khởi động lại giữa chừng** (giữa lúc chạy typecheck cuối Phase 6 ở phiên trước) — làm crash background task, nhưng mọi thay đổi code trên đĩa vẫn nguyên vẹn khi resume (đã xác nhận qua `git status`).
2. **Container `cmcv2-pgfwd`** (socat port-forward `localhost:15432`) không tự khởi động lại cùng stack sau khi máy restart — các container `cmcv2-prod-*` khác đều `healthy` nhưng `pgfwd` ở trạng thái `Exited (255)`. Triệu chứng: lệnh test treo nhiều phút rồi báo "Can't reach database server at localhost:15432", dù `docker exec cmcv2-prod-postgres-1 psql` (trong container) vẫn chạy bình thường — đó là dấu hiệu phân biệt lỗi forwarder chứ không phải Postgres. Fix: `docker start cmcv2-pgfwd` (không cần tạo lại, chỉ khởi động lại container đã có). Named volume `cmc_edu` sống sót nguyên vẹn qua restart. Đã ghi vào memory `cmc-localsim-ops-quirks` để lần sau xử lý nhanh hơn.
3. **1 lần flaky ở `worker/session-done-sweep.test.ts`** (test "0-present session past endTime+24h" — expected 1 outcome, got 2) khi chạy full suite — **KHÔNG thuộc phạm vi Phase 6** (file không hề động tới trong 4 hạng mục trên). Nguyên nhân: `runCancelSweep` dùng query bypass-RLS quét TOÀN BỘ facility (`withFacility(db, null, ..., {bypass:true})`), không scope theo facility của chính test đó — khi chạy song song với các file khác cũng seed `ClassSession` `planned`/`confirmed` có `endTime` quá khứ (tìm thấy 9 file khác có pattern tương tự), có race window ngắn nhặt nhầm session của file khác. Xác nhận đây là pre-existing test-isolation gap, không phải regression: chạy riêng lẻ 3/3 lần đều xanh (11/11), full suite chạy lại ngay sau đó cũng xanh 100% (809/809) không lặp lại lỗi. Không sửa vì ngoài phạm vi Phase 6 (không đụng `session-done-sweep.ts`/`.test.ts`) — nếu muốn khắc phục triệt để cần scope lại query theo facility, để dành cho phase/plan khác nếu cần.

## Đối chiếu Success Criteria
- [x] `grade` phát hiện concurrent-modify, không ghi đè im lặng (2 test: race thật + regrade tuần tự không bị coi nhầm là conflict).
- [x] Không tạo `ReconciliationFlag` trùng — constraint DB thật (không chỉ code comment) + P2002-catch hoạt động đúng; dữ liệu trùng cũ (nếu có) đã có bước dọn trong cùng migration.
- [x] OTP request đua nhau không sinh trạng thái khó hiểu (advisory lock serialize); có rate-limit theo identifier (5 lần/15 phút, soft-block tự nhiên qua rolling window).
- [x] email-reaper phân biệt chậm (không reap, ngưỡng 15') vs crash thật (vẫn reap) — chấp nhận at-least-once làm tradeoff CHỐT, ghi rõ lý do (Brevo/Graph không có idempotency-key khả dụng).

## Unresolved questions
Không có quyết định PO mới phát sinh. Ghi chú kỹ thuật: gap test-isolation của `session-done-sweep.test.ts` (mục 3 ở trên) nằm ngoài scope Phase 6 — nêu ở đây để phase/plan sau cân nhắc nếu muốn dọn triệt để.
