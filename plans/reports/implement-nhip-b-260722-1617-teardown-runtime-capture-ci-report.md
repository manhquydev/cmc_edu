# Nhịp B — teardown, runtime capture, lưới an toàn CI (Phase 4–6)

Plan: `plans/260722-1114-go-permission-va-do-runtime/plan.md`
Ngày: 2026-07-22 · Branch `main` · Commit: `e3c9809` (P4), `adf31d8` (P6), `c4a7d4d` (P5)

## Phase 4 — teardown e2e

**S1 (Critical) đã đóng, có falsification.** `getPrivilegedDb()` — connection chạy **mọi** lệnh xoá — đọc thẳng `DATABASE_URL` mà **không guard**; `global-setup` chỉ canh `APP_DATABASE_URL`. Guard giờ nằm **bên trong** `getPrivilegedDb()`.

Chứng minh: trỏ `DATABASE_URL` sang `.../cmc_prod` rồi gọi `cleanupFacility` →
```
guard fired: Refusing to operate against database "cmc_prod"
```
Ném **trước** khi bất kỳ `deleteMany` nào chạy.

**5 bảng thiếu trong `cleanupFacility`** — xác định bằng cách quét `schema.prisma` hiện tại (41 model có `facilityId`) rồi diff với hàm teardown, **không chép từ branch** (branch `test/independent-runtime-verification-38-flows` **không tồn tại** trên máy này lẫn origin — một giả định nữa của plan đã cũ):
`RefundRecord`, `QualitativeAssessment`, `SessionEvidence`, `SessionEvidencePhoto`, `ReconciliationFlag` — đúng 5 cái plan nêu.

**Residue guard** đặt **sau** `facility.deleteMany` theo đúng yêu cầu plan. Falsification 2 chiều:
- A: seed `ReconciliationFlag` → teardown xoá sạch, không ném.
- B: chặn DELETE bằng rule `DO INSTEAD NOTHING` (giả lập quên một `deleteMany`) → guard ném `ReconciliationFlag=1`, **và facility vẫn bị xoá** (0 row còn lại) ⇒ guard không biến rò mềm thành rò vĩnh viễn.

**Phát hiện ngoài kế hoạch:** teardown phía **API** cũng rò — `apps/api/src/audit/router.test.ts` tạo 4 facility và **không có teardown nào**. Mỗi lần chạy suite rò 4 row. Đã thêm `afterEach`; đo lại: facility count **không đổi** sau khi chạy (trước: +4).

**Dọn rác:** 15 facility rò (12 `Audit List *` + 3 probe) đã xoá khỏi DB test. Sau dọn còn đúng 2 facility seed.

**E2E thật:** `pnpm --filter @cmc/e2e test` → **20 passed, 1 skipped**, facility count **2 → 2**.

## Phase 6 — lưới an toàn CI

| Việc | Trạng thái |
|---|---|
| `scripts/` vào workspace + typecheck | ✅ `pnpm typecheck` **26 → 27 task** |
| Nợ type tồn đọng | **1 lỗi duy nhất**, và là lỗi thật: `seed-super-admin.ts` dùng `@prisma/client` mà không khai dependency → khai đúng, **không** `@ts-nocheck` |
| `verify.ts` exit code | ✅ exit 1 khi có orphan chưa phân loại / unresolved namespace, **sau** khi đã ghi report ra file |
| CI thêm `lint` + `acceptance:report` | ✅ |

Dùng `scripts` **không có glob** trong `pnpm-workspace.yaml` đúng như plan cảnh báo — `scripts/*` sẽ match thư mục con và bỏ sót `scripts/package.json`, khiến gate im lặng không chạy.

**Falsification 1** (typecheck thật sự phủ `scripts/`): thêm `const __probe: number = 'not a number'` → `Tasks: 26 successful, 27 total` (đỏ); revert → 27/27.
**Falsification 2** (exit code thật sự chặn): gỡ `user.pickList` khỏi manifest → `exit=1`, in `ORPHAN CHƯA PHÂN LOẠI: user.pickList`; revert → `exit=0`.

**Quyết định cần PO xác nhận:** `acceptance:report` trong CI để **`continue-on-error: true`** (cảnh báo, chưa chặn merge) — theo mặc định plan tự nêu: chặn khi chưa biết tần suất báo động giả là cách nhanh nhất để team tắt gate. Nâng lên chặn là một dòng.

`lint` phủ `scripts/` nhưng **giá trị thấp và cần nói thẳng**: `eslint.config.js` cố ý chỉ có **1 rule** (cấm import UI sai cửa) và scope vào `apps/**`. Với `scripts/` nó gần như chỉ chứng minh file parse được.

## Phase 5 — runtime capture

**Đảo chiều nguồn sự thật.** Thay vì hỏi "luồng này cần procedure gì", mở màn thật bằng vai thật và ghi lại cái nó gọi.

