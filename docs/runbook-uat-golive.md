# Runbook UAT Go/No-Go (Phase 4)

Nguồn: `plans/260707-2308-golive-sprint-land-sso-env-uat/phase-04-uat-gonogo.md`
Sinh ngày 2026-07-22 từ `acceptance-report/verification.json` (**không chép tay** — số liệu khớp sổ nghiệm thu tại thời điểm sinh).

## 1. UAT này tồn tại để chứng minh cái gì

Nghiệp vụ chạy đúng **đã** có bằng chứng khác: unit/integration 977 test, e2e 20 spec, runtime capture 102 tổ hợp màn×vai (`0 denied`).

Phase 4 chứng minh thứ **không công cụ nào thay được**:

- Đăng nhập **Entra thật** của nhân viên, và nav hiện đúng theo vai
- Gửi email **Brevo + Graph thật**, mỗi loại ≥ 1 lần thành công
- Chồng **Docker/env production thật** phục vụ được người dùng thật

⇒ Vì vậy UAT chạy trên **chồng prod thật**, không phải DB thử nghiệm. Một stack không có SSO/email/env không thể chứng minh SSO/email/env.

## 2. Hạ tầng — quyết định và lý do

**Chốt: chạy trên `cmc_prod` + nghi thức reset.**

Dữ kiện (đo 2026-07-22, read-only): `cmc_prod` **rỗng** — 1 Facility (seed), 0 Student, 0 ParentAccount, 0 Receipt, 0 AppUser.

> ⚠️ **Đính chính một tuyên bố sai đang lan trong repo.** Nhiều plan/doc ghi *"`cmc_prod` chứa dữ liệu trẻ em thật"*. **Tại 2026-07-22 điều đó KHÔNG đúng** — dự án chưa vận hành. Tuyên bố đó sẽ đúng **sau go-live**, nên:
> - Các guard (`assertNotProdDatabase`, guard trong `getPrivilegedDb()`) **giữ nguyên** — chúng bảo vệ trạng thái tương lai.
> - Nhưng đừng dùng nó làm lý do từ chối UAT trên prod **lúc này**.

Rủi ro thật của phương án này **không** phải mất dữ liệu (chưa có gì để mất) mà là **quên reset** ⇒ go-live khởi đầu với học sinh/phiếu thu giả từ UAT.

## 3. Nghi thức bắt buộc (theo thứ tự, không bỏ bước)

> Bản đầu của mục này **không thực thi được** — red-team 2026-07-22 tìm 4 Critical. Đã sửa; các bẫy ghi ngay tại chỗ để người chạy không vấp lại.

| # | Bước | Cách làm | Bằng chứng cần lưu |
|---|---|---|---|
| **0** | 🔴 **REDEPLOY** | Build + deploy lại chồng prod từ `main` hiện tại | Commit hash đang chạy = `git rev-parse HEAD` |
| 1 | Backup trước UAT | `scripts/backup-db.sh` | **S3 key** của dump (`db-backups/cmc-prod-<TS>.dump.enc`) — ghi lại chính xác |
| 2 | Ghi trạng thái đầu | Đếm row §6 — **bằng role `postgres`** | Bảng số liệu "trước" |
| 3 | Seed nhân sự UAT | `scripts/seed-super-admin.ts`, rồi super_admin tạo AppUser cho từng vai | Danh sách email × vai |
| 4 | Chạy UAT | Checklist §5, theo luật §4 | Tick PASS/FAIL từng dòng |
| 5 | Email thật | ≥1 Brevo + ≥1 Graph gửi thành công | Ảnh chụp hộp thư nhận |
| 6 | Biên bản Go/No-Go | Ký xác nhận | File biên bản |
| 7 | **RESET** | Xem §3.1 — **KHÔNG dùng `restore-drill.sh`** | Log restore + hash dump đã dùng |
| 8 | Xác nhận sạch | Đếm lại §6 **bằng role `postgres`** = số liệu bước 2 | Bảng số liệu "sau" |
| 9 | Seed lại đăng nhập | Chạy lại `scripts/seed-super-admin.ts` | Đăng nhập thử 1 lần |

