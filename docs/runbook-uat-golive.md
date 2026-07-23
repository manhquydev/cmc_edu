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

67 luồng-vai, sinh từ sổ nghiệm thu (đồng bộ 2026-07-23 sau khi sửa actor manifest). Một luồng xuất hiện ở nhiều vai nghĩa là mỗi vai phải tự đi.

⚠️ **Đọc cột "Màn cần đi qua" cho đúng.** Cột này liệt kê mọi màn của *luồng*, không phải màn của *vai đó*. Ví dụ P1-06 gồm `/admin/parents` — đó là màn nhân viên duyệt, **phụ huynh không vào**. Người test chỉ đi phần thuộc vai mình; phần của vai khác do người khác đi (xem §4.2).

⚠️ **Một số màn không có nav entry** (`/finance/new`, `/finance/class-placement`, `/admin/courses`, các màn engagement — `apps/admin/src/routes/admin.routes.tsx:66-68`, `:78-79`). Với các dòng này, luật §4.3 "vào bằng menu" **không áp dụng**; ghi rõ vào biên bản là đã vào bằng URL, và **bản thân việc không tìm được lối vào qua menu là một phát hiện UX cần ghi**.

### Sale (`sale`) — 13 luồng

| # | Luồng | Màn của luồng | Tiền đề (vai khác phải làm trước) | Người test | Giờ | Kết quả |
|---|---|---|---|---|---|---|
| P1-01 | Quản lý phễu tuyển sinh (O1→O5) | `/crm`, `/crm/opportunities/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-02 | Tạo phiếu học phí từ cơ hội | `/finance/new` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-05 | Kích hoạt ghi danh khi đóng phí | `/admin/students`, `/admin/students/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-06 | Liên kết phụ huynh–con | `/admin/parents` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-01 | Chấm công cặp vào/ra mỗi ngày | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-02 | Duyệt phiếu chấm công offsite | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-03 | Đăng ký ca làm | `/hr/shifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-01 | Đổi quà bằng sao | `/admin/engagement/rewards`, `/student/gifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-03 | Lên lịch & nhắc họp PH | `/crm/post-sale-meeting` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-04 | Đặt lịch test đầu vào/định kỳ | `/crm/opportunities/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-05 | Chăm sóc sau bán | `/crm/aftersale` | | | | ☐ PASS ☐ FAIL ☐ N/A |

### GĐ Kinh doanh (`giam_doc_kinh_doanh`) — 15 luồng

| # | Luồng | Màn của luồng | Tiền đề (vai khác phải làm trước) | Người test | Giờ | Kết quả |
|---|---|---|---|---|---|---|
| P1-03 | Duyệt phiếu kích hoạt học viên | `/finance`, `/finance/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-05 | Kích hoạt ghi danh khi đóng phí | `/admin/students`, `/admin/students/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-06 | Liên kết phụ huynh–con | `/admin/parents` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-01 | Chấm công cặp vào/ra mỗi ngày | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-02 | Duyệt phiếu chấm công offsite | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-04 | Duyệt ca | `/hr/shifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-05 | Chốt lương tháng theo bậc lương | `/hr/payroll`, `/hr/salary-tiers`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-07 | Từ chối đăng ký ca (kèm lý do) | `/hr/shifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-08 | Tất toán KPI hàng loạt (branch-scope) | `/hr/kpi` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-01 | Đổi quà bằng sao | `/admin/engagement/rewards`, `/student/gifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-02 | Cấu hình quà đổi sao | `/admin/engagement/gifts`, `/admin/engagement/rewards` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-03 | Lên lịch & nhắc họp PH | `/crm/post-sale-meeting` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-05 | Chăm sóc sau bán | `/crm/aftersale` | | | | ☐ PASS ☐ FAIL ☐ N/A |

### GĐ Đào tạo (`giam_doc_dao_tao`) — 18 luồng

