# Red-team vòng 2 — tấn công chính các bản vá

**Ngày:** 2026-08-05 · **Chế độ:** report-only
**Đối tượng:** `plans/260805-0811-deck-thuyet-trinh-van-hanh-he-thong/`
**HEAD lúc viết báo cáo:** `83b59b0` (KHÔNG phải `562b372` như plan ghi)

---

## 0. Hai chuyện xảy ra GIỮA LÚC review — đọc trước mọi thứ khác

### 0a. Plan bị viết lại trong lúc tôi đang đọc nó

Tôi đọc xong 7 file mà task giao lúc ~08:48. Lúc 08:55 thư mục plan chỉ còn 5 file:

```
08:55:45  phase-01-nen-tang-generator-va-vo-reveal.md
08:45:03  phase-02-mach-chinh-va-ban-do-nha.md
08:55:11  phase-03-noi-dung-toan-bo-luong.md
08:55:45  phase-04-ghi-chu-dien-thu-kiem-thu.md      ← nguyên là phase-05, đã đổi tên
08:54:43  plan.md
```

`phase-00-va-an-toan-nen.md` và `phase-04-anh-that-tu-synthetic-seed.md` **đã bị xoá**.
`plan.md:3` và `:22-32` ghi lý do: *"đã bỏ ảnh thật theo quyết định người dùng 2026-08-05"*.

⇒ 6 trên 10 điểm tấn công task giao (1,2,3,6,7 + phần lớn của 3) nhắm vào hai file **không còn tồn
tại**. Tôi vẫn trả lời đủ 10 điểm — vì (a) task yêu cầu, (b) các lỗ trong repo mà Phase 0 định vá
**vẫn còn nguyên** và plan tự thừa nhận điều đó (`plan.md:34-41`), (c) nếu ảnh chụp quay lại thì
các bản vá đó sẽ được lôi ra dùng nguyên trạng.

### 0b. HEAD đã dịch 4 commit — và commit cuối làm sai toàn bộ "sự thật đã đo" của plan

```
83b59b0 fix(e2e): drop flaky geofence UI journey; keep unit-tested gate
e952df8 fix(e2e): slim geofence journey and cascade-delete staff
975680b fix(e2e): scope shift template form to group card
b2b040a Merge pull request #63 ...
562b372 fix(e2e): align geofence journey with current helper APIs   ← plan.md vẫn ghi branch ở đây
```

`83b59b0` xoá 12 dòng khỏi `scripts/acceptance-report/flow-manifest.ts` — chính là `P3-01b`.

| Plan khai | Đo lại tại `83b59b0` | Kết luận |
|---|---|---|
| Manifest **39** luồng | `grep -oE "id: '[^']+'"` → **38** | **SAI** |
| `P1=9·P2=8·P3=12·P4=5·ADMIN=5` | `P1=9·P2=8·P3=11·P4=5·ADM=5` | **SAI** (P3) |
| `P3-01b` có trong manifest | `grep -rn P3-01b` toàn repo → chỉ còn trong file plan/report | **SAI — luồng không tồn tại** |
| `verification.json` lệch manifest đúng `P3-01b` | tập id manifest ∩ verification ∩ business: **lệch = 0** | **SAI — hết lệch** |
| `"38" trong AGENTS.md/docs đã cũ` | 38 giờ là số đúng | **ĐẢO NGƯỢC** |

Đây đúng là mẫu hỏng mà task cảnh báo. Chi tiết ở **B1**.

---

## 1. Hai phát hiện CHẶN

### B1 — CHẶN · Mọi số luồng trong plan đã sai; AC#4 tự mâu thuẫn với chính Phase 1

**Bằng chứng:** như bảng 0b. Kèm:

- `plan.md:112` AC#4: *"Đủ **39/39** luồng — số lấy động từ manifest"*
- `phase-01:19` bảng nguồn: *"Danh sách luồng (**39**)"*
- `phase-01:33` Requirement 4: *"Số luồng lấy **động** từ manifest"*
- `phase-03:14`: *"39 luồng trong manifest, chia: … P3=12 …"*
- `phase-03:48` đợt 3c: *"12 | Nặng nhất; có `P3-01b` mới"*
- `phase-03:57`: *"có luồng mới `P3-01b` chưa có trong docs"*

**Kịch bản hỏng cụ thể:** Phase 1 làm đúng Requirement 4 → build in ra **38**. AC#4 đòi 39/39 →
acceptance fail. Người sửa nhanh nhất sẽ hardcode 39 để cho qua cổng — và thế là mất luôn cái
"đếm động" mà cả D2 sinh ra để bảo vệ. Song song, đợt 3c được lên kế hoạch cho 12 luồng, trong đó
1 luồng không tồn tại; người viết nội dung sẽ đi tìm `P3-01b` trong `docs/27` và trong code, không
thấy gì, rồi mất thời gian tự hỏi tài liệu hay code sai.

**Fix nhỏ nhất:** thay mọi con số cứng bằng "số lấy từ manifest" và ghi ảnh chụp kèm SHA:
*"38 luồng đo tại `83b59b0`"*. Xoá `P3-01b` khỏi `phase-03:48,57`. Sửa AC#4 thành *"phủ 100% id
trong manifest tại commit build"*. Xoá đoạn `plan.md:86-88` về `P3-01b`/lệch 38-39 — nó nói ngược
sự thật hiện tại.

**Hệ quả tốt kèm theo (nên ghi vào plan):** manifest = verification = business = **38 id giống
hệt nhau**. Toàn bộ nhánh xử lý "lệch tập luồng" ở D9 hiện **không có ca kiểm thử thật nào** — vẫn
nên giữ (fresh clone vẫn thiếu file), nhưng đừng mô tả nó như vấn đề đang xảy ra.

---

### B2 — CHẶN · "Quyết định người dùng bỏ ảnh thật" chưa có bằng chứng, và nó đảo một quyết định đã chốt

