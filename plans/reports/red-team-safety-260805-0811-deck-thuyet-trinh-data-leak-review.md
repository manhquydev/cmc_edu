# Red-team an toàn dữ liệu — Deck thuyết trình vận hành hệ thống

**Ngày:** 2026-08-05 · **Phạm vi:** `plans/260805-0811-deck-thuyet-trinh-van-hanh-he-thong/`
(plan.md, phase-01, phase-04) · **Chế độ:** report-only, không sửa plan/code
**Kết luận ngắn:** Phase 4 **chưa đủ điều kiện chạy**. Safety Gate bị suy yếu ở 4 điểm so với gate gốc,
trong đó **1 lớp bị xoá hẳn** — và lớp bị xoá đúng là lớp chặn kênh rò rỉ nguy hiểm nhất
(repo này **PUBLIC** trên GitHub).

---

## Sự thật đã kiểm chứng (không lấy từ plan)

| Khẳng định | Trạng thái | Bằng chứng |
|---|---|---|
| local-sim chứa `cmc_prod` | ĐÚNG | `docker-compose.prod.yml:152` `POSTGRES_DB: cmc_prod`; `apps/e2e/src/assert-not-prod.ts:12-15` |
| Chưa có hạ tầng chụp ảnh | ĐÚNG | grep `page.screenshot|toHaveScreenshot|captureEvidence` trong `apps/e2e/` → 0 |
| 34 file journey | ĐÚNG | `ls apps/e2e/tests/journeys/` → 34 |
| Manifest 39 luồng | ĐÚNG | `grep -c "^\s\+id: '" scripts/acceptance-report/flow-manifest.ts` → 39 |
| **Postgres local-sim KHÔNG publish cổng ra host** | ĐÚNG (giảm nhẹ) | `docker-compose.prod.yml` chỉ có `ports:` ở nginx (80/443); service `postgres` không có `ports:` |
| **Repo là PUBLIC** | ĐÚNG (làm nặng thêm) | `gh repo view` → `manhquydev/cmc_edu`, `visibility: PUBLIC` |
| Playwright mặc định KHÔNG bật trace/video | ĐÚNG | `apps/e2e/playwright.config.ts` — không có `use.trace` / `use.video` / `use.screenshot` |

---

## Trục 2 (trả lời trực tiếp) — Gate mới KHÔNG bằng gate gốc

So sánh `phase-04-anh-that-tu-synthetic-seed.md:38-47` với
`plans/260717-1213-so-nghiem-thu-song/phase-04-evidence-collector-playwright-screenshots.md:32-39`.

| # gốc | Nội dung gốc | Trạng thái trong plan mới | Đánh giá |
|---|---|---|---|
| 1 | guard cả 2 URL | Giữ nguyên (mục 1) | Tương đương |
| 2 | `ACCEPTANCE_EVIDENCE_ALLOW=1` — biến **riêng** cho capture | Đổi thành `SYNTH_SEED_ALLOW=1` (mục 2) | **SUY YẾU** — xem F2 |
| 3 | Runner **tự chạy `seed.mjs`** vào DB đích như bước gated, rồi verify sentinel | Chỉ còn "verify sentinel sau khi seed"; việc seed đẩy sang Step 3 thủ công | **SUY YẾU** — xem F3 |
| 4 | CẤM local-sim | Giữ nguyên (mục 4) | Tương đương |
| 5 | Loại view cross-facility, **đánh dấu cố định trong manifest** (`uiEvidenceSpec: undefined`) | Chỉ còn văn xuôi "Cụm ADMIN không chụp ảnh" | **SUY YẾU** — mất enforcement trong code |
| 6 | **Runner tự check `.gitignore` có thư mục output — thiếu → từ chối chạy** | **BỊ XOÁ HOÀN TOÀN** | **MẤT LỚP** — xem F1 |

Ngoài Safety Gate, hai điều khác cũng bị bỏ:

- **`EVIDENCE_DIR` không set → helper no-op** (gốc dòng 62). Plan mới không có → xem F4.
- **`specStatus` trong metadata whitelist + aggregate rule "flow ⬤ chỉ khi test PASS"** (gốc dòng 30, 57-58).
  Plan mới thay `specStatus` bằng `dbFingerprint` → xem F7.
