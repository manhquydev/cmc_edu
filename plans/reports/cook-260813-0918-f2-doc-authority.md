# F2 — bịt lỗ cổng doc-authority + dọn kit dạy class nghỉ hưu

**Branch:** `fix/doc-authority-coverage` (base `develop` `bc986bd`)  
**Worktree:** `/home/manhquy/.herdr/worktrees/cmc_edu/fix-doc-authority-coverage`  
**Skills:** `/ak-engineer:ak-cook` + `/ak-engineer:ak-docs`  
**Commits:** `37810d2` `fix(docs): cover styling-bridge and view-grammar in doc-authority` · `c3fa904` `fix(docs): correct ConfirmDialog mapping and pin authority file count`

## Contract

- Outcome: hai file kit sống hết chỉ dẫn tạo chrome đã khai tử; cổng `check:doc-authority` quét chúng bằng cùng FORBID set; HEAD xanh; inject `.sh-cta--x` đỏ.
- Non-goals: không đổi UI/runtime; không thêm per-file subset; không thêm `docs/design-system-console.md` nếu còn FORBID.
- Authority ngôn ngữ thay thế: `docs/design-system-console.md` + `plans/reports/phase-spec-260813-0120-doc-authority.md` (file spec nằm ở bản Downloads, không có trên worktree này).

## (A) Dọn nội dung

### `design-system/cmc-edu/STYLING-BRIDGE.md`

Xóa chỉ dẫn sống “**add** `.sh-cta--secondary` / `.sh-cta--ghost`” và cả block CSS `.sh-cta--*` / `.sh-item`. Thay bằng map shadcn → Astryx `Button` từ `@cmc/ui`:

| shadcn | CMC |
|--------|-----|
| default | `Button variant="primary"` |
| secondary / outline | `Button variant="secondary"` |
| ghost | `Button variant="ghost"` (Đăng xuất / systray) |
| destructive | ConfirmDialog `actionVariant="destructive"` hoặc `Button variant="destructive"` |

Token/authority: `packages/ui/src/console.css` dưới `.o_web_client`, accent `--cmc-brand` / `#0071E3`, trỏ `docs/design-system-console.md`.

Cũng sửa hàng responsive `<768`: “SideNav collapse” → “ConsoleNavbar sections collapse/overflow” (chỉ dẫn sống sai, dù `SideNav` không nằm trong FORBID).

### `design-system/cmc-edu/VIEW-GRAMMAR.md`

Sơ đồ §1 (cũ `:22`) không còn kê `AppFrame + SideNav` như chrome LMS sống:

```
Admin (design3):  ConsoleNavbar + main.console-main
LMS (TL12):       lms-* chrome (`apps/lms/src/app.css`)
```

Ghi chú lịch sử header (cũ `:14`) **giữ nghĩa** “removed, do not reintroduce”, nhưng **không giữ literal `AppFrame`**. Lý do: FORBID dùng substring `AppFrame`; thêm file vào allowlist mà giữ token → cổng đỏ ngay trên HEAD sạch. Câu hiện tại: previous admin/LMS shell frame + `SideNav` were removed — do not reintroduce; LMS = `lms-*` trong `apps/lms/src/app.css`.

`rg` sau dọn: 0 hit `AppFrame`, `.premium-`, `--sh-`, `.sh-`, `.ck-surface`, `tpl-wrap`, `premium.css` trên cả hai file.

## (B) Allowlist

`scripts/check-doc-authority.mjs` — thêm, **cùng `FORBID`** (không subset):

- `design-system/cmc-edu/STYLING-BRIDGE.md`
- `design-system/cmc-edu/VIEW-GRAMMAR.md`

Cổng giờ quét **10** file.

`scripts/check-doc-authority.test.mjs` — cập nhật `ALLOWLIST` cùng hai path. Bắt buộc: fixture `--root tmp` copy thiếu file → script báo `<file missing>` và test đỏ giả.

## (C) Không thêm `docs/design-system-console.md`

Đã quét trước. File authority sống này **không sạch FORBID**:

| Dòng | Needle |
|------|--------|
| 8, 18 | `premium.css` (lịch sử “deleted dead premium.css”) |
| 65 | `AppFrame` (câu “were removed”) |

Thêm vào allowlist mà không viết lại các câu lịch sử đó sẽ làm cổng đỏ. Không thêm.

## Bằng chứng cổng

### Xanh khi sạch

```
$ pnpm check:doc-authority
ok  docs/README.md
ok  docs/12-design-system-ui.md
ok  docs/18-tech-stack-va-chuan-ky-thuat.md
ok  design-system/cmc-edu/STRUCTURE.md
ok  design-system/cmc-edu/PAGE-FRAMES.md
ok  design-system/cmc-edu/MASTER.md
ok  design-system/cmc-edu/STYLING-BRIDGE.md
ok  design-system/cmc-edu/VIEW-GRAMMAR.md
ok  packages/ui/llms.txt
ok  packages/ui/src/index.ts

10 files clean.
```

`pnpm test:doc-authority` — 3/3 pass (inject fixture AppFrame vào TL12, requireLine README, HEAD sạch).  
`pnpm typecheck` — 34/34 successful.

### Đỏ khi chèn (rồi hoàn tác)

Tạm append `.sh-cta--x` vào cuối `STYLING-BRIDGE.md`:

```
FAIL design-system/cmc-edu/STYLING-BRIDGE.md
     design-system/cmc-edu/STYLING-BRIDGE.md:185  .sh-
1/10 files failed.
INJECT_EXIT=1
```

Hoàn tác xong: `10 files clean.` Inject marker không còn trong working tree.

## GitNexus

- `impact(checkFile)`: symbol không có trong index (script Node không được index như function product).
- `detect_changes({scope:"all"})`: 4 files, 6 markdown sections, **0 processes**, **risk LOW**.

## Review / test subagents

- tester: DONE_WITH_CONCERNS — wiring đúng; residual `checkCount >= 8` không khóa 10 file.
- code-reviewer: DONE_WITH_CONCERNS — AC (a)–(f) PASS. Medium: hàng destructive dạy `ConfirmDialog actionVariant` (prop không tồn tại; public API là `confirmColor`). Medium: test không pin RULES=10.

Follow-up trên HEAD: sửa hàng destructive → `ConfirmDialog` (default confirm is destructive) hoặc `Button variant="destructive"`; `<768` → overflow-x (khớp `console.css`); `assert.equal(report.checkCount, 10)`. `check:doc-authority` + `test:doc-authority` vẫn xanh.

## `git diff --stat`

```
 design-system/cmc-edu/STYLING-BRIDGE.md | 45 +++++++++++----------------------
 design-system/cmc-edu/VIEW-GRAMMAR.md   |  4 +--
 scripts/check-doc-authority.mjs         |  2 ++
 scripts/check-doc-authority.test.mjs    |  2 ++
 4 files changed, 21 insertions(+), 32 deletions(-)
```

Không push.
