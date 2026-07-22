# Red-team `docs/runbook-uat-golive.md` — báo cáo đối kháng

Ngày: 2026-07-22 · Branch `main` (`89e42da`) · Vai: Staff Engineer / adversarial reviewer
Phạm vi: chỉ đọc. Không sửa file nào.

## Kết luận ngắn

Runbook đúng ở phần *chẩn đoán* (§1, §2, §4 lý do, §7, §8) nhưng **nghi thức §3 không thực thi được như viết**, và **§9 có thể ký GO trong khi 4 điều kiện go-live chưa được chứng minh**. Bốn lỗi mức Critical đều thuộc loại "chạy đúng theo runbook vẫn ra kết luận sai", không phải lỗi văn phong.

Nghiêm trọng nhất: **bước RESET (§3.7) không đụng tới `cmc_prod`** — nó in ra `RESTORE DRILL PASSED` trong khi toàn bộ rác UAT còn nguyên; và **bước xác nhận sạch (§3.8) có thể trả "sạch" bằng RLS** dù DB bẩn. Hai chốt duy nhất bảo vệ đúng rủi ro mà runbook tự nêu ở dòng 28 đều hỏng.

| Mức | Số finding |
|---|---|
| Critical | 4 (C1–C4) |
| High | 6 (H1–H6) |
| Medium | 5 (M1–M5) |

---

## CRITICAL

### C1 — §3 thiếu bước redeploy bắt buộc; UAT sẽ chạy trên binary KHÔNG chứa 3 fix hôm nay

`phase-04-uat-gonogo.md:39-44` ghi rõ: bước 0 REDEPLOY là **"red-team F-FM1 — CRITICAL, bắt buộc trước mọi bước khác"**, lý do nguyên văn: *"UAT người thật + biên bản GO phải chạy trên binary chứa fix"*.

Bảng §3 (`docs/runbook-uat-golive.md:32-41`) bắt đầu từ backup. **Không có bước redeploy, không có bước ghi lại commit/image digest.**

Bằng chứng lần deploy gần nhất và các fix sau đó:

- `phase-04-uat-gonogo.md:72-77` — redeploy cuối: **2026-07-11**, từ main `5c2cd2e`.
- `2c686bb` 2026-07-22 16:48 — `fix(rbac): separate class read permissions from class creation` (đụng `packages/auth`).
- `2c13634` 2026-07-22 19:24 — `fix(admin): guard the three screens the capture found unreachable-but-open`.

⇒ Image `cmcv2-prod` đang chạy cũ 11 ngày và **không chứa F1/F2/F4 fix**. Chạy §5 lên stack đó sẽ FAIL đúng 3 luồng vừa sửa — tester ghi "sản phẩm hỏng", hoặc tệ hơn: ai đó rebuild giữa chừng, nửa checklist chạy binary A nửa chạy binary B, và biên bản không phân biệt được.

**Hệ quả GO sai:** biên bản chứng nhận một binary không ai định danh.

**Sửa:** chèn bước 0 (rebuild → `up -d` → boot-checks → SSO smoke) trước bước 1; thêm cột bằng chứng `git rev-parse HEAD` + image digest; đưa vào §9 thành một dòng gate.

---

### C2 — §3 bước 7 "RESET" là no-op trên `cmc_prod`, nhưng in ra chữ PASS

Runbook dòng 40: *"RESET | Restore từ backup bước 1 (`scripts/restore-drill.sh`)"*.

Script làm việc khác hẳn:

- `scripts/restore-drill.sh:36` — `DRILL_PG_URL` mặc định `.../cmc_drill`, comment: *"never the prod DB"*.
- `scripts/restore-drill.sh:40-44` — **guard cứng**: nếu DB đích là `cmc_prod` → `exit 1`.
- `scripts/restore-drill.sh:98-100` — `DROP DATABASE IF EXISTS ${DRILL_DB}; CREATE DATABASE ${DRILL_DB};` (DB nháp).
- `scripts/restore-drill.sh:106` — `pg_restore` vào `${DRILL_PG_URL}`, tức DB nháp.
- `scripts/restore-drill.sh:128` — drop luôn DB nháp sau khi xong.
- `scripts/restore-drill.sh:131` — in `=== RESTORE DRILL PASSED ===`.

