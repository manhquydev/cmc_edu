---
title: "Chuẩn hoá từ ngữ UI (frontend-only)"
description: "Siết luật subtitle trong frame spec, xoá định danh nội bộ khỏi chuỗi hiển thị, enforce bằng lint. Đã qua red-team R1+R2+R3 (hội tụ)."
status: pending
priority: P2
effort: "1 sprint ngắn"
tags: [ui, copy, design-system, lint]
created: 2026-08-05
blockedBy: []
blocks: []
---

# Chuẩn hoá từ ngữ UI (frontend-only)

## Overview

Giao diện giải thích lê thê và để lọt định danh nội bộ ra mặt tiền. Đợt này siết
luật điền subtitle, xoá định danh nội bộ ở frontend, và gắn lint chống tái phát.

**Giao kèo gốc:** `plans/reports/from-brainstorm-to-planner-copy-standard-260805-1107-ui-copy-condensation-report.md`

> ⚠️ Plan này đã qua **3 vòng red-team** (R1 phá tiền đề, R2 phá cơ chế, R3 hội tụ).
> Luận cứ nền tảng của bản đầu bị
> bác bỏ bằng bằng chứng. Xem §"Sai lầm đã sửa" — đừng dùng lại lý lẽ cũ.

## Sai lầm đã sửa sau red-team R1

### Sai 1 — "subtitle nằm ngoài ngữ pháp" là SAI

Bản đầu lập luận: *VIEW-GRAMMAR không cấp phát slot subtitle ⇒ 42 subtitle là trôi
dạt.* Đúng là VIEW-GRAMMAR không nhắc subtitle — nhưng **`PAGE-FRAMES.md` mới là
file cấp phát slot frame**, và nó cấp phép subtitle:

- `design-system/cmc-edu/PAGE-FRAMES.md:38` → `[ Title + subtitle ]` (DashboardPage)
- `design-system/cmc-edu/PAGE-FRAMES.md:55` → `PageHeader: title · subtitle · actions` (ListPage)
- `design-system/cmc-edu/pages/cockpit.md:5-7` → **"## Frame (locked)"** + "subtitle greeting VN roles"
- `design-system/cmc-edu/README.md:19` → `pages/<name>.md` xếp **trên** MASTER

⇒ Subtitle **được cấp phép**. Việc gỡ nó không phải dọn rác mà là **đổi design system**.

**Quyết định người dùng (2026-08-05):** giữ slot, **siết luật điền**. Subtitle hợp
lệ khi mang thông tin không suy ra được; lặp lại title thì vi phạm. cockpit giữ
nguyên hợp lệ.

### Sai 2 — phép đo an toàn bỏ sót 47 file unit test

Bản đầu chỉ đo `apps/e2e`. Nhưng `pnpm test` nằm **cùng required check**
`typecheck-and-test` (`.github/workflows/ci.yml:115-116`). Đã đo lại gồm cả
`apps/admin/src/**/*.test.tsx` + `packages/ui/src/**/*.test.tsx`.

### Sai 3 — số đếm sai

| Tuyên bố cũ | Sự thật đã đo lại |
|---|---|
| "0/41 subtitle bị e2e tham chiếu" | **1/35** bị ràng buộc (unit test, không phải e2e) |
| "42 subtitle = 35 literal + 7 dynamic" | 35 dòng literal → **34 nội dung duy nhất** (payroll trùng 1) + 7 dynamic |
| "22 SAFE / 3 RISK" | R1 sửa thành 17/5 → **R3 đồng bộ lại: 22 Phase 3 sở hữu / 4 coupled** |
| "27/33 chuỗi lỗi nguồn backend" | **55 chỗ** render `.message` (admin 46 + lms 9) |

### Sai 4 — "0 false positive" là tuyên bố quá tay

Probe chỉ chạy 2 chuỗi sạch. Chạy thật: regex bắt nhầm email placeholder ở
`parents/index.tsx:584`, `receipt-create.tsx:334`, `design-lab.tsx:813/:1898`,
`lms/login.tsx:91`, và `audit-log.tsx:108` (`"VD: facility.update"` — hướng dẫn
nhập liệu hợp lệ).

