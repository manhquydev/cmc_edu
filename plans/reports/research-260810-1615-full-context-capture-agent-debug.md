# Research: Full operational context capture cho UAT (agent-debuggable)

Ngày: 2026-08-10 | Build ON: `plans/reports/research-260810-1550-agent-friendly-observability.md` (đã chốt pino+reqId ở backend + GlitchTip cho error tracking — coi là FACT, không re-litigate). Task này giải quyết phần còn thiếu: **frontend session/action capture** + **correlation backbone** nối nó với backend, + đóng gap AuditLog.

## Tóm tắt quyết định

| Layer | Chọn | Vì sao thắng | Bỏ qua |
|---|---|---|---|
| Backend error | **GlitchTip** (đã chốt, không đổi) | MCP built-in, 4 container, Sentry-SDK-compatible | — |
| Frontend session/action capture | **OpenReplay self-hosted** | Official MCP (self-host confirmed), thiết kế self-host-first (không phải cloud-product-có-hobby-leftover), active dev (12k★, commit Aug 2026, YC/Runa funded), input masking mặc định bật | PostHog session replay |
| Correlation backbone | **Header propagation thủ công** (session-id header, giống pattern OpenReplay/PostHog đã có sẵn) — KHÔNG OpenTelemetry | OTel giải quyết distributed tracing multi-service; app này là 1 API monolith trên 1 host — overkill, thêm collector+SDK churn không đổi câu trả lời | OpenTelemetry browser+node SDK đầy đủ |
| AuditLog | **Thêm 1 cột `reqId` (nullable)**, KHÔNG thêm ip/userAgent | Join rẻ vào log join-key đã có; ip/userAgent nhân đôi PII-surface vào bảng compliance mà không cần thiết | Duplicate toàn bộ debug context vào AuditLog |
| PII/session replay | **Mask mặc định (input+text), KHÔNG bật video/DOM capture toàn bộ form nhạy cảm** | Cả 2 tool default-on masking, nhưng vẫn phải audit thủ công field nào chứa tên/điểm HS | Ghi full input không mask |

**Câu hỏi cốt lõi "PostHog thay hay bổ sung GlitchTip?"**: **KHÔNG dùng PostHog cho case này.** Lý do ở mục 1 và 6.

---

## 1. Session capture / replay — ranking theo agent-consumability + self-host viability

