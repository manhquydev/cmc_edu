# Bộ trình bày trực quan — vận hành hệ thống CMC EDU v2

**Trạng thái:** **implemented** (cook 2026-08-05 · `--tdd --auto`) · chờ diễn thử bấm giờ người + `deck:build --release` khi số liệu khớp HEAD  
**Branch:** feature/geofence-gps-punch-verification

## Mục tiêu

Bộ trình bày chạy offline để **người dùng đứng thuyết minh trực tiếp**. Đích: người nghe **hình dung
được hệ thống chạy thật ngoài đời**.

Giao kèo đầy đủ: `plans/reports/brainstorm-contract-260805-0025-deck-thuyet-trinh-van-hanh-he-thong.md`

## Bối cảnh buổi trình bày (đã chốt)

| | |
|---|---|
| **Đối tượng** | Ban giám đốc CMC **nội bộ** |
| **Thời lượng** | 60–90 phút: mạch chính ~40 phút + hỏi đáp |
| **Người thuyết minh** | Chủ dự án, tự cầm nhịp |
| **Minh hoạ** | **Sơ đồ, không chụp ảnh hệ thống thật** |

## Quyết định bỏ ảnh thật — và hệ quả

Người dùng chốt bỏ ảnh chụp. Hệ quả: **toàn bộ rủi ro dữ liệu trẻ em biến mất khỏi kế hoạch này.**

Bị xoá khỏi phạm vi: Phase 4 (chụp ảnh) và Phase 0 (vá an toàn nền) — cả hai chỉ tồn tại để phục vụ
việc chụp ảnh. Không còn seed, không còn capture, không còn artifact nhị phân nào sinh ra từ UI thật.

**Thay thế cho nhu cầu "cho thấy giao diện trông ra sao":** sơ đồ được phép kèm **phác hoạ bố cục
màn hình vẽ bằng SVG** — khung, cột, nút, bảng, nhãn tiếng Việt. Người nghe thấy hình hài màn hình
mà không có một byte dữ liệu thật nào. Đây là cách đạt mục tiêu ban đầu của ảnh chụp mà không mang
theo rủi ro của nó.

Chủ sở hữu cụ thể: component `diagram/screen-sketch.ts` ở **Phase 1**, dùng trong **Phase 3**. Ghi rõ
để nó không thành ý tưởng trôi nổi không ai làm.

*Vết quyết định: người dùng chốt bỏ ảnh chụp trong phiên làm việc 2026-08-05, đảo lại lựa chọn
"ảnh thật cho luồng chính" ghi ở giao kèo brainstorm. Giao kèo đã được cập nhật tương ứng.*

> **Hai lỗ an toàn có sẵn trong repo, giờ NGOÀI phạm vi bản kế hoạch này nhưng vẫn còn nguyên** —
> ghi lại để không bị quên chứ không tự đưa vào scope:
> 1. `.gitignore:82` `screenshots/*` chỉ neo vào gốc repo, không phủ thư mục lồng — mà repo là
>    **PUBLIC** (`gh repo view` → `manhquydev/cmc_edu`)
> 2. `packages/db/prisma/seed.mjs` không có guard chống prod (`grep -c assertNotProdDatabase` → 0)
>    và trồng sentinel `__SYNTH__` vô điều kiện ở dòng 43
>
> Đáng vá bằng một task riêng, nhỏ. Không liên quan tới deck.

## Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| D1 | **reveal.js**, ghim version, vendor chọn lọc bản **UMD** (`dist/reveal.js`) | Xác minh từ tài liệu chính thức: ghi chú màn hình phụ, hiện dần từng bước, chế độ tổng quan, xuất PDF, link theo id — đều native. Bản UMD né chuyện ES module bị chặn trên `file://` |
| D2 | Nội dung **sinh từ dữ liệu** | `flow-manifest.ts` + `verification.json` + `business-verification.json` |
| D3 | **4 loại hình vẽ** dùng lặp, cho phép kèm phác hoạ bố cục màn hình | Research đề xuất 6; rút còn 4 vì hai cặp trùng chức năng |
| D4 | Mạch chính **kể theo nhân vật** | Kể theo cấu trúc làm người nghe mất tập trung ngay 5 phút đầu |
| D5 | **Không demo trực tiếp**, **không ảnh chụp** | Rủi ro vỡ trận + rủi ro dữ liệu |
| D6 | **Font hệ thống**, không nhúng file font | `@font-face` bị chặn trên `file://`; `scripts/acceptance-report/templates/layout.ts` đã giải bài này — dùng lại |
| D7 | ~~PDF để lại đến miễn phí~~ **BỎ** | Deck tối giản chữ làm tài liệu đứng một mình rất tệ. PDF chỉ còn là bản dự phòng khi deck lỗi |
| D8 | Nhãn trạng thái **hai tầng** | Xem mục dưới |
| D9 | **Không hard-fail** khi thiếu/stale dữ liệu | Xem [phase-01](phase-01-nen-tang-generator-va-vo-reveal.md) |

### Từ vựng thị giác (4 loại)

Rút từ 6 xuống 4: **service blueprint** hấp thụ vào swimlane (manifest đã có tác nhân `he_thong` nên
"phần chạy ngầm" chỉ là một **làn cố định**); **day-in-life** hấp thụ vào journey (chỉ khác mốc giờ).

| Loại | Dùng cho |
|---|---|
| **L1 — Làn vai trò** | Luồng nhiều người bàn giao. Luôn có làn "⚙️ Hệ thống tự làm" |
| **L2 — Một ngày của…** | Luồng một người, có mốc giờ |
| **L3 — Cổng kiểm soát** | Luồng có duyệt / từ chối / trả lại |
| **L4 — Trước / Sau** | Thủ công vs tự động. Dùng tiết chế |

Cả bốn loại đều có thể kèm **phác hoạ bố cục màn hình** khi cần cho thấy giao diện.

## Nhãn trạng thái — HAI TẦNG (D8)

Chỉ lấy nhãn từ `verification.json` là overclaim. Số đo thật (chạy 2026-08-04, `dirty:true` —
**phải chạy lại trước khi phát hành**):

| Tầng | Nguồn | Số |
|---|---|---|
| Chạy thông | `verification.json` | **31** proven / 7 not-yet |
| Đúng nghiệp vụ | `business-verification.json` | **16** verified-correct · 15 reachable-only · 7 not-proven |

Ba nhãn người nghe thấy: **Đã kiểm đúng nghiệp vụ** · **Đã chạy được, chưa kiểm số học** · **Chưa
chứng minh**. Deck phải nói rõ *chạy thông ≠ đúng số học*, và **UAT người thật chưa chạy**.

**Bắt buộc lấy thêm `criticalReachableOnly`** (`scripts/business-verify/verify.ts`) — danh sách luồng
**tiền / lương / trạng thái quan trọng** còn ở mức smoke. Đây là con số ban giám đốc hỏi đầu tiên;
gộp nó vào "đã chạy được" là che đúng chỗ cần soi nhất.

## Sự thật đã đo (không chép từ tài liệu)

- **KHÔNG hardcode số luồng ở bất kỳ đâu** — kể cả trong tài liệu này. Ảnh chụp tại commit
  `83b59b0` (2026-08-05): **38 luồng** — P1=9 · P2=8 · P3=11 · P4=5 · ADMIN=5.
  > Bài học tại chỗ: bản kế hoạch đầu ghi "39 luồng · P3=12" và **đã sai trong cùng phiên làm việc**
  > — commit `83b59b0` xoá `P3-01b` (bỏ journey geofence hay flaky, giữ gate đã test đơn vị). Đo một
  > lần rồi coi là cố định chính là lỗi mà kế hoạch này cảnh báo. Con số duy nhất đáng tin là con số
  > generator đọc từ manifest lúc build.
- Tại `83b59b0`, ba tập id (manifest · `verification.json` · `business-verification.json`) **khớp
  nhau hoàn toàn**, không còn lệch. Điều này có thể đổi lại bất cứ lúc nào
- **Cạm bẫy nhãn (`flow-evidence.ts:61-67`):** khi `sha !== headSha`, **mọi** luồng bị hạ về trạng
  thái dự phòng, badge `stale` ⇒ **mỗi commit nội dung làm hỏng toàn bộ nhãn**. Xử lý ở D9