`plan.md:3` và `:24` viện dẫn *"quyết định người dùng 2026-08-05"* để xoá 2 phase.

Đối chiếu giao kèo đã chấp nhận —
`plans/reports/brainstorm-contract-260805-0025-...md`:

- dòng 18-19: *"Bốn quyết định đã chốt ở phiên trước **vẫn giữ nguyên hiệu lực** (3 tầng · nhãn
  trạng thái · **ảnh thật cho luồng chính** · đủ 38 luồng)"*
- dòng 55: *"Không demo hệ thống chạy trực tiếp trong buổi (rủi ro vỡ trận; **dùng ảnh/clip quay
  sẵn**)"* — ảnh chính là biện pháp giảm thiểu cho D5
- dòng 73: AC#8 *"**0** ảnh có nguồn từ local-sim — truy được nguồn từng ảnh"*

Không có artifact nào trong repo ghi lại quyết định đảo chiều. Theo
`.claude/rules/review-audit-self-decision.md` (*"Do not silently undo explicit user decisions"*) và
theo mẫu đã ghi nhận trong bộ nhớ dự án (`verify-fabricated-approvals`), **phải để người dùng xác
nhận trực tiếp** trước khi coi hai file bị xoá là hợp lệ.

Tôi **không** phản đối nội dung quyết định — bỏ ảnh là lựa chọn an toàn và tôi ủng hộ. Tôi phản đối
việc nó được ghi như đã chốt mà không có vết.

**Kèm theo: một lỗ thật do chính lần cắt này tạo ra.** Chỗ thay thế cho ảnh —
*"phác hoạ bố cục màn hình vẽ bằng SVG"* — chỉ tồn tại ở `plan.md:29-32`, `:49` (D3), `:69`.
Grep toàn thư mục plan: **không phase nào nhắc tới nó**. `phase-01:61` vẫn chỉ liệt kê 4 component
`swimlane · journey · control-gate · before-after`. `phase-02`/`phase-03` không có bước nào vẽ
mockup. Phase 3 vẫn ghi *"90% công sức"* không đổi.

⇒ Đây là **scope drift nằm bên trong một lần cắt scope**: plan hứa một năng lực mới (vẽ lại bố cục
màn hình cho các luồng chính, bằng tay, bằng SVG — công sức đáng kể) mà không phase nào nhận,
không file nào tạo, không ước lượng nào đổi.
**Fix nhỏ nhất:** hoặc thêm `diagram/screen-sketch.ts` vào `phase-01` Files + 1 bước ở `phase-02`,
hoặc hạ D3 xuống *"không vẽ mockup"* và chấp nhận deck chỉ có sơ đồ quy trình.

---

## 2. Trả lời từng điểm tấn công

### #1 — SQL Phase 0: **CÂU LỆNH ĐÚNG**, nhưng có một đường false-negative thật

Đối chiếu thực tế:

| Thành phần | Kiểm | Kết quả |
|---|---|---|
| Tên bảng `"Facility"` | `schema.prisma:230-257`, model `Facility`, **không có `@@map`** | ĐÚNG (Prisma giữ nguyên tên model, cần dấu nháy kép vì chữ hoa) |
| Cột `code` | `schema.prisma:237` `code String @unique`, không `@map` | ĐÚNG |
| `'__SYNTH__'` | `seed-constants.mjs:20` `SYNTHETIC_SEED_FACILITY_CODE = '__SYNTH__'` | ĐÚNG |
| `'DEVSEED'` | `seed-constants.mjs:13` `DEV_SEED_FACILITY_CODE = 'DEVSEED'` | ĐÚNG |

**Verdict: CLOSED về mặt cú pháp — không có rủi ro "0 dòng vì viết sai truy vấn".**

**Nhưng có false-negative ở tầng ngữ nghĩa (NEWLY-INTRODUCED, chưa ai nêu):**
`seed.mjs:26-27` — `upsertFacility` tìm bằng **`name`**, không bằng `code`:

```js
const existing = await db.facility.findFirst({ where: { name } });
if (existing) { ...; return existing.id; }   // KHÔNG chạm tới `code`
```

Nghĩa là: nếu prod đã có một Facility trùng **tên** `__SYNTHETIC_SEED__ — CMC EDU throwaway` nhưng
`code` khác (đổi tên cơ sở qua API, hoặc restore từ một môi trường khác), seed **đã chạy ở đó rồi**
mà truy vấn theo `code` trả 0 dòng → đọc thành "an toàn". Truy vấn phải hỏi đúng khoá mà seed dùng.

**Fix nhỏ nhất:**
```sql
SELECT code, name FROM "Facility"
WHERE code IN ('__SYNTH__','DEVSEED')
   OR name IN ('__SYNTHETIC_SEED__ — CMC EDU throwaway','CMC EDU — Cơ sở mặc định (dev seed)');
```
và lấy 4 chuỗi đó **từ `seed-constants.mjs`** (file này tồn tại đúng để làm việc đó — xem header
của nó), không gõ tay vào plan.

**Hai điểm yếu còn lại của bước này (STILL-OPEN):**
- *"Khởi động local-sim **chỉ đọc**"* không thực hiện được như mô tả: `docker-compose.prod.yml` chỉ
  publish port ở nginx (`ports:` xuất hiện đúng một lần, dòng 46), service postgres **không** mở
  port ra host ⇒ bắt buộc `docker exec`. Plan không nói cách kết nối, và "khởi động stack" không
  phải hành vi chỉ-đọc.
- Local-sim `cmc_prod` sạch **không** chứng minh DB pilot đang chạy thật sạch, cũng không chứng minh
  một bản restore-prod-đổi-tên là sạch. Đây là F3b vòng 1, bản vá không đụng tới.

---

### #2 — Import guard vào `seed.mjs`: **UNIMPLEMENTABLE AS WRITTEN**

