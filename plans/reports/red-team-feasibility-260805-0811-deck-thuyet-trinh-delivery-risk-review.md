# Red-team khả thi kỹ thuật & rủi ro giao hàng — Deck thuyết trình vận hành hệ thống

**Đối tượng:** `plans/260805-0811-deck-thuyet-trinh-van-hanh-he-thong/`
**Ngày:** 2026-08-05 · **Branch:** `feature/geofence-gps-punch-verification` (HEAD `562b372`)
**Tính chất:** report-only, không sửa plan, không sửa code.

---

## 0. Kiểm chứng số liệu plan tự khai

Plan tự khai là "sự thật đã đo". Kiểm lại từng dòng:

| Plan khai | Kiểm chứng | Kết luận |
|---|---|---|
| Manifest 39 luồng | `scripts/acceptance-report/flow-manifest.ts` → 39 `id:` | **ĐÚNG** |
| P1=9 · P2=8 · P3=12 · P4=5 · ADMIN=5 | đếm id thực tế: P1-01..09, P2-01..08, P3-01..11 + P3-01b, P4-01..05, ADM-01..05 | **ĐÚNG** |
| `verification.json` = 38 luồng, 31 proven / 7 not-yet | đếm thực: 38 flows, `Counter({proven:31, not-yet:7})` | **ĐÚNG** |
| Đã lệch manifest đúng một luồng (`P3-01b`) | `P3-01b present: False` trong verification.json | **ĐÚNG** |
| 7 luồng not-yet đều badge `no-ui-path` | `Counter({('not-yet','no-ui-path'):7})` — P1-08, P2-01, P2-02, P2-03, P2-05, P3-10, P3-11 | **ĐÚNG** |
| Từ vựng trạng thái `proven`/`built-unproven`/`not-yet` | `types.ts:61` `AcceptanceState` | **ĐÚNG** |
| "khớp đúng 3 nhãn khách sẽ thấy (+ badge `no-ui-path`)" | `types.ts:65-90` có **10** badge: `proven`, `no-results`, `stale`, `partial`, `red-fixme`, `red-untriaged`, `vacuous`, `no-journey`, `no-ui-path`, `passed-not-built` | **THIẾU** — xem F1 |
| `dirty:true` ở artifact gần nhất | `verification.json` `evidenceRun.dirty: true`, commit `d359249` | **ĐÚNG** |

Phần số học của plan sạch. Vấn đề nằm ở chỗ plan **không đo cái gì sẽ xảy ra khi build**.

---

## F1 — NGHIÊM TRỌNG: `deck:build` sẽ không chạy được, và chạy được rồi thì nhãn sẽ tự hỏng ở commit kế tiếp

**Axis 2.** Đây là finding chặn phase 1.

### Bằng chứng

1. **`verification.json` là artifact bị gitignore.**
   `.gitignore:173` → `/acceptance-report/`. `git log -- acceptance-report/verification.json` → rỗng, chưa bao giờ commit.
   `.gitignore:168` → `apps/e2e/acceptance-results/` (nguồn `journeys.json`) cũng bị ignore.
   Comment ngay trong `.gitignore:165-167` nói rõ lý do: *"a checked-in copy would be a hand-editable file claiming to be a run result"*.

2. **Ngay lúc này, drift check của Phase 1 đã FAIL.**
   Manifest 39 vs verification 38. Phase 1 Requirement 5 + Step 4 nói lệch → `throw`.
   Nghĩa là: **từ commit đầu tiên của Phase 1, `pnpm deck:build` không chạy được**, cho tới khi có một lần chạy e2e đầy đủ.

3. **Chi phí gỡ không phải "chạy lại `pnpm acceptance:report`".**
   `pnpm acceptance:report` = `tsx scripts/acceptance-report/verify.ts` — chỉ static scan + ingest `journeys.json` có sẵn. Nó **không** chạy Playwright.
   Nhãn `proven` chỉ đến từ `journeys.json` với `sha === headSha` (`flow-evidence.ts:61-67`). Muốn có nhãn thật thì phải chạy `PLAYWRIGHT_UI=1 npx playwright test --project=ui-chromium` với DB env — `.github/workflows/ui-e2e.yml` đo được **6.1 phút wall clock** trên CI, local cộng thêm ~2 phút build admin/lms lần đầu.

4. **Và đây là chỗ chết người:** `flow-evidence.ts:61-67` hạ **toàn bộ** luồng về `built-unproven`/`not-yet` khi `facts.sha !== headSha`.
   Phase 3 là ~90% công sức, tức hàng chục commit nội dung. **Mỗi commit đẩy HEAD, làm ledger stale, làm 31 proven → 0 proven.**
   Drift check như plan mô tả chỉ bắt lệch *tập luồng*, không bắt *stale*. Hệ quả thực tế: deck sẽ **build thành công và hiển thị 31 "Đã chứng minh chạy" đọc từ JSON đông cứng ở commit `d359249`**, trong khi câu trả lời đúng cho HEAD hiện tại là "stale — chưa chứng minh". Đó chính xác là lời nói dối mà cả bộ ledger sinh ra để chặn (`flow-evidence.ts:52-53`).

5. **`dirty:true` nữa.** `verify.ts:310-314`: worktree bẩn ⇒ *"kết quả CHỈ THAM KHẢO, không phải sổ chính danh (sổ chính danh chỉ nhận artifact CI)"*. Acceptance criterion 7 của plan đòi "khớp `pnpm acceptance:report`, kèm commit SHA và cờ sạch/bẩn" nhưng **không có bước nào lấy artifact CI về**. Artifact tên `acceptance-journeys-${{ github.sha }}` (`ui-e2e.yml:212`).