| # | Luồng | Màn của luồng | Tiền đề (vai khác phải làm trước) | Người test | Giờ | Kết quả |
|---|---|---|---|---|---|---|
| P1-03 | Duyệt phiếu kích hoạt học viên | `/finance`, `/finance/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-05 | Kích hoạt ghi danh khi đóng phí | `/admin/students`, `/admin/students/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-06 | Liên kết phụ huynh–con | `/admin/parents` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-09 | Giám sát bất thường tài chính | `/ops/recon` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-01 | Tạo lớp tự sinh lịch buổi | `/admin/classes`, `/admin/classes/:id` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-04 | Cung cấp bài tập PDF | `/teaching/exercises` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-01 | Chấm công cặp vào/ra mỗi ngày | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-02 | Duyệt phiếu chấm công offsite | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-04 | Duyệt ca | `/hr/shifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-05 | Chốt lương tháng theo bậc lương | `/hr/payroll`, `/hr/salary-tiers`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-07 | Từ chối đăng ký ca (kèm lý do) | `/hr/shifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-08 | Tất toán KPI hàng loạt (branch-scope) | `/hr/kpi` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-01 | Đổi quà bằng sao | `/admin/engagement/rewards`, `/student/gifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-02 | Cấu hình quà đổi sao | `/admin/engagement/gifts`, `/admin/engagement/rewards` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-03 | Lên lịch & nhắc họp PH | `/crm/post-sale-meeting` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-05 | Chăm sóc sau bán | `/crm/aftersale` | | | | ☐ PASS ☐ FAIL ☐ N/A |

### Giáo viên (`giao_vien`) — 10 luồng

| # | Luồng | Màn của luồng | Tiền đề (vai khác phải làm trước) | Người test | Giờ | Kết quả |
|---|---|---|---|---|---|---|
| P1-06 | Liên kết phụ huynh–con | `/admin/parents` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-02 | Điểm danh buổi học | `/teaching/attendance` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-06 | Chấm bài & cộng sao | `/teaching/grading` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-07 | Nhận xét (AI nháp, GV chốt) | `/teaching/session-assessment`, `/admin/report-cards` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-08 | Gửi ảnh & tóm tắt buổi cho PH | `/teaching/session-evidence`, `/parent/evidence/:studentId` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-01 | Chấm công cặp vào/ra mỗi ngày | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-02 | Duyệt phiếu chấm công offsite | `/hr/checkin` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-03 | Đăng ký ca làm | `/hr/shifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-06 | Nộp & duyệt phiếu KPI (auto-score) | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P3-09 | Tính lại điểm KPI tự động | `/hr/kpi`, `/hr/my` | | | | ☐ PASS ☐ FAIL ☐ N/A |

### Phụ huynh (`phu_huynh`) — 3 luồng

| # | Luồng | Màn của luồng | Tiền đề (vai khác phải làm trước) | Người test | Giờ | Kết quả |
|---|---|---|---|---|---|---|
| P1-06 | Liên kết phụ huynh–con | `/admin/parents` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P1-07 | Đăng nhập xem con | `/login`, `/parent/home` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-08 | Gửi ảnh & tóm tắt buổi cho PH | `/teaching/session-evidence`, `/parent/evidence/:studentId` | | | | ☐ PASS ☐ FAIL ☐ N/A |

### Học viên (`hoc_vien`) — 3 luồng

| # | Luồng | Màn của luồng | Tiền đề (vai khác phải làm trước) | Người test | Giờ | Kết quả |
|---|---|---|---|---|---|---|
| P2-03 | Mở bài tập theo tiến độ học | `/student/home`, `/student/exercise/:exerciseId` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P2-05 | Làm bài trên PDF & nộp | `/student/exercise/:exerciseId` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| P4-01 | Đổi quà bằng sao | `/admin/engagement/rewards`, `/student/gifts` | | | | ☐ PASS ☐ FAIL ☐ N/A |

### Super admin (`super_admin`) — 5 luồng

| # | Luồng | Màn của luồng | Tiền đề (vai khác phải làm trước) | Người test | Giờ | Kết quả |
|---|---|---|---|---|---|---|
| ADM-01 | Quản trị cơ sở | `/admin/facilities` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| ADM-02 | Quản trị tài khoản nhân sự | `/admin/users` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| ADM-03 | Cấu hình mạng chấm công (IP) | `/admin/network-ip` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| ADM-04 | Nhật ký hệ thống | `/admin/audit-log` | | | | ☐ PASS ☐ FAIL ☐ N/A |
| ADM-05 | Cấu hình ca làm | `/admin/shift-config` | | | | ☐ PASS ☐ FAIL ☐ N/A |

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

## 8b. ✅ P2-04 — ĐÃ CÓ PHÁN QUYẾT (2026-07-22)

Manifest từng khai `giao_vien` là actor của P2-04, nhưng cả 5 procedure gate `exercise.manage` — chỉ GĐĐT. **PO chốt: chỉ GĐĐT ra đề bài tập** ⇒ manifest khai sai actor, **không** nới quyền. Đã sửa `flow-manifest.ts`; dòng P2-04/`giao_vien` đã biến mất khỏi §5.

## 8c. ✅ Audit actor↔permission — ĐÃ SẠCH (2026-07-23)

`pnpm acceptance:report` kèm `actor-audit`. Sau đợt sửa manifest:

```
actor-audit — 0 phát hiện (0 vai không tồn tại, 0 actor không làm được gì,
0 procedure không actor nào gọi được); 26 procedure ngoài tầm registry,
2 (luồng, vai) không kết luận được
```