- **Prune `rm -rf` thư mục evidence mỗi run** (gốc kiến trúc bước 2). Plan mới chỉ nói manifest
  "sinh lại mỗi lần chạy", không nói xoá ảnh cũ → xem F5.

---

## Findings xếp theo mức độ

### F1 — CRITICAL · Ảnh chụp **không bị gitignore**, repo là PUBLIC

**Kịch bản cụ thể:** Runner ghi ảnh vào `scripts/presentation/screenshots/`. Dev chạy `git add -A`
(thói quen phổ biến khi commit plan/report — `git status` hiện tại đã có 4 file untracked chờ add),
commit, push. Ảnh lên **GitHub public**. Kể cả xoá sau đó, git history giữ vĩnh viễn; không thu hồi được.

**Bằng chứng:**
```
$ git check-ignore -q scripts/presentation/screenshots/p1-01-01.png ; echo $?
1   # NOT ignored
```
`.gitignore:82` có `screenshots/*` nhưng pattern **có dấu `/` ở giữa nên bị neo vào repo root** →
chỉ khớp `/screenshots/*`, không khớp `scripts/presentation/screenshots/*`.
`phase-01-...md:44` chỉ nói thêm "thư mục output" vào `.gitignore` — **thư mục ảnh nguồn không nằm trong
output**, nên không được che.

Gate gốc mục 6 chính là lớp chặn việc này và nó đã bị xoá.

**Fix nhỏ nhất:** (a) thêm `/scripts/presentation/screenshots/` vào `.gitignore` **trước** khi viết
runner; (b) khôi phục gate gốc mục 6 nguyên văn: runner đọc `.gitignore`, không thấy entry khớp
đúng đường dẫn output của chính nó → **abort**, không chụp. Không thay bằng "nhớ thêm gitignore".

---

### F2 — CRITICAL · `SYNTH_SEED_ALLOW=1` không còn là positive signal cho bước capture

**Kịch bản cụ thể:** Quy trình Step 3 của chính plan bắt dev chạy
`SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh` (`scripts/synthetic-seed-env.sh:16`). Dev thực tế
hay `export SYNTH_SEED_ALLOW=1` một lần cho cả shell. Sau đó ở Step 5 chạy capture — biến **đã sẵn set**,
gate 2 pass tự động, **không còn là hành vi có chủ ý cho việc chụp ảnh**. Nếu đến lúc đó dev đã sửa
`APP_DATABASE_URL` sang DB khác (dev-pg :5433, hoặc một DB import từ prod đặt tên khác `cmc_prod`),
lớp duy nhất còn lại là name-check — đúng lớp mà `assert-not-prod.ts:6-10` **tự thừa nhận là không đủ**.

Gate gốc dùng biến **khác tên** (`ACCEPTANCE_EVIDENCE_ALLOW`) chính vì lý do này: một allow-signal
đã tiêu dùng cho bước A không được tính là allow-signal cho bước B.

**Fix nhỏ nhất:** giữ biến riêng cho capture, ví dụ `DECK_CAPTURE_ALLOW=1`, và runner **abort nếu
`SYNTH_SEED_ALLOW` là biến duy nhất được set**. Một dòng plan, không thêm kiến trúc.

---

### F3 — CRITICAL · Sentinel `__SYNTH__` chứng minh sai mệnh đề, và có thể tồn tại trong prod

Hai lỗi riêng biệt chồng lên nhau:

**3a. Sentinel không được bảo vệ khỏi prod.** `packages/db/prisma/seed.mjs:43` upsert facility
`__SYNTH__` **vô điều kiện**, và seed.mjs **không gọi `assertNotProdDatabase`** (grep: 0 kết quả trong
file). Một lần duy nhất ai đó chạy `DATABASE_URL=<prod> node packages/db/prisma/seed.mjs` (rất dễ xảy
ra trong phiên migration) là `cmc_prod` **có sentinel vĩnh viễn** — `upsertFacility` là find-or-create,
không bao giờ xoá. Từ đó trở đi, gate 3 **pass trên chính prod DB**. Lớp bảo vệ "bằng nội dung" biến
thành lớp bảo vệ bằng một hàng dữ liệu ai cũng trồng được.

**3b. Sentinel chứng minh sai mệnh đề.** Có sentinel ⇒ "seed tooling từng chạy ở đây". Nó **không**
chứng minh "DB này chỉ chứa dữ liệu tổng hợp". Một DB restore từ prod rồi seed lên trên sẽ pass gate 3.