### 3.0 Vì sao bước 0 bắt buộc

`phase-04-uat-gonogo.md:39-44` khai bước REDEPLOY là **CRITICAL, trước mọi bước khác**.

**Đo thực tế 2026-07-22** (`docker image inspect cmcv2-prod-api`): image đang chạy build **2026-07-18**. *(Tài liệu phase-04 ghi lần deploy cuối là 2026-07-11 — tài liệu đã cũ; lấy số đo, đừng lấy số chép.)*

Các bản vá RBAC hôm nay (`2c686bb` — `packages/auth`; `2c13634` — `apps/admin`; `11b7eea` — sổ nghiệm thu) đều **sau** ngày build đó ⇒ **chưa có trong binary đang chạy**.

⇒ Bỏ bước 0 thì UAT chạy trên hệ thống **vẫn còn F1/F2/F4** và sẽ fail đúng 3 luồng vừa sửa — hoặc tệ hơn, người chạy kết luận "fix không hiệu lực".

### 3.1 RESET — `restore-drill.sh` KHÔNG làm việc này

🔴 **Bẫy đã suýt vào runbook:** `scripts/restore-drill.sh` **không hề chạm `cmc_prod`**:

- `:36` mặc định đích là DB nháp `cmc_drill`; `:40-44` **guard cứng từ chối** nếu đích là `cmc_prod`
- `:106` restore vào DB nháp, `:128` **drop luôn** DB đó
- `:72` chọn dump **mới nhất** (`sort | tail -1`), **không phải** dump của bước 1 — cron 02:00 (`runbook-deploy.md:267`) có thể chen một dump giữa-UAT vào

⇒ Chạy nó xong sẽ in `RESTORE DRILL PASSED` trong khi `cmc_prod` **không đổi một dòng**. Đây đúng loại tín hiệu xanh vô nghĩa mà đợt này tồn tại để chống.

**Cách reset đúng** — chọn 1, ghi rõ đã chọn cách nào vào biên bản:

- **Cách A (khuyến nghị, đồng thời là diễn tập restore thật):** tải đúng S3 key ghi ở bước 1, giải mã, `pg_restore --clean --if-exists` vào `cmc_prod`. Chứng minh backup phục hồi được — thứ go-live vốn phải diễn tập.
- **Cách B (đơn giản hơn, chỉ hợp lệ vì DB khởi điểm rỗng):** drop + tạo lại `cmc_prod`, `prisma migrate deploy`, chạy seed. Không chứng minh được backup, nên nếu chọn B thì **vẫn phải diễn tập restore riêng**.

### 3.2 Đăng nhập sẽ mất sau reset — phải seed lại

SSO **không tự tạo tài khoản**: `sso-routes.ts:219-222` từ chối người chưa có `AppUser`. `'user.manage': []` (`packages/auth/src/index.ts:105`) nghĩa là **chỉ super_admin** tạo được nhân viên, và `seed.mjs` **không** tạo AppUser nào. Đường bootstrap duy nhất là `scripts/seed-super-admin.ts`.

⇒ Bước 7 đưa `AppUser` về 0 ⇒ **không ai đăng nhập được**. Bước 9 không phải tuỳ chọn.

## 4. Luật cứng khi chạy UAT

1. **Một vai đi trọn luồng.** Người đóng vai `sale` phải tự làm từ đầu tới cuối bằng chính tài khoản đó.
2. **CẤM đưa sẵn id/link.** Mỗi người phải **tự tìm** đối tượng cần thao tác qua giao diện (danh sách, tìm kiếm, hàng đợi). Không ai được đưa sẵn `classBatchId` / `studentId` / URL trực tiếp cho vai khác.
   > Đây không phải thủ tục. Chính cơ chế bắc cầu `classBatchId` giữa các vai đã che lỗi F1 khỏi **cả 38 runtime-proof** — hệ thống báo xanh trong khi không sale nào thu nổi học phí.

   ⚠️ **Không đồng nghĩa "một luồng chỉ một người".** Nhiều luồng **cố ý** cần 2 vai — tách trách nhiệm theo ADR-B. Rõ nhất **P1-03**: GĐĐT không có `finance.receiptCreate` (`packages/auth/src/index.ts:64`), còn GĐKD bị chặn tự duyệt phiếu mình tạo (`apps/api/src/finance/router.ts:174`, `:257`). Không actor nào tự đi trọn — **đúng thiết kế**.
   Luật đúng là: sale tạo phiếu bằng tài khoản sale; người duyệt **tự mở hàng đợi `/finance` tìm phiếu đó**, không được ai đưa link/id. Nếu người duyệt không tìm thấy phiếu qua giao diện ⇒ **FAIL**, đó chính là lỗi cần bắt.