### Sai 5 — bật rule vào `eslint.config.js` ở Phase 1 gây deadlock (vá lại ở R2)

`pnpm lint` nằm trong `typecheck-and-test` (`ci.yml:107-108`), hiện **đang xanh**.

**Vá R1 (`warn`) KHÔNG hoạt động** — R2 bác bỏ: `.husky/pre-commit` chạy
`lint-staged` với `eslint --no-warn-ignored --max-warnings=0` (`package.json`),
nên **`warn` ≡ `error`** ở gate commit cục bộ. Phase 2 sẽ không commit nổi file
đầu tiên nào còn chứa vi phạm thuộc phase khác.

**Vá R2 (đang dùng):** **không đưa rule vào `eslint.config.js` cho tới Phase 5.**
Worklist sinh bằng **config audit riêng** (`eslint.copy-audit.config.js`) — file
này không được `pnpm lint` hay lint-staged dùng, nên không chặn gì. Phase 5 mới
gộp rule vào config chính, sau khi vi phạm đã dọn sạch.

### Sai 6 (R2) — inventory viết tay sai suốt 2 vòng

R1 và R2 đều tìm ra chỗ bỏ sót/phân loại sai trong bảng viết tay
(`my-hr.tsx:284,294`, `network-ip.tsx:353`, 5 dòng gắn nhãn `✅lint` sai,
`O1–O5` bị gán "coupled" trong khi **không test nào tham chiếu**).

**Sửa gốc:** inventory **do máy sinh**, không viết tay. Artifact:
`plans/reports/from-red-team-r2-to-planner-260805-1153-d2-worklist-machine-generated.md`
— 16 vị trí lint bắt được + 9 vị trí lint mù + 2 chuỗi coupled đổi nhãn nút.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Siết luật subtitle trong `PAGE-FRAMES.md` + mở rộng chuẩn copy ở `MASTER.md` | P1 |
| 2 | Config audit sinh worklist (Phase 1), rule vào config chính khi đã dọn xong (Phase 5) | P1 |
| 3 | 34 subtitle: xoá cái lặp title, giữ+rút gọn cái mang ràng buộc | P1 |
| 4 | 22 chuỗi D2 Phase 3 sở hữu (12 lint bắt + 9 lint mù + 1 chuyển từ P4) | P1 |
| 5 | 4 chuỗi D2 ràng buộc: dual-edit source + unit test + e2e (3 nếu áp default OQ1) | P2 |
| 6 | Sửa chuỗi lộ hạ tầng OTP ở `lms/login.tsx:83` | P1 |

## Non-goals

- **Permission code trong màn 403 — GIỮ NGUYÊN.** Quyết định người dùng 2026-08-05.
  Lý do: `permission-gate.tsx:19-21` có comment ghi rõ mục đích chẩn đoán; mã quyền
  vốn không bí mật (`data.path` trong mọi lỗi tRPC đã lộ tên procedure —
  `apps/api/src/trpc-error-formatter.test.ts:52`; `audit-log.tsx:108` hiển thị mã
  action như dữ liệu sản phẩm). Xoá không giảm bề mặt tấn công, chỉ mất khả năng
  chẩn đoán. ⇒ **Không đụng** `apps/admin/src/lib/permission-gate.tsx`, 8
  `requirementLabel` trong `apps/admin/src/routes/`, `classes/index.tsx:158`,
  `class-detail.tsx:492`, `shift-config.tsx:302`, `users.tsx:553`, và
  `deeplink-detail-gates.ui.spec.ts`.
- **Không đụng `apps/api`.** 55 chỗ render `.message` từ backend ⇒ backlog.
  Trong đó 9 chỗ ở LMS đổ raw message cho phụ huynh (Prisma error có thể lộ tên
  bảng — `apps/api/src/trpc.ts` formatter không mask message). **Backlog ưu tiên.**
- Không sửa D1/D3 ngoài subtitle.
- Không gom copy vào module tập trung (YAGNI — repo đơn ngữ).
- Không bật thêm ruleset ESLint.
- **`design-lab.tsx` ngoài phạm vi sửa** (11 subtitle) — là bảng trưng bày design
  nội bộ, không phải màn nghiệp vụ. Nhưng nó **nằm trong scope `pnpm lint`**
  (`eslint.config.js:35`) ⇒ Phase 1 phải thêm `ignores` hoặc chấp nhận finding.