`phase-00:49-54` bảo import `assertNotProdDatabase` từ `apps/e2e/src/assert-not-prod.ts` vào
`packages/db/prisma/seed.mjs`. Ba lý do độc lập khiến nó không chạy:

1. **Runtime không đọc được `.ts`.** `seed.mjs` header (dòng 8-10) tự ghi: *"Plain ESM `.mjs`
   (no build step, no `tsx` dependency)"*, và được gọi bằng `node prisma/seed.mjs`
   (`packages/db/package.json` — `db:seed` và khối `prisma.seed`). Node ESM import `.ts` →
   `ERR_UNKNOWN_FILE_EXTENSION`.
2. **Ngược chiều phụ thuộc.** `apps/e2e/package.json` khai `"@cmc/db": "workspace:*"`.
   `packages/db/package.json` `dependencies` chỉ có `@prisma/client`. Cho `packages/db` import
   `apps/e2e` là tạo vòng.
3. **Exports map chặn.** `packages/db` chỉ export `"."`; `apps/e2e` không có exports map nào.

**Repo đã tự né chuyện này:** `scripts/synthetic-seed-env.sh:46-49` **không** import — nó chạy
`npx tsx -e 'import { assertNotProdDatabase } from "./apps/e2e/src/assert-not-prod.ts"'` từ gốc
repo, tức một wrapper shell.

**Và điều plan viết từ trí nhớ:** `phase-00:53-54` cảnh báo *"không copy — một guard hai bản sẽ
trôi khỏi nhau"*. **Việc đó đã xảy ra rồi:** guard tồn tại 2 bản —
`apps/e2e/src/assert-not-prod.ts:17` (bản "single source of truth" theo chính header của nó) và
`apps/api/src/test/db.ts:24-36` (`FORBIDDEN_DATABASE_NAME` + `assertNotProdDatabase` private,
thông điệp lỗi khác hẳn). Plan cảnh báo về một rủi ro tương lai mà không kiểm rằng nó đã thành
hiện thực.

**Guard nên nằm ở đâu (đề xuất, đã kiểm ràng buộc):**

- Đặt bản canonical là `packages/db/prisma/assert-not-prod.mjs` — ESM thuần, không dependency, nằm
  cạnh `seed-constants.mjs`. Header của `seed-constants.mjs` viết đúng lý do tồn tại của mẫu này:
  *"consumers … can import the marker names/codes safely. NO imports with side effects here."*
  `seed.mjs` import trực tiếp bằng đường dẫn tương đối → 1 dòng, không cần build, không cần tsx.
- `apps/e2e/src/assert-not-prod.ts` đổi thành re-export. **Ràng buộc đã kiểm:** `tsconfig.base.json`
  **không bật `allowJs`** ⇒ cần thêm `assert-not-prod.d.mts` (2 dòng khai kiểu) bên cạnh file
  `.mjs`. Nếu import qua tên package thì phải thêm subpath vào `exports` của `packages/db`.
- Gộp luôn bản trùng ở `apps/api/src/test/db.ts` vào cùng nguồn — nếu không thì lần vá này tạo
  **bản thứ ba**.

**Verdict: UNIMPLEMENTABLE. Ngoài scope plan hiện tại, nhưng nếu làm task riêng như `plan.md:41`
đề nghị thì phải làm theo đường trên, không theo đường plan viết.**

---

### #3 — Vá `.gitignore`: **PATCH LÀ MỘT TODO, KHÔNG PHẢI MỘT BẢN VÁ**

`phase-00:42-45` viết *"Thêm mẫu neo đúng cho thư mục ảnh và output"* — **không đưa ra mẫu nào**.
`phase-01:65-67` (bản hiện tại) cũng chỉ nói *"thư mục output của deck"* + *"kiểm bằng
`git check-ignore -v`"*. Không có pattern để tấn công.

**Đo thật (`git check-ignore -v`, HEAD `83b59b0`):**

| Đường dẫn | Kết quả |
|---|---|
| `scripts/presentation/screenshots/test.png` | **NOT IGNORED** |
| `scripts/presentation/dist/deck.html` | ignored — `.gitignore:24 dist/` |
| `screenshots/a.png` | ignored — `.gitignore:82 screenshots/*` |
| `.data/blobs/x.bin` | ignored — `.gitignore:16 .data/` |
| `plans/reports/y.png` | ignored — `.gitignore:78 /plans/**` |
| `plans/.../reports/x.md` | **NOT ignored** — `.gitignore:81 !/plans/**/*.md` |

Kết luận: F1 vòng 1 **đúng và vẫn mở** trong repo. Nhưng cũng lộ ra: nếu output deck đặt trong một
thư mục tên `dist/` thì **`.gitignore:24` đã phủ sẵn** — sửa `.gitignore` ở Phase 1 là thao tác
thừa. Chỉ cần khi output đặt tên khác (`out/`, `build/`, `deck/`).

**LỖ MỚI do chính bản vá tạo ra (nếu ảnh quay lại):**
`phase-04:107` đặt `manifest.json` và `approved.json` **bên trong** `scripts/presentation/screenshots/`
— đúng thư mục mà Phase 0 định gitignore. Kết quả: **sổ duyệt ảnh (`approved.json`) trở thành
file không commit được**. Mà `approved.json` chính là artifact duy nhất chứng minh "ai đã duyệt
ảnh nào" — fix của F9 vòng 1 dựa hoàn toàn vào nó, và `phase-04` "Phiên bản deck" đòi tái dựng
được. Ignore thư mục ảnh và giữ sổ duyệt trong đó là hai yêu cầu loại trừ nhau.
*Fix nhỏ nhất:* `approved.json` ra ngoài, ví dụ `scripts/presentation/screenshot-approvals.json`;
chỉ ignore `screenshots/` chứa nhị phân.