⇒ Chạy đúng bước 7 → `cmc_prod` **không thay đổi một dòng nào**, màn hình báo PASS. Đây chính xác là "thất bại âm thầm" mà câu hỏi 1 tìm.

Runbook cũng không có quy trình restore thật vào prod ở đâu khác; `docs/runbook-deploy.md:169-186` (§3 Rollback) chỉ nói rollback ứng dụng và migration, **không có DB restore**.

**Lỗ hổng thứ hai trong cùng nghi thức:** `restore-drill.sh:72` chọn backup bằng `sort | tail -1` — **backup mới nhất**, không phải backup bước 1. `docs/runbook-deploy.md:267` đặt cron `backup-db.sh` chạy hằng ngày 02:00 UTC. UAT kéo qua 02:00 ⇒ "mới nhất" là dump **giữa UAT, đã chứa rác**. Script không có biến để ghim một key cụ thể ⇒ câu "Restore từ backup bước 1" **không thực thi được** kể cả sau khi sửa DB đích.

**Sửa:** viết một thủ tục restore-prod riêng (drop/recreate `cmc_prod` từ dump đã ghim theo tên file), tách khỏi `restore-drill.sh`; hoặc tắt cron backup trong cửa sổ UAT và ghim `LATEST_KEY` bằng biến môi trường. Ghi rõ script hiện tại **không** dùng được cho mục đích này.

---

### C3 — §3 bước 8 (đếm row) có thể báo "sạch" trong khi DB bẩn, do RLS

§6 đưa câu SQL nhưng **không nói chạy bằng connection nào**. Repo có hai: `DATABASE_URL` (owner, bypass RLS) và `APP_DATABASE_URL` (`cmc_app`, chịu RLS).

5/7 bảng trong §6 có RLS `facility_isolation`:

- `packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:116` (`Receipt`), `:126` (`Student`), `:131` (`Enrollment`) — `USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')`.
- `AppUser`, `ClassBatch` cũng nằm trong danh sách `ENABLE ROW LEVEL SECURITY` (grep toàn bộ migrations).
- `20260707190000_force_rls_on_rls_tables/migration.sql:23` — `FORCE ROW LEVEL SECURITY` cho mọi bảng đã bật RLS.

Nếu chạy §6 bằng `APP_DATABASE_URL` mà không set GUC: `current_setting(...)` trả NULL → điều kiện không true → **mọi row bị lọc, count = 0, không lỗi**.

⇒ Bước 2 đọc 0 (khớp kỳ vọng "DB rỗng", không ai nghi ngờ). Bước 8 đọc 0 (rác bị RLS giấu). Hai bảng khớp nhau → §9 dòng 187 tick "DB sạch cho go-live". **Chốt duy nhất canh đúng rủi ro runbook tự nêu ở dòng 28 trả PASS theo cấu trúc.**

Chi tiết đáng nói: `ParentAccount` và `Facility` **không** có policy RLS (grep migrations không ra) ⇒ hai cột đó vẫn lộ rác. Đó là may, không phải kiểm soát — 5/7 chỉ số mù.

**Sửa:** §6 phải ghi rõ dùng `DATABASE_URL` (owner) hoặc `SET app.bypass_rls = 'on'`; bắt buộc bước 2 và bước 8 dùng **cùng một chuỗi kết nối**, và chép nguyên chuỗi (đã che mật khẩu) vào biên bản.

---

### C4 — Bước 3 "Seed nhân sự UAT" không có cơ chế; bước 7 xoá luôn đường đăng nhập duy nhất

Sự thật đã đo: `cmc_prod` có `AppUser = 0`.