## Bằng chứng ràng buộc (đo lại 2026-08-05, sau red-team)

| Sự kiện | Lệnh đo | Kết quả |
|---------|---------|---------|
| Subtitle literal | `grep -rn 'subtitle="' apps/admin/src/pages --include=*.tsx \| grep -v design-lab.tsx` | 35 dòng / 34 nội dung |
| Subtitle ràng buộc | đối chiếu từng nội dung với e2e **và** `*.test.tsx` | **1** — `"Danh sách lớp học tại cơ sở"` ← `class-access-guard.test.tsx:76` |
| D2 do máy sinh | chạy rule thật, config audit riêng | **16 lint bắt + 9 lint mù + 2 đổi nhãn nút** |
| D2 ràng buộc | đối chiếu từng chuỗi với e2e + unit test | **4 coupled** (không phải 5 — xem dưới) |
| CI hiện trạng | run gần nhất | `ui-e2e` + `CI` đều success (2026-08-05T03:52Z) |

**Inventory authoritative:** `plans/reports/from-red-team-r2-to-planner-260805-1153-d2-worklist-machine-generated.md`.
Bảng trong các phase file chỉ để **tham chiếu**; khi lệch, **artifact thắng**.

### 4 chuỗi D2 ràng buộc (Phase 4)

| Nguồn | Chuỗi | Unit test | E2E |
|-------|-------|-----------|-----|
| `hr/payroll.tsx:182` | `Tính lương (assemble)` | `payroll.test.tsx:201,208,214,224` | `payroll-assemble-finalize:98`, `kpi-submit-confirm-bulk-approve:174` |
| `hr/payroll.tsx:201` | `Mở lại (reopen)` | `payroll.test.tsx:263,269,276,284` | `payroll-assemble-finalize:107,109` |
| `finance/reconciliation.tsx:254` | "AI agent — chỉ đọc" | `reconciliation.test.tsx:98` | — |
| `admin/users.tsx:346` | `User ID (auth identity)` | — | `create-staff-via-admin-ui.ts:134`, `user-admin-roles:58` |

**`crm/opportunity-detail.tsx:551` (`O1–O5`) KHÔNG coupled** — R2 đã kiểm:
`grep -rn 'O1–O5\|Tiến độ giai đoạn'` chỉ ra 3 hit (source + 2 chỗ trong
`design-lab-wireframes.tsx`), **không test nào**. Giá trị enum
(`'O1_LEAD'…'O5_ENROLLED'`) là mảng riêng ở `:555-559`, tách rời chuỗi hiển thị
⇒ đổi nhãn an toàn. **Open question 2 đóng bằng bằng chứng này**; chuỗi chuyển
sang Phase 3.

### 🔒 Ràng buộc token ↔ quyết định (chống tái lập bẫy R1 #5)

Token `auth identity` chỉ có **một** chỗ khớp: `users.tsx:346` — đang chờ Open
question 1. **Luật cứng:** nếu OQ1 = "giữ nhãn form" ⇒ **cùng lúc gỡ token
`auth identity` khỏi pattern**, ghi lý do vào `MASTER.md` §"Giới hạn lint".
Không được để nhánh này treo tới Phase 5.

⚠️ `payroll-assemble-finalize.journey.ui.spec.ts:128-129` chạy
`assertBusinessInvariant`, và `scripts/business-verify/verify.ts` liệt `'lương'`,
`'payroll'` trong `MONEY_STATE_KEYWORDS` ⇒ **gate `business:verify --strict`
trong `ui-e2e.yml` cũng phủ spec này.**

## Gate thật của repo (đầy đủ — bản đầu thiếu)