Từ **26 → 0**. Nguyên nhân gốc: `nhan_vien` là **lỗi dịch** — TL25 viết "nhân viên" nghĩa là nhân sự nói chung, người soạn manifest biến thành mã vai không tồn tại. **Không nới quyền nào.**

⚠️ **Hai giới hạn phải đọc là "chưa phủ", KHÔNG phải "sạch":**
- **26 procedure ngoài tầm registry** (owner-check, `lmsProcedure`, public) — audit không kết luận được.
- **2 (luồng, vai) không kết luận được**: P3-02 với `sale`/`giao_vien`. Họ tham gia qua `manualPunch.resubmit` + `list` — cả hai là owner-check không có gate. Audit chỉ nhìn procedure có gate nên không khẳng định được; nó **đếm** thay vì kết luận sai.

## 8d. Điều kiện tiên quyết từ Phase 4 mà bản đầu bỏ sót (M1)

| Yêu cầu | Nguồn | Trạng thái |
|---|---|---|
| 🔴 **Brevo key phải rotate + verify TRƯỚC bước 5** | `phase-04:104-106` | Key trả **401 Key not found** (2026-07-10) và **chưa từng có email Brevo thật gửi thành công end-to-end**. Không rotate ⇒ bước 5 chắc chắn fail |
| Chạy lại e2e **sau** redeploy | `phase-04:117` | Thêm vào §3 giữa bước 0 và 1 |
| Verify PII-guard reject | `phase-04:22` | Cần 1 dòng test riêng, chưa có trong §5 |
| AI draft bằng LLM thật | `phase-04:22` | Ẩn trong P2-07, phải nêu thành điều kiện |
| NO-GO: xoá dump R2 + revoke token | `phase-04:65` | Bước 1 của runbook này **upload dump lên R2** ⇒ nếu NO-GO phải xoá đúng object đó |
| Tracker #9 + changelog | `phase-04:121` | Cập nhật sau khi ký biên bản |

**Không đặc tả lại backup/restore ở đây** — dùng `docs/runbook-deploy.md` §2.5 (backup), §1.7/§2.6 (restore), §6 (checklist bảo mật trước go-live). Runbook này chỉ nói phần *khác* với vận hành thường ngày. *(M3: trên VPS thật `postgres` không map port ra host — mọi lệnh psql/pg_dump chạy qua `docker exec`, xem `runbook-deploy.md:49-56`.)*

## 9. Tiêu chí Go/No-Go

- [ ] Mọi dòng checklist §5 **PASS** hoặc **N/A có lý do ghi rõ**. FAIL phải có phán quyết bằng văn bản của PO.
      **Trần cứng: ≤ 3 dòng "chấp nhận có điều kiện"**, và không dòng nào thuộc cụm P1 (luồng tiền). Vượt trần ⇒ **NO-GO**, không thương lượng.
- [ ] Email Brevo ≥1 và Graph ≥1 **vào tới hộp thư người nhận** — bằng chứng là **ảnh chụp hộp thư**, không phải mã 2xx của transport (lịch sử: key Brevo 401 suốt từ 2026-07-10)
- [ ] e2e chạy lại **sau** redeploy, xanh (`phase-04:117`)
- [ ] PII-guard reject đã verify; AI draft chạy bằng LLM thật
- [ ] Staff đăng nhập **Entra thật**, nav hiện đúng theo vai
- [ ] **Bước 0 REDEPLOY đã chạy**; commit đang chạy trên prod = `main` tại thời điểm UAT (ghi hash vào biên bản)
- [ ] §8 đã giải quyết: P3-01 và P4-03 có actor thật, **đã test** hoặc được PO loại khỏi phạm vi **có ghi lý do**
- [ ] §8c: **P4-04/`giao_vien`** đã có phán quyết PO (cùng dạng P2-04) — không để treo
- [ ] §8c: 21 `unreachable-procedure` đã được phân loại (sửa manifest / sửa quyền / chấp nhận có lý do)
- [ ] Bước 9 xong: **đăng nhập được** sau reset (nếu không, DB "sạch" là DB chết)
- [ ] Bước 7–8 xong: đếm row sau = trước, **đếm bằng role `postgres`** ⇒ DB sạch cho go-live
- [ ] Biên bản ký; nếu NO-GO: teardown + huỷ secret theo phase-04

## Câu hỏi chưa giải

1. Actor thật của 4 luồng `nhan_vien` (§8) — **chặn lịch UAT**.
2. Ai đóng vai gì: cần ≥1 người cho mỗi vai trong §5, gồm cả phụ huynh và học viên thật.
3. Có cần UAT `super_admin` (5 luồng) bằng người, hay coi là quản trị nội bộ và nghiệm bằng ảnh chụp?
