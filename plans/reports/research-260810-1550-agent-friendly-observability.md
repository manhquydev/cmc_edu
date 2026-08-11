# Research: Observability tooling tối ưu cho AI coding agent (CMC EDU v2)

Ngày: 2026-08-10 | Phạm vi: chọn logging/error-tracking/metrics/uptime cho self-hosted trial, tiêu chí quyết định DUY NHẤT = agent (Claude Code) có tự tra cứu/query được không (CLI/API/MCP), không phải con người click dashboard.

## Tóm tắt quyết định (đọc trước, chi tiết bên dưới)

| Lớp | Chọn | Vì sao thắng | Bỏ qua |
|---|---|---|---|
| Structured logging | **pino** (JSON to stdout) | Nhanh nhất, JSON-native, `docker compose logs \| jq` thành query engine miễn phí | winston/bunyan (chậm hơn, không cần) |
| Error tracking | **GlitchTip self-hosted** | Native built-in MCP server (17 tools), 4 container nhẹ, Sentry-SDK-compatible (đổi DSN là chạy) | Sentry self-hosted (20+ container, 16–26GB RAM chỉ để bắt lỗi — quá tải cho 1 người) |
| Log aggregation | **Chưa cần** (Tier 1 dự phòng: Loki) | `docker compose logs` trên 1 host laptop đã là "aggregated" rồi — không có bài toán multi-host | Loki/VictoriaLogs/OpenObserve ngay từ đầu (YAGNI) |
| Metrics (Prometheus/Grafana) | **Không làm trong UAT** | Không có câu hỏi trend/SLO nào đang cần trả lời; là dashboard-ceremony agent không đụng tới | Toàn bộ stack Prometheus+Grafana |
| Uptime/health | **healthchecks.io** (ping từ `/health` qua cron) | REST API thật (`/api/v3/checks/`), agent `curl` thẳng, không cần MCP | Uptime Kuma (không có REST API chính thức, chỉ có MCP wrapper cộng đồng chưa kiểm chứng ổn định) |

---

## 1. Structured logging: pino vs hiện trạng console.error

**Hiện trạng**: `console.error('[api] ...', err)` — text tự do, agent phải regex/heuristic để tách level/context/stack, không có field nào tra được chính xác (không req id, không statusCode field).