3. **Vào màn bằng menu**, không gõ URL trực tiếp, trừ khi dòng đó ghi rõ là bài test gõ URL.
4. FAIL thì **ghi lại nguyên trạng** (ảnh + giờ + vai), không tự sửa rồi thử lại.

## 5. Checklist theo vai

50 luồng-vai, sinh từ sổ nghiệm thu. Một luồng xuất hiện ở nhiều vai nghĩa là mỗi vai phải tự đi.

⚠️ **Đọc cột "Màn cần đi qua" cho đúng.** Cột này liệt kê mọi màn của *luồng*, không phải màn của *vai đó*. Ví dụ P1-06 gồm `/admin/parents` — đó là màn nhân viên duyệt, **phụ huynh không vào**. Người test chỉ đi phần thuộc vai mình; phần của vai khác do người khác đi (xem §4.2).

⚠️ **Một số màn không có nav entry** (`/finance/new`, `/finance/class-placement`, `/admin/courses`, các màn engagement — `apps/admin/src/routes/admin.routes.tsx:66-68`, `:78-79`). Với các dòng này, luật §4.3 "vào bằng menu" **không áp dụng**; ghi rõ vào biên bản là đã vào bằng URL, và **bản thân việc không tìm được lối vào qua menu là một phát hiện UX cần ghi**.

### Sale (`sale`) — 7 luồng

| # | Luồng | Màn cần đi qua | Kết quả |
|---|---|---|---|
| P1-01 | Quản lý phễu tuyển sinh (O1→O5) | `/crm`, `/crm/opportunities/:id` | ☐ PASS ☐ FAIL |
| P1-02 | Tạo phiếu học phí từ cơ hội | `/finance/new` | ☐ PASS ☐ FAIL |
| P3-03 | Đăng ký ca làm | `/hr/shifts` | ☐ PASS ☐ FAIL |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P4-04 | Đặt lịch test đầu vào/định kỳ | `/crm/opportunities/:id` | ☐ PASS ☐ FAIL |
| P4-05 | Chăm sóc sau bán | `/crm/aftersale` | ☐ PASS ☐ FAIL |

### GĐ Kinh doanh (`giam_doc_kinh_doanh`) — 10 luồng

| # | Luồng | Màn cần đi qua | Kết quả |
|---|---|---|---|
| P1-03 | Duyệt phiếu kích hoạt học viên | `/finance`, `/finance/:id` | ☐ PASS ☐ FAIL |
| P3-02 | Duyệt phiếu chấm công offsite | `/hr/checkin` | ☐ PASS ☐ FAIL |
| P3-04 | Duyệt ca | `/hr/shifts` | ☐ PASS ☐ FAIL |
| P3-05 | Chốt lương tháng theo bậc lương | `/hr/payroll`, `/hr/salary-tiers`, `/hr/my` | ☐ PASS ☐ FAIL |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P3-07 | Từ chối đăng ký ca (kèm lý do) | `/hr/shifts` | ☐ PASS ☐ FAIL |
| P3-08 | Tất toán KPI hàng loạt (branch-scope) | `/hr/kpi` | ☐ PASS ☐ FAIL |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P4-02 | Cấu hình quà đổi sao | `/admin/engagement/gifts`, `/admin/engagement/rewards` | ☐ PASS ☐ FAIL |
| P4-05 | Chăm sóc sau bán | `/crm/aftersale` | ☐ PASS ☐ FAIL |