| Số đo | Giá trị |
|---|---|
| Route quét được (`scanUiRoutes()`) | **57** — đúng con số plan đo |
| Admin / LMS | 43 / 14 (LMS **loại khỏi ma trận admin**, đúng cảnh báo R3-2) |
| Route `:param` | **4** (admin) — sinh từ scanner, không viết tay |
| Tổ hợp (màn, vai) | **118**; chạy **102** (16 tổ hợp `:param` báo skip, không im lặng bỏ) |
| Lời gọi thu được | 194 |

`/finance/new` **có trong ma trận** với cả 4 vai — màn không có nav entry, nên nếu lấy nguồn từ nav-registry thì không bao giờ mở tới (đúng lý do D-RT).

### Phép thử chua — ĐẠT

Plan yêu cầu chứng minh capture **tự** tìm ra F1/F2 mà không được mớm.

**Sai lệch có chủ đích so với plan:** plan mô tả dựng **git worktree tại `4237cb5`**. Tôi làm cách khác: **gỡ `class.read` + `classRoster.read` khỏi registry, rebuild `dist`, chạy lại capture**. Lý do: worktree cần `pnpm install` + `pnpm build` + **DB riêng** (rủi ro chính plan tự nêu ở bảng risk), trong khi thứ đang được kiểm là "capture có phát hiện thiếu quyền không" — gỡ đúng biến đó tái lập **chính xác** trạng thái phân quyền trước Phase 1 mà không đổi biến nào khác. Capture không hề biết gì về registry; nó chỉ mở màn và ghi 403.

Kết quả: **11 → 27 denial**. 16 cái mới, gồm đúng 2 tiêu chí sống-còn:

```
DENIED /finance/new [sale]: classBatch.list                      ← F1
DENIED /teaching/session-assessment [giao_vien]: classBatch.list ← F2
DENIED /teaching/schedule [4 vai]: classBatch.list
DENIED /teaching/session-evidence [giao_vien]: classBatch.list
DENIED /finance/class-placement [4 vai]: classBatch.list
DENIED /admin/classes [giam_doc_dao_tao]: classBatch.list
```

Khôi phục registry + rebuild → xác nhận `class.read` trở lại đủ 4 vai.

### ⚠️ ĐÍNH CHÍNH (2026-07-22, audit sau khi đọc source) — 6/11 denial là **ARTIFACT của capture**, không phải lỗi sản phẩm

Bảng 11 denial bên dưới **đã bị thổi phồng**. Đọc source từng procedure:

- `manualPunch.list` (`checkin/router.ts:398`) và `kpi.myScore` (`kpi/router.ts:461`) đều là **`protectedProcedure`, KHÔNG có permission key**. Cả hai ném `forbidden('Staff profile not found in this facility.')` khi caller **không có AppUser**.
- Capture mint session `userId: capture-<role>` — **danh tính tổng hợp, không khớp AppUser nào** ⇒ 6 denial (`/hr/checkin` ×4, `/hr/my` ×2) là **do capture, không phải do phân quyền**.

Đây **đúng** "Giới hạn thứ hai" plan đã cảnh báo và tôi đã ghi là chưa xử lý — nó lập tức sinh 6 finding giả ngay lần chạy đầu. Bài học: giới hạn đã biết mà không vá thì nó **sẽ** xuất hiện trong kết quả, và người đọc báo cáo không có cách nào tự phân biệt.

**Đã sửa** (`2b0dd46`): capture seed AppUser thật cho từng vai trước khi quét.

**Denial thật còn lại: 5** — và cả 5 đều là **màn không có nav entry, thiếu page-level guard**, KHÔNG phải "luồng gãy cho chính chủ":

| Màn | Vai bị từ chối | Gate thật | Phán quyết |
|---|---|---|---|
| `/admin/courses` | GĐKD, GV, sale | `course.list` → `course.manage` (GĐĐT) | Phân quyền **đúng**; thiếu guard trang (cùng loại `/admin/classes` đã vá ở Phase 2) |
| `/admin/engagement/gifts` | giao_vien | `gift.list` (GĐKD/GĐĐT/sale) | như trên |
| `/admin/engagement/rewards` | giao_vien | `rewards.manage` (GĐKD/GĐĐT/sale) | như trên |

⇒ **Không nới quyền.** Việc cần làm là thêm page guard, đúng mẫu Phase 2 — để plan kế tiếp.

**Đã xác nhận bằng runtime** (chạy lại với danh tính thật, 2026-07-22 19:21):

```
screen-role-capture — 102 pairs, 194 calls, 5 denied
  DENIED /admin/courses [giam_doc_kinh_doanh]: course.list
  DENIED /admin/courses [giao_vien]: course.list
  DENIED /admin/courses [sale]: course.list
  DENIED /admin/engagement/gifts [giao_vien]: gift.list
  DENIED /admin/engagement/rewards [giao_vien]: rewards.list
  1 passed (2.5m)
```