### Kịch bản hỏng cụ thể

- Ngày 1: bạn `pnpm deck:build` → throw "P3-01b thiếu trong verification". Bạn mất 15 phút dựng DB + 8 phút chạy e2e để gỡ blocker cho một việc *viết slide*.
- Ngày 5: bạn commit batch 3a. `deck:build` chạy ngon, deck in ra 31 luồng "Đã chứng minh chạy". Không đúng — ledger đang stale so với HEAD.
- Ngày 20 trước mặt khách: khách hỏi "số 31 này đo lúc nào?". Nếu deck không in commit SHA của **lần chạy e2e** (chứ không phải commit của deck), không có câu trả lời.
- Người khác clone repo → không có `acceptance-report/` → `deck:build` chết ngay ở `readFileSync`. Plan không có nhánh xử lý file thiếu.

### Fix nhỏ nhất (không viết lại plan)

Bỏ "build fail on drift" ở chế độ mặc định. Thay bằng **hai chế độ**:

- `pnpm deck:build` (mặc định, dùng suốt Phase 2–3): ledger là **optional input**.
  - Không có `acceptance-report/verification.json` → build vẫn chạy, mọi nhãn hiển thị `chưa đo`.
  - Có → dùng, và **luôn in provenance lên chính slide trạng thái**: `evidenceRun.sha`, `generatedAt`, `dirty`, và câu "N luồng trong sổ chưa có trong lần đo này".
  - Không throw. Việc viết nội dung không được phụ thuộc vào hạ tầng DB.
- `pnpm deck:build --release` (chạy đúng 1 lần trước buổi họp): fail-closed, đòi đủ 4 điều kiện, mỗi điều kiện một thông báo riêng:
  1. `verification.json` tồn tại;
  2. tập `flow.id` khớp manifest (bắt `P3-01b`);
  3. `evidenceRun.sha === ` commit đang build (bắt stale — điều kiện plan đang **thiếu**);
  4. `evidenceRun.dirty === false`.

Và ghi vào `README` của phase một dòng quy trình release: tải artifact `acceptance-journeys-<sha>` từ run `ui-e2e` xanh → đặt vào `apps/e2e/acceptance-results/journeys.json` → `pnpm acceptance:report` → `pnpm deck:build --release`. **Không** commit `verification.json` — làm vậy là phá thẳng invariant đã ghi ở `.gitignore:165-167`.

Bổ sung: plan chỉ map 1 trong 10 badge. Tối thiểu phải map thêm `stale`, `no-results`, `passed-not-built`, `vacuous` — cả bốn đều nghĩa là "đừng khoe cái này với khách". Nhánh `default:` phải là "chưa đo", không phải bỏ qua badge.

---

## F2 — CAO: rủi ro `file://` mà plan nêu thì nhẹ hơn thực tế, còn rủi ro thật thì plan không nêu

**Axis 1.** Plan đặt "ES module bị chặn trên `file://`" là rủi ro cao nhất Phase 1. Kiểm chứng thực tế cho thấy plan **đánh giá sai cả hai chiều**.

### 2a. ES module: rủi ro thấp hơn plan nghĩ — bản non-module có sẵn

Tôi tải `reveal.js@6.0.1` và mở dist ra:

- `dist/reveal.js` mở đầu bằng `(function(e,t){typeof exports==\`object\`&&typeof module<\`u\`?module.exports=t():typeof define==\`function\`&&define.amd?...` — **UMD thuần**, nạp được bằng `<script src>` cổ điển. `dist/reveal.mjs` là bản ESM riêng.
- Mọi plugin đều có cặp `.js` (UMD) / `.mjs`: `notes.js`, `highlight.js`, `markdown.js`, `math.js`, `search.js`, `zoom.js`.
- `grep "fetch(\|XMLHttpRequest"` trên `dist/reveal.js` và `dist/plugin/notes.js` → **0 kết quả**. Core không gọi mạng. (`fetch` chỉ xuất hiện ở plugin markdown khi dùng external `.md` — deck này sinh HTML tĩnh nên không chạm.)

⇒ Chỉ cần **không** dùng `<script type="module">` là xong. Đây là quyết định 1 dòng, không phải "rủi ro cao nhất của phase". Plan nên hạ mức và ghim rõ: dùng UMD, cấm `type="module"`, cấm plugin markdown external.

### 2b. Speaker notes trên `file://`: reveal.js đã chủ động hỗ trợ

`dist/plugin/notes.js` mở popup bằng `window.open` + `document.write` vào `about:blank` (không nạp file rời), và có carve-out nguyên văn:

```
// Validate the origin of all messages to avoid parsing messages
// that aren't meant for us. Ignore when running off file:// so
// that the speaker view continues to work without a web server.
if( window.location.origin !== event.origin && window.location.origin !== 'file://' ) { return }
```