- `apps/api/src/auth/sso-routes.ts:10-11` — comment: *"no AppUser with that email → reject"*.
- `apps/api/src/auth/sso-routes.ts:219-222` — `findFirst({where:{email}})`, `if (!appUser || !appUser.isActive)` → từ chối. Comment dòng 219: **"no auto-provision"**.
- `packages/auth/src/index.ts:105` — `'user.manage': []` ⇒ chỉ `super_admin` qua bypass trong `can()` mới tạo được AppUser, tại `/admin/users` (`apps/api/src/user/router.ts:109`).
- `packages/db/prisma/seed.mjs` — **không tạo AppUser nào** (chỉ facility + curriculum + shift catalog), khớp với `AppUser=0` đo được.
- Đường bootstrap duy nhất: `scripts/seed-super-admin.ts` — **runbook không nhắc tới**.

Chuỗi hệ quả:

1. Bước 3 như viết ("Tài khoản Entra thật cho từng vai") không nói ai tạo, bằng gì. Không có super_admin thì không tạo được vai nào, và tạo super_admin cần script trên.
2. Bước 7 restore về backup bước 1 ⇒ `AppUser` về 0.
3. Bước 8 **bắt buộc** `AppUser = 0` mới coi là sạch ⇒ nghi thức **cố ý xoá** super_admin và toàn bộ tài khoản nhân sự UAT.
4. §9 dòng 187 tick "DB sạch cho go-live" cho một database **không ai đăng nhập được**, và không có auto-provision để tự phục hồi.

Trả lời trực tiếp câu hỏi 2 ("dữ liệu seed nhân sự Entra có bị restore xoá không, lần UAT sau làm lại từ đâu"): **có, bị xoá sạch**; lần sau phải bắt đầu lại từ `scripts/seed-super-admin.ts` (cần `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_FACILITY`), rồi super_admin tạo lại từng vai qua `/admin/users` (ADM-02).

**Sửa:** nêu đích danh `scripts/seed-super-admin.ts` ở bước 3; thêm bước 9 "re-bootstrap sau reset"; và §6 phải ghi rõ `AppUser` là cột **được phép lệch** (hoặc chốt rằng roster go-live được tạo *sau* reset).

---

## HIGH

### H1 — §5 và §8 mâu thuẫn trực tiếp về P3-02 và P4-01

§8 (dòng 166-170) tuyên bố 4 luồng khai actor `nhan_vien` là **"Không thể phân công ai test"** và chặn xếp lịch. Manifest nói khác:

- `scripts/acceptance-report/flow-manifest.ts:308` — P3-02 `actorRoles: ['nhan_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao']`
- `scripts/acceptance-report/flow-manifest.ts:436` — P4-01 `actorRoles: ['hoc_vien', 'nhan_vien']`

Cả hai **đã có actor thật và đã nằm trong §5**: P3-02 ở dòng 74 và 92-93, P4-01 ở dòng 130. Chỉ P3-01 (`:297`) và P4-03 (`:460`) là *thuần* `nhan_vien`.

Hai người đọc §9 dòng 186 ("§8 đã giải quyết") sẽ kết luận khác nhau: một người coi tick §5 là đã xong P3-02/P4-01, người kia coi §8 vẫn mở. Chính xác thì tick §5 chỉ phủ **nửa duyệt** của P3-02 (`manualPunch.approve` = GĐKD/GĐĐT, `packages/auth/src/index.ts:118`); **nửa gửi lại** dùng owner-check không có registry key (`index.ts:113-116`) vẫn chưa ai test.

### H2 — P3-01 và P4-03 nằm ngoài 50 dòng §5 ⇒ §9 có thể PASS toàn bộ mà chưa ai chấm công lần nào

Hai luồng thuần `nhan_vien` **không xuất hiện ở bất kỳ dòng nào trong §5**. §9 dòng 183 chỉ yêu cầu "mọi dòng checklist §5 PASS" ⇒ điều kiện thoả trong khi:

- P3-01 "Chấm công cặp vào/ra mỗi ngày" — luồng dùng hằng ngày của **mọi nhân viên**, `'checkIn.punch': ['giam_doc_kinh_doanh','giam_doc_dao_tao','sale','giao_vien']` (`index.ts:117`), và là nơi duy nhất kiểm tra IP/trusted-proxy mà `phase-04-uat-gonogo.md:60` liệt kê là yêu cầu UAT.
- P4-03 "Lên lịch & nhắc họp PH".