**Đường vẫn lọt kể cả khi vá đúng:**
- `EVIDENCE_DIR`/`DECK_CAPTURE_DIR` bị set sai sang thư mục ngoài vùng ignore — `.gitignore` không
  thể phủ đường dẫn tuỳ ý. Chỉ lớp gate 6 (runner tự chạy `git check-ignore` trên **đường dẫn
  tuyệt đối đã resolve của chính nó**, trước khi ghi byte đầu tiên) mới đóng được.
- `git add -f` — không lớp nào chặn; chỉ pre-commit hook chặn được.
- Ảnh do dev tự `page.screenshot()` khi debug, ghi vào chỗ bất kỳ.

---

### #4 — D9 bỏ hard-fail: **CLOSED phần chính, nhưng `--release` là một cổng chưa có đường qua**

Phần đúng: bỏ hard-fail là chuẩn. `.gitignore:173 /acceptance-report/` đã kiểm — clone mới không
có 2 file JSON, hard-fail sẽ giết build từ commit đầu. Nhãn "chưa đo" + banner là xử lý trung thực.

**Ba lỗ mới / còn lại của `--release`:**

**(a) Điều kiện "cây git sạch" đánh nhau với chính artifact của plan.**
`playwright.config.ts:39-45` — `gitDirty()` = `git status --porcelain` không rỗng, **tính cả file
untracked**. `.gitignore:81 !/plans/**/*.md` giữ markdown trong `plans/` ở trạng thái theo dõi
được ⇒ mỗi file plan/report chưa commit làm cây bẩn. **Ngay lúc này** cây đang bẩn đúng vì lý do
đó (`git status --porcelain` → 8 mục, toàn `plans/` + `.nodeterm/`).
`phase-04:57` bảo ghi biên bản diễn thử vào `plans/260805-0811-.../reports/` — viết biên bản xong
rồi build `--release` thì **fail**. Bẫy thao tác thật, xảy ra đúng vào ngày cuối.
*Fix nhỏ nhất:* `--release` chỉ đòi sạch với **file mã nguồn ảnh hưởng deck**
(`git status --porcelain -- scripts/ packages/ apps/`), hoặc đơn giản: bắt commit trước, và ghi
1 dòng quy trình vào phase.

**(b) "SHA khớp HEAD" chưa có quy trình để đạt.** Vòng 1 (feasibility F1, phần "Fix nhỏ nhất") đã
viết sẵn quy trình: tải artifact `acceptance-journeys-<sha>` từ run `ui-e2e` xanh → đặt vào
`apps/e2e/acceptance-results/journeys.json` → `pnpm acceptance:report` → `deck:build --release`.
**Bản vá không chép quy trình đó vào phase nào.** Hiện tại `verification.json`
`evidenceRun.sha = d359249` còn HEAD là `83b59b0` ⇒ `--release` fail 100%, và không tài liệu nào
nói cách gỡ. **STILL-OPEN.**

**(c) Quên cờ `--release` là im lặng.** Đúng như câu hỏi tấn công đặt ra: bản nháp mang nhãn
"chưa đo" trông y hệt bản thật trên máy chiếu. `--release` là cổng đặt sai chỗ — nó bảo vệ *hành
vi build*, không bảo vệ *thứ được chiếu*.
*Fix nhỏ nhất, đảo chiều mặc định:* build thường **luôn** in một dải "BẢN NHÁP — số liệu chưa xác
nhận" cố định ở mọi slide; chỉ `--release` gỡ dải đó. Quên cờ thì cả phòng họp nhìn thấy, thay vì
không ai thấy. Rẻ hơn mọi checklist.

**(d) Nhánh badge:** vòng 1 đòi map đủ 10 badge (`types.ts:65-90`). Đo lại `flow-evidence.ts:54-80`:
mọi nhánh không-xanh đều trả `state: fallback` kèm badge, nên **map theo `state` là đủ** —
lo ngại vòng 1 hơi quá tay. Dữ liệu hiện tại: `proven/proven` ×31, `not-yet/no-ui-path` ×7. Vẫn
phải để `default:` = "chưa đo".

**Verdict: CLOSED (không hard-fail) + NEWLY-INTRODUCED (a) + STILL-OPEN (b), (c).**

---

### #5 — Nhãn hai tầng (D8): **SỐ ĐÚNG TUYỆT ĐỐI**, ngữ nghĩa thiếu một trường quan trọng

Đo trực tiếp `acceptance-report/business-verification.json`:

```
counts: {"verifiedCorrect":16,"reachableOnly":15,"notProven":7,"total":38}
by correctness: {verified-correct:16, reachable-only:15, not-proven:7}
```
`verification.json`: `{proven/proven:31, not-yet/no-ui-path:7}`, `commit d359249`,
`evidenceRun.dirty:true`.

**16 / 15 / 7 và 31 / 7 — ĐÚNG NGUYÊN VĂN. CLOSED.**

**Câu hỏi "business-verification có phủ đủ 39 luồng manifest không":**
`scripts/business-verify/verify.ts:29-32` đọc `acceptance-report/verification.json` làm đầu vào ⇒
tập luồng của nó **luôn bằng tập của ledger**, không bao giờ bằng tập của manifest.
Đo: manifest 38 = verification 38 = business 38, giao khác rỗng ở cả ba chiều → **hiện tại lệch =
0**. Vậy tình huống "luồng có ở file này, thiếu ở file kia" giữa **hai file JSON** là bất khả thi
về mặt cấu trúc; đường lệch duy nhất là manifest ↔ ledger, và nó vừa đóng lại nhờ `83b59b0`.
⇒ Câu `plan.md:88` *"lệch manifest đúng `P3-01b`"* phải xoá (xem B1).