Issue lịch sử [hakimel/reveal.js#207](https://github.com/hakimel/reveal.js/issues/207) đã **closed**. Rủi ro còn lại là **popup blocker**, không phải CORS. Vẫn phải thử thật (Phase 5 step 3 đã có) nhưng đừng coi là blocker kiến trúc.

### 2c. RỦI RO THẬT PLAN KHÔNG NÊU: `@font-face` bị Chrome chặn trên `file://`

Phase 1 Step 3 viết: *"nhúng font đã subset vào output dạng `@font-face`"*. Đây là **xung đột trực tiếp** với AC#1 (chạy offline bằng `file://`) và AC#10 (tiếng Việt đúng dấu).

Chrome giới hạn cross-origin request theo scheme: `http`, `data`, `chrome`, `chrome-extension`, `chrome-untrusted`, `https`. **`file` không có trong danh sách.** Font tải qua `file://` bị chặn CORS, chữ rơi về font fallback. Firefox cũng chặn khi font khác thư mục (`security.fileuri.strict_origin_policy`).

*(Độ chắc chắn: cao nhưng không tuyệt đối — hành vi Chrome với font cùng thư mục file:// có thay đổi qua các bản. Phải thử thật.)*

**Kịch bản hỏng:** Phase 1 validation "Tiếng Việt đúng dấu trên máy sạch font" pass trên máy dev (vì máy dev đã cài font). Đến Phase 5, cắm máy chiếu phòng họp, mở `file://`, chữ tiếng Việt vỡ dấu hoặc rơi về serif mặc định. Phát hiện ở phase cuối = đúng thứ Phase 1 sinh ra để tránh.

**Fix nhỏ nhất — repo đã tự giải bài này rồi:**
`scripts/acceptance-report/templates/layout.ts:1-4` ghi rõ *"zero network asset (D5) ... must open by double-click"*, và giải bằng **font stack hệ thống**, không `@font-face`:

```
--cmc-font-sans: "Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

Segoe UI / Roboto / SF phủ đủ tiếng Việt trên Windows/macOS/Linux mặc định. Chọn 1 trong 2:
1. **Rẻ nhất:** dùng nguyên font stack đó, bỏ hẳn bước subset font. Ăn theo pattern đã chứng minh chạy `file://` trong chính repo này.
2. Nếu bắt buộc font riêng: nhúng WOFF2 subset dưới dạng **`data:` URI base64 trong CSS** — `data` nằm trong danh sách scheme được phép, né hẳn CORS. Subset Việt ~40–60KB → base64 ~55–80KB, không đáng kể.

### 2d. Ghi chú kỹ thuật nhỏ, đã kiểm

- `?print-pdf` vẫn còn ở v6: `/print-pdf/gi.test(window.location.search)&&(f.view='print')` trong `dist/reveal.js`. Claim của Phase 5 **đúng ở runtime**.
- `showNotes:'separate-page'` vẫn hoạt động ở runtime (`e===\`separate-page\`?m.push(r):...` trong `dist/reveal.js`), **nhưng** `dist/config.d.ts:411` khai `showNotes?: boolean`. Nếu deck-shell viết TS có type reveal config thì đây là type error. Đang sinh HTML bằng template string nên không vướng — ghi lại để khỏi mất 30 phút debug.
- Plan **không ghim version reveal.js**. Hiện tại là `6.0.1`. Ghim exact version, vì vendor dist vào output mà version trôi thì layout trôi theo.

---

## F3 — CAO: nhãn "31 đã chứng minh chạy" là *tới được*, không phải *đúng nghiệp vụ* — và repo đã có tín hiệu mạnh hơn mà plan bỏ qua

**Axis 6 (content-honesty).** Plan không nhắc `business-verification.json` một lần nào.

### Bằng chứng

`acceptance-report/business-verification.json` (cùng thư mục, cùng lần chạy `d359249`):

```
counts: {verifiedCorrect: 16, reachableOnly: 15, notProven: 7, total: 38}
```

Ví dụ P1-01 — luồng đầu tiên khách sẽ thấy:
```
"ledgerState": "proven", "correctness": "reachable-only",
"reason": "Proven (reachable + green) nhưng KHÔNG assert số/trạng thái nghiệp vụ nào — mới ở mức smoke."
```

Và `ui-e2e.yml:198` đã có hẳn một step gate tên **"Business-correctness gate (money/state flows must be verified-correct)"**.

`AGENTS.md` nói thẳng: *"Journey ở mức smoke (chạy thông ≠ đúng số học nghiệp vụ); **UAT người thật chưa chạy** ⇒ chưa được mô tả dự án là 'production-ready'."*

### Kịch bản hỏng

Deck chiếu "31/39 Đã chứng minh chạy". Khách nghiệm thu hỏi: *"chứng minh chạy nghĩa là đã kiểm tra tính đúng số liệu chưa?"*. Câu trả lời thật là "16 luồng có assert nghiệp vụ, 15 luồng mới ở mức bấm qua được". Nếu deck không nói trước, câu trả lời đó phải nói ra tại chỗ — và lúc đó nó nghe như bị bắt bài, không phải như minh bạch. Đây là rủi ro **uy tín**, không phải rủi ro kỹ thuật, và nó không sửa được sau buổi họp.

### Fix nhỏ nhất

Thêm **một trường** vào schema nhãn: `correctness` đọc từ `business-verification.json`, hiển thị thành 2 tầng trên slide trạng thái:

- ⬤ **Đã kiểm chứng số liệu** (16) — chạy thông + có assert nghiệp vụ
- ◐ **Đã chạy thông** (15) — luồng đi hết được, chưa assert số học
- ○ **Chưa có đường màn hình** (7)

Không thêm phase, không thêm file — cùng thư mục, cùng lần đọc dữ liệu ở `load-flow-data.ts`. Và nó biến một điểm yếu thành điểm bán hàng: "chúng tôi phân biệt được hai mức này, và chúng tôi nói cho anh biết mức nào là mức nào."

---

## F4 — CAO: cổng "≤25 từ mỗi màn" chưa đo được như phát biểu, và mâu thuẫn với chính Phase 3

**Axis 4.**

### 4a. Mâu thuẫn nội bộ giữa hai phase

Phase 3 Requirements bắt mỗi luồng trả lời đủ **4 câu** + quy tắc quan trọng (ngưỡng tiền, chống tự duyệt, thời hạn) + nhãn trạng thái.
Plan AC#5 + Phase 2 Requirement 3 bắt **≤25 từ mỗi màn**.

Đếm thử một câu trả lời thật, viết đúng giọng plan tự đề xuất (`phase-03` bảng dịch ngôn ngữ):

> "Giám đốc Kinh doanh duyệt phiếu thu; vượt ngưỡng thì cần mắt thứ hai" = **14 token**
> "Người lập phiếu và người duyệt phải là hai người khác nhau" = **11 token**

Tiếng Việt tách theo khoảng trắng là **âm tiết**, không phải từ. Ngân sách 25 token ≈ 12–14 từ tiếng Anh. Bốn câu trả lời + 1 quy tắc ≈ **45–70 token**.

⇒ Mỗi luồng bắt buộc **2–3 màn**, không phải 1. 39 luồng × 2.5 ≈ **~100 slide nội dung**, cộng mạch chính (8 chặng × 1–3 màn) + bản đồ + trạng thái. Plan không nói con số này ở đâu cả. Nó đổi hẳn ước lượng công sức Phase 3 và làm nặng thêm AC#3 (≤2 thao tác tới bất kỳ luồng nào).

**Fix nhỏ nhất:** ghi thẳng vào Phase 3 schema là mỗi luồng = **N màn**, và đơn vị đếm 25 từ là *màn*, không phải *luồng*. Rồi tính lại khối lượng theo ~100 màn để "cắt theo cụm" có nghĩa thật.

### 4b. Chữ trong sơ đồ — cổng vừa false-fail vừa bị lách trắng trợn

Plan không định nghĩa "từ trên màn hình khách nhìn". L1 swimlane 4 làn × 5 bước = ~20 nhãn node + nhãn làn + nhãn mũi tên. Hai khả năng, cả hai đều hỏng:

- **Đếm cả nhãn sơ đồ** → mọi slide L1 fail ngay từ slide đầu tiên. Bạn sẽ tắt cổng sau 2 ngày.
- **Không đếm nhãn sơ đồ** → cổng bị lách bằng cách nhét toàn bộ chữ vào node sơ đồ. Màn hình 200 chữ, script báo "0 từ". Cổng thành nghi lễ.

Thêm ba vùng chưa xác định: tiêu đề slide, badge trạng thái + mã luồng ở góc, và **presenter notes** (`phase-05` bắt 3–4 gạch đầu dòng/màn — nếu bị đếm thì mọi màn fail).

**Fix nhỏ nhất — chỉ cần một quyết định, viết vào `flow-copy-schema.ts`:** tách schema thành hai nhóm trường và đặt hai hạn mức khác nhau, thay vì một con số cho tất cả:

- `prose` (câu người đọc): **≤ 25 token/màn** — cổng cứng.
- `diagramLabels` (nhãn node/làn): **≤ 6 token mỗi nhãn**, và **≤ 12 nhãn mỗi sơ đồ** — cổng cứng, đây mới là thứ chống rậm sơ đồ.
- `chrome` (tiêu đề, mã, badge) và `notes`: **miễn đếm**, khai báo tường minh trong schema để không ai tranh cãi lại.

Cổng chỉ đo được khi nội dung nằm trong TS có kiểu — điểm này Phase 3 **đã làm đúng** (`content/flows/*.ts` + schema). Đừng để `check-copy.ts` đi grep HTML sinh ra; grep HTML sẽ đụng class CSS của reveal và fail vô nghĩa.

---

## F5 — CAO: danh sách "từ cấm" bắt hụt đúng những từ khách sẽ thấy, và mục tiêu grep chưa xác định

**Axis 4.**

### Bằng chứng — jargon đến thẳng từ nguồn mà D2 chỉ định

D2 nói nội dung sinh từ manifest. Grep `displayName` trong `flow-manifest.ts`:

```
Chấm công GPS geofence (OR gate)      ← P3-01b, luồng MỚI của chính branch này
Nộp & duyệt phiếu KPI (auto-score)
Tất toán KPI hàng loạt (branch-scope)
Tính lại điểm KPI tự động
```

`geofence`, `OR gate`, `auto-score`, `branch-scope` — **không có từ nào trong danh sách cấm** (`tRPC`, `procedure`, `router`, `enum`, `RLS`, `migration`, `schema`, `endpoint`, `middleware`). Danh sách cấm hiện tại toàn từ *backend*; thứ thực sự lọt ra màn hình khách lại là *jargon sản phẩm nửa Anh nửa Việt* lấy từ tên luồng.

Ngược lại, một nửa danh sách cấm (`enum`, `middleware`, `endpoint`, `migration`) gần như không có cơ hội xuất hiện trong văn Việt viết cho khách — chúng làm danh sách trông chặt mà thực ra rỗng.

### Kịch bản hỏng

`check-copy.ts` báo xanh 39/39. Slide P3-01b vẫn hiện tiêu đề "Chấm công GPS geofence (OR gate)". Khách hỏi "OR gate là gì". Cổng đã pass — nên không ai kiểm lại.

### Fix nhỏ nhất

1. **Cấm dùng `displayName` từ manifest làm chữ hiển thị.** Bắt schema có trường `customerTitle` riêng, bắt buộc, và `check-copy.ts` fail nếu `customerTitle === flow.displayName`. Đây là một dòng check, chặn đúng lỗ hổng.
2. Bổ sung danh sách cấm bằng từ **thực sự có nguy cơ**: `geofence`, `OR gate`, `auto-score`, `scope`, `provisioning`, `outbox`, `ledger`, `SoD`, `webhook`, `cron`, `token`, `cache`, `deploy`, `API`, `backend`, `frontend`. Bỏ bớt `enum`/`middleware` nếu muốn danh sách gọn — chúng không kiếm được gì.
3. **Xác định mục tiêu grep tường minh:** chỉ quét các trường `prose` + `diagramLabels` + `customerTitle` trong `content/`, **không** quét HTML output, **không** quét `notes`.
4. Chấp nhận giới hạn: cổng này chống *sót*, không chống *dốt*. Nó không thay được một lượt đọc to (Phase 2 đã có, giữ nguyên).

---

## F6 — TRUNG BÌNH–CAO: cắt 5 đợt là thật, nhưng checkpoint đặt sai chỗ và "ship độc lập" là ảo

**Axis 3.**

### Cái đúng
Cắt theo cụm là đúng, mỗi cụm 1 file là đúng, rollback theo file là đúng.

### Cái sai — 4 điểm cụ thể

**(1) Checkpoint "rà khuôn" đặt sau 3a, nhưng khuôn chỉ bị stress ở 3c.**
Phase 3 nói "sai khuôn ở luồng thứ 9 thì sửa rẻ, phát hiện ở luồng thứ 39 thì làm lại tất cả" — logic đúng, nhưng chọn sai tập kiểm. P1 (3a) là cụm bán hàng, hợp L1/L3. Cụm P3 (3c, 12 luồng) mới là chỗ khuôn gãy: lương/ca/KPI có bảng số, có chu kỳ tháng, có ngưỡng — L1–L4 nhiều khả năng không đủ. Phát hiện ở luồng thứ 18.
*Fix nhỏ nhất:* kéo **1 luồng P3 nặng nhất (P3-05 Chốt lương tháng) vào batch 3a** làm ca kiểm khuôn. 10 luồng thay vì 9, đổi lấy việc biết sớm 9 luồng.

**(2) "Mỗi cụm ship được độc lập" mâu thuẫn AC#4.**
AC#4 đòi **đủ 39/39**. Không cụm nào đưa ra trước khách được. Câu "ship độc lập" chỉ đúng ở nghĩa *review nội bộ*. Rủi ro thật là: nếu đuối ở 3d, bạn không có bản dùng được, bạn có 27/39 và một AC fail.
*Fix nhỏ nhất:* định nghĩa **mức tối thiểu** cho luồng chưa biên tập kỹ: sinh tự động từ manifest (tên khách + nhãn trạng thái + cụm), không có 4 câu. AC#4 đổi thành "39/39 có mặt; ≥N luồng có đủ 4 câu". Lúc đó đuối giữa chừng vẫn ra được sản phẩm.

**(3) Nguồn tài liệu mỏng hơn plan giả định.**
`wc -w`: `docs/24`=2101 · `docs/26`=1635 · `docs/27`=1884 · `docs/28`=857 từ.
`docs/27` phục vụ **12 luồng P3** ⇒ ~157 từ/luồng. Không đủ để viết 4 câu trả lời **đúng**. Người viết sẽ phải đọc code — việc này chậm hơn "biên tập lại tài liệu" nhiều lần, và đúng ở batch 3c là chỗ tỉ lệ từ/luồng thấp nhất.
*Fix nhỏ nhất:* trước khi bắt đầu 3c, dành 1 buổi đọc `docs/27` + manifest `expected.trpc` của 12 luồng P3 và ghi ra danh sách "câu nào tài liệu **không** trả lời được". Biết trước còn hơn phát hiện ở luồng thứ 5.

**(4) Không có ngân sách thời gian ở bất kỳ đâu, và hai câu hỏi treo chặn độ sâu.**
Câu hỏi treo #1 (buổi 30 phút hay 2 tiếng) và #2 (nội bộ CMC hay bên thứ ba) quyết định độ sâu và mức thận trọng pháp lý. Plan vẫn cho Phase 3 chạy trước khi có câu trả lời. Nếu là buổi 30 phút, ~100 slide chi tiết là công sức đổ đi.
*Fix nhỏ nhất:* chặn Phase 3 bằng #1 và #2 (Phase 1, 2, 4 chạy được không cần). Đây là dependency thật, ghi vào bảng phase.

---

## F7 — TRUNG BÌNH: `P3-01b` là luồng duy nhất không có nhãn, và nó nằm giữa batch 3c

Ghép F1 với F6 ra một điểm cụ thể đáng nêu riêng:

- `P3-01b` có trong manifest (`flow-manifest.ts:496`), có journey (`apps/e2e/tests/journeys/checkin-geofence.journey.ui.spec.ts` — file tồn tại), **không** có trong `verification.json`.
- Nó là luồng làm drift check fail hôm nay, và nó nằm ở batch 3c — batch nặng nhất.
- Nếu tới lúc release mà branch geofence chưa merge / chưa có run e2e xanh ở commit sạch, bạn có 1 slide không có nhãn trạng thái nào hợp lệ, giữa cụm nhân sự.

**Fix nhỏ nhất:** cho `load-flow-data.ts` một nhãn thứ tư tường minh — `chưa-đo` (luồng có trong sổ, chưa có trong lần đo). Trung thực, một dòng, và giải luôn cả trường hợp fresh clone ở F1.

---

## F8 — TRUNG BÌNH: reveal.js là lựa chọn ĐÚNG, nhưng lý do plan đưa ra chưa phải lý do mạnh nhất, và có 3 chi tiết cần siết

**Axis 5.** Tôi đã dựng lập luận mạnh nhất chống lại reveal.js. Nó **không đứng vững** — nhưng nó lộ ra vài thứ cần sửa.

### Lập luận mạnh nhất chống reveal.js

1. `scripts/acceptance-report/render.ts` (17 dòng) + `templates/` (428 dòng) **đã** sinh HTML tự chứa, zero network asset, mở bằng double-click — chính là AC#1 và AC#10. Bài toán `file://` đã có lời giải đang chạy trong repo.
2. Nó **đã** đọc `verification.json`, **đã** render 38 luồng theo cụm kèm badge trạng thái. Phần "đường dữ liệu" của Phase 1 gần như trùng lặp.
3. `package.json` root hiện có **`dependencies: {}`** — 0 runtime dependency. reveal.js là dep runtime đầu tiên, cộng **5.1MB** dist vendor vào output.
4. Mở rộng `render.ts` thêm một tab "Trình bày" thì **không thể lệch số**, vì cùng một process viết ra `verification.json` — F1 biến mất hoàn toàn.
5. DRY: `TOKENS_CSS` trong `layout.ts` **không export** (`grep "^export"` → chỉ `LayoutOptions`, `renderLayout`, `escapeHtml`). Deck sẽ chép design token lần thứ ba (sau `packages/ui/src/tokens.css` và `layout.ts`).

### Vì sao lập luận này KHÔNG đứng vững

Bốn thứ reveal.js cho sẵn, tự viết đều là code trình duyệt lắt léo:
- **Speaker view đồng bộ 2 màn hình**: `window.open` + `document.write` + postMessage handshake + timeout + carve-out `file://` — đúng cái `notes.js` đã giải và đã sửa qua issue #207. Tự viết là mời lại bug đó.
- **Overview grid** (AC#3 "≤2 thao tác").
- **Fragment stepping** (Phase 2 Requirement 4).
- **Print layout** — `?print-pdf` → `view:'print'` + `pdfSeparateFragments` + `separate-page` notes. Tự viết CSS `@page` cho ~100 slide là một dự án con.

Ước lượng tự viết: 300–600 dòng browser code lắt léo, mỗi dòng đều là chỗ vỡ trước mặt khách. **Quyết định D1 giữ nguyên.** (Ghi theo `review-audit-self-decision.md`: bác bỏ dựa trên đọc trực tiếp `dist/plugin/notes.js` và `dist/reveal.js` của `reveal.js@6.0.1`.)

### Ba thứ vẫn phải siết (đây mới là giá trị của lập luận trên)

1. **Ghim exact version** `reveal.js@6.0.1`. Không caret.
2. **Vendor chọn lọc, không copy cả `dist/`.** `dist/theme/` một mình đã ~2.5MB (`black.css` 575KB, `black-contrast.css` 575KB). Chỉ cần `reveal.js` + `reveal.css` + `reset.css` + `plugin/notes.js` + **một** theme. Từ 5.1MB xuống <400KB.
3. **Export `TOKENS_CSS` từ `layout.ts` và import.** Đây là ngoại lệ đúng cho ràng buộc "không đụng `scripts/acceptance-report/*`" — thêm một từ khoá `export` không đổi hành vi công cụ đo, còn chép token lần thứ ba thì chắc chắn sẽ lệch. Nếu không muốn đụng, thì ít nhất đừng chép: import từ `packages/ui/src/tokens.css`.

---

## F9 — TRUNG BÌNH: PDF-làm-tài-liệu-để-lại — **PHÁN QUYẾT: HIDDEN GAP**, không phải claim đúng

**Axis 7.** Trả lời trực tiếp: **claim này không đứng vững.**

D6 (`plan.md:24`) và Phase 5 (`phase-05:20`) viết: *"tài liệu chi tiết để lại cho khách **không phải viết lại** — nó là bản xuất PDF của chính bộ này. Một nguồn, hai sản phẩm."*

Cơ chế thì đúng. Sản phẩm thì không.

### Vì sao không đứng vững — plan tự mâu thuẫn ở 3 chỗ

1. **Phase 2 Context** trích Mayer/redundancy principle để kết luận mạch chính *"phải gần như **chỉ có hình**"*. Một tài liệu để lại gồm toàn hình, không người thuyết minh, là tài liệu không đọc được.
2. **AC#5 + Phase 2 Req 3**: ≤25 từ/màn. Deck tối ưu cho *người nói* thì tối thiểu hoá chính cái làm nên tài liệu đứng một mình. Hai mục tiêu này **loại trừ nhau** — plan đang giả định chúng miễn phí ghép.
3. **Phase 5 Req 2**: ghi chú là *"gạch đầu dòng gợi ý, không phải kịch bản đọc"* — cố ý viết dở dang. `showNotes:'separate-page'` in ra trang riêng chứa mấy gạch đầu dòng cụt. Khách đọc nguội sẽ thấy: 1 trang hình + 1 trang 3 gạch đầu dòng khó hiểu, lặp lại ~100 lần.

### Ba lỗ cơ chế nữa plan chưa đụng

- **Số trang**: ~100 slide × 2 (separate-page notes) ≈ **200+ trang**. Nếu `pdfSeparateFragments` để mặc định `true`, mỗi bước hiện dần thành một trang riêng → dễ vọt lên 400–600 trang. Plan có nhắc option nhưng **không quyết**. Phải đặt `pdfSeparateFragments: false`.
- **Không tự động hoá được**: xuất PDF phải qua hộp thoại in của Chrome bằng tay. `pnpm deck:build` không sinh ra nó. Vậy "sản phẩm thứ hai" là một bước thủ công, không có cổng kiểm, không có version.
- **Không có validation nào kiểm PDF *đọc hiểu được***. Phase 5 chỉ kiểm "hình vẽ và ảnh không vỡ" — kiểm hiển thị, không kiểm nội dung đứng một mình.

### Fix nhỏ nhất (không thêm phase, không viết tài liệu thứ hai)

1. Thêm vào schema nội dung **một trường** `standaloneSummary` (2–3 câu đầy đủ, **miễn cổng 25 từ**) cho mạch chính + các luồng cụm tiền/lương. Trường này **không render lên slide khách nhìn** — nó chỉ chảy vào phần notes ở bản in. PDF lập tức có phần đọc được, mà buổi trình bày không đổi một chữ.
2. Tài liệu để lại **không phải một file**, mà **hai**: PDF (kể chuyện) + `acceptance-report/index.html` đã có sẵn (bảng 39 luồng, trạng thái, nguồn bằng chứng, commit SHA). Cái thứ hai là **0 công sức** và trả lời đúng câu khách nghiệm thu hỏi. Đây mới thật là "một nguồn, hai sản phẩm".
3. Đặt `pdfSeparateFragments: false` và thêm 1 dòng validation Phase 5: *"đưa PDF cho một người **không** dự buổi họp đọc; họ trả lời được 3 câu về luồng duyệt tiền thì đạt."* Rẻ, và là phép đo duy nhất thật sự đo được thứ đang bàn.

---

## F10 — TRUNG BÌNH: bốn thứ vắng mặt sẽ cắn lúc giao hàng

**Axis 6.**

**(a) Không ai sở hữu tính đúng nghiệp vụ.**
Phase 3 risk tự nhận đây là *"nguy hiểm nhất về nội dung"*, rồi giảm thiểu bằng "đối chiếu ngẫu nhiên **5** luồng" — mẫu **13%** cho rủi ro nghiêm trọng nhất, do **chính người viết** kiểm. Bối cảnh vận hành là solo + code do AI sinh; không có người review thứ hai (`AGENTS.md`, mục Operating model).
*Fix nhỏ nhất:* schema bắt buộc trường `source: { doc: string; heading: string }` cho **mỗi** câu trong 4 câu. `check-copy.ts` fail nếu thiếu, và fail nếu `heading` không tồn tại trong file `doc` (grep một dòng). Đổi "mẫu 13% do trí nhớ" thành "100% có neo, kiểm được bằng máy". Đây cũng là cách duy nhất chống bịa — đúng vết `verify-fabricated-approvals`.

**(b) Chưa chuẩn bị câu trả lời cho câu chắc chắn bị hỏi.**
`AGENTS.md` cấm mô tả dự án là production-ready, và ghi UAT người thật chưa chạy, Entra SSO đang tắt vì mất quyền M365, 4 vai trò đang gác 0 quyền. Phase 3 có cấm *hứa* 4 vai trò gác — tốt — nhưng deck **không có chỗ nào** chứa câu trả lời đã soạn cho: *"đã production-ready chưa?"*, *"7 luồng chưa có là những gì?"*, *"đăng nhập bằng tài khoản công ty được không?"*.
*Fix nhỏ nhất:* 3 slide phụ lục ở cuối, nhảy tới được từ bản đồ nhà, mỗi slide một câu hỏi khó + câu trả lời đã chốt. Hỏi thì nhảy tới; không hỏi thì không ai thấy. Rẻ hơn ứng khẩu nhiều.

**(c) Diễn thử nằm ở phase cuối, sau khi tiêu 90% công sức.**
Phase 5 phụ thuộc [2,3]. Rủi ro lớn nhất của buổi họp là **mạch kể nhạt** (Phase 2 tự nhận, "không phát hiện được bằng test tự động"). Phát hiện điều đó sau khi viết xong 39 luồng là kịch bản đắt nhất có thể.
*Fix nhỏ nhất:* diễn thử **mạch chính riêng, ngay sau Phase 2**, trước khi mở Phase 3. Mạch chính có 8 chặng, diễn thử tốn ~20 phút. Nếu mạch nhạt, bạn biết khi mới tiêu 10% công sức.

**(d) Không có version deck qua nhiều buổi.**
Output dir bị gitignore (Phase 1 tự thêm), `verification.json` bị gitignore, PDF xuất tay. Sau buổi thứ nhất, **không tái dựng lại được thứ đã chiếu**. Với ngữ cảnh nghiệm thu, "hôm 12/8 chúng tôi đã chiếu chính xác cái gì" là câu hỏi có thể phát sinh thật.
*Fix nhỏ nhất:* `--release` ghi ra `deck-release.json` (deck commit, ledger `evidenceRun.sha`, `generatedAt`, `dirty`, số luồng theo từng nhãn, ngày, đối tượng nghe) và **commit riêng một file JSON nhỏ đó** — không commit deck, không commit `verification.json` (giữ nguyên invariant `.gitignore:165-167`). Một file, vài dòng, tái dựng được.

---

## Bảng tổng hợp

| # | Mức | Trục | Vấn đề | Fix nhỏ nhất |
|---|---|---|---|---|
| F1 | **Nghiêm trọng** | 2 | `verification.json` gitignore + drift = throw ⇒ `deck:build` chết từ commit 1; mỗi commit nội dung làm nhãn stale mà build không bắt | Bỏ fail mặc định; 2 chế độ; `--release` kiểm thêm `sha===HEAD` và `dirty===false`; map đủ 10 badge |
| F2 | Cao | 1 | Rủi ro ES module bị thổi phồng (UMD có sẵn); rủi ro thật là `@font-face` bị chặn trên `file://`, plan không nêu | Dùng font stack hệ thống như `layout.ts` đã làm; hoặc nhúng WOFF2 dạng `data:` URI |
| F3 | Cao | 6 | "31 proven" = tới được, không phải đúng nghiệp vụ; `business-verification.json` (16/15/7) bị bỏ qua | Thêm trường `correctness`, hiển thị 3 tầng nhãn |
| F4 | Cao | 4 | ≤25 từ mâu thuẫn với yêu cầu 4-câu (⇒ ~100 slide, plan không tính); chữ sơ đồ chưa định nghĩa ⇒ false-fail hoặc bị lách trắng | Tách schema `prose`/`diagramLabels`/`chrome`/`notes`, 2 hạn mức khác nhau |
| F5 | Cao | 4 | Danh sách cấm bắt hụt `geofence`/`OR gate`/`auto-score`/`branch-scope` — jargon đến từ `displayName` của chính manifest | Bắt buộc `customerTitle` ≠ `displayName`; bổ sung từ cấm; xác định mục tiêu grep |
| F6 | TB-Cao | 3 | Checkpoint khuôn đặt sai chỗ; "ship độc lập" mâu thuẫn AC#4; `docs/27` chỉ ~157 từ/luồng cho 3c; #1/#2 chưa trả lời | Kéo P3-05 vào 3a; định nghĩa mức tối thiểu/luồng; chặn Phase 3 bằng #1+#2 |
| F7 | TB | 2/3 | `P3-01b` không có nhãn hợp lệ, nằm giữa 3c | Thêm nhãn `chưa-đo` |
| F8 | TB | 5 | D1 **đúng** (bác bỏ có bằng chứng), nhưng: không ghim version, vendor 5.1MB, chép token lần 3 | Ghim `6.0.1`; vendor chọn lọc <400KB; export `TOKENS_CSS` |
| F9 | TB | 7 | **HIDDEN GAP** — PDF từ deck ≤25-từ + notes gạch đầu dòng là tài liệu tồi; ~200–600 trang; xuất tay, không kiểm | `standaloneSummary` chỉ chảy vào bản in; kèm `acceptance-report/index.html` làm phụ lục trạng thái; `pdfSeparateFragments:false`; kiểm bằng người không dự họp |
| F10 | TB | 6 | Không ai sở hữu tính đúng (mẫu 13% tự kiểm); không có câu trả lời soạn sẵn cho câu hỏi khó; diễn thử ở phase cuối; không version deck | `source` bắt buộc + kiểm được bằng máy; 3 slide phụ lục Q&A; diễn thử mạch chính ngay sau Phase 2; `deck-release.json` |

---

## Chỗ tôi không chắc

- **Chrome chặn `@font-face` trên `file://`**: bằng chứng gián tiếp (danh sách scheme cho phép cross-origin: `http`, `data`, `chrome`, `chrome-extension`, `chrome-untrusted`, `https` — không có `file`). Hành vi với font **cùng thư mục** có thể khác qua các bản Chrome. Phải thử thật ở Phase 1. Fix `data:` URI đúng trong mọi trường hợp nên có thể áp dụng mà không cần chờ kết luận.
- **Speaker notes trên `file://`**: tôi đọc carve-out trong `notes.js` của `6.0.1` và issue #207 đã closed, nhưng chưa chạy thử. Popup blocker vẫn là ẩn số.
- **Ước lượng ~100 slide**: suy ra từ ngân sách token và yêu cầu 4-câu, chưa có mẫu thật. Sai số có thể ±30%.
- **`showNotes:'separate-page'`**: tôi xác nhận nhánh `separate-page` còn ở runtime `dist/reveal.js`, nhưng chưa xuất PDF thử. `config.d.ts:411` khai `boolean` — có thể là type lỗi thời, cũng có thể là dấu hiệu sắp bỏ.

## Câu hỏi còn treo (bổ sung 4 câu của plan)

1. **Nguồn ledger cho bản release lấy ở đâu?** Chạy e2e local (dirty, không phải sổ chính danh) hay tải artifact `acceptance-journeys-<sha>` từ run `ui-e2e` xanh? Câu này chặn F1 và AC#7.
2. **Branch geofence có merge trước buổi họp không?** Quyết định `P3-01b` xuất hiện với nhãn gì, và có làm được run e2e ở commit sạch chứa nó hay không.
3. **Có được nói "16 luồng đã kiểm chứng số liệu / 15 luồng mới chạy thông" trước khách không?** Đây là quyết định sản phẩm, không phải kỹ thuật — nhưng nó quyết định F3 và toàn bộ slide trạng thái.
4. **Tài liệu để lại đi ra ngoài tổ chức hay không?** Nếu có: cần footer bảo mật, và phạm vi Phase 4 (ảnh) đổi mức rủi ro.
5. **Ai là người thứ hai đọc lại nội dung nghiệp vụ trước buổi họp?** Nếu câu trả lời là "không có ai", thì F10(a) phải nâng lên mức Cao, vì lúc đó cổng bằng máy là lớp phòng thủ duy nhất.

---

### Nguồn tham khảo ngoài repo

- [Speaker notes don't work when running off filesystem (file://) — hakimel/reveal.js#207](https://github.com/hakimel/reveal.js/issues/207)
- [Speaker View — reveal.js](https://revealjs.com/speaker-view/)
- [Installation — reveal.js](https://revealjs.com/installation/)
- [Access to font blocked by CORS policy — vercel/next.js#31870](https://github.com/vercel/next.js/issues/31870)
- [Cross Domain Fonts CORS — CSS font-face not loading](https://www.hirehop.com/blog/cross-domain-fonts-cors-font-face-issue/)