**3c. Bước seed bị đẩy ra ngoài runner.** Gate gốc bắt runner tự seed vào DB đích. Plan mới
(`phase-04:80` Step 3 "Dựng synthetic-seed, verify sentinel") để việc này thủ công, và **không nói
runner verify sentinel qua URL nào**. `scripts/synthetic-seed-env.sh:94` verify qua `docker exec`
vào container `cmc-synth-pg` — tức verify **container**, không phải verify **URL mà Playwright sẽ dùng**.
Hai thứ đó có thể khác nhau.

**Fix nhỏ nhất:**
1. Thêm `assertNotProdDatabase(process.env.DATABASE_URL)` vào đầu `main()` của `seed.mjs` (2 dòng).
2. Runner phải verify sentinel **qua chính `APP_DATABASE_URL` mà capture dùng**, không qua docker exec.
3. Đổi mệnh đề chứng minh: ngoài sentinel, kiểm thêm **điều kiện phủ định** —
   `SELECT count(*) FROM "Facility"` phải ≤ ngưỡng nhỏ (ví dụ ≤ 3) và không tồn tại facility nào
   ngoài `DEVSEED` / `__SYNTH__` / facility ephemeral của run. DB prod sẽ fail ngay.

---

### F4 — CRITICAL · Gate nằm ở runner, capture nằm ở spec → **bypass được bằng lệnh chạy thẳng**

**Kịch bản cụ thể:** `phase-04:66-69` đặt Safety Gate trong `scripts/presentation/screenshots/run-capture.ts`,
nhưng hàm chụp được gọi **bên trong các file journey**. Journey chạy được độc lập bằng lệnh đã tài liệu hoá:

```
PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium
```
(`apps/e2e/playwright.config.ts:18`)

Lệnh này **không đi qua run-capture.ts** → Safety Gate không chạy → ảnh vẫn được ghi ra đĩa,
với bất kỳ `APP_DATABASE_URL` nào đang có trong shell. Cùng chuyện đó xảy ra trên **CI job `ui-e2e`**
mỗi lần push. Sau đó thư mục ảnh có file, không ai biết file đó sinh từ run nào.

Gate gốc đóng đúng lỗ này bằng `EVIDENCE_DIR` không set → helper no-op (gốc dòng 62). Plan mới bỏ.

**Fix nhỏ nhất:** helper fail-closed **hai chiều**: (a) `DECK_CAPTURE_DIR` không set → no-op im lặng;
(b) `DECK_CAPTURE_DIR` **có** set nhưng token do runner sinh (`DECK_CAPTURE_TOKEN`, random mỗi run,
runner set sau khi gate pass) không khớp → **throw**, làm fail test. Gate không được ở chỗ khác spec.

---

### F5 — HIGH · Không có ràng buộc xuất xứ giữa file ảnh và run đã qua gate

**Kịch bản cụ thể (khả năng cao nhất trong thực tế):** Plan tự nêu rủi ro *"Ảnh trông giả vì dữ liệu
seed vô nghĩa"* (`phase-04:100`). 11h đêm trước buổi trình bày, ảnh synthetic nhìn trống trơn. Dev mở
local-sim (`https://localhost`, đang chạy, đang đăng nhập), bấm `PrtSc` một màn hình danh sách học
viên **thật**, lưu đè vào `scripts/presentation/screenshots/p1-01-02.png`, chạy `pnpm deck:build`.
Deck build đọc thư mục ảnh → nhét ảnh vào. **Không lớp gate nào chạm tới đường đi này** — cả 5 mục
Safety Gate đều nằm ở nhánh capture, không ở nhánh build.

Cộng thêm: plan không có bước prune (gate gốc có). Một ảnh còn sót từ lần thử nghiệm trước gate cũng
đi vào deck y hệt.

**Fix nhỏ nhất:** manifest phải mang `sha256` từng file do runner tính. `deck:build`:
(1) chỉ nạp ảnh **có trong manifest**; (2) hash không khớp → fail; (3) có file thừa trong thư mục
không nằm trong manifest → fail. Runner `rm -rf` thư mục ảnh trước mỗi lần chạy.

---

### F6 — HIGH · `dbFingerprint` là rủi ro rò rỉ, và plan không định nghĩa nó

**Trả lời trục 3: có, đây là rủi ro thật.** Trường này **không có trong whitelist gốc** — nó là thứ
mới thêm, chưa ai review. Vấn đề:

