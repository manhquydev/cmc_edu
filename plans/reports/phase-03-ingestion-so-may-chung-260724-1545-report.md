# Phase 3 — Sổ trạng thái máy-chứng: ingestion vào `AcceptanceState`

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-03-so-4-trang-thai-va-ingestion.md`
**Ngày:** 2026-07-24 · **Branch/HEAD:** `acceptance-journey-38-lms` @ `a57e71d`

## Kết quả

`pnpm acceptance:report` giờ đọc kết quả Playwright thật và cấp trạng thái
`proven` cho **9/38 luồng** — đúng 9 luồng đang khai `journey:` và có spec chạy
xanh ở đúng commit HEAD. Trước phase này con số đó là **0** (không có nguồn bằng
chứng nào; mọi luồng dừng ở "đã xây, chưa chứng minh").

## Đã làm

| Hạng mục | File |
|---|---|
| Test host cho `scripts/` (RT-12: trước đây KHÔNG tồn tại) | `scripts/package.json` — thêm vitest + script `test`; `turbo run test` nhặt được |
| Parser thuần, không biết manifest | `scripts/acceptance-report/ingest-playwright-results.ts` |
| Luật compose (facts × manifest × statusReason) | `scripts/acceptance-report/flow-evidence.ts` |
| Kiểu dữ liệu + `statusReason` + `EvidenceBadge` | `scripts/acceptance-report/types.ts` |
| Nối vào entry point + luật FAIL hẹp | `scripts/acceptance-report/verify.ts` |
| Điền TODO EvidenceIndex + dải provenance | `scripts/acceptance-report/templates/acceptance-tab.ts` |
| Chi tiết bằng chứng (chỉ tab nội bộ) | `scripts/acceptance-report/templates/builder-tab.ts` |
| Gate json reporter + đóng dấu commit | `apps/e2e/playwright.config.ts` |
| Job CI full-suite + upload artifact | `.github/workflows/ci.yml` — **CHƯA XÁC MINH, xem §Trung thực** |
| 34 test (24 unit + 10 fixture-driven) | `*.test.ts` + `__fixtures__/` |

`FlowStatus` cũ (`built|partial|missing`) **không đổi** — đúng ràng buộc phase.
Không đụng `apps/api`, `apps/admin`, `apps/lms`, `packages/**`.
`git diff packages/auth/src/index.ts` rỗng.

## Falsification — chạy thật, không phải mô tả

### Trên sổ thật (không phải fixture)

| # | Phá gì | Kỳ vọng | Kết quả thật |
|---|---|---|---|
| a | Xoá kết quả | mọi luồng về unproven | `0/38 proven`, in rõ "KHÔNG có kết quả nào" ✅ |
| b | Sửa `gitSha` trong results thành commit khác | toàn bộ tụt về unproven | `0/38 proven` + cảnh báo "KẾT QUẢ CŨ" ✅ |
| c | Xoá 1 spec **đã khai** khỏi results | flag partial run | `8/38 proven` + "CHẠY THIẾU (partial run)" ✅ |
| c′ | Xoá 1 spec **không được khai** khỏi results | KHÔNG flag (không phải partial) | `9/38`, không cảnh báo ✅ (đúng: `finance-receipt` không luồng nào khai) |
| e | Ép 1 spec đã khai thành `unexpected` | luồng đó → đỏ chưa triage, mất `proven` | `P1-02 → {state: built-unproven, badge: red-untriaged}` ✅ |
| d | Chạy project `api` sau khi có bằng chứng UI | không đụng file bằng chứng | md5 + mtime y nguyên ✅ (sau khi sửa lỗi §Lỗi thật) |

### Trên fixture (unit)

24 test xanh. Quan trọng nhất — mutation testing chứng minh test có sức bác bỏ
thật, không phải test rỗng:

| Đột biến cài vào code | Test bắt được |
|---|---|
| spec toàn skip vẫn tính là `pass` (lỗ "xanh rỗng") | 1 test đỏ ✅ |
| bỏ đối chiếu SHA | 1 test đỏ ✅ |
| spec vắng mặt vẫn tính là proven | 2 test đỏ ✅ |
| spec đỏ không lý do vẫn tính là proven | 2 test đỏ ✅ |

## Lỗi thật phát hiện trong lúc falsification

**Bằng chứng UI bị XOÁ bởi một lần chạy API.** RT-4 dự đoán rủi ro là "reporter
config-global ghi đè results". Cơ chế thật khác và nặng hơn: Playwright **dọn
sạch `outputDir` (`test-results/`) ở đầu mỗi lần chạy**, nên đặt `journeys.json`
ở đó thì mọi lần chạy api xoá trắng bằng chứng UI — bất kể reporter có bị gate
hay không.

Đo được trực tiếp: chạy `--project=api` một spec → `journeys.json` biến mất.

Sửa: chuyển bằng chứng ra `apps/e2e/acceptance-results/journeys.json` (ngoài
outputDir), thêm vào `.gitignore`. Chạy lại đúng kịch bản đó → md5 + mtime không
đổi. Giữ nguyên cả gate `PLAYWRIGHT_UI` vì hai lớp này hỏng theo hai cách khác
nhau.

## Luật FAIL (thu hẹp theo RT-13)

`verify` chỉ đặt exit code 1 với **lời khai không thể đúng**:
- `journey:` trỏ file không tồn tại, hoặc file không có `test(` nào;
- `statusReason.code === 'h2-mismatch'` (triage đã chứng minh mapping sai).

Luồng **đỏ** KHÔNG làm fail tool — render badge "ĐỎ CHƯA TRIAGE" thật to. Báo cáo
luôn được ghi + render TRƯỚC khi set exit code, nên một lần fail vẫn để lại
artifact đọc được.

## Quyết định thiết kế đáng ghi

1. **Chi tiết bằng chứng KHÔNG vào tab Nghiệm thu.** `statusReason.detail` chứa
   lệnh grep và tên procedure. Tab Nghiệm thu là bản đưa cho ban giám đốc / có
   thể ra khỏi toà nhà; tab Builder đã có cảnh báo 🔒 nội bộ. Tab ngoài chỉ hiện
   nhãn tiếng Việt thường ("Đang lỗi — đã xác định nguyên nhân"), chi tiết nguyên
   văn nằm ở tab trong.
2. **`flow-evidence.ts` tách khỏi `verify.ts`** vì `verify.ts` gọi `main()` ngay
   khi import — luật compose không thể unit-test nếu nằm trong đó.
3. **So sánh SHA đầy đủ, không rút gọn.** Trường `commit` hiển thị vẫn là bản
   ngắn; đối chiếu bằng chứng dùng SHA đầy đủ để hai commit khác nhau không thể
   trông giống nhau.
4. **`flaky` tính là pass**, giống đúng cách Playwright quyết định exit code.
   Flake là việc của nghi thức retry/reset ở Phase 5-8, không phải một trạng thái
   của sổ.

## Trung thực về những gì CHƯA được chứng minh

- **Job CI chưa từng chạy một lần nào.** Actions của repo fail 3-4 giây với 0
  step từ 2026-07-17 (billing, không phải code — xem plan.md V4). Job full-suite
  + upload artifact được viết ra là để đúng, **không phải đã quan sát thấy đúng**.
  Đã ghi cảnh báo này ngay trong `ci.yml`. Sổ v1 vẫn "blocked on CI billing".
- **SHA-binding không bắt được worktree bẩn.** Bằng chứng gắn với commit HEAD; sửa
  file chưa commit rồi chạy vẫn cho SHA khớp. Đúng với threat model đã ghi: cơ
  chế này NÂNG CHI PHÍ tự lừa, không chống giả mạo chủ động.
- **9/38 proven là con số của hôm nay**, phản ánh 9 luồng đang khai `journey:` —
  không phải mục tiêu 38/38 của plan.

## Code review — 2 lỗi NẶNG tự kiểm không bắt được

Reviewer độc lập tìm ra **2 đường lên `proven` mà thiết kế tuyên bố là bất khả**.
Cả hai đã được xác nhận bằng probe chạy thật trước khi sửa:

| # | Lỗi | Trạng thái trước sửa (đo thật) | Đã sửa |
|---|---|---|---|
| 1 | `proven` bỏ qua `FlowStatus` — luồng `partial`/`missing` vẫn lên ⬤ | `status=partial → {state:'proven'}`, `status=missing → {state:'proven'}` | Thêm guard `status !== 'built'` → badge `passed-not-built` |
| 2 | `h2-mismatch` composer không đọc — journey gắn sai luồng vẫn ⬤ | `h2-mismatch + spec xanh → {state:'proven'}` | Xử lý trước khi đọc results → badge `h2-mismatch` |
| 3 | Check `test(` làm FAIL tool đúng lúc dùng nghi thức `test.fixme` của plan | `"test.fixme(...)".includes("test(") === false` | Đổi sang regex `\btest(\.(fixme\|skip\|only\|describe))?\s*\(` |

**Lỗi #1 nghiêm trọng gấp đôi vì test của tôi nói dối.** Test tên "never lets
evidence promote a flow that was not built" truyền `facts({})` — tức spec VẮNG
MẶT — nên nó xanh nhờ nhánh `partial`, chưa bao giờ chạm bất biến nó mang tên.
Đây đúng là phantom test. Đã viết lại để spec CÓ MẶT và XANH, chạy cho cả
`partial` lẫn `missing`, cộng test mới cho `h2-mismatch`.

Hệ quả thật nếu không sửa: P1-08 hiện là `partial` + có trang giữ chỗ. Khi
Phase 5 viết journey cho nó, thẻ của P1-08 trong tab Nghiệm thu sẽ hiện đồng
thời ⬤ "Đã chứng minh chạy" và "Màn hình chưa được xây". Bốn luồng P2-07/P3-02/
P3-05/P4-01 mà triage xếp "phủ hẹp hơn expected" cũng sẽ thành 4 thẻ xanh giả
ngay khi ai đó ghi `h2-mismatch` vào manifest.

### Sửa thêm từ review (mức trung bình)

- **Worktree bẩn:** trước đây run trên cây có thay đổi chưa commit vẫn được đóng
  dấu SHA của HEAD. Nay stamp `gitDirty`, hiện `-dirty` ở console và banner đỏ
  "chỉ tham khảo nội bộ" trong HTML. *Giữ nguyên ⬤ khi bẩn* — nếu chặn thì suốt
  Phase 5-8 (luôn có file chưa commit) sổ local sẽ vô dụng và người ta sẽ lách.
  Lớp chống thật vẫn là: sổ chính danh chỉ nhận artifact CI.
- **`statusReason` mục nát:** thêm liveness guard cùng kiểu 3 whitelist sẵn có —
  cảnh báo khi `red-fixme` gắn trên spec đã xanh, hoặc `no-ui-path` gắn trên
  luồng đã có journey.
- **Job CI chạy 2 lần + SHA không tồn tại:** workflow trigger cả `push` lẫn
  `pull_request`; trên PR `github.sha` là merge commit không có trong clone nào
  ⇒ artifact tải về sẽ demote toàn bộ về `stale`. Thêm `if: github.event_name ==
  'push'` — đúng luôn với V1 ("mỗi push"), và cắt một lần chạy 9-53 phút tính
  tiền cho mỗi PR.
- **Provenance chính xác hơn:** ghi TẤT CẢ project trong report (trước chỉ ghi
  cái đầu tiên gặp — run gộp api+ui-chromium sẽ khai `project api` cho kết quả
  thật ra do `ui-chromium` tạo); đọc `errors[]` mức run để một run chết ở
  `globalSetup` không bị đọc thành "chạy thiếu" vô hại; chuẩn hoá dấu `\` cho
  đường dẫn Windows.
- Sửa comment đầu `acceptance-tab.ts` (còn ghi "v1 không có evidence"), bỏ cast
  `Parameters<typeof defineConfig>` sang `PlaywrightTestConfig['reporter']`.

### Từ review nhưng CHƯA sửa (có chủ ý)

- **Mixed pass+fixme vẫn → `proven`.** Đây là quyết định tường minh của plan
  (phase-03 bước 2: "proven chỉ khi mọi test không-skip pass và ≥1 pass"). Rủi ro
  reviewer nêu là thật (file 2 test, test gánh chính bị fixme, test vặt xanh →
  ⬤) nhưng hiện mỗi journey file chỉ có đúng 1 `test(`. Ghi lại làm điều kiện
  cần xem lại khi Phase 5-8 sinh file nhiều test.
- **Pill ⬤ vẫn hiện số khi banner cảnh báo partial.** Cosmetic; banner đã đỏ.

Kiểm lại sau sửa (probe chạy thật): `partial → not-yet`, `missing → not-yet`,
`h2-mismatch → built-unproven`, `built + spec xanh → proven`. 28 test xanh.

## Đối chiếu Success Criteria phase

- [x] Fixture tests xanh, gồm all-fixme≠proven, SHA-stale, partial-run
- [x] `proven` chỉ sinh từ results hợp lệ; đỏ-thiếu-lý-do render "ĐỎ CHƯA TRIAGE" mà tool vẫn render trọn sổ
- [x] Run api không đụng bằng chứng (chứng minh bằng run thật — sau khi sửa lỗi outputDir)
- [~] Nguyên nhân CI fail **đã chẩn đoán** (billing) nhưng **không sửa được từ repo**; job full-suite + artifact tồn tại nhưng CHƯA XÁC MINH — V4
- [x] `FlowStatus` cũ không đổi; typecheck 27/27 · lint sạch · test 2100 pass (23/23 task)
- [x] Code review độc lập: 2 lỗi High + 1 Medium-High đã sửa và kiểm lại bằng probe chạy thật

## Câu hỏi chưa giải quyết

- 6 drift manifest/UI mà Phase 2 tìm ra (P1-07 ×2, P2-07, P2-03, ADM-02, P1-05):
  sửa `expected` trong manifest hay mô tả bằng `statusReason`? Chưa đụng.
- `statusReason` cho các luồng đỏ/không-đường-UI chưa được điền — phụ thuộc quyết
  định user ở §4 của report triage tổng hợp.