- `/acceptance-report/` **có** trong `.gitignore` (dòng 173) ⇒ bản clone mới **không có** hai file
  JSON ⇒ build không được hard-fail vì thiếu
- **Đường màn hình: tin manifest, không tin docs.** `docs/24` ghi `/finance/receipts/new`, manifest
  ghi `/finance/new`. Manifest đối chiếu trực tiếp scanner output nên nó đúng

## Các phase

| # | Tên | Phụ thuộc | File | Status |
|---|---|---|---|---|
| 1 | Nền tảng: generator + vỏ reveal + đường dữ liệu | — | [phase-01](phase-01-nen-tang-generator-va-vo-reveal.md) | done |
| 2 | Mạch chính: câu chuyện + bản đồ nhà | 1 | [phase-02](phase-02-mach-chinh-va-ban-do-nha.md) | done |
| 3 | Nội dung toàn bộ luồng | 1, 2 | [phase-03](phase-03-noi-dung-toan-bo-luong.md) | done |
| 4 | Ghi chú, diễn thử, kiểm thử phòng họp | 2, 3 | [phase-04](phase-04-ghi-chu-dien-thu-kiem-thu.md) | done* |

\*Phase 4: kỹ thuật xong; diễn thử bấm giờ 60–90 phút vẫn là bước người (xem `plans/reports/deck-dry-run-260805-presentation-room-check.md`).

Phase 3 là ~90% công sức, cắt 5 đợt theo cụm.

## Acceptance criteria toàn cục

1. Mở trên máy **đã ngắt mạng** → chạy đủ chức năng
2. Đi hết mạch chính chỉ bằng phím mũi tên
3. Nhảy tới bất kỳ vai trò/luồng nào trong **≤ 2 thao tác**
4. Deck phủ **đúng bằng số luồng manifest báo tại lúc build** — không hardcode, không so với một số
   ghi trong tài liệu. Thiếu một luồng so với manifest → fail
5. Màn hình **mạch chính** ≤ 25 từ *(màn tra cứu có ngưỡng riêng — xem Phase 3)*
6. Grep từ cấm trên nội dung **người xem thấy** → **0** kết quả. Gồm jargon từ `displayName`:
   `geofence`, `OR gate`, `auto-score`, `branch-scope`, `HOTL`, `idempotent`.
   *(`KPI` KHÔNG cấm — ban giám đốc dùng từ này hằng ngày; cấm nó sẽ false-fail chính mạch chính)*
6b. **Whitelist trường, không blacklist từ.** Danh sách từ cấm bắt tên khái niệm, còn thứ thực sự rò
   là **giá trị dữ liệu**: `verification.json` chứa `crm.opportunityAdvance`, `/crm/opportunities/:id`,
   đường dẫn spec. Generator chỉ được đọc các trường đã liệt kê tường minh; trường lạ → bỏ qua
7. Nhãn **hai tầng**, khớp cả hai file JSON, kèm commit SHA
8. **0** ảnh chụp từ hệ thống thật trong toàn bộ output
9. Ghi chú thuyết minh chỉ ở màn phụ
10. Tiếng Việt đúng dấu trên máy không cài font riêng
11. Đã diễn thử trọn buổi có bấm giờ, vừa khung 60–90 phút

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Overclaim số liệu | Cao | Nhãn hai tầng (D8) |
| Nhãn đông cứng ở commit cũ | Cao | D9: banner stale, không âm thầm chiếu số cũ |
| Sai nghiệp vụ khi diễn giải lại | Cao | Mỗi luồng trỏ về mục nguồn; hai chốt rà khuôn |
| Đuối giữa chừng ở gần 40 luồng | Trung bình | Phase 3 cắt 5 đợt, mỗi đợt ship độc lập |
| Deck vỡ lúc trình bày | Trung bình | Phase 1 xác minh `file://` sớm; Phase 4 kiểm thử máy chiếu + PDF dự phòng |

~~Rủi ro rò rỉ dữ liệu trẻ em~~ — **đã loại bỏ** cùng với quyết định bỏ ảnh chụp.

## Câu hỏi còn treo

1. Trình chiếu bằng máy của bạn hay máy phòng họp?