Có thể ký GO mà chưa một người thật nào bấm chấm công.

### H3 — 6 dòng §5 bất khả thi dưới luật §4.3 ("vào màn bằng menu")

Code tự khai không có nav entry:

- `apps/admin/src/routes/admin.routes.tsx:66-68` — *"Courses. **No nav entry points here, so the URL is the only way in**"*
- `apps/admin/src/routes/admin.routes.tsx:78-79` — *"Engagement — **same situation: no nav entry**"*

Đối chiếu toàn bộ `apps/admin/src/shell/nav-registry.ts:6-100`, các path sau **không có** trong menu: `/admin/parents`, `/admin/engagement/gifts` (`admin.routes.tsx:81`), `/admin/engagement/rewards` (`:91`), `/admin/report-cards` (`:111`), `/finance/new` (`finance.routes.tsx:29`).

Dòng §5 bị ảnh hưởng: P1-02 (dòng 62), P4-02 (dòng 81 và 99), P2-07 (dòng 109), P1-06 (dòng 120), P4-01 (dòng 130).

§4.3 cho ngoại lệ "trừ khi dòng đó ghi rõ là bài test gõ URL" — **không dòng nào ghi**. Tester nghiêm túc ghi FAIL cho hệ thống đúng; tester thực dụng gõ URL và âm thầm vô hiệu hoá chính luật sinh ra để tái hiện điểm mù F1.

(`/finance/new` thực tế vào được bằng nút trong app: `crm/opportunity-detail.tsx:209`, `crm/pipeline.tsx:154`, `cockpit.tsx:124` — nhưng đó là nút, không phải menu. Luật cần đổi thành "menu hoặc điều hướng trong app, tuyệt đối không gõ URL".)

### H4 — Cột "Màn cần đi qua" là per-flow, không per-role — bảo vai đi vào màn nó không có quyền

Runbook ghép **mọi** `uiRoutes` của một luồng vào **mọi** dòng actor của luồng đó. Kết quả sai cụ thể:

| Dòng §5 | Vai | Màn bị gán sai | Bằng chứng |
|---|---|---|---|
| 120 | `phu_huynh` | `/admin/parents` | `flow-manifest.ts:118`; PH không có tài khoản app admin — LMS chỉ có `/parent/*`, `/student/*` (`apps/lms/src/routes/index.tsx:47-79`) |
| 130 | `hoc_vien` | `/admin/engagement/rewards` | `flow-manifest.ts:440`; màn gate `PermissionGate module="rewards" action="manage"` (`admin.routes.tsx:94`) = GĐKD/GĐĐT/sale (`index.ts:143`) |
| 122 | `phu_huynh` | `/teaching/session-evidence` | `flow-manifest.ts:288`; gate `sessionEvidence.upsert` = `giao_vien` only (`index.ts:103`, `nav-registry.ts:24`) |
| 109 | `giao_vien` | `/admin/report-cards` | không có nav (`admin.routes.tsx:111`) |

### H5 — P2-04 cho `giao_vien` là lỗi chặn luồng ĐANG SỐNG, runbook trình bày như dòng bình thường

§5 dòng 107 giao P2-04 "Cung cấp bài tập PDF" cho Giáo viên qua `/teaching/exercises`.

- `apps/api/src/exercise/router.ts:104, 131, 163, 178, 192` — `list`/`create`/`publish`/`close`/`list` đều `requirePermission('exercise', 'manage')`.
- `packages/auth/src/index.ts:96` — `'exercise.manage': ['giam_doc_dao_tao']` — **không có `giao_vien`**.
- `apps/admin/src/shell/nav-registry.ts:28` — menu "Bài tập" cũng gate `exercise.manage` ⇒ giáo viên **không thấy menu**.
- `packages/auth/src/index.ts:97` — `'exercise.view': ['giao_vien','giam_doc_dao_tao']` chỉ được dùng ở một chỗ ngoài tRPC (`apps/api/src/exercise/upload-route.ts:210`), không procedure nào dùng.

