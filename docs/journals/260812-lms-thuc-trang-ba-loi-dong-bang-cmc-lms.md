# 2026-08-12 — Đo lại LMS bằng code, đóng ba lỗ nghiệp vụ, đóng băng `cmc-lms` tại `031d193`

**Phạm vi:** hợp nhất LMS từ `cmc-lms` vào `cmc_edu`; phiên này đo lại thực trạng bằng code rồi mới thi công.  
**PR phiên này:** #117 (khung + gỡ bù + gap-aware), #118 (một đường mở bài + nộp gắn lần phát), #119 (`develop` → `main`).  
**Đóng băng `cmc-lms`:** commit `031d193` (`031d19360845bf1d4f680ef911e16282d583f69b`), chốt ngày 12/08/2026.  
**Status:** ba mảng đã merge `main`; `cmc-lms` đóng băng vận hành (sửa sự cố vẫn làm, tính năng mới ngừng).

---

## Bối cảnh

Dự án đang đưa LMS từ repo `cmc-lms` (đang phục vụ trung tâm) vào `cmc_edu`. Phiên 12/08 không bắt đầu bằng việc tin status tài liệu rồi “làm nốt phần còn lại”. Status tài liệu, seed nháp, và journey xanh trên catalog 4 unit đã từng đủ để nói “khung có rồi / tiến trình chạy rồi / buổi bù là tính năng”. Đo lại bằng code thì ba câu đó đều sai theo nghĩa nghiệp vụ, không chỉ theo nghĩa “chưa đẹp”.

Cách vào việc: đọc hành vi thật (schema, stamp, grant, roster, unique nộp bài), đối chiếu với dữ liệu khung thật, rồi mới thi công. Đó không phải nghi thức. Trên dự án này, sổ và tài liệu đã nói dối nhiều lần; nếu phiên này tin chúng thì ba lỗ dưới đây vẫn sống — một lỗ thu tiền rồi không cấp quyền, một lỗ biến unit 4 buổi thành 5 buổi thực, một lỗ để bốn buổi không có unit.

## Ba mảng đã ship — viết vì sao, không phải vì cái gì

Cả ba đều lên `main` qua PR #119. Chỉ #117 và #118 là của phiên này. #119 là phát hành `develop` → `main` (99 commit / 16 PR). Merge `main` **không** tự triển khai production.

### PR #117 — khung thật, gỡ buổi bù, tiến trình đi trên unit có thật

**Khung chương trình không phải việc “nạp đủ seed cho đẹp.”** Catalog cũ là bản nháp 4 unit UCREA. Bright I.G và Black Hole rỗng. Học sinh gia hạn thì hệ đi tìm unit không tồn tại: **thu tiền rồi không cấp được quyền học**. Đó là lỗ tiền + lỗ quyền, không phải thiếu dữ liệu trang trí. Nạp khung thật: 240 dòng CSV gom thành **96 unit** (36 UCREA / 18 Bright I.G / 42 Black Hole). `CurriculumUnit.level` đổi từ số sang chuỗi vì mã cấp độ của khung (`U2`, `J`, `G`…) là văn bản, không phải thứ tự.

**Buổi bù bị gỡ vì nó phá trục dạy, không vì “đơn giản hóa sản phẩm.”** `addMakeup` tạo buổi không gán unit và không restamp, trong khi việc gán unit đếm **mọi** buổi chưa hủy. Buổi bù chiếm một vị trí, đẩy lệch các buổi sau, nên một unit 4 buổi **âm thầm thành 5 buổi thực**. Lịch dạy trên giấy và lịch dạy trong DB không cùng một sự thật. LMS đang vận hành (`cmc-lms`) đã bỏ buổi bù có chủ đích; học sinh nghỉ vẫn ở roster nên vẫn nhận bài về nhà; học bù thật do cơ sở sắp xếp ngoài hệ thống. Giữ buổi bù trên `cmc_edu` là port một lỗi đã biết, không phải port một tính năng thiếu.

**Tiến trình gap-aware vì `order_global` của khung thật không liên tục.** Bright I.G chạy 37–59 nhưng thiếu 40/44/48/52/56. Logic cũ cộng số nguyên: lớp neo tại 37 ra unit 40 ở buổi 13–16. Unit 40 không tồn tại ⇒ bốn buổi không có unit, roster rỗng. Lớp “đang học” nhưng không có bài, không có quyền, không có trục. Sửa không phải vá từng lỗ số — là đổi phép toán: dịch vị trí trên trục unit **có thật**, không cộng `k` vào nhãn. Lỗ trong đánh số không phải là unit.

Ba thay đổi này đi cùng nhau vì chúng là một trục. Khung nháp che lỗ Bright I.G. Buổi bù làm lệch cùng trục đó. Cộng số nguyên trên trục có lỗ biến lệch thành buổi rỗng. Sửa một cái rồi để hai cái kia là để lỗ chạy sang chỗ khác.