**Thiếu sót thật (STILL-OPEN, mức Cao về uy tín):** `verify.ts:150` sinh trường
`criticalReachableOnly` — danh sách các luồng **tiền/trạng thái** mới ở mức smoke
(`MONEY_STATE_KEYWORDS` gồm `phiếu thu`, `học phí`, `duyệt`, `lương`, `payroll`, `hoàn`, `KPI`…).
Đây là con số **ban giám đốc quan tâm nhất**: "luồng duyệt tiền đã kiểm số chưa?". Plan không hiển
thị trường này ở bất cứ đâu. Nói "16 verified-correct" mà không nói luồng tiền nào nằm ngoài 16 đó
vẫn là nửa sự thật — đúng loại rủi ro mà D8 sinh ra để đóng.
*Fix nhỏ nhất:* slide trạng thái in thêm một dòng: *"trong đó N luồng tiền/lương mới ở mức chạy
thông"*, đọc thẳng từ `criticalReachableOnly.length`.

**Thiếu sót thứ hai:** `business-verification.json` có trục stale riêng
(`ledgerCommit`, `resultsSha`, `resultsPresent`; kiểm ở `verify.ts:163`). D9 chỉ nói tới
`sha !== headSha` của `verification.json`. Một file tươi ghép một file cũ vẫn lọt.

**Rác còn sót:** `phase-03:107` Validation vẫn ghi *"Nhãn trạng thái từng luồng khớp
`verification.json`"* — một tầng, mâu thuẫn trực tiếp với D8. Bản vá sửa phần mô tả mà quên phần
kiểm.

---

### #6 — Chống bypass Phase 4: **KHÔNG ĐỦ, và bản vá có một lỗi logic ngay trong câu chữ**

`phase-04:46`: *"Helper chụp ảnh **tự nó** phải no-op khi thiếu `EVIDENCE_DIR` **và**
`DECK_CAPTURE_ALLOW`"*.

Đọc đúng nghĩa đen: chỉ no-op khi **thiếu cả hai**. Thiếu một → vẫn chụp. Fail-closed đòi
**hoặc** (`||`), tức thiếu bất kỳ biến nào là no-op. Một chữ, đảo hẳn hành vi cổng.

**Các đường bypass còn lại kể cả khi sửa chữ đó:**

1. **Biến còn sót trong shell — đúng lỗ F2, chỉ đổi tên biến.** Bản vá thay `SYNTH_SEED_ALLOW`
   bằng `DECK_CAPTURE_ALLOW` vì biến cũ bị "tiêu dùng" ở bước seed. Nhưng dev vẫn sẽ
   `export DECK_CAPTURE_ALLOW=1` một lần cho cả phiên chụp, rồi chạy tiếp `pnpm --filter @cmc/e2e
   test` trong **cùng shell đó** → chụp lại. Vòng 1 (F4) đề xuất **token ngẫu nhiên mỗi run do
   runner sinh** (`DECK_CAPTURE_TOKEN`), helper `throw` nếu token không khớp. **Bản vá bỏ mất phần
   token, chỉ giữ phần biến tĩnh.** Đây là phần *duy nhất* chống được env kế thừa.
2. **`packages/db/prisma/.env`** — file tồn tại thật (`ls` → 141 byte, 2026-07-24), Prisma CLI
   auto-load. Guard đọc `process.env`, Prisma đọc file. **Không bản vá nào đụng tới F8.**
3. **CI.** `phase-04:48` mong *"chạy e2e thường (kể cả trên CI) không sinh ảnh nào"* — đúng nếu
   helper fail-closed, nhưng chưa ai kiểm tra rằng job `ui-e2e` không tình cờ có biến đó trong
   secrets/env. Test âm thứ 6 (`phase-04:120`) chỉ kiểm ở local.
4. **Nhánh build** — đóng đúng bằng `manifest.json` + sha256 + `approved.json`, đây là phần bản vá
   làm tốt nhất; nhưng xem lỗ `approved.json` bị gitignore ở #3.

**Verdict: STILL-OPEN + một lỗi chữ nghĩa (`và` phải là `hoặc`).**

---

### #7 — `dbFingerprint = sha256(dbName + "|" + sentinelFacilityId).slice(0,12)`

**Về rò rỉ: AN TOÀN. CLOSED.** `Facility.id` là `@default(uuid())` (`schema.prisma:231`) ⇒ đầu vào
có ~122 bit entropy, không enumerate được; đầu ra 12 hex không đảo ngược được; không chứa host,
port, user, password. Unit test regex chặn `[:@]|password|postgres(ql)?://` là lớp bọc hợp lý.

**Về giá trị chứng minh: GẦN NHƯ BẰNG KHÔNG (NEWLY-INTRODUCED — cảm giác an toàn giả).**

- Plan không nói fingerprint được **so với cái gì**. `phase-04:132` chỉ đòi *"khớp công thức đã
  chốt"* — tức chỉ kiểm nó được tính đúng cách, không kiểm nó trỏ đúng DB. Một giá trị tự-nhất-quán
  luôn "khớp công thức".
- Muốn xác minh sau này phải tính lại từ DB — mà DB là throwaway, xoá xong là fingerprint thành
  chuỗi vô nghĩa vĩnh viễn.
- Nó **thừa hưởng nguyên F3b**: restore prod (đã bị trồng sentinel) vào một DB tên `cmc_synth` thì
  `dbName` sạch, `sentinelFacilityId` copy nguyên từ prod ⇒ fingerprint ổn định, trông đáng tin,
  và sai hoàn toàn.
- Ca biên chưa xử lý: không có sentinel → `undefined` bị nối chuỗi, vẫn ra một fingerprint hợp lệ.
  Phải abort chứ không phải hash.