⇒ Đây là lỗi **hình dạng F1**: capture báo `0 denied` chính vì nav không render cho giáo viên nên không có call nào bị denied. Hoặc `flow-manifest.ts:216` khai sai actor, hoặc đây là **luồng chặn thứ 4** chưa ai biết. Phải chốt **trước** UAT, không phải phát hiện giữa UAT.

### H6 — Luật §4.1 + §4.2 làm ít nhất 9 dòng §5 bất khả thi; đây là mâu thuẫn thiết kế nặng nhất

Ca chặt chẽ nhất — **P1-03 "Duyệt phiếu kích hoạt học viên"** (dòng 73 và 88, cả GĐKD lẫn GĐĐT):

- `packages/auth/src/index.ts:64` — `'finance.receiptCreate': ['giam_doc_kinh_doanh', 'sale']` ⇒ **GĐĐT không tạo được phiếu**.
- `packages/auth/src/index.ts:66-67` — `'finance.receiptApprove': ['giam_doc_kinh_doanh','giam_doc_dao_tao']`, comment: *"approver must differ from the drafting sale rep"*.
- `apps/api/src/finance/router.ts:174` — `const notSelf = receipt.createdById !== subject.userId;` và `:257` `const selfApproved = receipt.createdById === approverId;` ⇒ **GĐKD tự tạo thì không tự duyệt được**.

⇒ Không actor nào của P1-03 tự đi trọn được. Bắt buộc cần `sale` tạo phiếu trước — tức cần "bắc cầu", thứ §4.2 **CẤM tuyệt đối**.

Cùng lớp (đã đối chiếu manifest + registry):

| Luồng | Vai trong §5 | Tiền đề phải do vai khác tạo |
|---|---|---|
| P1-03 | GĐKD, GĐĐT | phiếu thu của `sale` (P1-02) |
| P3-04 | GĐKD, GĐĐT | đăng ký ca của sale/GV (P3-03, `manifest:319`) |
| P3-07 | GĐKD, GĐĐT | đăng ký ca để mà từ chối |
| P2-06 | GV | bài nộp của học viên (P2-05, `manifest:229`) |
| P2-03, P2-05 | HV | exercise + enrollment do nhân sự tạo |
| P4-01 | HV | danh mục quà (P4-02, GĐKD/GĐĐT) + sao (P2-06, GV) |
| P1-07 | PH | `ParentAccount` chỉ sinh bởi `provisionFromReceipt` khi duyệt phiếu |
| P2-08 | PH | teacher publish trước |

**Vấn đề gốc:** §4.2 đúng về *lỗi cần bắt* (đưa sẵn id/deep-link cho tester) nhưng viết thành lệnh cấm tuyệt đối nên chặn luôn *bàn giao hợp lệ* (vai B tự tìm bản ghi của vai A qua menu và hàng đợi của chính mình). Giữ nguyên câu chữ, tester sẽ hoặc bắc cầu id thật (tái lập đúng điểm mù F1), hoặc bỏ trống các dòng liên vai.

**Sửa (giữ nguyên ý định gốc):** đổi §4.2 thành *"Không được đưa id/URL/deep-link cho vai khác. Vai kế tiếp phải tự tìm bản ghi qua menu và hàng đợi của chính mình."* Và §5 cần cột "Tiền đề" ghi rõ luồng nào phải chạy trước.

---

## MEDIUM

### M1 — Runbook không phủ đủ Success Criteria của Phase 4