### PR #118 — một đường mở bài, bài nộp gắn vào lần phát

Gỡ Tier A của ADR 0038 và hai cờ `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE` (chết theo). Việc kiểm dải unit trong `onRoster` giữ nguyên — không phải “bỏ cổng quyền.”

Lỗ thật nằm ở khóa nộp bài. `Submission` unique `(exerciseId, studentId)` khiến **học lại một unit thì không nộp lại được**. Học sinh đi đúng đường nghiệp vụ (học lại) và hệ từ chối như thể họ đã xong mãi mãi. Đổi khóa sang `(sessionExerciseId, studentId)`: mỗi lần phát là một lần nộp được. Đó là sửa hợp đồng, không phải đổi tên cột.

Cờ môi trường cũ sau khi gỡ **không crash** — chúng im. Im còn nguy hơn crash: operator tưởng gate còn, hành vi đã cố định.

### PR #119 — phát hành, không phải “xong việc”

99 commit, 16 PR, chỉ 2 của phiên này. Trong khối phát hành có hai migration một chiều cần nói thẳng:

- `20260812120000` hủy mọi buổi `isMakeup` rồi DROP cột. Không phân biệt lại được makeup với buổi hủy thường.
- `20260812210000` **TRUNCATE `Submission`** và xóa `StarTransaction` `refType = 'submission'`. Không backfill.

`prisma migrate deploy` **không** nạp 96 unit. Bỏ bước seed/ensure thì grant và tiến trình LMS hỏng trên catalog rỗng — đúng họ lỗi mà #117 vừa đóng, tái lập bằng thao tác deploy. Merge xanh ≠ môi trường đích an toàn.

## Quyết định đóng băng `cmc-lms` (12/08/2026)

Chủ hệ thống chốt đóng băng từ hôm nay. Mốc đo được, không phải mô tả:

| | |
|---|---|
| Commit | `031d193` (`031d19360845bf1d4f680ef911e16282d583f69b`) |
| Ngày commit | 2026-08-09 09:13 +07 |
| Nội dung | `Merge pull request #34 from manhquydev/fix/remove-google-fonts-cdn-link` |
| Nhánh | `develop` và `main` cùng commit này, 0 phân kỳ |

Repo `cmc-lms` đã lặng 3 ngày trước khi chốt, nên mốc neo tự nhiên vào `031d193`. “Đóng băng từ 12/08” nghĩa là: **từ hôm nay không thêm tính năng mới**, và bản chuẩn để port là `031d193`.

| Loại việc | `cmc-lms` | `cmc_edu` |
|-----------|-----------|-----------|
| Sửa lỗi, sự cố vận hành | vẫn làm | vẫn làm |
| Thêm tính năng mới | **ngừng** | làm ở đây |

Đây không phải tắt `cmc-lms`. Nó vẫn phục vụ trung tâm cho tới khi hệ mới đủ tốt để thay. Đóng băng vì port thêm tính năng vào repo cũ trong lúc `cmc_edu` vừa sửa ba lỗ trục là mời hai hệ phân kỳ đúng lúc không được phân kỳ.

## Cách làm

Điều phối nhiều agent (grok / pi / codex) song song qua Herdr. Mỗi mảng đi red-team và validate nhiều vòng **trước** khi thi công — không phải review sau khi đã viết xong để hợp thức hóa. Review độc lập trước mỗi lần merge.

Cách này đắt thời gian và vẫn sót (xem bài học). Nó không thay được đo bằng code; nó chỉ làm giảm việc một agent vừa viết vừa tự chứng minh. Review độc lập bắt được lỗ typecheck và lỗ manifest sau khi “xanh local.” Red-team trước thi công bắt được việc buổi bù và cộng số nguyên là cùng một trục, nên không port buổi bù rồi vá tiến trình riêng.

Song song không miễn trừ hợp nhất: typecheck lẻ từng app và claim nghiệm thu tách khỏi procedure là đúng kiểu lỗi mà nhiều nhánh độc lập tạo ra rồi chỉ lộ khi ghép.

## Bài học — viết thật, kể cả chỗ làm sai

### 1. Typecheck lẻ từng app bỏ sót `@cmc/scripts` — CI đỏ một lần

Local chạy typecheck từng app thì xanh. CI chạy cả repo thì `@cmc/scripts` vỡ: `ensure-curriculum-units.ts` import `import-curriculum-units.mjs` không có declaration, TS7016 dưới `strict` + NodeNext.