| Tool | CLI/API | MCP 2026 | Self-host RAM | Session replay | Input masking | Adoption risk |
|---|---|---|---|---|---|---|
| **OpenReplay** | REST API đầy đủ | **Official**, self-host xác nhận hoạt động (`docs.openreplay.com/en/mcp/`: "works against both Cloud and self-hosted"), tool: search session, replay trong chat, funnel/journey/web-vitals | ~8GB tối thiểu (2 vCPU/8GB/50GB theo docs chính thức) — không phải constraint trên laptop 39GB | **Có**, đây là core product, thiết kế cho việc này | `obscureTextEmails`/`obscureInputEmails`/`obscureInputNumbers`/`obscureInputDates` default ON (`defaultInputMode=1` obscured) | **Thấp** — công ty có funding ($4.85-6M, YC+Runa), 12k★, commit gần nhất Aug 2026, thiết kế self-host-first từ đầu |
| **PostHog self-hosted** | REST API, query HogQL | **Official**, phong phú hơn (search replay theo rage-click/dead-click/error event, filter cohort) | Docker "hobby" 7+ container (Kafka+ClickHouse+Zookeeper+Postgres+Redis+Django+Celery) ≥8GB idle | **Có nhưng bị giới hạn nghiêm trọng ở self-host**: chính PostHog xác nhận self-host = "unsupported", "no guarantees", giới hạn ~100k events/tháng, Kubernetes/Helm path đã sunset → **không còn đường production-grade nào cho self-host**, chỉ còn Docker Compose "hobby" | `maskAllInputs: true` default | **Cao cho self-host cụ thể** — không phải rủi ro về công ty (PostHog rất lớn), mà là **chính sách self-host bị 2nd-class hoá**: recommend chuyển sang Cloud khi vượt hobby scale, self-host session-recording có bug report tồn đọng (GitHub #41581 "fresh installation not working") |
| **Sentry self-hosted** | REST API | Community MCP servers cho self-host (`vitalypanait/sentry-self-hosted-mcp`, `ddfourtwo/sentry-selfhosted-mcp`), official MCP chính là remote SaaS (`mcp.sentry.dev`) | 16-26GB, 20+ container (đã chốt loại ở round trước) | Có nhưng có bug thực tế ("Replay Not Found" sau 24h retention, issue #3963 closed-not-planned — dấu hiệu team không ưu tiên vá self-host replay) | Có (rrweb-based, tương tự) | Loại — đã chốt vòng trước vì footprint, thêm bằng chứng mới: replay self-host có known-unfixed bug |
| **GlitchTip** | REST API | Official built-in | 4 container, nhẹ | **Không có, không phải mục tiêu sản phẩm** | N/A | Đã chốt cho error tracking, giữ nguyên vai trò |

**Verdict**: OpenReplay thắng session-replay layer. Không phải vì PostHog kém hơn về mặt tool/MCP (MCP của PostHog phong phú hơn) — mà vì **chính PostHog nói thẳng self-host session replay là "hobby-only, unsupported, no guarantee"**, mâu thuẫn trực tiếp với ràng buộc của dự án này (self-host KHÔNG phải lựa chọn tùy ý mà là yêu cầu cứng vì PII học sinh — xem Ground truth). Đặt PII học sinh vào một tính năng mà chính vendor khuyến cáo "di chuyển sang Cloud khi cần production" là rủi ro kiến trúc, không phải chi tiết vặt. OpenReplay được thiết kế self-host-first ngay từ đầu (đó là lý do tồn tại của công ty), nên không có khoảng cách hỗ trợ đó.

Nguồn: [OpenReplay MCP docs](https://docs.openreplay.com/en/mcp/), [OpenReplay GitHub](https://github.com/openreplay/openreplay), [OpenReplay Docker Compose](https://docs.openreplay.com/en/deployment/deploy-docker/), [OpenReplay sanitize data](https://docs.openreplay.com/en/installation/sanitize-data/), [PostHog self-host docs](https://posthog.com/docs/self-host), [PostHog self-host disclaimer](https://archive.posthog.com/docs/self-host/open-source/disclaimer), [PostHog session replay storage](https://posthog.com/docs/self-host/configure/session-replay-storage), [PostHog issue #41581](https://github.com/PostHog/posthog/issues/41581), [Sentry self-hosted issue #3963](https://github.com/getsentry/self-hosted/issues/3963).

## 2. Correlation backbone: reqId (backend) ↔ session (frontend) — KHÔNG cần OpenTelemetry

Cả OpenReplay và PostHog đều tự cung cấp đúng cơ chế cần: **lấy session id ở client, gắn vào request/error ở backend qua custom header hoặc tag**, không cần một collector/protocol riêng.

Pattern cụ thể cho OpenReplay + tRPC + GlitchTip (Sentry-SDK-compatible):

1. Frontend (`@openreplay/tracker`): `const sessionId = tracker.getSessionID()`.
2. Gắn header vào mọi tRPC call — cách rẻ nhất là 1 dòng trong `httpBatchLink({ headers() { return { 'x-openreplay-session-id': sessionId } } })` (tRPC hỗ trợ `headers` dạng function, gọi lại mỗi request — [tRPC headers docs](https://trpc.io/docs/v10/client/headers)).
3. Đồng thời gắn cùng id đó làm Sentry tag: `Sentry.setTag('openReplaySessionToken', sessionId)` — vì GlitchTip nhận `@sentry/node`/`@sentry/browser` nguyên vẹn, tag này tự động có mặt trên MỌI event GlitchTip bắt được từ session đó, không cần code riêng cho từng lỗi. Đây đúng pattern OpenReplay tài liệu hoá cho tích hợp Sentry ([OpenReplay integrations](https://openreplay.com/integrations.html)).
4. Backend: tRPC context/middleware (nơi `reqId` hiện đã được stamp) đọc header `x-openreplay-session-id`, log nó cùng `reqId` trong 1 dòng pino: `log.info({ reqId, openReplaySessionId }, 'request')`. Giờ 1 dòng JSON log = cả 2 khóa join.
5. Kết quả: agent có 3 điểm vào cùng 1 sự cố — GlitchTip error (đã có tag session id) → pino log (đã có cả reqId lẫn session id) → OpenReplay MCP `get session by id` (replay đầy đủ click/nhập liệu/điều hướng).

**Vì sao không OpenTelemetry**: OTel trace-context (`traceparent` header) giải quyết bài toán *span đi qua nhiều service/nhiều host* — đúng use case microservices. CMC EDU v2 là 1 API monolith (`node:http`) + 1 worker trên 1 docker-compose/1 laptop; không có "distributed" nào để trace. Thêm OTel nghĩa là: 2 SDK mới (browser+node) phải maintain qua các bản major (OTel JS đổi API khá thường xuyên — ví dụ Span Event API bị deprecate 3/2026 theo tài liệu mới), một collector cần vận hành, và learning curve cho 1 operator solo — để cuối cùng trả lời đúng câu hỏi mà 1 header string đã trả lời được. Đánh giá thẳng: **overkill cho quy mô này**, đúng tinh thần YAGNI của dự án.

Nguồn: [tRPC custom headers](https://trpc.io/docs/v10/client/headers), [OpenReplay Sentry integration](https://docs.openreplay.com/en/integrations/sentry/), [OpenReplay sanitize/getSessionID pattern](https://docs.openreplay.com/en/installation/sanitize-data/), [correlation ID best practice 2026](https://sreschool.com/blog/correlation-id/), [OTel Span Event API deprecation note](https://oneuptime.com/blog/post/2026-02-06-otel-request-scoped-correlation-ids/view).

(Ghi chú: PostHog cũng có sẵn cơ chế tương đương — config `__add_tracing_headers` tự inject `X-POSTHOG-SESSION-ID`/`X-POSTHOG-DISTINCT-ID` vào fetch/XHR theo hostname — nên nếu sau này đổi ý sang PostHog, pattern correlation không đổi, chỉ đổi tên header.)

## 3. Đóng gap AuditLog — thêm cột, không nhân đôi bảng

AuditLog hiện có actor/action/entity/entityId/data/createdAt, thiếu reqId/ip/userAgent nên không join được vào lỗi backend hay session frontend.

**Khuyến nghị: thêm đúng 1 cột `reqId` (nullable, index), KHÔNG thêm ip/userAgent vào AuditLog.**

Lý do tách:
- `reqId` là khóa join rẻ và đã tồn tại sẵn trong tRPC context — set nó trong AuditLog insert gần như free, biến "crm.customerCreate xảy ra lúc nào" thành join trực tiếp `WHERE reqId = 'req_abc'` ra đúng dòng log/error tương ứng. Best practice 2026 đồng thuận: gắn request-scoped correlation id có business meaning vào audit record là chuẩn ([oneuptime.com centralized audit logging](https://oneuptime.com/blog/post/2026-02-06-centralized-audit-logging-api-access/view)).
- `ip`/`userAgent` là câu chuyện khác: đây là 2 trường PII-adjacent (định danh thiết bị/vị trí tương đối) đang KHÔNG có trong 1 bảng compliance-audit vốn được thiết kế cho mục đích nghiệp vụ (ai làm gì, khi nào). Nhân đôi chúng vào AuditLog mở rộng phạm vi dữ liệu cá nhân trong 1 bảng có khả năng bị export/audit bởi bên thứ 3 sau này (compliance review), trong khi giá trị debug thực tế của ip/userAgent (đã có sẵn trong pino access-log + nginx access-log) không tăng thêm nhiều so với chỉ có reqId để join sang đó.
- Nếu tương lai thực sự cần "AuditLog nào từ IP lạ" (fraud/security review) — join qua reqId sang pino log (đã có ip nếu access-log ghi) rẻ hơn và giữ ranh giới rõ: AuditLog = "chuyện gì xảy ra về nghiệp vụ", pino/nginx log = "chi tiết kỹ thuật của request đó".

Trade-off nếu KHÔNG làm: business action (vd `finance.receiptApprove`) không join được sang error/session nào gây ra nó — agent debug 1 báo cáo "duyệt phiếu thu bị lỗi" phải đoán thời điểm bằng `createdAt` thay vì join chính xác. Chi phí thêm cột: 1 migration nhỏ, không breaking (nullable), không ảnh hưởng 56 call site hiện có (chỉ set thêm field khi có).

## 4. PII / input masking cho UAT có dữ liệu trẻ vị thành niên

**Cả OpenReplay và PostHog default-on masking** — nhưng "default-on" ≠ "đã an toàn cho case cụ thể của trường học":

- OpenReplay: `obscureTextEmails`, `obscureInputEmails`, `obscureInputNumbers`, `obscureInputDates` default true; `defaultInputMode=1` (obscured) cho MỌI input field trừ khi khai báo khác ([OpenReplay sanitize docs](https://docs.openreplay.com/en/installation/sanitize-data/)).
- Rủi ro thực tế KHÔNG nằm ở input field (đã mask) mà ở **text/DOM content hiển thị** — vd tên học sinh trong bảng điểm, tên phụ huynh trong danh sách CRM, hiển thị dưới dạng text/table, không phải `<input>`. Mặc định "mask input" không tự động che các phần tử `<td>`/`<span>` chứa tên/điểm. Cả 2 tool có cơ chế `blockClass`/`blockSelector` (PostHog) hoặc tương đương để chặn theo CSS class/selector — nhưng đây là việc phải làm chủ động, cần rà 1 lượt các trang có PII học sinh (attendance, grading, CRM) và gắn class chặn/`ph-no-capture` tương ứng, KHÔNG đến tự nhiên từ default config.
- **Khuyến nghị cụ thể cho CMC EDU v2**: bật session replay cho toàn site (ít route, dễ audit), nhưng **chặn record ở các màn hình lộ PII đậm đặc nhất**: `apps/admin/src/pages/teaching/grading.tsx`, `attendance.tsx`/`attendance-panel.tsx`, và trang CRM có thông tin liên hệ phụ huynh — đánh dấu container chính bằng block-selector, giữ lại action bên ngoài (nav, click nút) để vẫn tái hiện được luồng thao tác dẫn tới lỗi mà không ghi nội dung nhạy cảm. Đây là điểm cần rà thủ công 1 lần, không phải cấu hình 1 dòng.
- **Trade-off thẳng thắn**: capture "toàn bộ thao tác" và capture "an toàn cho PII trẻ vị thành niên" có xung đột thật — muốn tái hiện đầy đủ sequence để debug nghĩa là ghi lại nhiều hơn zero, dù đã mask input. Với 2-4 tuần UAT + retention ngắn (dữ liệu ở lại trên laptop của chính operator, không rời hạ tầng — đã thỏa constraint self-host/PII locality), rủi ro dư thừa là chấp nhận được NẾU: (a) block-selector các trang PII đậm đặc, (b) retention session replay đặt ngắn (vd 7-14 ngày, xoá sau khi hết giá trị debug), (c) không bật video/canvas recording (không cần cho web app dạng form/table này).

## 5. Workflow debug đầu-cuối cho agent (Claude Code)

Kịch bản: user UAT báo "bấm duyệt điểm thì lỗi".

1. Agent hỏi user (hoặc đọc báo cáo) lấy mốc thời gian gần đúng + tên user/role.
2. `docker compose logs api --no-log-prefix | jq -c 'select(.level>=50 and (.time | . >= <t0> and . <= <t1>))'` → tìm dòng lỗi, lấy `reqId` + `openReplaySessionId` từ chính dòng log đó (đã gắn theo mục 2).
3. Gọi GlitchTip MCP `search_issues`/`get_issue` bằng `reqId` (nếu GlitchTip index theo tag) hoặc theo thời gian — lấy stack trace đầy đủ, số lần xảy ra.
4. Gọi OpenReplay MCP `get_session(session_id=openReplaySessionId)` — xem lại chính xác: user bấm gì, nhập gì (đã mask phần nhạy cảm), điều hướng qua trang nào trước khi lỗi, network request nào trả về gì.
5. `SELECT * FROM "AuditLog" WHERE "reqId" = '<reqId>'` (sau khi làm mục 3) — biết đây có phải hành động nghiệp vụ nào trong 56 action đã log không, entity nào bị ảnh hưởng.
6. Tổng hợp: agent có đủ 4 mảnh — thao tác UI (OpenReplay), request cụ thể + stack trace (GlitchTip), log chi tiết request (pino via reqId), và business record bị/được thay đổi (AuditLog) — dựng lại toàn bộ chuỗi nhân-quả mà không cần hỏi lại user thêm chi tiết kỹ thuật nào.

Công cụ ngắn nhất cho vòng lặp này: **GlitchTip MCP + OpenReplay MCP + `jq` trên pino log + `psql`/Prisma query AuditLog** — không cần thêm dashboard nào con người phải mở tay.

## 6. Khuyến nghị theo tier

### Tier 0 (đã có, không đổi)
pino + reqId + GlitchTip — theo research round trước, giữ nguyên.

### Tier 1 — làm cho UAT lần này (frontend context capture)
1. Deploy **OpenReplay self-hosted** trên laptop (cùng docker-compose, 39GB RAM dư dả cho 8GB yêu cầu — không phải vấn đề). Không đặt lên VPS 2GB.
2. Gắn `@openreplay/tracker` vào cả 2 SPA (admin, lms).
3. Thêm correlation header (mục 2): 1 dòng trong tRPC client `headers()`, 1 dòng `Sentry.setTag` khi khởi tạo tracker, 1 dòng đọc header trong tRPC context ở backend, thêm field vào pino log call đã có.
4. Audit thủ công 1 lượt các trang PII đậm đặc (grading, attendance, CRM contact) → gắn block-selector.
5. Đăng ký OpenReplay MCP (official, self-host) vào Claude Code project config.
6. Migration nhỏ: thêm cột `reqId` nullable vào `AuditLog`, set nó ở nơi hiện đang ghi AuditLog (tận dụng reqId đã có trong context, không cần thu thập thêm).

### Rõ ràng KHÔNG làm
- **PostHog** cho session replay — self-host bị chính vendor coi là hobby/unsupported, mâu thuẫn với yêu cầu cứng self-host+PII của dự án. (Vẫn có thể hợp lý nếu sau này đổi hẳn sang PostHog Cloud + chấp nhận dữ liệu rời laptop — không phải trường hợp này.)
- **OpenTelemetry đầy đủ** (browser+node SDK, collector) — giải quyết bài toán distributed tracing mà app 1-host này không có; header-propagation thủ công rẻ hơn và đạt cùng mục tiêu agent-pivot.
- **Duplicate ip/userAgent vào AuditLog** — mở rộng PII-surface một bảng compliance không cần thiết; join qua reqId đủ.
- **Video/canvas recording, ghi full input không mask** — không cần thiết cho web form/table app, tăng rủi ro PII trẻ vị thành niên không tương xứng giá trị debug thêm.

## Giới hạn nghiên cứu / câu hỏi chưa giải quyết

- Chưa verify trực tiếp bằng cách deploy thật: `getSessionID()` API tồn tại đúng như tài liệu ở version OpenReplay mới nhất (đã đọc qua nhiều version doc path khác nhau, vd `/en/v1.18.0/` lẫn `/en/`) — nên smoke-test trước khi phụ thuộc vào tên hàm/header chính xác.
- Chưa xác nhận GlitchTip MCP có tool tìm issue theo custom tag (`openReplaySessionToken`) hay chỉ theo thời gian/text search — nếu không hỗ trợ filter theo tag, bước 3 trong workflow (mục 5) phải làm qua tìm theo mốc thời gian thay vì tag trực tiếp; cần verify khi triển khai thật.
- OpenReplay MCP official được xác nhận qua tài liệu chính thức của OpenReplay, nhưng chưa tự chạy thử tool thật trên 1 self-host instance trong nghiên cứu này — nên smoke-test trước UAT thật, giống khuyến nghị đã ghi cho GlitchTip MCP ở round trước.
- Chưa đo RAM thực tế của OpenReplay self-host trên máy cụ thể này (docs ghi 8GB tối thiểu cho "low/moderate volume" — với UAT vài chục user chắc chắn dưới ngưỡng đó, nhưng chưa benchmark tại chỗ).
- `AuditLog.reqId` migration cụ thể (tên field, nơi set trong code — 56 call site) là việc implementation, chưa spec chi tiết ở đây, cần 1 phase riêng.
