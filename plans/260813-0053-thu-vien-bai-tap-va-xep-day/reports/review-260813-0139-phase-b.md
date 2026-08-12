# Review — Phase B (docs + gates) · `docs/console-authority` @ `cc19b92`

**Verdict: SHIP WITH FIXES** — 1 blocking item (merge-order / doc claim), 4 non-blocking.

Đo lại độc lập trên worktree, không chỉ đọc diff. Cổng không bị nới. Số 61 đúng.

---

## Blocking

### B1. `docs/design-system-console.md:78` khẳng định một lock chưa tồn tại

```
This rule is locked by `packages/ui/src/console/console-precedence.test.ts`.
```

`ls packages/ui/src/console/` → không có file đó (có `console-astryx-remap.test.ts`,
`console-tokens.test.ts`, …). Dòng 143 cũng thêm `console-precedence.test.ts` vào bảng
**Unit locks / Evidence**.

Đây đúng là lớp lỗi mà chính PR này dựng cổng để chặn: tài liệu sống dạy một thứ không có
trên cây. Khác biệt duy nhất là chuỗi cấm không nằm trong allowlist nên `check:doc-authority`
xanh. Người/agent đọc `design-system-console.md` sẽ tin luật precedence đã có test giữ —
trong khi trên `develop` sau khi merge PR này, nó **không** có gì giữ.

Không phải "chỉ cần thứ tự merge" theo nghĩa tuỳ chọn — nó **là** ràng buộc thứ tự bắt buộc:

- Merge sau `feat/token-name-isolation` (Phase A) ⇒ hết vấn đề, không cần sửa code.
- Merge trước ⇒ phải hạ giọng thành `sẽ được khoá bởi … (Phase A, chưa merge)` và gỡ khỏi
  bảng Evidence, rồi khôi phục khi Phase A vào.

Chọn một trong hai trước khi mở PR. Đừng để trạng thái hiện tại lên `develop` một mình.

**Đề xuất kèm (không bắt buộc):** thêm rule vào `check-doc-authority.mjs` — mọi path
`*.test.ts(x)` xuất hiện trong `docs/design-system-console.md` phải tồn tại. Rẻ, và
đúng loại lỗi này đã lọt qua đúng cổng vừa viết ra.

---

## Đã xác minh — không có vấn đề

### Ratchet không bị nới cho admin (trọng tâm 1) ✅

- `node scripts/ui-ratchet.mjs --json`: `pageCount 82`, `filesWithViolations 11`,
  `totalViolations 61`, `increased []`. **Mọi key trong `perFile` đều là `apps/lms/`** —
  admin thật sự 0.
- Tổng baseline = 3+5+8+3+11+4+6+1+10+8+2 = **61**, khớp chính xác số đo. Không có mục
  đệm, không có mục admin.
- Cơ chế fail còn nguyên: `ui-ratchet.mjs:272` `const before = baseline[rel] ?? 0` →
  file admin không có mục baseline ⇒ ngưỡng 0 ⇒ literal admin mới fail ngay như trước.
  Việc thêm baseline **không** đụng nhánh so sánh.
- `ratchet-exemptions.json` vẫn 16 mục, toàn `apps/admin/` — LMS không nhận exemption nào,
  61 là literal thật sau khi trừ exemption.
- Bảo hiểm tốt: `ui-ratchet.test.mjs:31-34` assert *không* key nào trong `perFile` **và**
  trong `baseline` được phép nằm ngoài `apps/lms/`. Nghĩa là nếu ai chạy
  `--write-baseline` khi admin đang bẩn (footgun thật của `:239`), test đỏ chứ không âm
  thầm grandfather admin. Đây là chỗ thiết kế đúng.

### Frames mở scope không pha loãng cổng ✅

Hai điều kiện `--strict` đều **tuyệt đối**, không phải tỉ lệ: `bulkListsOk = bulkFiles ≥ 5`
(`check-ui-frames.mjs:142`) và `dualTitleReview` rỗng. Thêm 16 file LMS chỉ có thể *tăng*
đếm hoặc *thêm* dual-title — không thể làm một cổng đang xanh khỏi ngưỡng. Không có metric
dạng "% adoption" để bị loãng.

### CI thật sự blocking (trọng tâm 3) ✅

- 4 step nằm ở `ci.yml:113-129`, trong job `typecheck-and-test` (`ci.yml:28`).
- `gh api repos/:owner/:repo/branches/{main,develop}/protection` →
  `["typecheck-and-test","ui-e2e"]`. Job này **là** required check trên cả hai nhánh.