| Gate | Nơi chạy | Ghi chú |
|------|----------|---------|
| `pnpm lint` | `ci.yml:107-108`, job `typecheck-and-test` | **required**, đang xanh |
| `pnpm check:ui-frames && pnpm test:ui-frames` | `ci.yml:113`, cùng job | **required — R2 phát hiện bỏ sót** |
| `pnpm typecheck` | `ci.yml`, cùng job | required |
| `pnpm test` | `ci.yml:115-116`, cùng job | required — **47 file test admin** |
| `ui-e2e` | `.github/workflows/ui-e2e.yml`, `on: push` không lọc branch | required — chạy trên **mọi** branch |
| `business:verify --strict` | step trong `ui-e2e.yml` | R1 phát hiện bỏ sót |
| lint-staged | `.husky/pre-commit`, `--max-warnings=0` | **chặn commit cục bộ — `warn` cũng chặn** |
| gitleaks | `.husky/pre-commit` (nếu có trên PATH) | quét secret staged |

`apps/lms` **không có script `test`** — đừng đưa "test đơn vị lms" vào tiêu chí.

⚠️ `eslint.config.js` đăng ký `plugins: { '@typescript-eslint': tseslint.plugin }`
để các directive `eslint-disable` sẵn có trong source resolve được. Config audit
riêng **phải đăng ký plugin tương tự**, nếu không sẽ nổ hàng loạt lỗi
"Definition for rule not found" (đã gặp khi sinh worklist).

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [Chuẩn copy + config audit sinh worklist (TDD)](./phase-01-start.md) | Pending | — |
| 2 | [Subtitle theo luật siết](./phase-02-purge-subtitle-drift.md) | Pending | 1 |
| 3 | [D2 an toàn + OTP banner](./phase-03-d2-safe-remediation.md) | Pending | 1 |
| 4 | [D2 ràng buộc — dual-edit](./phase-04-d2-e2e-coupled-dual-edit.md) | Pending | 1 |
| 5 | [Verify + nâng lint error + docs](./phase-05-verify-and-docs-sync.md) | Pending | 2,3,4 |

**Chống trùng Phase 2/3 (lỗi bản đầu):** worklist khoá bằng **nội dung chuỗi**,
không bằng số dòng — số dòng trôi sau mỗi lần xoá. Mỗi chuỗi có **đúng một phase
sở hữu**. Phase 3 vào việc theo điều kiện "chuỗi còn tồn tại", không phải "dòng
còn tồn tại". Chạy tuần tự 2 → 3 → 4.

## Git hygiene (bắt buộc, không có lựa chọn stash)

Working tree đang có fix bảo mật chưa commit: `apps/lms/src/pages/login.tsx`
(gỡ lộ mật khẩu mặc định).

**Bắt buộc:** commit → PR → merge → **rồi mới** cắt `feat/ui-copy-standard`.
**Cấm `git stash`** — Phase 3 sửa đúng file đó (`login.tsx:83`), stash pop sẽ
xung đột, và `apps/lms` không có test nào bắt được việc mất dòng sửa bảo mật.

### 🔴 R2: fix đó KHÔNG phải biện pháp khắc phục — vấn đề nằm ngoài plan này

Đã verify:
- `gh repo view` → **visibility PUBLIC**, default branch **`main`**
- `git show origin/main:apps/lms/src/pages/login.tsx` → **dòng 209 vẫn còn nguyên**
  chuỗi lộ mật khẩu mặc định
- `git log -S'Cmc2026@' --all` → giá trị nằm trong **lịch sử git công khai** (c444200)
- `gh api .../branches/develop/protection` → `develop` **không** có branch protection

⇒ Giá trị mật khẩu mặc định dùng chung cho mọi tài khoản học sinh mới **đã công
khai** và **không thể thu hồi bằng cách sửa UI**. Xoá chuỗi khỏi giao diện chỉ
giảm mức độ dễ thấy, không khắc phục.

**Việc thật sự cần (ngoài phạm vi plan này, cần quyết định riêng):** đổi cơ chế
mật khẩu mặc định phía backend (`apps/api/src/student/router.ts:94`,
`provisioning/provision-from-receipt.ts:306`) — vd sinh ngẫu nhiên per-student,
hoặc buộc đặt mật khẩu lúc kích hoạt. Đồng thời đưa fix UI lên `main`, không dừng
ở `develop`.

## Success Criteria