| Yêu cầu gốc | Vị trí | Trạng thái trong runbook |
|---|---|---|
| e2e chạy lại sau redeploy | `phase-04:117` — *"needs one more post-redeploy re-run after Brevo rotation"* | **Thiếu** hoàn toàn ở §3 và §9 |
| Brevo key phải rotate/verify TRƯỚC bước 5 | `phase-04:104-106` — `BREVO_API_KEY` trả **401 Key not found** (2026-07-10), *"chưa từng có email Brevo thật gửi thành công end-to-end"* | **Thiếu**; §3.5 và §9 giả định gửi là chạy |
| PII-guard reject verify | `phase-04:22` | **Thiếu** — không dòng §5 nào |
| AI draft LLM thật | `phase-04:22` | Chỉ ẩn trong P2-07, không nêu là điều kiện |
| NO-GO: xoá dump R2 + revoke R2 token | `phase-04:65` (red-team F-S7) | §9 dòng 188 rút gọn thành "huỷ secret theo phase-04". Chính bước 1 của runbook này **upload dump mới lên R2** (`backup-db.sh:37, 61-67`) ⇒ bỏ quên là chắc chắn |
| Tracker #9 + changelog | `phase-04:121` | **Thiếu** |

### M2 — §3/§5 không ghi ai chạy dòng nào, lúc nào ⇒ luật §4.1 không kiểm chứng được sau khi ký

Bước 4 chỉ yêu cầu "Tick PASS/FAIL từng dòng"; §4.4 chỉ bắt ảnh + giờ + vai **khi FAIL**. Không có danh tính tester và thời điểm cho dòng PASS ⇒ không ai hậu kiểm được "một vai đi trọn luồng" đã thật sự diễn ra. Luật trung tâm của tài liệu trở thành không cưỡng chế được. Thêm 2 cột `Người chạy` / `Giờ` vào §5.

### M3 — Bước 1 (backup) và §6 (đếm row) không chạy được từ shell host như viết

`docs/runbook-deploy.md:49-56` đã ghi nhận: `postgres` không map port ra host, `DATABASE_URL` dùng hostname nội bộ Docker, *"Running directly from the VPS host shell will fail to resolve `postgres`"*. `scripts/backup-db.sh:3` lại nói *"Run as a cron job on the VPS HOST"* và `:50` chạy `pg_dump` trực tiếp. Lỗi này **ồn** (không âm thầm), nhưng sẽ kẹt ngay bước 1 nếu runbook không chỉ rõ chạy trong container/network nào.

### M4 — Trùng lặp và mâu thuẫn với `docs/runbook-deploy.md`, không cross-reference

Backup (`runbook-deploy.md:153-158` §2.5), restore drill (`:160-165` §2.6 và `:71-107` §1.7), và security checklist trước go-live (`:275-291` §6) đã tồn tại. Runbook UAT đặc tả lại backup/restore ở §3 mà không link. Nặng hơn: chú thích dòng 43 (*"Bước 7–8 **là** hạng mục go-live sẵn có (diễn tập restore)"*) là **sai** theo C2 — hai tài liệu giờ mô tả cùng một drill theo hai cách, và bản của `runbook-deploy.md` mới là bản đúng.

### M5 — §7 loại P1-08 khỏi test nhưng không xử lý việc menu "Hoàn tiền" vẫn hiện khi go-live

Xác minh đúng: `acceptance-report/verification.json` = **37 built / 1 partial**; `apps/admin/src/routes/finance.routes.tsx:9-12` xác nhận refund là EmptyState. Nhưng `nav-registry.ts:59` vẫn đăng ký menu `Hoàn tiền → /finance/refund` gate `finance.refundCreate` = GĐKD (`index.ts:68`) ⇒ go-live ship một mục menu dẫn tới màn giữ chỗ. Đó là quyết định sản phẩm (B2, brainstorm dòng 41), nhưng phải nằm ở §9 dưới dạng **rủi ro đã chấp nhận có chữ ký**, không phải im lặng dưới mục "không test".

---

## Trả lời trực tiếp 5 câu hỏi

**1. Bước nào thất bại âm thầm?**
Bước 7 (C2 — no-op nhưng in PASS) và bước 8 (C3 — RLS trả 0 cho 5/7 bảng, không lỗi). Bước 1 và §6 fail ồn (M3). Bước 3 không có cơ chế nên fail ngay lập tức, không âm thầm (C4).

