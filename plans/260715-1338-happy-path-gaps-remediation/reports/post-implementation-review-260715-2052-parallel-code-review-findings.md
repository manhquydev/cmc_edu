# Nghiệm thu thực tế + rà soát sau triển khai — commit 9c1522c

**Ngày:** 2026-07-15 · **Phạm vi:** 3 `code-reviewer` subagent song song, review toàn bộ diff commit `9c1522c` (65 file, dc6a4db..9c1522c) — không tin tưởng test xanh sẵn có, tìm bug/regression/edge-case thật.

## Đối chiếu success criteria đã nghiệm thu

Toàn bộ 7 tiêu chí tổng của plan (`plan.md`) đã được đánh dấu `[x]` với bằng chứng test. Rà soát này phát hiện **2 tiêu chí không hoàn toàn đúng như đã nghiệm thu**:

- Tiêu chí #1 ("...reconcile bắt được nếu lọt"): **KHÔNG đúng trong production** — reconciler layer-2 (`reconcileCancelledButProvisioned`) chưa bao giờ chạy (finding H2 dưới đây). Test `receipt-cancel-provisioning-race.test.ts` gọi hàm TRỰC TIẾP nên vẫn xanh, nhưng worker thật không bao giờ gọi nó.
- Tiêu chí #6 ("FinalGrade tự refresh sau sửa điểm danh"): **chưa đầy đủ** — chỉ đúng cho `attendance.mark`/`markAll`, KHÔNG đúng cho `classSession.cancel` (finding M4 dưới đây).

## Findings — xếp theo mức độ nghiêm trọng

### HIGH

**H1 — `submission.saveTeacherAnnotation` không có class-ownership scoping (cross-teacher write bypass)**
`apps/api/src/submission/router.ts:386-420`. Sibling `submission.grade` NGAY TRÊN vừa được thêm `assertTeacherOwnsClass` trong chính diff này (vì "giáo viên chỉ được chấm bài học sinh lớp mình"), nhưng `saveTeacherAnnotation` (cùng permission gate, cùng bảng `Submission`) không có check nào ngoài `facilityId`. Giáo viên B (không thuộc lớp X) có thể ghi đè annotation PDF của học sinh lớp X (giáo viên A phụ trách) nếu biết `submissionId`.

**H2 — `reconcileCancelledButProvisioned` (layer-2 backstop, Phase 2) chưa được wire vào worker thật — dead code trong production**
Đã tự xác minh bằng grep: `apps/api/src/worker/index.ts` (`drainOnce`) gọi `reconcileOrphanedReceipts`, `relayEmailOutbox`, `runDoneSweep`, `runCancelSweep` — **không** gọi `reconcileCancelledButProvisioned`. Hàm chỉ được test bằng cách gọi trực tiếp (`receipt-cancel-provisioning-race.test.ts`), không qua chu trình worker thật. "Lưới đỡ lớp 2" tôi xây ở Phase 2 hiện không chạy trên bất kỳ lịch nào.

**H3 — Duplicate-student gate có TOCTOU thật với receipt DRAFT (chưa approve)**
`apps/api/src/finance/router.ts:731-741` (query `existingStudents`) + `:277-292` (tính `kind`). Gate chỉ nhìn Student đã PROVISION (qua Guardian) — chỉ tồn tại sau khi receipt được APPROVE. Hai lệnh `receiptCreate` cùng phone gửi trước khi bất kỳ cái nào được approve (khoảng thời gian thực tế — approve cần role khác, draft có thể nằm hàng giờ/ngày) đều thấy `existingStudents=[]`, đều pass gate không cần `studentId`, đều thành `kind='new'` khi approve → tạo 2 Student trùng cho cùng 1 đứa trẻ — đúng kịch bản mà tính năng này được xây để chặn.

**H4 — OTP advisory-lock transaction dùng timeout Prisma mặc định (~5s) thay vì 15s như `withFacility`**
Đã tự xác minh: `apps/api/src/lms-auth/router.ts:197,345` gọi `ctx.db.$transaction(...)` TRỰC TIẾP, không qua `withFacility` (dòng 79 `packages/db/src/index.ts` đặt `{timeout: 15_000}` với lý do đã ghi rõ trong code: dưới tải song song, transaction có thể chạm deadline mặc định). `requestOtp`/`requestOtpEmail` là `publicProcedure` KHÔNG cần đăng nhập — nhiều request đồng thời cùng SĐT đều giữ 1 connection Prisma trong lúc chờ advisory lock (Postgres lock wait KHÔNG nhả connection). Không có `connection_limit` cấu hình ở đâu trong repo → có thể cạn pool connection, ảnh hưởng TOÀN BỘ API, không chỉ endpoint OTP.

### MEDIUM-HIGH

**MH1 — `submission.listForGrading` đọc không scope theo lớp**
`apps/api/src/submission/router.ts:423-437`. `grade` đã scope theo lớp, nhưng thủ tục đọc song hành vẫn trả TOÀN BỘ Submission trong facility (mọi exercise/status) — bao gồm `basePdfRef` và điểm — bất kể giáo viên có phụ trách lớp đó hay không. Rò rỉ thông tin bài làm/điểm học sinh lớp khác cùng facility.

### MEDIUM