- [ ] `PAGE-FRAMES.md` có luật siết cho slot subtitle (giữ slot, thêm ràng buộc)
- [ ] `MASTER.md` §Copy mở rộng thành chuẩn kiểm được + nêu rõ giới hạn lint
- [ ] Lint rule ở `warn` từ Phase 1, `error` từ Phase 5, **không FP trên email placeholder**
- [ ] 34 subtitle có quyết định giữ/xoá kèm lý do
- [ ] 22 chuỗi Phase 3: 12 nhóm A (lint xác nhận) + 9 nhóm B (grep tay) + 1 nhóm C
- [ ] 4 chuỗi D2 coupled (hoặc 3 nếu áp default OQ1): source + unit test + e2e **cùng commit**
- [ ] `lms/login.tsx:83` không còn lộ tên transport/nhà cung cấp
- [ ] `pnpm lint` + `pnpm typecheck` + `pnpm test` xanh **trên CI**
- [ ] `ui-e2e` (gồm `business:verify --strict`) xanh **trên CI**
- [ ] Hoàn thành đo bằng **checklist inventory theo chuỗi**, không bằng exit code lint
- [ ] `docs/12` §8 có con trỏ tới SoT (không viết lại nội dung)

## Risk Assessment

| Risk | Mức | Mitigation |
|------|-----|-----------|
| Lint `error` sớm làm đỏ required check | Cao | `warn` ở Phase 1, `error` ở Phase 5 |
| FP email placeholder chặn commit | Cao | Loại `placeholder` khỏi selector hoặc negative lookahead cho `@`; allowlist `audit-log.tsx:108` |
| Sửa chuỗi làm đỏ `pnpm test` | Cao | Mọi phase đo ràng buộc trên **e2e + unit test**; file test nằm trong Related Code Files |
| Dùng lint làm thước đo hoàn thành (vòng tròn) | Cao | Tách: lint = guard tái phát; checklist chuỗi = thước đo hoàn thành |
| Trùng việc Phase 2/3 | Trung bình | Worklist khoá bằng nội dung, mỗi chuỗi một phase sở hữu |
| Số dòng trôi sau khi xoá | Trung bình | Không tham chiếu theo dòng khi thực thi |
| Mất fix bảo mật khi tách branch | Trung bình | Cấm stash; merge trước khi cắt branch |
| `ui-e2e` chỉ chạy `on: push` | Trung bình | Chấp nhận push-để-verify trên branch; không hứa "chạy trước khi push" |
| Sửa chuẩn mâu thuẫn `pages/cockpit.md` (locked) | Trung bình | Phase 1 đọc `PAGE-FRAMES.md` + `pages/*.md` trước khi ghi |

## Open questions

1. **`admin/users.tsx:346` `label="User ID (auth identity)"`** — nhãn form, lộ
   "auth identity". Giao kèo có non-goal "không đụng nhãn form" nhưng lý do đó
   (nhãn form vốn đúng chuẩn) không đúng ở đây. Sửa (dual-edit 2 file e2e) hay giữ?
   *Chưa quyết — Phase 4 chặn ở chuỗi này cho tới khi có trả lời.*
2. `crm/opportunity-detail.tsx:551` `O1–O5`: nhãn hiển thị hay giá trị enum từ
   backend? Phase 4 phải trace trước khi đổi.
3. 7 subtitle dynamic (`subtitle={…}`) **không đo được bằng grep chuỗi** — phải
   xác định ràng buộc bằng cách đọc code/render, không phải grep.
4. LMS: 9 chỗ đổ raw `error.message` cho phụ huynh — đưa vào đợt sau hay để lâu hơn?

## Red Team Review

### Vòng R1 — 2026-08-05
**Reviewer:** Security Adversary · Assumption Destroyer · Failure Mode Analyst
**Findings:** 27 thô → 15 sau dedupe (14 accepted, 1 rejected)
**Severity:** 5 Critical, 7 High, 3 Medium