- Không `continue-on-error` (trái với 2 step cố ý non-blocking cùng job:
  screen-role-matrix, acceptance:report). Chạy `check && test` nên cả script lẫn test
  của nó đều chặn.
- `check:ui-a11y-roles` chạy thật, xanh: `8 checks passed`. Không có sửa code app để ép xanh.

### Doc precedence mô tả đúng hành vi (trọng tâm 4) ✅

`console.css:371` mở block `.o_web_client { … }` remap `--font-size-*` (10/11/12/13/14/…),
`--text-*-size` (`:387-400`), `--font-family-*` (`:402-403`), `--color-text-*` (`:428-430`).
Shell gắn class tại `apps/admin/src/shell/shell.tsx:130` `<div className="o_web_client">`.
`grep console.css apps/lms/` = 0 hit ⇒ câu "ngoài shell, Astryx/CMC thắng" đúng.
Comment sẵn có ở `console.css:368-369` xác nhận đây là chủ ý ("override one does not
cascade into the other"), không phải tai nạn. Mô tả trong doc khớp nguồn.

### Comment-only (trọng tâm 6) ✅

`packages/ui/src/index.ts:166` và `console.css:1394` chỉ đổi nội dung comment; export và
selector nguyên vẹn. `primitives.ts:35-41` (SideNav re-export) và `console-navbar.tsx:8`
đúng là **không** bị đụng.

### LMS 4 file (trọng tâm 5) ✅

`2xs`→`sm` đúng 4 vị trí đặc tả: `student/home.tsx:90`, `exercise.tsx:149,153`,
`parent/homework-results.tsx:64`. `grep size="2xs" apps/lms/src` còn 8 hit, **không hit nào
nằm trong tập bị cấm đụng** — `login.tsx:210,257,272` ✓, `session-evidence.tsx:116,139` ✓,
`exercise.tsx:193` (đếm ký tự, không phải meta bài) ✓. Viewport: bỏ đúng
`maximum-scale=1.0, user-scalable=no`, giữ `width=device-width, initial-scale=1.0`.
Commit message không có AI attribution.

---

## Non-blocking

### N1 (High) — `ui-ratchet.test.mjs:38` đỏ khi ai đó *cải thiện* LMS

```js
assert.equal(report.totalViolations, Object.values(baseline).reduce((s, n) => s + n, 0));
```

Bằng-chính-xác. Token-hoá **một** inline style trong LMS, hoặc xoá một file LMS ⇒
`check:ui-ratchet` vẫn xanh nhưng `test:ui-ratchet` đỏ với `expected 60 to equal 61`.
Cổng phạt đúng hướng đi mình muốn, và thông báo lỗi không nói phải làm gì
(`node scripts/ui-ratchet.mjs --write-baseline`). Với một người vận hành, đây là loại đỏ
làm người ta nới cổng.

Sửa: `assert.ok(report.totalViolations <= sum, 'ratchet chỉ được giảm — chạy --write-baseline sau khi dọn')`.
Giữ nguyên hai vòng assert `startsWith('apps/lms/')` — đó mới là phần giữ admin ở 0.

### N2 (Medium) — rule `require` của `docs/README.md` xanh giả được

`check-doc-authority.mjs:62` chỉ kiểm `text.includes('design-system-console')` trên **toàn
file**. `docs/README.md` đang có 2 chỗ chứa chuỗi đó (`:15` đường đọc Frontend dev, `:41`
mục TL12). Xoá dòng `:15` — đúng thứ đặc tả muốn chặn ("frontend path thiếu
design-system-console") — cổng vẫn xanh nhờ `:41`.

Sửa: đổi thành rule theo dòng, ví dụ `requireLine: { match: /\*\*Frontend dev\*\*/, contains: 'design-system-console' }`.

Kèm: test chỉ chứng minh đường đỏ cho nhánh `forbid` (`check-doc-authority.test.mjs:40`).
Nhánh `require` — đúng cái rule yếu nhất — không có ca đỏ nào. Thêm một ca.

### N3 (Medium) — tập `forbid` lệch nhau giữa các file

`docs/12-design-system-ui.md` cấm `--sh-` nhưng **không** cấm `.sh-`; ba file
`design-system/` thì cấm `.sh-`. Viết `.sh-cta` vào TL12 ⇒ cổng xanh. Không có lý do để hai
tập khác nhau; hợp nhất thành `['AppFrame', '.premium-', '--sh-', '.sh-', '.ck-surface', 'tpl-wrap', 'premium.css']`
rồi trừ ra theo file nếu thật sự cần.

Ngoài ra `docs/design-system-console.md` — tài liệu authority chính, và là file PR này
thêm nội dung quan trọng nhất — **không nằm trong allowlist**, nên không có gì giữ nó.

### N4 (Medium) — dư drift ngoài allowlist, vẫn là live instruction

`grep` toàn `docs/` + `design-system/` (bỏ journals/changelog vốn là lịch sử, đúng):

- `docs/18-tech-stack-va-chuan-ky-thuat.md:36` — vẫn dạy `@cmc/ui` export `AppFrame, SideNav`.
  TL18 nằm ngay trên đường đọc "Frontend dev" mà `docs/README.md:15` vừa sửa. Không có trong
  đặc tả, nhưng cùng lớp lỗi và một dòng là xong.
- `design-system/cmc-edu/VIEW-GRAMMAR.md:22` `LMS (TL12): AppFrame + SideNav` — mâu thuẫn
  với chính banner `:14` của file đó. Đặc tả đã hoãn (chấp nhận), ghi lại để không quên.
- `STYLING-BRIDGE.md:72-98` — `.sh-cta*` (đặc tả hoãn).

### N5 (Low) — `.ck-*` utilities còn lại trỏ vào hư không

Diff xoá `.ck-surface` khỏi `STRUCTURE.md:18` và `llms.txt:36` nhưng giữ
`.ck-keyline`, `.ck-truncate`, `.ck-label-upper`, `.ck-title-1line`, `.ck-meta-1line`
(`STRUCTURE.md:38`, `llms.txt:36`). Đo:
`grep -rn 'ck-truncate|ck-keyline|ck-label-upper|ck-title-1line|ck-meta-1line' apps packages`
= **0 hit**. Không class nào trong số đó tồn tại. Đúng đặc tả (đặc tả chỉ yêu cầu
`.ck-surface*`), nhưng kết quả là hai dòng vừa được sửa vẫn dạy 5 class không có thật.

Bonus quan sát: `check-ui-frames.mjs:20-24` `EXEMPT` lọc theo **basename**, nên
`apps/lms/src/pages/login.tsx` và `student/change-password.tsx` bị miễn khỏi frames scan
như tác dụng phụ của exemption vốn viết cho admin. Vô hại ở đây (frames LMS chỉ báo cáo),
nhưng ratchet lại **không** miễn theo basename — `apps/lms/src/pages/login.tsx: 3` có trong
baseline. Hai script cùng scope, hai luật lọc khác nhau; ghi lại để đừng ngạc nhiên sau này.

---

## Không đồng ý với báo cáo cook (nhỏ)

`cook-260813-0139-phase-b.md:15` gọi `2xs`→`sm` là "sửa đọc". Đo tại
`astryx-theme-cmc.css:72,74`: `--font-size-2xs: 12px` → `--font-size-sm: 13px`.
Là **1px**, không phải bước nhảy dễ đọc. Thay đổi đúng hướng và vô hại, nhưng đừng ghi vào
tài liệu như một cải thiện accessibility đã đạt.

---

## Hành động theo thứ tự

1. **B1** — chốt thứ tự merge sau Phase A, hoặc hạ giọng 2 chỗ trong
   `docs/design-system-console.md:78,143`. Không mở PR trước khi chốt.
2. **N1** — đổi `assert.equal` → `assert.ok(<=)` ở `ui-ratchet.test.mjs:38`.
3. **N2** — rule `require` theo dòng + một ca test đỏ cho nhánh `require`.
4. **N3** — hợp nhất tập `forbid`; cân nhắc đưa `docs/design-system-console.md` vào allowlist.
5. **N4/N5** — TL18:36 (1 dòng, làm luôn); phần còn lại ghi vào phase sau.

## Câu hỏi chưa giải

- Phase A (`feat/token-name-isolation`) có merge trước không? Câu trả lời quyết định B1 là
  "không cần làm gì" hay "phải sửa doc".
- Có chủ ý giữ 5 class `.ck-*` không tồn tại như tên gọi lịch sử, hay là sót? Nếu là sót,
  thêm `.ck-` vào tập `forbid` sẽ đóng luôn.