**M1 — `assessment.listBySession` + `sessionEvidence.getBySession` không được scope dù sibling mutation cùng file đã hardened**
`apps/api/src/assessment/router.ts:309-320`, `apps/api/src/session-evidence/router.ts:217-242`. Giáo viên không phụ trách lớp vẫn đọc được nhận xét/trạng thái+blobRef ảnh minh chứng của lớp giáo viên khác qua `classSessionId`/`sessionEvidenceId`.

**M2 — `classSession.cancel` không gọi `recomputeFinalGrade` — FinalGrade có thể stale sau khi huỷ buổi hồi tố**
`apps/api/src/class/class-session-router.ts:97-136`. Đúng loại bug Phase 7 chủ đích sửa (FinalGrade phải refresh khi mẫu số điểm danh đổi) nhưng bỏ sót case huỷ buổi SAU KHI đã điểm danh — `reportCard` phụ huynh thấy vẫn giữ điểm cũ tới khi có 1 sự kiện điểm danh/chấm bài KHÁC không liên quan vô tình trigger refresh.

**M3 — Reconciler (một khi được wire) thiếu check M9 invariant**
`apps/api/src/worker/reconcile-orphaned-receipts.ts:198-230`. Rút Enrollment active không điều kiện — không check "còn receipt approved khác cùng student+class không" như path chính (`runCancelTransaction`) đã làm. Nếu wire finding H2 mà không sửa cùng, có thể rút nhầm chỗ học hợp lệ.

**M4 — Thiếu index `Receipt.studentId` cho query kind mới** — chạy mỗi lần `receiptApprove`, hiện chỉ dùng được index `facilityId` rồi scan.

**M5 — Ngưỡng reap (15p) giờ vượt TTL sweep OTP (5p) — email OTP khôi phục sau crash có thể gửi rỗng nội dung**
`apps/api/src/worker/relay-email-outbox.ts`. Worker poll mỗi 30s. Nếu crash giữa lúc gửi, row kẹt `sending`: ở phút thứ 5, `sweepStaleOtpPayloads` đã xoá payload (mọi status, kể cả `sending`) nhưng `reap` chưa reset (ngưỡng 15p) → tới phút 15 reap mới đưa về `pending`, drain gửi với payload đã bị xoá → email rỗng nội dung thay vì có mã hoặc không gửi. Comment code ở dòng 288-296 khẳng định bất biến "sweep chỉ bắt row drain chưa xử lý" — bất biến này ĐÚNG khi reap=sweep=5p, KHÔNG còn đúng khi reap=15p > sweep=5p.

### LOW

- **L1** — Thứ tự check: session/business-state check chạy TRƯỚC ownership check ở vài thủ tục attendance/session-evidence → giáo viên không phận sự biết trạng thái nghiệp vụ trước khi bị FORBIDDEN. Pattern có sẵn từ trước, không phải mới.
- **L2** — Migration dedup (H5) không set `resolvedById`/`resolvedAt` khi dồn flag trùng — khác mọi code path khác luôn set cả 2.
- **L3** — `docs/11-api-contract.md` chưa cập nhật `receiptCreate`'s `needs_confirmation`/`confirmNewStudent`.
- **L4** — `warning`/`warnings` field mới (manualPunch.approve, guardian.approveLink, meeting.schedule) được backend tính nhưng KHÔNG UI nào hiển thị (`check-in-out.tsx`, `parents/index.tsx` đều bỏ qua). Tính năng "cảnh báo cho staff" hiện chưa có tác dụng thực tế với người dùng.

## Không phải vấn đề (đã kiểm chứng, không phải oversight)
- `submission.grade` CAS lock, Tier B time-gate rewrite, `markAll` dedupe theo studentId, `rewards.reject` refund fallback (không thể xảy ra do StarTransaction append-only), K9 reversal logic, `receiptCreate` contract sweep repo-wide (e2e đều dùng phone random + narrow status generic) — đều đúng, có test thật chứng minh.

## Đề xuất hướng sửa (chưa làm — chờ quyết định)
1. H1: thêm `assertTeacherOwnsClass`/tương đương vào `saveTeacherAnnotation`.
2. H2: wire `reconcileCancelledButProvisioned` vào `drainOnce`, HOẶC bỏ comment "layer 2 backstop" nếu cố tình defer.
3. H3: khoá advisory lock theo `(facilityId, normalizedPhone)` cho receipt draft chưa có studentId, hoặc chuyển quyết định new/renewal về thời điểm approve có cross-check draft anh em.
4. H4: đưa 2 transaction OTP qua `withFacility` (hoặc truyền `{timeout: 15_000}` trực tiếp) + cân nhắc rate-limit tầng request thật.
5. MH1, M1: thêm scope check cho các thủ tục đọc song hành.
6. M2: gọi `recomputeFinalGrade` trong `classSession.cancel`.
7. M3: thêm check M9 vào reconciler trước khi wire (làm cùng H2).
8. M4: `@@index([facilityId, studentId])`.
9. M5: loại trừ row `sending` kind=otp khỏi sweep tới khi có cơ hội reap-redrain, hoặc rút ngắn riêng ngưỡng reap cho OTP.

## Unresolved questions
- H2/M3 (reconciler): có phải cố tình defer sang phase khác, hay bỏ sót thật?
- L4 (warnings không hiển thị UI): có kế hoạch UI theo sau không, hay chấp nhận API-only tạm thời?
- M5: quyết định "CHỐT at-least-once" ở Phase 6 có tính tới tương tác với OTP sweep TTL không, hay chỉ xét case email thông báo thường?