Đó không phải CI khó tính. Đó là chỗ phiên này **tự tạo** consumer TypeScript đầu tiên cho một file seed `.mjs` vốn chỉ chạy bằng `node`, rồi kiểm tra thiếu đúng gói chứa consumer đó. “Apps xanh” bị hiểu nhầm thành “typecheck xong.” Baseline cần là `pnpm typecheck` toàn repo, cùng bề mặt với job `typecheck-and-test`. Một lần đỏ trên CI là lần đáng phải đỏ — đáng hơn là merge rồi mới biết.

Sửa đúng chỗ: sibling `import-curriculum-units.d.mts`, giữ seed chạy bằng `node` thuần. Không biến `.mjs` thành `.ts` chỉ để typecheck cho vui. Bài học không phải “nhớ thêm một gói”; bài học là typecheck từng phần **không phải** typecheck.

### 2. Gỡ procedure mà quên claim trong `flow-manifest.ts` — hạ nghiệm thu trong im lặng

Gỡ một tRPC procedure (đường buổi bù / claim gắn với nó) mà quên gỡ claim trong `flow-manifest.ts` sẽ **âm thầm** hạ luồng nghiệm thu từ `built` xuống `partial`. CI vẫn xanh. `typecheck-and-test` và `ui-e2e` không đọc manifest như hợp đồng của procedure.

Đây cùng họ với bài học 22–23/07: công cụ đo nói dối, lần này không phải đếm placeholder thành `built` mà là giữ claim của thứ đã chết. Sổ xấu đi, cổng merge không kêu. Người đọc `acceptance:report` nếu không tự chạy sau khi gỡ API sẽ mang số cũ đi nói. Trên dự án một người + AI, cổng xanh **là** đội review — cổng không nhìn thấy manifest thì lỗ này mặc định sống.

Chưa có gate tự động khóa cặp procedure ↔ claim. Cho đến khi có, mỗi lần xóa procedure là một lần phải đọc manifest bằng tay. Quên một lần là đủ.

### 3. Lỗi Bright I.G chỉ lộ khi có dữ liệu thật

Với 4 unit nháp UCREA liên tục, cộng số nguyên và đi trên trục có thật cho cùng một kết quả. Test, seed, journey, demo — tất cả xanh và vô hại. Lỗ 40/44/48/52/56 chỉ tồn tại trên khung Bright I.G thật. Không nạp khung thật thì không có buổi 13–16 trỏ vào unit không tồn tại, không có roster rỗng, không có lý do viết `programAxis`.

Đây là lý do phiên này đo bằng code **và** bằng CSV, không bằng status. Catalog nháp không phải subset trung thực của catalog thật; nó là một trục khác, trơn, không lỗ, đủ để giấu đúng lỗi sẽ đụng học sinh gia hạn gói Bright I.G.

Bài học hẹp: integration trên trục có lỗ (neo 37, buổi 13–16 = 41 chứ không 40; grant 4 unit = `37,38,39,41` chứ không `to=40`) phải tồn tại **trước** khi dám nói tiến trình đúng. Bài học rộng: “chạy thông trên dữ liệu nháp” chưa từng là bằng chứng nghiệp vụ trên repo này.

## Việc còn treo

- **`cmc-lms` vẫn sống.** Đóng băng là ngừng tính năng mới, không phải cắt phục vụ. Sự cố vận hành vẫn sửa trên `031d193`. Chưa có ngày cắt sang `cmc_edu`.
- **Khung 96 unit không đi theo `migrate deploy`.** Môi trường đích phải chạy seed/ensure. Quên bước này thì lỗ “thu tiền / không có unit” trở lại bằng tay vận hành.
- **Migration nộp bài là một chiều và phá dữ liệu.** Mọi `Submission` + star gắn submission bị xóa khi deploy `20260812210000`. Chấp nhận được trên môi trường chưa có bài thật; không chấp nhận được nếu ai đó tưởng merge #119 là nâng cấp tại chỗ.
- **Lỗ số Bright I.G vẫn nằm trong nguồn.** Code đi vòng chúng; chưa ai (và phiên này không được phép) “điền” unit 40/44/48/52/56. Đó là câu hỏi khung chương trình, không phải câu hỏi stamp.
- **Chưa có CI khóa `flow-manifest` với procedure.** Bài học #2 vẫn là kỷ luật người, chưa là cổng.
- **UAT người thật vẫn chưa chạy.** Journey chứng minh chạy thông ≠ đúng số học nghiệp vụ. Ba lỗ vừa đóng là bằng chứng đúng việc đó. Hệ chưa được gọi là production-ready.

## Trạng thái

Phiên 12/08 đóng được việc đã đo: khung thật, hết buổi bù trên trục dạy, tiến trình không nhảy vào lỗ, nộp bài theo lần phát, `cmc-lms` neo tại `031d193`. Việc chưa đóng là vận hành (seed, deploy, cắt hệ cũ) và đo lường (manifest, UAT). Không pretends ba PR thay được hai thứ đó.