**11 → 5**, khớp **chính xác** bảng suy từ source ở trên; 6 artifact (`/hr/checkin` ×4, `/hr/my` ×2) **biến mất** ⇒ chẩn đoán "do danh tính tổng hợp" đúng, và bản vá `2b0dd46` hiệu quả.

*(Ghi để truy vết: lần chạy lại đầu tiên bị chính tôi `pkill` nhầm khi dọn process — tưởng là process mồ côi. Lần thứ hai chạy sạch.)*

### 11 denial thô của lần chạy đầu (giữ để truy vết — xem đính chính ngay trên)

| Màn | Vai | Procedure bị từ chối |
|---|---|---|
| `/hr/checkin` | **cả 4 vai** | `manualPunch.list` |
| `/hr/my` | sale, giao_vien | `kpi.myScore` |
| `/admin/courses` | GĐKD, GV, sale | `course.list` |
| `/admin/engagement/gifts` | giao_vien | `gift.list` |
| `/admin/engagement/rewards` | giao_vien | `rewards.list` |

Hai cái đầu đáng lo nhất: `/hr/checkin` (chấm công) và `/hr/my` (màn cá nhân) **không có nav gate** — mở cho mọi nhân viên — nhưng procedure chúng gọi thì **không vai nghiệp vụ nào** gọi được. Đây **đúng hình dạng F1/F2**, chỉ chưa ai nêu tên. Theo plan (bước 6): ghi lại, sửa ở plan kế tiếp khi đã có dữ liệu.

## Giới hạn đã biết (công bố, không giấu)

- **Capture chỉ thấy lỗi có phát sinh request.** Gate `canDo()` phía client khiến màn **không gọi gì** ⇒ vô hình. Đã rà thủ công 28 call site cho `class.create` ở Phase 1 (tìm ra `cockpit.tsx:210`), chưa rà cho key khác.
- ~~**Danh tính tổng hợp** chưa bind AppUser thật~~ — **ĐÃ SỬA** (`2b0dd46`) sau khi nó sinh 6 finding giả; xem §Đính chính. Chạy lại để xác nhận runtime **chưa xong**.
- **16 tổ hợp `:param` chưa chạy** (cần id thật). Được báo cáo là skipped để số liệu vẫn đối chiếu được.
- **Ổn định giữa các lần chạy**: 3 lần chạy đều cho **102 pair / 194 call** giống hệt. Số denial đổi (11 → 5) **chỉ vì bản vá danh tính**, không phải do nhiễu.

## Môi trường — plan đã lỗi thời, đã sửa trong `plan.md`

- Container `cmc-test-db-socat` **không còn**; DB `cmc_edu` **không còn** trên `cmcv2-prod-postgres-1` (chỉ còn `cmc_prod` — dữ liệu trẻ em thật, đang publish `0.0.0.0:5432`).
- Dùng `scripts/synthetic-seed-env.sh` → container riêng `cmc-synth-pg:55432`, DB `cmc_synth`. Chọn hướng này thay vì tạo `cmc_edu` cạnh `cmc_prod` vì nó **triệt tiêu** kịch bản S1 thay vì chỉ canh nó.
- Máy sạch cần `pnpm install` + `prisma generate` (pnpm 10.24 bỏ qua `pnpm.onlyBuiltDependencies`).
- `npx playwright install chromium` cần thiết: bản `chrome-headless-shell` thiếu dù `chromium` đã có.

## Validation cuối

| Gate | Kết quả |
|---|---|
| `pnpm typecheck` | **27/27** |
| `pnpm lint` | sạch |
| `pnpm test` | **22/22 task** (api 977, admin 348, …) |
| `pnpm acceptance:report` | 38 luồng, 1 orphan documented, **0 chưa phân loại**, exit 0 |
| `pnpm --filter @cmc/e2e test` | 20 passed, 1 skipped, **0 facility rò** |
| Runtime capture | 102 tổ hợp, 194 call, 11 denial; sour test **đạt** |

## Câu hỏi còn chờ PO

1. `acceptance:report` trong CI: giữ **cảnh báo** hay nâng lên **chặn merge**?
2. Runtime capture chạy **mọi PR** (thêm ~7 phút: ~4 build + ~2,5 chạy) hay **nightly + trước release**? Hiện **chưa nối vào CI** — chạy tay.
3. 5 denial thật (`/admin/courses`, 2 màn engagement): thêm page guard theo mẫu Phase 2 — mở plan riêng? (KHÔNG nới quyền.) `/hr/checkin` + `/hr/my` **rút khỏi danh sách** — là artifact, xem §Đính chính.
4. `/finance/refund` là EmptyState nhưng P1-08 đếm `built` — sửa cách đếm hay xây nốt màn?
5. Actor thật của 4 luồng khai `nhan_vien` (P3-01, P3-02, P4-01, P4-03)?
6. Nhóm nav "Tài chính & Điều hành" giờ ẩn hoàn toàn với `giao_vien` — xác nhận đúng ý sản phẩm?