- Validation viết *"Mọi ảnh có `dbFingerprint` **trỏ** synthetic-seed"* (`phase-04:89`). Chữ "trỏ" đẩy
  người implement về phía giá trị **đọc được bằng mắt** — tức chứa host/port/tên DB. Cách implement
  hiển nhiên nhất là gắn thẳng `APP_DATABASE_URL`, mà URL đó là
  `postgresql://cmc_app:<password>@localhost:55432/cmc_synth` (`scripts/synthetic-seed-env.sh:37`) —
  **có mật khẩu trong đó**. Với `SYNTH_PG_PASSWORD` mặc định là `synth` thì thiệt hại nhỏ; với dev
  đặt `SYNTH_PG_PASSWORD` bằng mật khẩu thật họ hay dùng thì không nhỏ.
- Mâu thuẫn nội tại: validation cuối (`phase-04:93`) nói "không metadata nào chứa chuỗi kết nối hay
  mật khẩu", còn validation ở dòng 89 lại yêu cầu fingerprint "trỏ" tới DB. Hai dòng đánh nhau, người
  implement sẽ chọn dòng dễ hơn.
- Metadata này đi **vào deck gửi khách**. `commit` SHA cũng vậy — SHA + repo public = khách map được
  chính xác code tại thời điểm chụp. Không phải dữ liệu trẻ em, nhưng là thông tin nội bộ không cần thiết.

**Fix nhỏ nhất:** định nghĩa cứng trong plan:
`dbFingerprint = sha256(dbName + "|" + sentinelFacilityId).slice(0,12)`, tính từ **thành phần đã parse**
(`new URL(u).pathname`), tuyệt đối không từ chuỗi URL thô. Thêm 1 unit test:
fingerprint không match `/[:@]|password|postgres(ql)?:\/\//`. Và: metadata chỉ nằm trong
`manifest.json` (artifact nội bộ, gitignored), **không nhúng vào HTML/PDF giao cho khách**.

---

### F7 — HIGH · Bỏ `specStatus` → ảnh từ journey FAIL vẫn được trình bày như "hệ thống chạy thật"

**Kịch bản cụ thể:** Journey `P3-05 Chốt lương tháng` chạy, capture ảnh ở bước 3, rồi **fail ở
assertion cuối**. Ảnh bước 3 đã nằm trên đĩa. Không có trường nào ghi lại rằng test đó fail
(whitelist mới không có `specStatus`), deck ghép ảnh vào và người thuyết minh nói "đây là màn hình
chốt lương chạy thật". Đây đúng là mẫu lỗi mà repo đã ghi nhận: *"journey ở mức smoke (chạy thông ≠
đúng số học nghiệp vụ)"* (AGENTS.md).

Gate gốc chống chuyện này bằng aggregate rule tường minh (dòng 57-58: `fixme/skipped/failed → not-proven`).

**Fix nhỏ nhất:** đưa `specStatus` trở lại whitelist; `deck:build` **loại bỏ** mọi ảnh có
`specStatus !== 'passed'`. Không cần đọc JSON reporter phức tạp: runner đã biết exit code từng test qua
JSON file `apps/e2e/acceptance-results/journeys.json` (đã có sẵn cơ chế này trong repo).

---

### F8 — MEDIUM · `packages/db/prisma/.env` — kênh override vô hình với gate

**Kịch bản cụ thể:** File `packages/db/prisma/.env` **tồn tại trên máy này** (untracked, khớp
`.gitignore:55` `.env*`), chứa `APP_DATABASE_URL` và `DATABASE_URL`. Hiện tại cả hai trỏ `cmc_synth`
(đã kiểm, không in credential). Prisma CLI auto-load file này. Runner của plan mới guard
`process.env` — nếu dev sửa file này trong một phiên migration để trỏ local-sim rồi quên, các đường
đi qua Prisma CLI (`migrate deploy` ở `scripts/synthetic-seed-env.sh:79`) dùng giá trị trong file,
còn guard nhìn `process.env` và báo OK. Chính repo đã ghi nhận hazard này:
`scripts/synthetic-seed-env.sh:91` — *"không phụ thuộc ... một stray prisma/.env"*.

**Fix nhỏ nhất:** Safety Gate thêm 1 dòng: nếu `packages/db/prisma/.env` tồn tại, parse nó và abort
nếu bất kỳ URL nào trong đó khác URL đã guard.