| # | Finding | Sev | Disposition | Applied To |
|---|---------|-----|-------------|------------|
| 1 | `PAGE-FRAMES.md:38/:55` + `pages/cockpit.md:7` **có** cấp phép subtitle — luận cứ nền tảng sai | Critical | Accept | plan §Sai 1, Phase 1, Phase 2 |
| 2 | Phép đo an toàn bỏ sót 47 file unit test trong cùng required check | Critical | Accept | plan §Sai 2, Phase 2/3/4 |
| 3 | Rule `error` ở Phase 1 làm đỏ `pnpm lint` (đang xanh) trong required check | Critical | Accept | Phase 1 (@warn), Phase 5 (nâng error) |
| 4 | "0 false positive" sai — regex bắt 6 email placeholder | Critical | Accept | Phase 1 (bỏ `placeholder`, test 6 FP) |
| 5 | `ConsoleEmailTransport` vừa trong regex vừa trong non-goal ⇒ criterion bất khả thi | Critical | Accept | Phase 3 (đưa OTP vào phạm vi) |
| 6 | Success criterion đo bằng chính lint (vòng tròn) — lint mù JSXText/template | High | Accept | Phase 3/5 (tách checklist chuỗi) |
| 7 | `audit-log.tsx:90`, `facilities.tsx:100` nằm ở **cả** Phase 2 lẫn Phase 3 | High | Accept | Phase 2 (một chuỗi một phase sở hữu) |
| 8 | Inventory bỏ sót `permission-gate.tsx:41` + 8 `requirementLabel` ở `routes/` | High | Accept | → chuyển thành non-goal (quyết định người dùng) |
| 9 | Threat model: mã quyền không bí mật, code có comment ghi lý do giữ | High | Accept | plan §Non-goals |
| 10 | Số `.message` sai: 55 chỗ, không phải 33/27; 9 chỗ LMS lộ Prisma error | High | Accept | plan §Sai 3, §Non-goals, Phase 5 backlog |
| 11 | `ui-e2e` là `on: push` ⇒ "chạy trước khi push" bất khả thi | High | Accept | Phase 4 §Non-functional |
| 12 | Bỏ sót gate `business:verify --strict` phủ đúng spec payroll | High | Accept | plan §Gate thật, Phase 4/5 |
| 13 | Git hygiene cho phép `stash` → nuốt fix bảo mật (LMS không có test) | Medium | Accept | plan §Git hygiene (cấm stash) |
| 14 | `design-lab.tsx` ngoài inventory nhưng trong scope lint | Medium | Accept | plan §Non-goals, Phase 1 (`ignores`) |
| 15 | Còn sót `eslint.probe.mjs` ở repo root | Medium | **Reject** | `git status` sạch — file do chính reviewer tạo, không phải của plan |

### Whole-Plan Consistency Sweep — R1

Decision delta đã áp:
- Luận cứ subtitle: "ngoài ngữ pháp" → "vi phạm luật siết mới" (plan, Phase 1, Phase 2)
- Permission code: trong phạm vi → **non-goal** (plan, Phase 3 kiểm bằng `git diff`)
- OTP banner: non-goal → **trong phạm vi** (plan Goal 6, Phase 3)
- Lint: `error` ngay → `warn` (Phase 1) rồi `error` (Phase 5)
- Thước đo: exit code lint → checklist chuỗi (Phase 3, Phase 5)
- Mọi số liệu đo lại: 34 subtitle / 1 coupled / 17 safe / 5 coupled / 55 `.message`
  *(số 17 và 5 sau đó bị R3 đồng bộ lại thành 22 và 4 — dòng này giữ nguyên làm
  lịch sử R1, không phải số hiện hành)*
- Related Code Files của Phase 2/3/4 đã thêm file `*.test.tsx`

Đã kiểm chéo: `docs/12` vẫn chỉ nhận con trỏ (không viết lại); `pages/cockpit.md`
"locked" vẫn hợp lệ dưới luật mới; không còn chuỗi nào thuộc 2 phase.

**Mâu thuẫn tồn đọng:** không. **Open question chặn thực thi:** 2 (chuỗi 5 Phase 4,
`O1–O5`).

### Vòng R2 — 2026-08-05 (kiểm chính bản vá R1)
**Reviewer:** Assumption Destroyer/Scope Auditor · Failure Mode Analyst/Flow Tracer
**Findings:** 19 thô → 12 sau dedupe (12 accepted, 0 rejected)
**Severity:** 4 Critical, 5 High, 3 Medium