**2. Nghi thức backup→UAT→restore có lỗ hổng thật không?**
Có, ba lỗ: (a) restore không đụng prod — `restore-drill.sh:40-44`; (b) chọn dump "mới nhất" chứ không phải dump bước 1, và cron 02:00 có thể chen vào — `restore-drill.sh:72` + `runbook-deploy.md:267`; (c) restore **xoá sạch** seed nhân sự Entra kể cả super_admin, và §3.8 *bắt buộc* nó phải bị xoá; phục hồi phải bắt đầu lại từ `scripts/seed-super-admin.ts` rồi tạo tay từng vai qua `/admin/users`.

**3. Luồng nào một vai không đi trọn được?**
Ít nhất 9 (H6). Cụ tên rõ nhất: **P1-03** — GĐĐT không có `finance.receiptCreate` (`index.ts:64`) và GĐKD bị chặn tự duyệt bởi `receipt.createdById !== subject.userId` (`finance/router.ts:174`). Kèm P3-04, P3-07, P2-06, P2-03, P2-05, P4-01, P1-07, P2-08. Luật §4.2 dạng cấm tuyệt đối làm toàn bộ nhóm này bất khả thi.

**4. §9 mơ hồ ở đâu?**
- Dòng 183: nửa đầu "mọi dòng PASS", nửa sau cho phép "chấp nhận có điều kiện" — không nói ai quyết, không trần số lượng, không ngưỡng nghiêm trọng. Đây là mệnh đề sẽ bị lạm dụng, vì F1/F2/F4 đúng là loại lỗi từng bị "biết rồi, chấp nhận".
- Dòng 186: PO được quyền "loại khỏi phạm vi có ghi lý do" ⇒ một câu là descope được P3-01 (chấm công hằng ngày của mọi người) mà vẫn tính là qua cổng.
- Dòng 184: "gửi thật thành công" không định nghĩa — transport 2xx hay thật sự vào hộp thư? §3.5 đòi ảnh hộp thư, §9 không. Với lịch sử Brevo 401, cách hiểu lỏng là rủi ro thật.
- Dòng 187: mơ hồ kép (C3 connection nào, C4 seed nhân sự có được phép sống sót không).
- §5 không có ô N/A ⇒ dòng bị chặn theo thiết kế (H3/H4/H5) sẽ bị ghi FAIL sản phẩm hoặc bỏ trắng, và §9 không nói dòng trắng tính là gì.

**5. Giả định kiểm chứng được là SAI**
- Dòng 40 — "Restore từ backup bước 1 (`scripts/restore-drill.sh`)": sai, `restore-drill.sh:36, 40-44, 98-100, 128`.
- Dòng 43 — "Bước 7–8 là hạng mục go-live sẵn có… một công đôi việc": sai cùng lý do; drill chứng minh dump restore được vào DB nháp, **không** rollback prod.
- Dòng 107 — P2-04 cho `giao_vien`: mâu thuẫn `exercise/router.ts:104,131,163,178,192` + `index.ts:96` + `nav-registry.ts:28`.
- Dòng 120 — P1-06 cho `phu_huynh` qua `/admin/parents`: mâu thuẫn `apps/lms/src/routes/index.tsx:47-79` (PH chỉ có `/parent/*`) và `nav-registry.ts` (không có entry).
- Dòng 166-170 — "4 luồng khai actor `nhan_vien` không thể phân công ai test": chỉ đúng với P3-01 và P4-03; P3-02 (`flow-manifest.ts:308`) và P4-01 (`:436`) đã có actor thật và đã nằm trong §5.

**Đã kiểm và ĐÚNG, không bịa lỗi:** §2 dòng 22-26 (`cmc_prod` rỗng; giữ guard vì bảo vệ trạng thái tương lai) — `assertNotProdDatabase` chỉ dùng ở tầng test (`apps/e2e/src/assert-not-prod.ts:17`, `apps/api/src/test/db.ts:26`), không cản trở UAT tay. §5 tổng 50 dòng (7+10+13+9+3+3+5) khớp manifest sau khi trừ P1-08. §7 loại P1-08 khớp `verification.json` (37 built / 1 partial). §4.2 chẩn đoán đúng nguyên nhân F1.