---

### F9 — MEDIUM · Kiểm soát "người duyệt từng ảnh" không thể hoạt động như đang mô tả

**Trả lời trục 4.** Ba lý do nó fail trong thực tế:

1. **Người duyệt không phân biệt được bằng mắt.** Plan yêu cầu seed có *"tên và số liệu trông hợp lý"*
   (`phase-04:100`) — tức cố tình làm dữ liệu giả **trông giống thật**. Đồng thời yêu cầu người duyệt
   *"soi tên, số điện thoại, email"* (`phase-04:83`). Hai yêu cầu triệt tiêu nhau: nếu seed thành công
   thì việc soi bằng mắt **về nguyên tắc không phân biệt được** synthetic với prod.
2. **Self-review.** Đây là dự án một người (AGENTS.md, operating model). Người duyệt = người chụp =
   người biết "tôi đã trỏ đúng DB rồi". Reviewer bias tối đa.
3. **Không có artifact.** "Ghi lại là đã duyệt" (`phase-04:92`) không nói ghi ở đâu, dạng gì, ai kiểm.
   Một checkbox trong plan.md không chặn được `deck:build`.

**Biến thành kiểm soát thật (fix nhỏ nhất, 2 phần):**

- **Phần máy làm:** seed dùng **từ điển tên đóng, cố định**, và mọi tên người/cơ sở trong seed mang
  tiền tố nhận dạng rõ ràng (ví dụ facility `DEMO — …`). Khi đó người duyệt có tiêu chí **nhị phân**
  ("có thấy chuỗi nào ngoài từ điển không?") thay vì phán đoán mơ hồ.
- **Phần enforce:** file `screenshots/approved.json` liệt kê `sha256 → {reviewer, date}`.
  `deck:build` **fail** nếu có ảnh chưa được duyệt hoặc hash lệch. Duyệt lúc đó là hành vi bắt buộc để
  build chạy, không phải một checkbox.

Đồng thời **bỏ yêu cầu "seed trông hợp lý"** hoặc hạ nó xuống "hợp lý về *cấu trúc*, rõ ràng là demo
về *nội dung*". Đó là user decision (rủi ro "ảnh trông giả" là đánh đổi bán hàng) → cần bạn quyết,
tôi không tự cắt.

---

### F10 — MEDIUM · Số điện thoại VN sinh ngẫu nhiên là số **có thật của người lạ**

`apps/e2e/src/random-vn-phone.ts:9-15` sinh `09` + 8 chữ số ngẫu nhiên — dải số di động VN đang được
cấp phát thật. Ảnh chụp màn hình danh sách phụ huynh sẽ hiển thị một số điện thoại **thuộc về một
người thật không liên quan**, và deck đó gửi ra ngoài tổ chức. Không phải dữ liệu trẻ em, nhưng vẫn là
PII của bên thứ ba nằm trong tài liệu phát hành.

**Fix nhỏ nhất:** seed dùng cho capture dùng dải không cấp phát (ví dụ `0900000xxx`) hoặc
`deck:build` che 4 số cuối. Không đụng `randomVnPhone` của e2e (nó cần shape hợp lệ).

---

### F11 — MEDIUM · `.data/blobs` dùng chung → màn hình ảnh buổi học (P2-08) là bề mặt rủi ro cao nhất

`packages/storage/src/index.ts:51-52`: `BLOB_STORAGE_DIR` không set → `.data/blobs` **tương đối theo CWD**.
API server do `global-setup.ts:88-91` spawn kế thừa `process.env` — nếu không set biến này, nó dùng
đúng thư mục blob mà mọi phiên dev/local-sim trước đó đã ghi vào. Luồng `P2-08 Gửi ảnh & tóm tắt buổi
cho PH` là luồng **duy nhất trong danh sách 8 luồng render ảnh trẻ em thật** nếu key trùng.

**Mức độ chắc chắn: TRUNG BÌNH — tôi chưa xác minh key blob có phải UUID không đoán được hay không.**
Nếu key là UUID thì trùng là bất khả thi và đây chỉ là defense-in-depth.

**Fix nhỏ nhất:** runner set `BLOB_STORAGE_DIR=<thư mục tạm mới mỗi run>` và abort nếu thư mục đó
không rỗng lúc bắt đầu. Rẻ, đóng dứt điểm, không cần xác minh thêm.