**Nó thực chất là gì:** một **token tương quan** ("mấy ảnh này cùng một DB"), không phải bằng chứng
non-prod. Chấp nhận được nếu plan gọi đúng tên. **Không được** để nó thay cho điều kiện phủ định mà
vòng 1 đề xuất (F3 fix #3: trần số bản ghi `Facility` + tập `code` đóng) — bản vá đã bỏ đề xuất đó
mà không nêu lý do.

---

### #8 — Tách ngưỡng từ (25 / 60 / sơ đồ đếm riêng): **CHỈ DI CHUYỂN CHỖ MƠ HỒ**

`phase-03:33-36` đặt ngưỡng 60 từ cho màn tra cứu, và nói chữ trong sơ đồ *"đếm riêng và đặt trần
riêng"*.

**Bốn lý do nó vẫn chưa đo được:**

1. **Mâu thuẫn sống trong cùng một file.** `phase-03:34` ghi *"≤ 60 từ"*; `phase-03:104` Validation
   vẫn ghi *"0 màn vượt **25** từ"*. Người viết `check-copy.ts` phải chọn một, và sẽ chọn dòng
   Validation vì đó là cái được tick.
2. **Trần cho chữ trong sơ đồ không có số.** *"đặt trần riêng"* — bao nhiêu? Không có con số thì
   không có cổng. Vòng 1 (F4b) đã cho sẵn số cụ thể (≤6 từ/nhãn, ≤12 nhãn/sơ đồ); bản vá chép ý
   tưởng, bỏ con số.
3. **Không có trường phân loại màn.** `check-copy.ts` phải biết màn nào là mạch chính (25) màn nào
   là tra cứu (60). `phase-01`/`phase-03` Files không có field nào mang thông tin đó
   (`flow-copy-schema.ts` chỉ được mô tả là *"ép đủ 4 câu trả lời"*). Không phân loại được ⇒ không
   áp ngưỡng được.
4. **Đơn vị đếm vẫn không định nghĩa.** Vòng 1 (F4a) chỉ ra tiếng Việt tách theo khoảng trắng là
   **âm tiết**: *"Giám đốc Kinh doanh duyệt phiếu thu; vượt ngưỡng thì cần mắt thứ hai"* = 14 token.
   Bản vá không nói "từ" nghĩa là gì. 60 "từ" có thể là 60 âm tiết (≈ 28 từ thật) hoặc 60 từ thật —
   chênh gấp đôi.
5. **`chrome`/`notes` chưa tuyên bố miễn đếm.** Tiêu đề, mã luồng ở góc, badge trạng thái, và
   presenter notes (phase-04 đòi 3-4 gạch đầu dòng/màn) — nếu bị đếm thì mọi màn fail.

**Verdict: STILL-OPEN.**
*Fix nhỏ nhất, một khối trong `flow-copy-schema.ts`:*
`kind: 'spine' | 'reference'`; `prose` ≤25 (spine) / ≤60 (reference), đơn vị = **token tách theo
khoảng trắng**, nói thẳng ra; `diagramLabels` ≤6 token/nhãn và ≤12 nhãn/sơ đồ; `chrome` và `notes`
khai tường minh là miễn đếm. Rồi sửa `phase-03:104` cho khớp.

**Kèm theo, vẫn chưa đóng từ vòng 1 (F4a):** hệ quả khối lượng. 38 luồng × 2–3 màn ≈ ~100 slide
nội dung. `phase-03` vẫn không có con số slide nào, nên "cắt 5 đợt" chưa có đơn vị đo tiến độ.

---

### #9 — Bỏ claim "PDF làm tài liệu để lại": **CLOSED, không còn gì phụ thuộc**

Grep toàn thư mục plan: chỉ còn `phase-04:22-23` (nói rõ PDF **chỉ** là bản dự phòng) và
`plan.md:53` (D7 gạch bỏ). Không AC nào, không phase nào còn dựa vào tài liệu để lại.
Đối chiếu giao kèo: `brainstorm-contract:16` và `:53` vốn đã coi tài liệu để lại là **sản phẩm
riêng, làm sau** ⇒ việc bỏ là **nhất quán với giao kèo**, không phải cắt scope lén.

`phase-04` giữ đúng ba thứ vòng 1 yêu cầu: không `showNotes` (đóng F13), `pdfSeparateFragments:
false`, và validation "số trang hợp lý".

**Một giá trị bị bỏ theo, nên nhặt lại (mức Thấp):** vòng 1 (F9 fix #2) đề xuất dùng
`acceptance-report/index.html` — **đã tồn tại sẵn** (`ls acceptance-report/` → có) — làm phụ lục
trạng thái để lại, chi phí 0. Bỏ claim PDF kéo theo mất luôn đề xuất này. Không phải lỗi, nhưng là
giá trị miễn phí bị rơi.

---

### #10 — Nhất quán liên phase

**Cấu trúc: SẠCH.** Trên bản hiện tại (4 phase):

| plan.md | Link | File tồn tại | Frontmatter `dependencies` | Khớp |
|---|---|---|---|---|
| 1 (—) | `phase-01-nen-tang-generator-va-vo-reveal.md` | ✓ | `[]` | ✓ |
| 2 (1) | `phase-02-mach-chinh-va-ban-do-nha.md` | ✓ | `[1]` | ✓ |
| 3 (1,2) | `phase-03-noi-dung-toan-bo-luong.md` | ✓ | `[1, 2]` | ✓ |
| 4 (2,3) | `phase-04-ghi-chu-dien-thu-kiem-thu.md` | ✓ | `[2, 3]` | ✓ |

Không link gãy, không vòng, không tham chiếu tới phase-00/phase-05 còn sót (grep sạch).
Tham chiếu dangling *"Không có ảnh thật — xem Phase 4"* ở `phase-03:50` đã được sửa thành
*"Màn quản trị, mô tả gọn"*. Tốt.

**Bốn chỗ lệch còn lại:**

1. **`phase-04-ghi-chu-dien-thu-kiem-thu.md:8`** — H1 vẫn là `# Phase 5 — Ghi chú, diễn thử, kiểm
   thử` trong khi frontmatter là `phase: 4`. Đổi tên file xong quên đổi tiêu đề.
2. **`phase-04:57`** trỏ `plans/260805-0811-deck-thuyet-trinh-van-hanh-he-thong/reports/` —
   `ls` → **không tồn tại**. Mọi report của kế hoạch này đang nằm ở `plans/reports/`. Chọn một chỗ.
3. **`plan.md:114-115` AC#6 cấm từ `KPI`, còn `phase-02:40` chặng 7 của mạch chính viết
   *"chấm công, ca làm, **KPI**, chốt lương giáo viên"*.** Cổng grep sẽ fail trên chính nội dung
   mạch chính. Ngoài ra `geofence` và `OR gate` giờ là mục chết — `83b59b0` đã xoá `P3-01b`; đo
   lại manifest chỉ còn `auto-score` (dòng 591) và `branch-scope` (dòng 627) trong `displayName`.
4. **`plan.md:117` AC#8** *"**0** ảnh chụp từ hệ thống thật trong toàn bộ output"* — sau khi bỏ
   Phase 4 thì đây là mệnh đề tự đúng, không đo gì. Nếu muốn giữ, làm nó đo được: *"build fail nếu
   output chứa bất kỳ `<img>` hoặc `data:image/(png|jpeg)` nào"* — một dòng, chặn thật cả trường
   hợp ai đó dán ảnh vào sau này.

---

## 3. Trạng thái các finding vòng 1

### Báo cáo an toàn dữ liệu

| # | Nội dung | Verdict vòng 2 |
|---|---|---|
| F1 | `.gitignore` không phủ thư mục ảnh lồng | **STILL-OPEN trong repo** (đo lại: not ignored). Ra ngoài scope plan; `plan.md:36-37` có ghi lại |
| F2 | `SYNTH_SEED_ALLOW` không còn là positive signal | **APPARENTLY CLOSED** — đổi tên biến không chống được env kế thừa; phần token bị bỏ (xem #6) |
| F3a | `seed.mjs` không có guard prod | **STILL-OPEN** (`grep -c` → 0, đo lại hôm nay). Bản vá **unimplementable** (xem #2) |
| F3b | Sentinel chứng minh sai mệnh đề | **STILL-OPEN** — điều kiện phủ định vòng 1 đề xuất đã bị bỏ, không nêu lý do |
| F3c | Verify sentinel qua container ≠ qua URL capture | Không thấy bản vá nào đụng tới. **STILL-OPEN** |
| F4 | Bypass bằng lệnh e2e thẳng | **APPARENTLY CLOSED** — thiếu token, và câu chữ dùng `và` thay vì `hoặc` |
| F5 | Không ràng buộc xuất xứ ảnh | **CLOSED về thiết kế** (manifest+sha256+file thừa→fail). Prune `rm -rf` vẫn chưa nêu |
| F6 | `dbFingerprint` rò rỉ / không định nghĩa | **CLOSED phần rò rỉ**, xem #7 phần giá trị chứng minh |
| F7 | Bỏ `specStatus` | **CLOSED** (`phase-04:69,72-75`) |
| F8 | `packages/db/prisma/.env` override vô hình | **STILL-OPEN — không bản vá nào nhắc tới.** File tồn tại thật |
| F9 | Duyệt ảnh không khả thi | **CLOSED về thiết kế** (từ điển tên đóng + tiền tố `DEMO —` + tiêu chí nhị phân) |
| F10 | Số điện thoại VN thật | **CLOSED** (`phase-04:85-86`); code `random-vn-phone.ts:9-15` vẫn nguyên (ngoài scope) |
| F11 | `.data/blobs` dùng chung | **CLOSED** (gate 7) |
| **F12** | **Ký hiệu nội bộ (`crm.opportunityAdvance`, `/crm/opportunities/:id`, đường dẫn spec) chảy từ `verification.json` vào deck; AC#6 là blacklist khái niệm nên không bắt được** | **STILL-OPEN VÀ VẪN TRONG SCOPE.** `phase-01:60` `load-flow-data.ts` vẫn đọc `verification.json` không có whitelist trường nào. Đây là finding vòng 1 nặng nhất **còn trong phạm vi** mà không bản vá nào đụng |
| F13 | PDF kèm notes | **CLOSED** (`phase-04:24-26`) |
| F14 | trace/video không pin | Ngoài scope sau khi bỏ ảnh |
| F15 | AC "0 ảnh local-sim" không đo được | **STILL-OPEN dưới dạng khác** — AC#8 mới cũng không đo được (xem #10.4) |

### Báo cáo khả thi / rủi ro giao hàng

| # | Verdict vòng 2 |
|---|---|
| F1 hard-fail + stale | **CLOSED** phần mặc định; `--release` **STILL-OPEN** (không có quy trình lấy ledger @ HEAD; bẫy cây-bẩn) |
| F2 font/UMD | **CLOSED** (D1, D6, `phase-01:73-78`) |
| F3 hai tầng nhãn | **CLOSED**, số đúng; thiếu `criticalReachableOnly` (mới) |
| F4 ngưỡng 25 từ | **APPARENTLY CLOSED — thực chất còn mở** (xem #8) |
| F5 từ cấm | **Đóng một nửa**: danh sách mở rộng, nhưng kiểm `customerTitle ≠ displayName` chỉ là văn xuôi (`phase-03:94`), mục tiêu grep vẫn không xác định, và tạo mâu thuẫn `KPI` mới |
| F6 checkpoint / ship độc lập | **Đóng một nửa**: hai chốt rà khuôn đã thêm (`phase-03:52-57`). Mâu thuẫn *"mỗi cụm ship độc lập"* (`phase-03:42`) vs *"đủ 39/39"* (`plan.md:112`) **vẫn nguyên**; "mức tối thiểu mỗi luồng" không adopt |
| F7 `P3-01b` không nhãn | **OBSOLETE** — luồng đã bị `83b59b0` xoá |
| F8 pin version / vendor / TOKENS_CSS | Pin + vendor **CLOSED**; `TOKENS_CSS` chép lần 3 **STILL-OPEN** (thấp) |
| F9 PDF để lại | **CLOSED** (xem #9) |
| F10a `source` bắt buộc mỗi câu | **STILL-OPEN.** `phase-03:108` vẫn *"đối chiếu ngẫu nhiên 5 luồng"* = mẫu 13% do chính người viết kiểm; Risks nói "mỗi luồng phải trỏ về mục nguồn" nhưng không có field schema, không có kiểm máy |
| F10b 3 slide Q&A khó | **STILL-OPEN** — không adopt |
| F10c diễn thử sớm | **CLOSED** (`phase-04:66` bước 5 "làm sớm") |
| F10d version deck | **Đóng một nửa** — có mục "Phiên bản deck"; `deck-release.json` commit được thì không adopt ⇒ vẫn không tái dựng được thứ đã chiếu |

---

## 4. Xếp hạng và việc cần làm

| Hạng | Vấn đề | Fix nhỏ nhất |
|---|---|---|
| **CHẶN** | B1 — 39/P3=12/`P3-01b` đều sai sau `83b59b0`; AC#4 đánh nhau với Requirement 4 | Bỏ số cứng, ghi "38 @ `83b59b0`", xoá `P3-01b` khỏi phase-03, sửa AC#4 |
| **CHẶN** | B2 — "quyết định người dùng bỏ ảnh" không có vết, đảo giao kèo đã chốt; và mockup SVG thay thế không phase nào nhận | Hỏi người dùng xác nhận; nếu giữ thì thêm `screen-sketch` vào phase-01 Files hoặc hạ D3 |
| Cao | F12 vòng 1 — ký hiệu nội bộ chảy vào deck, AC#6 không bắt | `load-flow-data.ts` whitelist trường: chỉ `{id, displayName, cluster, actorRoles, state, correctness}`; assertion build chặn `.ts`, route, `^[a-z]+\.[a-zA-Z]+$` |
| Cao | `--release` không có đường qua (ledger @ HEAD + cây sạch) | Chép quy trình artifact `acceptance-journeys-<sha>` vào phase-01; giới hạn kiểm sạch ở `scripts/ packages/ apps/` |
| Cao | Quên `--release` là im lặng | Đảo mặc định: build thường luôn có dải "BẢN NHÁP", `--release` gỡ |
| Cao | Ngưỡng từ: 25 vs 60 mâu thuẫn trong cùng file, trần sơ đồ không có số, đơn vị đếm không định nghĩa | `kind: 'spine'\|'reference'` + 3 con số + khai miễn đếm `chrome`/`notes`; sửa `phase-03:104` |
| Cao | Không ai sở hữu tính đúng nghiệp vụ (mẫu 13% tự kiểm) | `source: {doc, heading}` bắt buộc mỗi câu, `check-copy.ts` grep heading trong file |
| TB | `criticalReachableOnly` không hiển thị | 1 dòng trên slide trạng thái |
| TB | `phase-03:107` còn nhãn một tầng | Sửa thành hai tầng |
| TB | AC#6 cấm `KPI` nhưng `phase-02:40` dùng `KPI` | Bỏ `KPI` khỏi danh sách cấm hoặc sửa chặng 7; bỏ `geofence`/`OR gate` (đã chết) |
| TB | "ship độc lập" vs "đủ 38/38" | Định nghĩa mức tối thiểu mỗi luồng (tên khách + nhãn + cụm) |
| Thấp | H1 phase-04 ghi "Phase 5" | Sửa tiêu đề |
| Thấp | `plans/.../reports/` không tồn tại | Trỏ về `plans/reports/` |
| Thấp | AC#8 không đo được | Đổi thành "build fail nếu output có `<img>` / `data:image/*`" |

**Ngoài scope plan nhưng nên mở task riêng như `plan.md:41` đề nghị** — kèm cảnh báo rằng hai bản
vá đã soạn cho chúng đều **không dùng được nguyên trạng**:
- `.gitignore` phủ thư mục ảnh lồng (F1) — chưa có pattern nào được viết ra
- guard prod cho `seed.mjs` (F3a) — đường import trong plan không chạy được; và guard **đã có 2
  bản** (`apps/e2e/src/assert-not-prod.ts`, `apps/api/src/test/db.ts:24-36`), vá kiểu này thành 3
- `packages/db/prisma/.env` (F8) — chưa ai đụng

---

## 5. Câu hỏi còn treo

1. **Người dùng có thật sự chốt bỏ ảnh chụp không?** Nếu không, phải khôi phục `phase-00` +
   `phase-04-anh-that`, và toàn bộ mục #1–#3, #6, #7 ở trên trở thành blocker sống.
2. **Bỏ ảnh rồi thì "phác hoạ bố cục màn hình" ai vẽ, vẽ bao nhiêu màn, tính vào phase nào?**
   Hiện chỉ có lời hứa ở `plan.md`, không có chỗ thực thi.
3. **Nguồn ledger cho bản release lấy ở đâu** — artifact CI `acceptance-journeys-<sha>` hay chạy
   local (`dirty`, không phải sổ chính danh)? Chưa trả lời từ vòng 1; nó chặn `--release`.
4. **Branch `feature/geofence-gps-punch-verification` có merge trước buổi họp không?** Sau
   `83b59b0` thì luồng geofence **không còn journey UI** — nếu tính năng vẫn ship, deck sẽ mô tả
   một tính năng có mặt trong sản phẩm mà **không có luồng nào trong sổ nghiệm thu**. Cần quyết:
   nói hay không nói, và nói bằng nhãn gì.
5. **`KPI` có phải từ cấm không?** Ban giám đốc CMC nội bộ nhiều khả năng dùng từ này hằng ngày.
   AC#6 và `phase-02:40` phải chọn một phía.
6. **Có được nói ra `criticalReachableOnly` (luồng tiền/lương mới ở mức smoke) trước ban giám đốc
   không?** Đây là quyết định sản phẩm, không phải kỹ thuật.
7. **Ai là người thứ hai đọc lại nội dung nghiệp vụ?** Nếu "không có ai" thì F10a vòng 1 phải lên
   mức Cao — cổng bằng máy là lớp duy nhất.