---

## Hành động đề xuất (theo thứ tự)

1. **Chặn lịch UAT** cho tới khi C1–C4 và H5 xong. Đây không phải nice-to-have: C2+C3 nghĩa là nghi thức dọn dẹp hiện không hoạt động, H5 nghĩa là có thể còn một luồng chặn chưa biết.
2. Thêm **bước 0 redeploy** + ghi commit SHA/image digest vào bằng chứng (C1).
3. Viết **thủ tục restore prod thật**, tách khỏi `restore-drill.sh`, ghim tên dump; tắt cron backup trong cửa sổ UAT (C2).
4. §6 chốt **dùng `DATABASE_URL` owner**, cùng connection cho bước 2 và 8 (C3).
5. Bước 3 chỉ đích danh `scripts/seed-super-admin.ts`; thêm **bước 9 re-bootstrap** sau reset; ghi `AppUser` là cột được phép lệch (C4).
6. Chốt P2-04: `giao_vien` là actor thật hay manifest sai (H5) — cần PO/GĐĐT trả lời, không tự quyết.
7. Viết lại §4.2 thành "cấm đưa id/URL; vai kế tiếp tự tìm qua menu và hàng đợi của mình"; thêm cột **Tiền đề** vào §5 (H6).
8. Sửa cột "Màn cần đi qua" thành per-role; đánh dấu rõ dòng nào là **bài test gõ URL** (H3, H4).
9. Bổ sung P3-01, P4-03 vào §5 (hoặc ghi rõ descope có chữ ký PO ngay trong §9) (H1, H2).
10. §9: định nghĩa "gửi thật thành công" = ảnh hộp thư nhận; đặt trần cho "chấp nhận có điều kiện"; thêm ô N/A cho §5; thêm dòng e2e re-run, Brevo key verify, PII-reject, xoá dump R2, tracker #9 + changelog (M1).
11. Link tới `docs/runbook-deploy.md` thay vì đặc tả lại backup/restore; sửa chú thích dòng 43 (M4).
12. `git add docs/runbook-uat-golive.md` — tài liệu sắp gate go-live hiện đang untracked (`git status` = `?? docs/runbook-uat-golive.md`).

---

## Câu hỏi chưa giải

1. **P2-04 / `giao_vien`**: manifest khai sai actor, hay đây là luồng chặn thứ 4? Ai chốt — PO hay GĐĐT?
2. **Roster nhân sự go-live tạo trước hay sau reset?** Quyết định này đổi hẳn nội dung §6 và §9 dòng 187.
3. **Brevo key** đã rotate chưa kể từ 401 ngày 2026-07-10 (`phase-04:104-106`)? Nếu chưa, bước 5 sẽ fail và §9 không có đường xử lý.
4. **Cron backup 02:00 UTC đã bật trên VPS chưa?** Nếu rồi, cửa sổ UAT phải né hoặc tắt tạm (C2b).
5. P3-01/P4-03 — descope có chữ ký, hay bổ sung vào §5 với actor suy từ `checkIn.punch` / `parentMeeting.manage`?

---

Status: DONE_WITH_CONCERNS
Summary: Runbook chẩn đoán đúng nhưng nghi thức §3 không thực thi được — bước RESET là no-op trên `cmc_prod` mà vẫn in PASS, bước xác nhận sạch có thể trả 0 do RLS, thiếu bước redeploy bắt buộc, và bước seed nhân sự không có cơ chế lẫn đường phục hồi. §9 hiện có thể ký GO trong khi 4 điều kiện go-live chưa được chứng minh.
Concerns: 4 Critical + 6 High phải xử lý trước khi xếp lịch UAT. Riêng H5 (P2-04 cho `giao_vien`) có thể là luồng chặn thứ 4 chưa ai biết — cần PO chốt, không tự quyết. H6 (luật "cấm bắc cầu id" làm ≥9 luồng bất khả thi) là mâu thuẫn thiết kế, sửa bằng cách thu hẹp câu chữ chứ không bỏ luật.