---

### F12 — MEDIUM · Phase 1 kéo **ký hiệu nội bộ** vào tài liệu gửi khách; AC6 không bắt được

**Trả lời trục 6 (phần data).** `phase-01:16` lấy nội dung từ `acceptance-report/verification.json`.
File đó chứa (đã kiểm):

```json
"trpc": ["crm.opportunityCreate", "crm.opportunityAdvance", ...],
"uiRoutes": ["/crm", "/crm/opportunities/:id"],
"models": ["Opportunity"],
"journey": "apps/e2e/tests/journeys/crm-opportunity-lost.journey.ui.spec.ts"
```

AC6 (`plan.md:80-81`) grep các từ `tRPC`, `procedure`, `router`, `enum`, `RLS`, `migration`, `schema`,
`endpoint`, `middleware`. **Không từ nào trong danh sách đó khớp** `crm.opportunityCreate`,
`Opportunity`, `/crm/opportunities/:id`, hay đường dẫn file spec. Grep list đang bắt **tên khái niệm**
trong khi thứ thật sự rò là **giá trị dữ liệu**. Khách bên thứ ba nghiệm thu (câu hỏi treo #2) sẽ nhận
được sơ đồ API nội bộ.

**Fix nhỏ nhất:** đổi AC6 từ blacklist sang **whitelist trường**: `load-flow-data.ts` chỉ trả
`{id, displayName, cluster, actorRoles, state}`, không bao giờ trả `expected.*` / `journey`. Thêm
1 assertion trong build: output không chứa `.ts`, không chứa `/` đứng đầu route, không chứa chuỗi khớp
`/^[a-z]+\.[a-zA-Z]+$/` từ danh sách trpc.

---

### F13 — MEDIUM · D6 xuất PDF kèm ghi chú thuyết minh — mâu thuẫn với AC9

`plan.md:24` (D6): tài liệu để lại = xuất PDF với `showNotes: 'separate-page'`.
`plan.md:84` (AC9): ghi chú chỉ hiện ở màn hình phụ, **khách không thấy**.

Hai điều này không thể cùng đúng: PDF có `showNotes` đưa **toàn bộ ghi chú thuyết minh vào tay khách**.
Ghi chú thuyết minh là nơi tự nhiên để viết những câu như *"7 luồng chưa có đường UI"*,
*"UAT người thật chưa chạy"*, *"chỗ này nếu khách hỏi sâu thì lái sang…"*. Đó là rò rỉ nội dung nội bộ
theo đúng nghĩa, chỉ khác là không phải PII.

**Fix nhỏ nhất:** tách hai chế độ export: `--notes` (nội bộ) và mặc định **không notes** (bản gửi khách).
Chốt rõ trong plan bản nào gửi khách. Đây cũng là quyết định của bạn, không phải của tôi.

---

### F14 — LOW · Trace/video Playwright: hiện an toàn, nhưng không được pin

Đã kiểm: `apps/e2e/playwright.config.ts` **không** đặt `use.trace/video/screenshot` → mặc định `off`.
Nên kịch bản "trace.zip chứa DOM + localStorage + network body" **hiện không xảy ra**.
Rủi ro còn lại: một dev debug journey flaky bằng `--trace on`, trace ghi vào
`apps/e2e/test-results/` (đã gitignore `.gitignore:160`) — không vào deck. Rủi ro thấp thật.

**Fix nhỏ nhất:** runner spawn Playwright với `--trace=off --video=off` tường minh. Một flag, xoá hẳn
lớp phải suy nghĩ về sau.

---

### F15 — LOW · AC "0 ảnh nguồn local-sim" không đo được

`plan.md:83` và `phase-04:90` đặt AC **0 ảnh nguồn local-sim**. Không có cách nào kiểm chứng mệnh đề
phủ định này từ file PNG — nó chỉ đúng nếu F5 (ràng buộc xuất xứ bằng hash) được implement. Ở dạng
hiện tại đây là lời hứa, không phải acceptance criterion.

**Fix nhỏ nhất:** viết lại AC thành mệnh đề đo được: *"Mọi ảnh trong deck có sha256 khớp một entry
trong `manifest.json` do run-capture sinh, và manifest ghi `dbFingerprint` khớp fingerprint của DB đã
qua Safety Gate."*

---

## Đường rò rỉ — tổng hợp theo trục 1

| # | Đường | Bị chặn bởi lớp nào hiện có? |
|---|---|---|
| 1 | Dev dán tay ảnh local-sim vào thư mục ảnh | **Không lớp nào** (F5) |
| 2 | Chạy journey trực tiếp, bỏ qua runner | **Không lớp nào** (F4) |
| 3 | Ảnh commit lên GitHub public | **Không lớp nào** (F1) |
| 4 | Sentinel đã bị trồng vào prod từ trước | **Không lớp nào** (F3a) |
| 5 | `SYNTH_SEED_ALLOW` còn sót trong shell | **Không lớp nào** (F2) |
| 6 | Ảnh cũ từ lần thử trước gate còn trong thư mục | **Không lớp nào** (F5) |
| 7 | `prisma/.env` trỏ khác `process.env` | **Không lớp nào** (F8) |
| 8 | DB spoof bằng socat, tên `cmc_synth` | Gate 3 (sentinel) — nhưng xem F3b |
| 9 | Kết nối thẳng vào Postgres local-sim từ host | **Đã chặn**: không publish port |
| 10 | Trace/video/storageState | **Đã chặn**: mặc định off (F14) |
| 11 | List view phân trang quá số hàng seed | Không áp dụng nếu DB đúng; nếu DB sai thì các đường trên đã thua trước |
| 12 | Ghi chú thuyết minh vào PDF khách | **Không lớp nào** (F13, không phải PII trẻ em) |

---

## Khuyến nghị hành động, theo thứ tự

1. **Chặn Phase 4 cho tới khi F1–F4 đóng.** Bốn cái này đều là "không lớp nào chặn", chi phí sửa mỗi
   cái ≤ 1 giờ.
2. Khôi phục nguyên văn 2 thứ đã bị bỏ khỏi gate gốc: check `.gitignore` (mục 6) và
   `EVIDENCE_DIR`-no-op. Không viết lại, chép lại.
3. Thêm `assertNotProdDatabase` vào `seed.mjs` — 2 dòng, đóng F3a vĩnh viễn cho mọi tooling sau này.
4. Định nghĩa `dbFingerprint` bằng công thức cụ thể trong plan trước khi ai đó implement (F6).
5. Đưa `specStatus` trở lại whitelist (F7).
6. Sửa AC6 và AC "0 ảnh nguồn local-sim" thành mệnh đề đo được (F12, F15).
7. **Phương án dự phòng plan tự nêu vẫn là đúng nhất:** `phase-04:97-99` — nếu bất kỳ lớp nào chưa
   chắc chắn thì **bỏ ảnh, dùng sơ đồ**. Với 8 luồng × ~4 ảnh, giá trị bán hàng tăng thêm không tương
   xứng với 7 đường rò rỉ đang mở. Cân nhắc nghiêm túc việc ship deck Phase 1–3–5 trước, Phase 4 sau.

---

## Câu hỏi còn treo

1. **Khách là bên thứ ba hay nội bộ CMC?** (plan.md:101 câu hỏi #2 — vẫn treo). Nếu bên thứ ba thì
   F12 (ký hiệu nội bộ) và F13 (ghi chú thuyết minh) lên mức High, không còn là Medium.
2. `SYNTH_PG_PASSWORD` khi chạy thật có để mặc định `synth` không? Nếu dev đặt mật khẩu cá nhân thì
   F6 nặng hơn nhiều.
3. Key blob trong `@cmc/storage` là UUID hay có thể đoán/trùng? Quyết định F11 là defense-in-depth hay
   là lỗ thật. **Tôi chưa xác minh.**
4. `packages/db/prisma/.env` là artifact chủ ý hay sót lại? Nếu chủ ý, ai đảm bảo nó không bị sửa
   trong phiên migration?
5. Có bao giờ `seed.mjs` đã từng chạy vào `cmc_prod` chưa? Kiểm bằng
   `SELECT code FROM "Facility" WHERE code IN ('__SYNTH__','DEVSEED')` trên local-sim. **Nếu có, gate 3
   đang vô hiệu ngay từ đầu và phải thiết kế lại chứ không phải vá.** Đây là câu hỏi cần trả lời trước tiên.
6. "Seed trông hợp lý" (phase-04:100) — giữ hay hạ xuống "rõ ràng là demo"? Đây là đánh đổi bán hàng,
   là quyết định của bạn (F9).