### GĐ Đào tạo (`giam_doc_dao_tao`) — 13 luồng

| # | Luồng | Màn cần đi qua | Kết quả |
|---|---|---|---|
| P1-03 | Duyệt phiếu kích hoạt học viên | `/finance`, `/finance/:id` | ☐ PASS ☐ FAIL |
| P1-09 | Giám sát bất thường tài chính | `/ops/recon` | ☐ PASS ☐ FAIL |
| P2-01 | Tạo lớp tự sinh lịch buổi | `/admin/classes`, `/admin/classes/:id` | ☐ PASS ☐ FAIL |
| P2-04 | Cung cấp bài tập PDF | `/teaching/exercises` | ☐ PASS ☐ FAIL |
| P3-02 | Duyệt phiếu chấm công offsite | `/hr/checkin` | ☐ PASS ☐ FAIL |
| P3-04 | Duyệt ca | `/hr/shifts` | ☐ PASS ☐ FAIL |
| P3-05 | Chốt lương tháng theo bậc lương | `/hr/payroll`, `/hr/salary-tiers`, `/hr/my` | ☐ PASS ☐ FAIL |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P3-07 | Từ chối đăng ký ca (kèm lý do) | `/hr/shifts` | ☐ PASS ☐ FAIL |
| P3-08 | Tất toán KPI hàng loạt (branch-scope) | `/hr/kpi` | ☐ PASS ☐ FAIL |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P4-02 | Cấu hình quà đổi sao | `/admin/engagement/gifts`, `/admin/engagement/rewards` | ☐ PASS ☐ FAIL |
| P4-05 | Chăm sóc sau bán | `/crm/aftersale` | ☐ PASS ☐ FAIL |

### Giáo viên (`giao_vien`) — 9 luồng

| # | Luồng | Màn cần đi qua | Kết quả |
|---|---|---|---|
| P2-02 | Điểm danh buổi học | `/teaching/attendance` | ☐ PASS ☐ FAIL |
| P2-04 | Cung cấp bài tập PDF | `/teaching/exercises` | ☐ PASS ☐ FAIL |
| P2-06 | Chấm bài & cộng sao | `/teaching/grading` | ☐ PASS ☐ FAIL |
| P2-07 | Nhận xét (AI nháp, GV chốt) | `/teaching/session-assessment`, `/admin/report-cards` | ☐ PASS ☐ FAIL |
| P2-08 | Gửi ảnh & tóm tắt buổi cho PH | `/teaching/session-evidence`, `/parent/evidence/:studentId` | ☐ PASS ☐ FAIL |
| P3-03 | Đăng ký ca làm | `/hr/shifts` | ☐ PASS ☐ FAIL |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | ☐ PASS ☐ FAIL |
| P4-04 | Đặt lịch test đầu vào/định kỳ | `/crm/opportunities/:id` | ☐ PASS ☐ FAIL |

### Phụ huynh (`phu_huynh`) — 3 luồng

| # | Luồng | Màn cần đi qua | Kết quả |
|---|---|---|---|
| P1-06 | Liên kết phụ huynh–con | `/admin/parents` | ☐ PASS ☐ FAIL |
| P1-07 | Đăng nhập xem con | `/login`, `/parent/home` | ☐ PASS ☐ FAIL |
| P2-08 | Gửi ảnh & tóm tắt buổi cho PH | `/teaching/session-evidence`, `/parent/evidence/:studentId` | ☐ PASS ☐ FAIL |

### Học viên (`hoc_vien`) — 3 luồng

| # | Luồng | Màn cần đi qua | Kết quả |
|---|---|---|---|
| P2-03 | Mở bài tập theo tiến độ học | `/student/home`, `/student/exercise/:exerciseId` | ☐ PASS ☐ FAIL |
| P2-05 | Làm bài trên PDF & nộp | `/student/exercise/:exerciseId` | ☐ PASS ☐ FAIL |
| P4-01 | Đổi quà bằng sao | `/admin/engagement/rewards`, `/student/gifts` | ☐ PASS ☐ FAIL |