Bản vá R1 **tự sinh lỗ mới** — đúng như kinh nghiệm dự án.

| # | Finding | Sev | Disposition | Applied To |
|---|---------|-----|-------------|------------|
| 16 | Vá R1 "`warn`" **không hoạt động** — lint-staged `--max-warnings=0` khiến warn cũng chặn commit | Critical | Accept | plan §Sai 5, Phase 1 (config audit riêng), Phase 5 (rule land ở đây) |
| 17 | `auth identity` tái lập nguyên bẫy R1 #5 (token trong pattern + chuỗi trong OQ treo) | Critical | Accept | plan §Ràng buộc token↔quyết định, Phase 1, Phase 4 bước 1 |
| 18 | `my-hr.tsx:284,294` `super_admin` lint bắt nhưng **không có trong inventory nào** | Critical | Accept | Phase 3 nhóm A |
| 19 | `reconciliation.tsx:254` bị Phase 2 gán cho Phase 3, thực tế là chuỗi coupled Phase 4 | Critical | Accept | Phase 2 bảng giao |
| 20 | 5 dòng gắn nhãn `✅lint` sai — pattern thiếu token `Entity`, `API…chưa khả dụng` | High | Accept | Phase 1 (thêm 2 token), Phase 3 phân nhóm lại |
| 21 | `O1–O5` **không hề coupled** (0 test tham chiếu); OQ2 tự chặn vô cớ | High | Accept | plan (4 coupled), Phase 3 nhóm C, Phase 4 (gỡ chuỗi) |
| 22 | `ignores` cùng object flat-config sẽ **tắt luôn `no-restricted-imports`** cho design-lab | High | Accept | Phase 5 (object thứ hai + kiểm trực tiếp) |
| 23 | Phase 4 mâu thuẫn hạt commit: "tất cả cùng commit" vs "mỗi chuỗi 1 commit" | High | Accept | Phase 4 bước 5 |
| 24 | Phase 4 chặn bởi OQ ⇒ Phase 5 không chạy được ⇒ plan deadlock với rule đã commit | High | Accept | Phase 4 §Thoát hiểm (default có thời hạn) |
| 25 | `payroll.tsx:519` + 3 chuỗi bảng-giao **không có quyết định** giữ/xoá | Medium | Accept | Phase 2 bảng quyết định đầy đủ |
| 26 | `network-ip.tsx:353` `CRUD` object literal — ngoài inventory, lint mù | Medium | Accept | Phase 3 nhóm B |
| 27 | Bảng "Gate thật (đầy đủ)" vẫn thiếu `check:ui-frames && test:ui-frames` (`ci.yml:113`) | Medium | Accept | plan §Gate thật, Phase 3/4/5 validation |
| 28 | Fixture "6 chuỗi FP" là **phantom test** — cả 6 là `placeholder` đã bị loại khỏi selector | Medium | Accept | Phase 1 bước 4 (ca âm dùng attribute trong selector) |

### 🔴 Ngoài phạm vi plan — phát hiện bởi R2, cần quyết định riêng

Repo **PUBLIC**, default branch `main`, `main` **vẫn chứa** dòng lộ mật khẩu mặc
định, và giá trị nằm trong **lịch sử git công khai** (`c444200`). Fix UI trên
`develop` **không** khắc phục được. Xem `plan.md` §Git hygiene.

### Whole-Plan Consistency Sweep — R2

Decision delta đã áp:
- Lint: `warn` trong config chính → **config audit riêng**, rule land ở Phase 5
- Inventory: bảng viết tay → **artifact do máy sinh** (16 lint bắt + 9 lint mù + 2 nhãn nút)
- `O1–O5`: coupled → **không coupled**, chuyển Phase 3, OQ2 đóng
- Coupled: 5 → **4**
- Phase 4: thêm §Thoát hiểm + hạt commit theo chuỗi
- Phase 5: thêm cách thêm rule (object thứ hai) + kiểm rule "một cửa" còn sống
- Gate: thêm `check:ui-frames && test:ui-frames`