**pino** — JSON-per-line tới stdout, ~600k-720k ops/sec (3-6x Bunyan, 7-8x console/Winston theo benchmark được nhiều nguồn 2026 nhắc lại) ([Dash0 guide](https://www.dash0.com/guides/logging-in-node-js-with-pino), [HireNodeJS](https://www.hirenodejs.com/blog/nodejs-pino-logging-production-2026), [1xAPI](https://dev.to/1xapi/how-to-add-structured-logging-to-nodejs-apis-with-pino-9-opentelemetry-2026-guide-3jd2)).

Agent workflow cụ thể, so sánh:
- Hiện tại: `docker compose logs api | grep -i error` → chuỗi text lộn xộn, agent phải đoán ranh giới message/stack.
- Với pino: `docker compose logs api --no-log-prefix | jq -c 'select(.level>=50)'` → agent lọc chính xác theo field `level`, `err.stack`, `reqId`, `statusCode`, `msg`; có thể pipe tiếp `jq 'select(.reqId=="req_abc123")'` để dựng lại toàn bộ trace của 1 request lỗi trong vài giây thay vì đọc log thủ công.
- Thêm `reqId` correlation (tRPC middleware set 1 id/request) là gần như miễn phí về code, nhưng biến "log của 1 request rải rác nhiều dòng" thành 1 field-query — đây là điểm nâng cấp giá trị nhất, quan trọng hơn cả việc đổi logger.

Kết luận: pino là baseline không cần bàn cãi — rẻ, nhanh, JSON out-of-the-box, có transport sẵn cho Loki/OTel nếu sau này cần ([SigNoz](https://signoz.io/guides/pino-logger-nodejs-logging-library/)). Không cần OpenTelemetry tracing đầy đủ ở quy mô 1 operator/1 host — correlation id đơn giản đã đủ giá trị, OTel distributed tracing giải quyết bài toán multi-service/multi-host mà app này (1 laptop, docker-compose) không có.

## 2. Log aggregation/query — Loki vs đơn giản hơn

| Tool | CLI/API cho agent | MCP 2026 | Footprint | Verdict |
|---|---|---|---|---|
| **`docker compose logs`+jq** | Có sẵn, không cần cài gì | N/A (không cần) | 0 | **Đủ dùng ở quy mô hiện tại** — 1 host, không cần cross-host aggregation |
| **Grafana Loki** | LogCLI + HTTP API (`/loki/api/v1/query_range`) | Có — chính thức `grafana/loki-mcp` ([GitHub](https://github.com/grafana/loki-mcp)) + cộng đồng: `abl030/loki-mcp` (42 tool phủ 100% Loki HTTP API), `incu6us/loki-mcp-server` (discovery-first, không cần Grafana), `ghrud92/simple-loki-mcp` (dùng logcli) | Nhẹ ở "simple scalable mode" nhưng vẫn cần Promtail/Alloy + config | Dự phòng Tier 1 nếu log-retention 10m×3 hiện tại không đủ để điều tra a posteriori |
| **Dozzle** | Chỉ đọc qua Docker API (giống `docker logs`), không có query language, không lưu trữ | Không tìm thấy MCP nào | Rất nhẹ (1 container) | Thừa — không cộng thêm giá trị so với `docker compose logs` sẵn có |
| **VictoriaLogs** | LogsQL + HTTP API, tự nhận nhẹ/nhanh hơn Loki | **Không tìm thấy MCP server nào được xác nhận** trong nghiên cứu này | Nhẹ hơn Loki | Thua tiêu chí quyết định (agent-consumability) dù kỹ thuật tốt hơn |
| **OpenObserve** | HTTP API tương thích OTel, Rust, ít RAM | Không tìm thấy MCP xác nhận | Nhẹ | Tương tự — thua vì thiếu MCP ecosystem |
| **Quickwit** | API + object storage | Không tìm thấy MCP xác nhận | Thiết kế cho scale lớn (Kafka ingestion) | Overkill cho quy mô 1 host, cũng thiếu MCP |

**Điểm mấu chốt**: câu hỏi "aggregation" thường tồn tại vì log rải nhiều host/nhiều service khó gom. Ở đây toàn bộ hệ thống chạy trong 1 `docker-compose` trên 1 laptop — `docker compose logs <service>` ĐÃ LÀ tập trung rồi. Giá trị thật của Loki chỉ là: (a) retention dài hơn cap hiện tại (10m×3), (b) LogQL cho pattern phức tạp. Nếu chỉ vậy, cách rẻ hơn là tăng `max-size`/`max-file` của json-file driver trước (laptop có 39GB RAM, không phải constraint) — chưa cần Loki. Nếu sau này thực sự cần cross-service correlation dài hạn, Loki thắng rõ ràng nhờ hệ sinh thái MCP (4 lựa chọn, kể cả chính thức từ Grafana) — VictoriaLogs/OpenObserve/Quickwit dù kỹ thuật ổn nhưng **thua tiêu chí quyết định của task này**.

## 3. Error tracking — đòn bẩy cao nhất theo đúng khung câu hỏi

### Sentry self-hosted
- Yêu cầu tối thiểu chính thức 16GB RAM; thực tế idle 5-9GB, tải thật 15-26GB ([DeepWiki system requirements](https://deepwiki.com/getsentry/self-hosted/3.1-system-requirements), [urgentry.com RAM guide](https://urgentry.com/guides/self-hosting/sentry-self-hosted-ram/), [GitHub issue #3467](https://github.com/getsentry/self-hosted/issues/3467)).
- 20+ container (Kafka, ClickHouse, Snuba, Relay, Redis, Postgres...) — gánh vận hành lớn cho 1 operator solo không có đội ops, đúng cảnh báo trong `AGENTS.md` (không có review con người, CI + chính operator là "đội" duy nhất).
- MCP: server chính thức host tại `mcp.sentry.dev` (remote, OAuth) ([Sentry docs](https://docs.sentry.io/ai/), [mcp.so listing](https://mcp.so/servers/sentry-mcp)) — nhưng đây là MCP hướng tới **SaaS Sentry**; chưa xác nhận được nó point thẳng vào self-hosted instance dễ dàng (câu hỏi mở, xem cuối báo cáo).
- SaaS free tier (Developer): 1 user, 5.000 events/tháng, 30 ngày lưu trữ, 5GB logs, 5GB metrics, 1 cron monitor ([costbench.com](https://costbench.com/software/developer-tools/sentry/free-plan/)) — đủ cho quy mô UAT 2-4 tuần, nhưng nghĩa là **dữ liệu lỗi (có thể chứa PII học viên trong stack trace/breadcrumb) rời khỏi hạ tầng của operator** — mâu thuẫn với tinh thần self-host hiện tại của dự án.

### GlitchTip self-hosted
- Kiến trúc: Django + Celery + Postgres + Redis — 4 container, "2GB VPS chạy thoải mái" theo nhiều nguồn so sánh ([Dash0 comparison](https://www.dash0.com/comparisons/8-best-glitchtip-alternatives-in-2026), [DanubeData](https://danubedata.ro/blog/self-host-sentry-glitchtip-error-tracking-2026)).
- **Drop-in Sentry SDK compatible**: chỉ đổi DSN, `@sentry/node` hoạt động nguyên vẹn, không cần viết instrumentation riêng.
- **MCP built-in chính thức** (không phải fork cộng đồng): bật bằng `GLITCHTIP_ENABLE_MCP=True`, chạy tại `https://<host>/mcp`, OAuth2 hoặc API token, hỗ trợ Claude Code trực tiếp. 17 tool chia 5 nhóm: Organizations/Projects, Issue Management, Performance Monitoring (bao gồm N+1 detection!), Alerting/Uptime, Logs (search/retrieve log events) ([glitchtip.com/documentation/mcp](https://glitchtip.com/documentation/mcp/)).
- GlitchTip 6 (phát hành tháng 2/2026) cải thiện stack trace + performance. Không có session replay — không liên quan tới việc agent debug backend nên không phải mất mát.

**Verdict**: GlitchTip thắng dứt khoát cho case này — footprint nhỏ hơn Sentry self-host ~5-10x, MCP **có sẵn từ nhà phát triển** (không phải chờ cộng đồng maintain), dữ liệu lỗi ở lại trên laptop (khớp mô hình self-host qua reverse tunnel đã chọn), và tận dụng được `@sentry/node` — SDK phổ biến, code portable nếu sau này đổi ý sang Sentry thật. Đây đúng là "single highest-leverage tool" mà đề bài gợi ý.

## 4. Metrics — Prometheus/Grafana có đáng không?

**Đánh giá thẳng: KHÔNG, chưa cần trong giai đoạn UAT này.**

Lý do:
- Không có câu hỏi vận hành nào hiện tại cần trend/percentile theo thời gian (không SLO, không on-call, không đội vận hành theo dõi 24/7).
- Agent debug lỗi cụ thể ("tại sao request X fail") cần **log/error của chính request đó**, không cần biểu đồ p95 latency — đúng như đề bài: "an agent does not click charts". Việc thêm Prometheus+Grafana+node-exporter+cAdvisor là ceremony cho con người nhìn dashboard, không phải thứ agent chủ động dùng để chẩn đoán.
- Backend hiện chưa có `/metrics` endpoint — muốn có phải viết instrumentation (`prom-client`) thủ công trên raw `node:http` handler, việc chưa có yêu cầu nghiệp vụ nào đòi hỏi (vi phạm YAGNI).
- Nếu chỉ cần biết "endpoint nào chậm" — thêm field `durationMs` vào pino access-log rồi `jq`/`awk` tính percentile thủ công qua log file rẻ hơn nhiều so với đứng cả stack mới.
- **Nếu tương lai thực sự cần** (UAT kéo dài thành production thật, cần theo dõi DB pool saturation qua nhiều ngày...): đường agent-queryable đã có sẵn và chính thức — `grafana/mcp-grafana` chạy PromQL instant/range query, lấy metric metadata, tính percentile qua `histogram_quantile` ([GitHub grafana/mcp-grafana](https://github.com/grafana/mcp-grafana), [Grafana docs](https://grafana.com/docs/grafana/latest/developer-resources/mcp/guides/query-metrics-with-prometheus/)). Ghi nhận đây là on-ramp rõ ràng, không phải ngõ cụt — chỉ là chưa đến lúc.

## 5. Uptime/health monitoring

| Tool | API | MCP | Đánh giá |
|---|---|---|---|
| **Uptime Kuma** | **Không có REST API chính thức** — chỉ Socket.IO, hoặc Python package `uptime-kuma-api` không chính thức ([search kết quả]) | Có nhưng đều là cộng đồng: `DavidFuchs/mcp-uptime-kuma` (v2, stdio/HTTP, `getMonitorSummary`/`listMonitors`/`getMonitor`), `phukit29182/uptime-kuma-mcp-server` ([GitHub](https://github.com/DavidFuchs/mcp-uptime-kuma)) | Dashboard-first tool, agent phải qua lớp MCP chưa chính thức, thêm 1 container + rủi ro breaking khi Uptime Kuma upstream đổi Socket.IO API |
| **healthchecks.io** | REST API chính thức `/api/v3/checks/` để tạo/tra check, dead-man's-switch model (job ping sau khi chạy xong, im lặng quá grace period → alert) ([healthchecks.io/docs](https://healthchecks.io/docs/), [monitoring cron docs](https://healthchecks.io/docs/monitoring_cron_jobs/)) | Không cần MCP — REST API đơn giản agent `curl`/script thẳng | Free hosted tier có sẵn, hoặc tự host (Django+Postgres, nhẹ hơn nhiều Sentry) |

**Vấn đề "laptop sleep khi gập nắp" ≠ outage thật**: bất kỳ hệ thống polling từ bên ngoài (kiểu Uptime Kuma "check every N phút") đều sẽ báo "down" mỗi khi laptop ngủ — nhiễu > tín hiệu nếu theo dõi 24/7 không phân biệt. Mô hình dead-man's-switch (healthchecks.io) tự nhiên khớp hơn: đặt `grace period` đủ rộng để bao trùm khung giờ operator biết laptop sẽ ngủ, chỉ alert khi im lặng vượt ngưỡng đó — vẫn bắt được outage thật (VPS/Caddy/tunnel chết) mà giảm false-positive từ việc gập laptop có chủ đích. Điểm theo dõi quan trọng nhất thực chất là **tunnel/VPS/Caddy còn sống hay không** (nếu chết, user không vào được app dù laptop có chạy) — nên đặt cron ping trên chính VPS gọi vào `/health` qua tunnel, không phải theo dõi container-level trên laptop.

**Verdict**: healthchecks.io thắng — API thật, đơn giản hơn Uptime Kuma cho agent, và khớp tự nhiên với thực tế "máy ngủ theo lịch". Uptime Kuma là dashboard-first cho con người, đúng loại ceremony đề bài bảo weight thấp.

## 6. Bảng MCP landscape 2026 (tổng hợp)

| Công cụ | MCP status | Nguồn |
|---|---|---|
| Sentry (SaaS) | Chính thức, hosted remote (`mcp.sentry.dev`), OAuth | [docs.sentry.io/ai](https://docs.sentry.io/ai/) |
| GlitchTip | **Chính thức, built-in**, self-hosted, 17 tools | [glitchtip.com/documentation/mcp](https://glitchtip.com/documentation/mcp/) |
| Grafana (Loki+Prometheus+...) | Chính thức `grafana/mcp-grafana`, đa data source qua 1 server | [github.com/grafana/mcp-grafana](https://github.com/grafana/mcp-grafana) |
| Loki (standalone, không cần Grafana) | Chính thức `grafana/loki-mcp` + 3 server cộng đồng | [github.com/grafana/loki-mcp](https://github.com/grafana/loki-mcp) |
| Uptime Kuma | Chỉ cộng đồng (2+ triển khai độc lập) | [github.com/DavidFuchs/mcp-uptime-kuma](https://github.com/DavidFuchs/mcp-uptime-kuma) |
| healthchecks.io | Không cần — REST API đủ đơn giản | [healthchecks.io/docs](https://healthchecks.io/docs/) |
| VictoriaLogs / OpenObserve / Quickwit | Không tìm thấy MCP xác nhận | (nghiên cứu này) |
| Dozzle | Không tìm thấy MCP | (nghiên cứu này) |

## 7. Khuyến nghị theo tier (áp dụng thực tế cho CMC EDU v2)

**Bối cảnh áp dụng**: mọi collector nặng (Loki, GlitchTip, Postgres/Redis của nó) chạy trên **laptop** (39GB RAM dư dả) cùng compose stack hiện tại — KHÔNG đặt lên VPS 2GB (VPS chỉ nên tiếp tục làm Caddy + tunnel passthrough, không cõng thêm state).

### Tier 0 — làm ngay, chi phí thấp, đòn bẩy cao nhất
1. Thay `console.error`/`console.log` bằng **pino**, JSON ra stdout, giữ nguyên docker `json-file` driver. Thêm 1 `reqId` correlation vào context tRPC (per-request id) — biến `docker compose logs | jq` thành full request-trace tool cho agent.
2. Tăng cap log rotation Docker (`max-size`/`max-file`) từ 10m×3 lên rộng hơn (laptop không thiếu disk) — bảo hiểm rẻ để agent còn log mà tra cứu sau khi có báo cáo lỗi.
3. Deploy **GlitchTip** self-hosted (4 container) trên laptop, gắn `@sentry/node` vào cả API server và worker (đổi DSN trỏ về GlitchTip). Bật `GLITCHTIP_ENABLE_MCP=True`, đăng ký MCP server này vào Claude Code project config. Đây là công cụ "agent tự tra: lỗi gì, stack trace nào, đã xảy ra bao nhiêu lần" — giá trị/chi phí tốt nhất trong toàn bộ nghiên cứu.
4. Thiết lập 1 check trên **healthchecks.io** (free tier), cron trên VPS `curl` vào `/health` qua tunnel định kỳ, grace period đủ rộng bao trùm khung giờ laptop có thể ngủ.

### Tier 1 — chỉ thêm nếu UAT kéo dài quá 2-4 tuần / có user thật phụ thuộc liên tục
5. **Loki** + 1 trong các MCP wrapper (`grafana/loki-mcp` chính thức, hoặc `ghrud92/simple-loki-mcp` nếu muốn tránh cài cả Grafana) — chỉ khi cap log rotation ở Tier 0 vẫn không đủ (cần tra log cũ hơn retention, hoặc cần LogQL pattern phức tạp xuyên nhiều service).
6. Instrumentation `prom-client` tối thiểu + Grafana MCP — chỉ khi có câu hỏi trend/SLO cụ thể (vd DB pool saturation qua nhiều ngày) mà log-grep không trả lời được. Hiện tại đánh giá **KHÔNG đáng** làm.

### Rõ ràng KHÔNG nên làm bây giờ
- **Sentry self-hosted đầy đủ** — 20+ container, 16-26GB RAM chỉ để bắt lỗi, quá tải cho 1 operator solo không có đội vận hành; GlitchTip cho ~90% giá trị ở ~5-10% footprint và có MCP built-in tương đương hoặc tốt hơn.
- **Uptime Kuma** — thêm 1 dashboard + phụ thuộc MCP wrapper cộng đồng chưa kiểm chứng độ ổn định, trong khi healthchecks.io giải quyết đúng bài toán bằng REST API đơn giản hơn.
- **Prometheus + Grafana metrics stack** — dashboard ceremony cho người, không phải thứ agent chủ động dùng; không có câu hỏi nghiệp vụ nào đang cần nó.
- **VictoriaLogs/OpenObserve/Quickwit/Dozzle** — dù một số kỹ thuật nhẹ hơn Loki, tất cả đều thất bại ở tiêu chí quyết định của chính đề bài (không có MCP xác nhận, hoặc không có query language nào cả).

## Giới hạn nghiên cứu / câu hỏi chưa giải quyết

- Chưa xác nhận được liệu MCP chính thức `mcp.sentry.dev` có point được vào 1 Sentry **self-hosted** instance hay chỉ hoạt động với SaaS sentry.io — không quan trọng vì khuyến nghị chính là GlitchTip, nhưng nếu sau này operator cân nhắc lại Sentry cụ thể thì cần verify trước.
- Không tìm thấy MCP server nào cho VictoriaLogs/OpenObserve/Quickwit trong lần tìm kiếm này — có thể tồn tại nhưng chưa được index/phổ biến; nếu operator có lý do mạnh để ưu tiên 1 trong 3 thay vì Loki, nên verify MCP support trước khi chọn.
- MCP built-in của GlitchTip là tính năng tương đối mới (tài liệu chính thức xác nhận nhưng không rõ version/ngày ship chính xác) — nên smoke-test 17 tool thực tế trên bản GlitchTip sẽ deploy trước khi phụ thuộc vào nó cho UAT.
- Thiết kế cụ thể cho `reqId` correlation trong tRPC context (raw `node:http` handler, không phải Express middleware) chưa được spec ở đây — đây là việc implementation, không phải research, cần 1 phase riêng trước khi làm Tier 0 mục 1.