### Super admin (`super_admin`) — 5 luồng

| # | Luồng | Màn cần đi qua | Kết quả |
|---|---|---|---|
| ADM-01 | Quản trị cơ sở | `/admin/facilities` | ☐ PASS ☐ FAIL |
| ADM-02 | Quản trị tài khoản nhân sự | `/admin/users` | ☐ PASS ☐ FAIL |
| ADM-03 | Cấu hình mạng chấm công (IP) | `/admin/network-ip` | ☐ PASS ☐ FAIL |
| ADM-04 | Nhật ký hệ thống | `/admin/audit-log` | ☐ PASS ☐ FAIL |
| ADM-05 | Cấu hình ca làm | `/admin/shift-config` | ☐ PASS ☐ FAIL |

## 6. Bảng đếm row (bước 2 và 8 phải khớp nhau)

🔴 **Phải chạy bằng role `postgres`, không phải `cmc_app`.** 5/7 bảng bật RLS `facility_isolation` + FORCE (migration `20260706054322_p1_remediation_wave1_schema_rls`, `20260707190000_force_rls_on_rls_tables`). Chạy bằng `cmc_app` mà không set GUC facility ⇒ **count trả 0 không báo lỗi**, ở cả bước 2 lẫn bước 8 ⇒ "sạch = sạch" luôn đúng và chốt canh rủi ro duy nhất của runbook này trở thành vô nghĩa.

```bash
docker exec cmcv2-prod-postgres-1 psql -U postgres -d cmc_prod -c "<SQL bên dưới>"
```

```sql
SELECT 'Facility' t, count(*) FROM "Facility"
UNION ALL SELECT 'Student', count(*) FROM "Student"
UNION ALL SELECT 'ParentAccount', count(*) FROM "ParentAccount"
UNION ALL SELECT 'Receipt', count(*) FROM "Receipt"
UNION ALL SELECT 'AppUser', count(*) FROM "AppUser"
UNION ALL SELECT 'Enrollment', count(*) FROM "Enrollment"
UNION ALL SELECT 'ClassBatch', count(*) FROM "ClassBatch" ORDER BY 1;
```

Trạng thái đo 2026-07-22 (trước UAT): Facility=1, mọi bảng còn lại = 0.

## 7. KHÔNG đưa vào UAT — và vì sao

| Hạng mục | Lý do |
|---|---|
| **P1-08 Huỷ phiếu / hoàn tiền** | `/finance/refund` là **màn giữ chỗ** (EmptyState). Sổ nghiệm thu đã hạ khỏi `built` ngày 2026-07-22. Không test cái chưa xây |
| Luồng actor `he_thong` (4) | Side-effect nội bộ (provisioning, worker) — nghiệm bằng quan sát kết quả, không có người đóng vai |
| Luồng actor `agent` (2) | Tác vụ tự động |

## 8. 🔴 CHẶN — phải giải quyết TRƯỚC khi xếp lịch UAT

**2 luồng KHÔNG có actor hợp lệ nào: P3-01 (chấm công), P4-03 (họp phụ huynh).**

*(Đính chính sau red-team: P3-02 và P4-01 tuy cũng khai `nhan_vien` nhưng còn có đồng-actor hợp lệ — `giam_doc_kinh_doanh`/`giam_doc_dao_tao`, `hoc_vien` — nên đã nằm trong §5. Chỉ P3-01 và P4-03 là thuần `nhan_vien`.)*

⚠️ Hệ quả nguy hiểm: P3-01 và P4-03 **không có dòng nào trong §5**, nên tiêu chí "mọi dòng §5 PASS" ở §9 **có thể thoả trong khi chưa ai chấm công lần nào**. Vì vậy §9 có mục riêng bắt buộc giải quyết §8.

`nhan_vien` **không tồn tại** trong `@cmc/auth` (`ROLES` chỉ có 9 vai: super_admin, giam_doc_kinh_doanh, giam_doc_dao_tao, sale, giao_vien, ke_toan, cskh, ctv_mkt, hr), cũng không có trong Prisma `enum Role` lẫn dữ liệu.