Đã kiểm chéo: không còn chuỗi nào thuộc 2 phase; mọi chuỗi trong artifact đều có
phase sở hữu; token `auth identity` đã nối với OQ1 bằng luật cứng.

**Mâu thuẫn tồn đọng:** không.
**Open question chặn thực thi:** 1 (OQ1 — đã có default thoát hiểm nên **không
chặn cứng** nữa).

### Vòng R3 — 2026-08-05 (kiểm bản vá R2 · vòng hội tụ)
**Reviewer:** Assumption Destroyer + Failure Mode Analyst (kết hợp)
**Findings:** 8 (8 accepted, 0 rejected) · **1 Critical, 3 High, 4 Medium**

R3 xác nhận **lõi đã hội tụ** — kiểm chứng độc lập và PASS:
- Artifact nhóm A tái lập **16/16** khi chạy rule thật
- 34 nội dung subtitle: Phase 2 phủ **đủ 34**
- Ownership chuỗi: cross-check 27 vị trí → **không chuỗi nào thuộc 2 phase**
- Config audit **không rò rỉ** vào `pnpm lint` / lint-staged / CI
- Flat config merge rules ⇒ `no-restricted-imports` object 1 vẫn áp
- 22 chuỗi Phase 3: grep vào test + e2e → **0 ràng buộc thật**

| # | Finding | Sev | Disposition | Applied To |
|---|---------|-----|-------------|------------|
| 29 | Object 2 kéo `main.tsx` (object 1 đang `ignores`) vào scope không parser → parse error | Critical | Accept | Phase 5 (snippet đủ `ignores`+`languageOptions`+`linterOptions`) |
| 30 | "5 coupled" chưa đồng bộ sau khi R2 hạ xuống 4 | High | Accept | plan Goals/Success, Phase 4 (đánh số lại) |
| 31 | "17 safe" chưa đồng bộ sau khi R2 thay inventory → thật là **22** | High | Accept | plan Goals/Success, Phase 3 Overview/Requirements |
| 32 | `classes/index.tsx:302` thiếu quyết định — mà nó là **neo duy nhất** phân biệt nhánh 403 | High | Accept | Phase 2 (quyết định **GIỮ** + cấm `getAllByText`) |
| 33 | Luật "artifact thắng" mâu thuẫn nhóm C (`O1–O5` ngoài pattern, không có trong artifact) | Medium | Accept | Artifact **mục D** + đính chính luật ưu tiên |
| 34 | Config audit thiếu `linterOptions` → 30 problem thay vì 16 | Medium | Accept | Phase 1 snippet + artifact §Lệnh tái lập |
| 35 | `git diff <path>` rỗng sau commit ⇒ tiêu chí non-goal vô hiệu | Medium | Accept | Phase 1/3 → `git diff origin/main...HEAD` |
| 36 | "Giới hạn lint" chỉ ghi dạng AST, bỏ giới hạn **token đóng** | Medium | Accept | Phase 1 (ghi đủ 2 giới hạn) |

### Whole-Plan Consistency Sweep — R3

Decision delta đã áp: đồng bộ 5→4 coupled và 17→22 safe ở **mọi** chỗ phát biểu;
`classes/index.tsx:302` = **GIỮ** (kèm lý do neo 403 + neo thay thế nếu vẫn xoá);
artifact có **mục D** cho item ngoài pattern; Phase 5 snippet object 2 đủ 3 thành
phần; Phase 1 nêu đủ 2 giới hạn lint; lệnh `git diff` đổi sang so điểm cắt nhánh;
gỡ mọi tham chiếu stale tới chiến lược `warn`.

**Mâu thuẫn tồn đọng:** không.
**Open question chặn thực thi:** 0 (OQ1 có default thoát hiểm; OQ2 đã đóng bằng bằng chứng).

**Kết luận loop:** R1 phá *tiền đề* → R2 phá *cơ chế* → R3 chỉ còn *sổ sách + 1
chi tiết config*. Biên độ giảm dần rõ rệt ⇒ **hội tụ, dừng loop.**

<!-- slug: chuan-hoa-tu-ngu-ui-frontend -->