⇒ **Không thể phân công ai test 4 luồng này.** Đây là F6 của plan `260722-0908`, nêu từ 2026-07-22 và **chưa ai trả lời**.

Cần PO chốt actor thật cho từng luồng trước khi UAT. Gợi ý suy từ registry (cần xác nhận, không tự quyết):

| Luồng | Suy từ quyền | Ghi chú |
|---|---|---|
| P3-01 | 4 vai có `checkIn.punch` (GĐKD/GĐĐT/sale/GV) | Chấm công — mọi nhân viên |
| **P3-02** | **khó nhất** — `manualPunch.resubmit` cố ý **không có** registry key, dùng owner-check | Chủ phiếu tự gửi lại; actor = chính người bị từ chối |
| P4-01 | 3 vai có `rewards.manage` (GĐKD/GĐĐT/sale) | |
| P4-03 | 3 vai có `parentMeeting.manage` (GĐKD/GĐĐT/sale) | |

## 8b. 🟠 NGHI LỖI CHẶN THỨ 4 — P2-04 với vai `giao_vien`

Manifest khai P2-04 ("Cung cấp bài tập PDF") có actor `giao_vien`. Nhưng **cả 5 procedure** của luồng gate `exercise.manage`, mà key đó **chỉ có `giam_doc_dao_tao`** (`packages/auth/src/index.ts:96`). Nav entry `/teaching/exercises` cũng gate cùng key (`apps/admin/src/shell/nav-registry.ts:28`).

⇒ **`giao_vien` không thấy menu và không gọi được procedure nào của luồng mình được khai là actor.** Đây đúng hình dạng F1/F2. Runtime capture báo `0 denied` **chính vì** nav không render ⇒ không phát sinh request ⇒ capture mù — đúng giới hạn đã công bố.

Đây là **F5 của plan `260722-0908`**, nêu 2026-07-22 và **chưa ai xử lý**.

**Cần PO chốt trước UAT** (không tự quyết): giáo viên *có* phải người ra đề bài tập không?
- Nếu **có** → thiếu quyền, phải sửa registry (giống F1/F2) rồi mới UAT.
- Nếu **không** → manifest sai actor, sửa manifest và bỏ dòng P2-04/`giao_vien` khỏi §5.

Trong lúc chưa chốt: **đánh dấu dòng P2-04 của `giao_vien` là BLOCKED**, đừng để người test tự kết luận "hệ thống hỏng".

## 9. Tiêu chí Go/No-Go

- [ ] Mọi dòng checklist §5 **PASS** (FAIL nào cũng phải có phán quyết: chặn GO hay chấp nhận có điều kiện)
- [ ] Email Brevo ≥1 và Graph ≥1 gửi thật thành công
- [ ] Staff đăng nhập **Entra thật**, nav hiện đúng theo vai
- [ ] **Bước 0 REDEPLOY đã chạy**; commit đang chạy trên prod = `main` tại thời điểm UAT (ghi hash vào biên bản)
- [ ] §8 đã giải quyết: P3-01 và P4-03 có actor thật, **đã test** hoặc được PO loại khỏi phạm vi **có ghi lý do**
- [ ] §8b đã có phán quyết PO cho P2-04/`giao_vien` (sửa quyền, hoặc sửa manifest) — không để treo
- [ ] Bước 9 xong: **đăng nhập được** sau reset (nếu không, DB "sạch" là DB chết)
- [ ] Bước 7–8 xong: đếm row sau = trước, **đếm bằng role `postgres`** ⇒ DB sạch cho go-live
- [ ] Biên bản ký; nếu NO-GO: teardown + huỷ secret theo phase-04

## Câu hỏi chưa giải

1. Actor thật của 4 luồng `nhan_vien` (§8) — **chặn lịch UAT**.
2. Ai đóng vai gì: cần ≥1 người cho mỗi vai trong §5, gồm cả phụ huynh và học viên thật.
3. Có cần UAT `super_admin` (5 luồng) bằng người, hay coi là quản trị nội bộ và nghiệm bằng ảnh chụp?
