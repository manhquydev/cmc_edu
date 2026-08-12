# J1 — Khai thác docs/ CMC LMS (quyết định + luật + lệch)

Nguồn: `/home/manhquy/Downloads/cmc-lms/docs/*` (+ đối chiếu code khi ghi `LỆCH`).
Chỉ đọc. Không suy diễn ngoài tài liệu/code đã kiểm. Ngày đọc: 2026-08-12.

---

## 0. Bản đồ tài liệu (ai là authority)

| File | Vai trò | Ghi chú |
|---|---|---|
| `docs/class-unit-spec.md` (328 dòng) | **Hợp đồng nghiệp vụ lõi** lớp/unit/ghi danh/bài/điểm danh | Chốt 27/07, vá nhiều lần tới 08/08 |
| `docs/architecture.md` | Stack, auth, schema prune, file-store, port map | Auth family cập nhật 07/08; UI Astryx xong 09/08 |
| `docs/auth-model.md` | Chỉ còn quyết định 0032 (mật khẩu mặc định chung) | Phần lớn đã trỏ sang architecture §Auth |
| `docs/role-matrix.md` | Phạm vi năng lực 4 vai trò + trạng thái build | Header 07/08 gộp HS+PH; bảng vẫn tách cột HS/PH |
| `docs/migration.md` | Hợp đồng migrate chọn lọc + trạng thái cutover | Prod LIVE ~30/07 |
| `docs/project-overview.md` | Ý định + non-goals + thuật ngữ | Có **lỗi thuật ngữ unit cũ** (xem LỆCH) |
| `docs/WORKFLOW.md` | Quy trình agent/Harness | Generic, không chứa vụ LMS |
| `docs/README.md` | Map Harness docs | Generic scaffold |
| `docs/decisions/README.md` | Index ADR | **Trống** — chưa có decision file local |
| `docs/product/README.md` | Product docs scaffold | **Trống** — không có contract consumer |
| `docs/design-system.md` (ngoài list chính) | UI tokens; §1–7 = lịch sử Mantine | §8: Mantine gỡ 09/08; authority = code theme |

**Authority thực tế cho merge ERP:** `class-unit-spec` + `architecture` §Auth + `role-matrix` header 07/08 + code (`packages/domain/src/unit-progression.ts`, `apps/api/src/auth/sessions.ts`). `docs/decisions/` và `docs/product/` **không** chứa quyết định thật.

---

## 1. `docs/class-unit-spec.md` — luật nghiệp vụ lõi

### 1.1 Khung chương trình (CSV)

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Nguồn sự thật = CSV `docs/CMC_EDU_Khung_Chuong_Trinh.csv`; admin v1 **chỉ xem**, sửa = CSV + reseed | — | 27/07 | `class-unit-spec.md:9-12` |
| 3 CT: UCREA 36u 90'/buổi; Bright I.G 18u 110'; Black Hole 42u 110' | — | 27/07 | `:14-15` |
| 1 `unit_code` = **1 tháng học = 4 buổi** | — | 27/07 | `:16` |
| `order_global` = **1 dãy xuyên 3 CT** (U 1–36, Bright 37–54, BH 61–102); API phải filter theo `courseId`, không tin số liền kề | Tránh nhảy chéo CT; lỗ 55–60 giữa CT vô hại | 27/07 | `:16-27` |
| Trong 1 course `order_global` **liền mạch**; seeder `compactOrderGlobal`; check `pnpm --filter @cmc/db check:curriculum` | session-generator ném lỗi khi lỗ | 27/07 | `:23-31` |
| Đổi `order_global` = đổi quyền đã bán (`EnrollmentUnitRange` lưu **SỐ**) | Cổng `assertOrderGlobalStable` | 27/07+ | `:28-30` |
| Bài tập **KHÔNG** gắn unit/lesson (đảo hệ cũ `Exercise.curriculumUnitId`) | Chốt riêng mục 8 | 27/07 | `:35-37` |

### 1.2 Tạo lớp (ADMIN)

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Form: CT + unit bắt đầu + lịch tuần (nhiều dòng: thứ/giờ/GV) + ngày KG + ghi chú | Lớp không bắt buộc từ đầu khung | 27/07 | `:39-48` |
| Mã lớp tự sinh `CMC-YY-NNNN` (STT reset theo năm); không gắn CT/cơ sở; không sửa | — | 27/07 | `:50-52` |
| **Loại khỏi v1:** sĩ số max, phòng, tên lớp tay, GV phụ, ngày kết thúc | Đã cân nhắc loại | 27/07 | `:53-55` |
| Trạng thái lớp: **đang chạy / đã đóng** — **không** "tạm dừng" | Thực tế lớp luôn chạy (D2) | 27/07 | `:57-59` |
| Đóng lớp: cảnh báo nếu còn HS còn unit chưa dùng | Admin thu hồi/add lớp khác trước | 27/07 | `:58-59` |
| **Hủy lớp** = xóa mềm (khác Đóng); khôi phục được; tab "Đã hủy" | Tạo nhầm vs kết thúc khóa | 01/08 | `:60-65` |
| Sửa ghi chú mọi lúc; ngày KG + unit bắt đầu **chỉ khi CHƯA sinh buổi** | Chặn 2 bug: cửa sổ sinh buổi + unit nhảy vọt | 01/08 | `:66-70` |
| Cho phép ngày KG quá khứ (nhập bù/migrate) | Buổi quá khứ sinh để điểm danh bù (M2) | 27/07 | `:71-72` |

### 1.3 Unit theo SỐ BUỔI (thay mùng 1) — **ĐỌC KỸ NHẤT**

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Unit nhảy sau **đúng 4 buổi hợp lệ**, **KHÔNG theo tháng lịch** | Mỗi unit=4 buổi; nghỉ/hủy không được làm lớp "nhảy unit khi chưa học đủ" | **01/08** thay M3 cũ | `:74-82` |
| "buổi hợp lệ" = **không bị hủy**; buổi tương lai planned **vẫn đếm** | — | 01/08 | `:81-82` |
| **Lùi buổi:** hủy 1 buổi → buổi tương lai kế thừa vị trí; đủ 4 hợp lệ mới nhảy | Cùng khuôn con trỏ bài 1:1 (4 buổi=1 unit=4 bài) | 01/08 | `:83-86` |
| Derive từ bản ghi buổi + neo `(unit_neo, ngày_neo)`: non-cancelled thứ k → `unit_neo + floor(k/4)` | Cron chết **không** sai unit (E10); cron chỉ sinh buổi + phát bài | 01/08 | `:87-91` |
| Buổi **đã điểm danh** + buổi **quá khứ đã có unit** = **đóng băng**; lùi chỉ re-stamp **tương lai chưa điểm danh** | Tránh roster/điểm danh mồ côi | 01/08 | `:92-95` |
| Admin chỉnh unit hiện tại = neo mới (unit chọn, **hôm nay**); ghi RecordEvent | Nghỉ dài (Tết): **chỉ hủy buổi**, không cần chỉnh tay | 01/08 | `:96-100` |
| **realignHistory** (migrate): trỏ 1 buổi mốc non-cancelled = "buổi P (1–4) của unit U"; **Pha≠0 từ chối**; force restamp cả quá khứ đã điểm danh; preview→confirm; chỉ lớp running | Phá đóng băng có kiểm soát — **không** dùng hằng ngày | **08/08** | `:101-113` |
| Hết unit cuối: ngừng sinh buổi + báo admin đóng; buổi tương lai vượt trần bị hủy | — | 01/08 | `:114-115` |

**Code khớp:** `packages/domain/src/unit-progression.ts:1-15` (`SESSIONS_PER_UNIT=4`, `deriveSessionUnits`); `apps/api/src/services/session-generator.ts:7-12` comment "Unit KHÔNG còn suy theo tháng".

### 1.4 Buổi học + hủy + **buổi bù**

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Sinh tự động từ KG theo lịch tuần; số buổi 1,2,3… liên tục | — | 27/07 | `:117-120` |
| Sinh cuốn chiếu 1–2 tháng trước (không sinh hết khung) | Black Hole = 42 tháng | 27/07 | `:125-126` |
| Nghỉ lễ: **không** lịch nghỉ riêng — ADMIN **hủy buổi** | — | 27/07 | `:128-129` |
| Hủy buổi = **admin-only**, GV không hủy | Chốt gỡ mâu thuẫn role-matrix | **28/07** | `:129-130` |
| Sửa khung lịch: đổi giờ KT/GV tại chỗ; đổi thứ/giờ BD = xóa khung cũ + tạo mới 1 thao tác, preview số buổi hủy | Tránh nửa chừng | 01/08 | `:131-136` |
| **KHÔNG có buổi bù** | Hệ chỉ: sinh theo lịch tuần **hoặc** hủy. HS nghỉ → cơ sở sắp **ngoài hệ**; vẫn nhận bài (vẫn trong roster). Muốn dạy thêm → thêm khung lịch tuần | **28/07** | `:137-145` |
| Bỏ buổi bù an toàn vì hủy **làm chậm tiến độ unit** (đủ 4 hợp lệ) — "nợ buổi" xử bằng lùi | Không cần entity makeup | 28/07+01/08 | `:142-145` |
| Hệ quả: GV nghỉ đột xuất phải báo ADMIN **trong ngày** (cron phát bài lúc hết giờ; hủy sau khi có nộp thì không thu hồi được) | — | 28/07 | `:146-148` |
| Hủy buổi → nhật ký **rút khỏi PH/HS** (kể cả đã publish); ẩn lúc đọc, không xóa; GV/ADMIN vẫn xem nháp | Bỏ hủy nhầm = khôi phục nguyên | **31/07** | `:149-153` |

**Code khớp buổi bù:** schema **không** còn `isMakeup`/`makeupOfSessionId` (grep packages/db = 0); plan ghi migration `20260728070000_drop_makeup_sessions`.

### 1.5 Tạo HS+PH / ghi danh / lifecycle

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Tạo HS+PH **tách** ghi danh; form không chọn lớp | — | 27/07 | `:155-157` |
| PH: SĐT unique = tên đăng nhập; email bắt buộc; gắn PH cũ theo SĐT (con 2 chung TK) | — | 27/07 | `:161-165` |
| Mật khẩu mặc định chung 0032; loginCode = mã HS, **sinh ngầm không quảng bá** | Login chính = SĐT PH | 27/07 | `:166-169` |
| Ghi danh: dãy unit **liên tục** từ unit hiện tại **hoặc tương lai**; validate lúc add (E4) | HS vào cuối tháng không mất unit dở | 27/07 | `:174-184` |
| Ngoại lệ **grantPast** cấp bù unit đã qua: preview + chống lệch hash | Migrate/nhập bù | 01/08 | `:181-184` |
| **Roster theo unit CỦA TỪNG BUỔI** (D1), không theo unit hiện tại lớp | Lịch sử không đổi khi lớp sang unit mới | 27/07 | `:185-189` |
| Hết unit → ẩn roster; lịch sử giữ; `Enrollment.status` chỉ migrate, **không** cổng roster | Học tiếp = add dãy mới (cho phép hở M4) | 27/07 | `:190-195` |
| Lifecycle `on_hold/withdrawn/transferred` ẩn điểm danh/nhật ký/phát bài; `completed` **không** ẩn | 3 cổng: lifecycle + unit-range + `Enrollment.archivedAt` | 28/07 | `:196-202` |
| Gỡ khỏi 1 lớp (`archivedAt`): hiệu lực **từ hôm sau**; quá khứ giữ; unarchive được; add lại = hồi sinh | **Quá khứ THÊM được, BỚT thì không** | 01/08 | `:203-224` |
| Thu hồi unit (D3): cắt từ unit **kế tiếp** (v1 không cắt unit đang học); lý do + RecordEvent | Nghỉ ngang/hoàn phí ngoài hệ | 27/07 | `:213-215` |
| Chuyển lớp = archive lớp cũ + add lớp mới | Bảo toàn lịch sử | 27/07 | `:227-228` |
| GV trùng lịch: **cảnh báo nhưng cho lưu** (D4) | Ca cố ý xếp chồng | 27/07 | `:229-230` |

### 1.6 Log Note / Bài tập / Điểm danh

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Log Note: yêu cầu đã nhận; **schema phải duyệt trước khi code**; pilot trang chi tiết HS (không phải lớp) | Dùng chung nhiều model; không ảnh hưởng perf | 27/07 | `:232-248` |
| Thư viện 1 cấp, 1 PDF=1 bài; thang điểm 10 + 10 sao **hằng số domain**, không config DB | Import hàng loạt không chặn admin | 28/07 | `:250-277` |
| Xóa file = **ẩn**, không xóa đĩa (sha256 dùng chung) | Tránh hỏng lớp khác | 27/07 | `:273-276` |
| Gán thư mục lớp: thứ tự **đóng băng lúc gán** | Cùng lỗi orderGlobal nếu dãy sống theo thư viện | 27/07 | `:278-287` |
| **1 bài/buổi**; mốc phát = **hết giờ buổi** (cron); **không** nút phát tay GV | GV quên bấm → HS không có bài | 28/07 | `:289-296` |
| Hủy buổi **không tiêu bài** (dồn sang buổi kế); hủy sau khi phát → thu hồi nếu chưa ai nộp | — | 28/07 | `:297-303` |
| Ai nhận bài = roster buổi (D1), kể cả vắng | Hết unit → không nhận mới, giữ bài cũ | 27/07 | `:304-308` |
| Điểm danh: GV **của buổi** + ADMIN; phase copy `attendance-window.ts` | Tin cậy số chuyên cần PH | 27/07 | `:317-322` |
| Nhật ký publish **vẫn sửa được** + RecordEvent; max 20 ảnh/buổi, 10MB/ảnh | GV hay sai tên/thiếu ảnh sau đăng | 27/07 | `:323-326` |

---

## 2. `docs/architecture.md` — quyết định kiến trúc

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Monorepo: `apps/web` + `apps/api` + `packages/{db,domain}` | — | — | `architecture.md:3-14` |
| UI: React19+Vite+**Astryx+Tailwind v4**; Mantine **gỡ 09/08** | Chốt 30/07; xong 09/08 | 30/07–09/08 | `:12-14` |
| Backend giữ Hono+tRPC+Prisma/Postgres (hệ cũ) | Quyết định khóa | 26–27/07 | `:12-13` |
| Session 1 cookie: `kind: family \| teacher \| admin` | — | 07/08 | `:21` |
| Family: **SĐT+MK** → session **mọi con**; Netflix switch client-side; **không** OTP/parent/student tách/ticket/`loginCode` login | Rủi ro máy dùng chung **chấp nhận, không PIN** (đảo 0033 D4) | **07/08** | `:25-36` |
| Phân quyền: bỏ registry 9 role + facility RLS → guard `kind` + ownership tRPC | — | 26–27/07 | `:38-40` |
| GV/ADMIN quên MK tự phục vụ (JWT HMAC `tokenVersion`, Brevo) | Mới so CMCnew | 31/07 | `:42-50` |
| Schema: prune ~26 bảng ERP; bỏ `facilityId`/RLS; giữ ledger sao, Guardian, Enrollment… | — | — | `:52-64` |
| File-store: content-addressed sha256, **driver đĩa only** (bỏ S3) | 1 môi trường: dev local = server thật | **27/07** | `:66-75` |
| Port nguyên hành vi; không import finance/payroll/crm | Grep = 0 ngoài docs | — | `:89-95` |
| Lỗi tRPC chuẩn 1 điểm: errorFormatter + mapPrismaNotFound P2025 | Không bọc Zod lẻ client | — | `:97-111` |

**Code khớp auth:** `sessions.ts` chỉ `loginFamilyByPhone` + `loginStaff`; test xác nhận OTP/studentLogin/setChildPassword **đã gỡ** (`auth-family-login.int.test.ts:196-204`).

---

## 3. `docs/auth-model.md` — mật khẩu mặc định 0032

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Doc này **không** còn mô tả 3 cửa login (family/loginCode/OTP) — đã bỏ | Trỏ sang architecture §Auth | 07/08 | `auth-model.md:1-7` |
| 0032: cùng MK mặc định ghi `ParentAccount.passwordHash` (+ `StudentAccount.passwordHash` dù HS **không** còn đường login) | — | 27/07 giữ | `:9-15` |
| Dev: `Cmc2026@`; prod: `DEFAULT_STUDENT_PASSWORD` **bắt buộc**, fail-fast boot | — | — | `:17-20` |
| Đổi env chỉ ảnh hưởng TK **mới**; rotate bulk = script idempotent, không log secret | — | — | `:21-25` |

---

## 4. `docs/role-matrix.md` — vai trò + phạm vi v1

### 4.1 Mô hình tài khoản (header 07/08) — **ĐÃ CHỐT**

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| HS+PH khu `/` = **1 vai trò gia đình** `kind:'family'` | SĐT+MK; chọn con Netflix | **07/08** | `role-matrix.md:2-11` |
| **Đã gỡ:** Email-OTP, phiên `parent`, `ParentApp`, `setChildPassword`/`childLoginInfo` | Con không còn credential riêng | 07/08 | `:7-8` |
| Family tự phục vụ MK: đổi (cần MK hiện tại) + quên email | — | 07/08 | `:9` |
| **4 vai trò** vận hành: family (HS+PH gộp), GV, ADMIN — thực tế session kinds = 3 | AGENTS: đúng 4 vai trò (HS/PH/GV/ADMIN) nhưng HS+PH 1 credential | 26–27/07 + 07/08 | header + AGENTS |

### 4.2 Phân quyền tạo (đã chốt)

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| **ADMIN** toàn quyền tạo HS/PH/lớp | Đảo teacher-lite hệ cũ | 27/07 | `:69-72`, `:96` |
| GV **chỉ dạy**: lịch, điểm danh, chấm, nhật ký, đề xuất (v2) | — | 27/07 | `:69-83` |

### 4.3 Build status đáng nhớ

| Cụm | Trạng thái | Nguồn |
|---|---|---|
| Family: classes/attendance/journal/exercises/rewards(số dư)/đổi MK | ✅ v1 | `:29-55` |
| Đổi quà, huy hiệu, xếp hạng, lên cấp, họp PH, liên kết con, SSE | ⏳ **v2 CHƯA build** (UI **không** hiện — không tính năng ma) | `:36-39`, `:50-55`, `:63-67` |
| Log Note pilot | Admin-only trang HS; GV chờ thiết kế | `:81-82`, `:111` |
| Hủy/khôi phục lớp, archive HS, grantPast, realignHistory, lifecycle, khóa PH | ✅ v1 | `:93-104` |

### 4.4 Không mang ERP

Tài chính, CRM, lương, ca kíp, cockpit… — `role-matrix.md:114-118`.

---

## 5. `docs/migration.md` — quá trình chuyển đổi

| Giai đoạn | Nội dung | Ngày | Nguồn |
|---|---|---|---|
| **Hợp đồng** | Chỉ lớp **đang chạy**; bảo toàn hash MK + loginCode **chuỗi**; **toàn bộ** StarTransaction ledger | 27/07 | `migration.md:1-5`, `:17-24` |
| **Nhập** | HS/PH/Guardian, GV map từ AppUser, lớp running + enrollment/session/attendance, submission lớp running, badge/level, gift pending → 1 catalog | 27/07 | `:13-24` |
| **Bỏ** | ERP full; lớp đã đóng + lịch sử; staff ngoài GV/ADMIN; facility/RLS; redeem đã xong | 27/07 | `:26-33` |
| **Đối soát trước cắt** | Sao 20/20; PH login ≥10; **HS loginCode ≥10**; enrollment count; PH nhiều con ≥3 | 27/07 | `:35-41` |
| **Chuẩn bị 29/07** | Dump prod CMCnew → `cmc_old`; data thật nhỏ (3 HS, 1 lớp running có attendance) | 29/07 | `:43-50` |
| **Script** | `packages/db/src/seed-migrate.ts`; `MIGRATE=1 pnpm --filter @cmc/db seed:migrate`; cần seed curriculum trước; idempotent | 29/07 | `:61-68` |
| **Map unit** | Level khung cũ 12 vị trí → vị trí U{n} mới; hằng `CURRICULUM_START_UNIT`; lớp chưa map = **BLOCK** | 29/07 | `:75-83` |
| **Khung 31/07** | UCREA đổi nhãn U1.x→U2.x…; vị trí giữ | 31/07 | `:85-88` |
| **Bỏ submission cũ** | 3 bài 0 chấm — kiến trúc ExerciseFile mới không tương thích | **29/07 chốt** | `:90-94` |
| **LIVE** | Prod cmc-lms đã migrate ~30/07 | ~30/07 | `:7-11` |
| **Tồn đọng verify** | (1) 31 ảnh blob file-store rsync VPS; (2) GV/app_user + schedule_slot **không** migrate → teacherId trống, lớp không tự sinh buổi mới tới khi admin thêm khung | sau cutover | `:96-118` |
| **loginCode sau 07/08** | Vẫn giữ chuỗi làm **mã định danh**; thôi credential (ghi chú trong bảng Nhập) | 07/08 | `:17` |

---

## 6. `docs/project-overview.md`

| Nội dung | Lý do | Ngày | Nguồn |
|---|---|---|---|
| Tách LMS khỏi ERP vì 41 router / 71 bảng / 9 role / RLS / tạo HS qua phiếu thu | Scout report CMCnew | 26–27/07 | `:10-16` |
| Trade-off chấp nhận: write-new+port tốn hơn fork; bỏ đa cơ sở; bỏ ERP; 1 app 4 khu | — | 26–27/07 | `:21-28` |
| Non-goals: không finance/sync/đa cơ sở; v1 không sĩ số/phòng/tên lớp/trợ giảng/"chuyển lớp giữa chừng" | Tham chiếu class-unit-spec | — | `:30-36` |
| Thuật ngữ: Sao ledger append-only; loginCode = định danh (không credential); đăng nhập gia đình Netflix | — | 07/08 | `:38-53` |

**Lệch thuật ngữ unit** — xem §9.

---

## 7. `docs/WORKFLOW.md` / `README.md` / `decisions/` / `product/`

| File | Luật / quyết định | Ghi chú |
|---|---|---|
| WORKFLOW | Code/tests/runtime = system of record; ephemeral plan vs `plans/{date}-…/plan.md`; pause khi policy mới mơ hồ; completion cần proof | Generic Harness |
| docs/README | Map Harness; CMC plans ở root `plans/` (không `docs/plans/`) | Scaffold |
| decisions/ | "Bắt đầu không fabricated decisions; add khi accepted" | **0 ADR file** — quyết định thật nằm AGENTS + class-unit-spec + architecture |
| product/ | "No consumer-specific product contract shipped" | Product truth = class-unit-spec + role-matrix |

---

## 8. Cái đã thử rồi BỎ (nguy cơ port lại vào ERP)

| Đã bỏ | Thay bằng | Ngày | Nguồn |
|---|---|---|---|
| Toàn bộ ERP (finance/payroll/CRM/shift/KPI…) | LMS only, không bridge sync | 26–27/07 | AGENTS #1, migration, role-matrix |
| Facility + RLS DB | ownership tRPC | 26–27/07 | architecture, AGENTS #4 |
| 9 vai trò staff + permissions registry | teacher \| admin (+ family) | 26–27/07 | architecture |
| Teacher-lite (GV tạo HS/PH/lớp) | ADMIN only | 27/07 | role-matrix, AGENTS #5 |
| Unit nhảy theo **mùng 1 tháng lịch** (M3) | Unit theo **4 buổi hợp lệ** + neo | **01/08** | class-unit-spec §3 |
| **Buổi bù** (`isMakeup` / makeupOfSessionId) | Chỉ lịch tuần + hủy; học bù ngoài hệ | **28/07** | class-unit-spec §4; migration drop makeup |
| Exercise gắn `curriculumUnitId` | Thư viện thư mục + phát 1 bài/buổi | 27/07 | class-unit-spec §8 |
| Form tạo/sửa khóa tay | CSV seed only | 27/07 | §1 |
| Tạm dừng lớp | running/closed only | 27/07 D2 | §2 |
| 3 cửa login (loginCode HS / OTP PH / student session) + ticket chọn con + setChildPassword | 1 cửa family SĐT+MK, multi-child session | **07/08** | architecture, auth-model, role-matrix |
| ParentApp / phiên `parent` tách | Unified family app | 07/08 | role-matrix |
| S3/MinIO file branch | Disk only sha256 | 27/07 | architecture |
| Mantine UI | Astryx + Tailwind v4 (gỡ sạch 09/08) | 30/07–09/08 | architecture, design-system §8 |
| Migrate submission cũ + lớp đã đóng | Bỏ có chủ ý | 29/07 / 27/07 | migration |
| v2 features (quà redeem, badge, leaderboard, level, meeting, link child, SSE) | Hoãn — **không** expose UI | 30/07 audit | role-matrix |

---

## 9. Mục LỆCH (tài liệu ↔ tài liệu / tài liệu ↔ code)

### LỆCH-1 — Unit theo tháng vẫn còn trong overview/role-matrix/README
| | |
|---|---|
| **Docs nói** | `project-overview.md:49`: unit "tự nhảy unit kế tiếp **vào mùng 1 hằng tháng**"; `role-matrix.md:91`: "unit nhảy **theo tháng**"; root `README.md:30` (ngoài docs): "Luật unit nhảy theo mùng 1" |
| **Spec/code làm** | class-unit-spec §3 (01/08): **4 buổi hợp lệ**; `unit-progression.ts` + `session-generator.ts` |
| **Loại** | Docs **stale** (còn wording M3 cũ). Authority = class-unit-spec + domain code |
| **Nguồn** | overview:49 · role-matrix:91 · unit-progression.ts:1-5 · session-generator.ts:7-9 |

### LỆCH-2 — "Không chuyển lớp" vs compose archive+add
| | |
|---|---|
| **Docs nói** | project-overview non-goals: v1 **không có** "chuyển lớp giữa chừng (đã cân nhắc và loại)" |
| **Spec nói** | class-unit-spec:227-228: chuyển lớp = **gỡ (archive) + add lớp mới** |
| **Code** | `enrollment.archive` / `unarchive` / `addWithUnits` tồn tại (role-matrix ✅) |
| **Loại** | Overview **mơ hồ/stale**: không có **feature chuyển lớp 1-nút**, nhưng thao tác kép **có** |
| **Nguồn** | overview:35-36 · class-unit-spec:227-228 · role-matrix:99 |

### LỆCH-3 — migration checklist vẫn verify "HS login bằng loginCode"
| | |
|---|---|
| **Docs nói** | migration.md:39: "Đăng nhập HS bằng loginCode cũ: ≥10 mẫu, 100% đạt" |
| **Auth hiện tại** | loginCode **không** còn credential; chỉ family SĐT+MK; studentLogin gỡ |
| **Code** | `auth.ts` chỉ `familyLogin` + staff; `sessions.ts` kind family only cho LMS |
| **Loại** | Checklist migrate **lỗi thời** sau 07/08 (vẫn hợp lệ như mã định danh, không phải login) |
| **Nguồn** | migration:39 · architecture:28-31 · auth-family-login.int.test.ts:196-204 |

### LỆCH-4 — StudentAccount.passwordHash vẫn ghi, không có login path
| | |
|---|---|
| **Docs** | auth-model:12-15 thừa nhận passwordHash HS vẫn set (0032) dù không dùng login |
| **Code** | student.create vẫn tạo StudentAccount + passwordHash; test comment "sẵn sàng đăng nhập" |
| **Loại** | **Nợ kỹ thuật có chủ ý** / dead credential — không phải bug chức năng family; nguy cơ hiểu nhầm khi merge |
| **Nguồn** | auth-model:12-15 · student.ts:223-229 · student-intake.int.test.ts:8,76-78 |

### LỆCH-5 — role-matrix vẫn bảng tách "HS" và "PH"
| | |
|---|---|
| **Docs** | Header 07/08: 1 vai trò family; body vẫn 2 section HS/PH với năng lực khác (HS nộp bài vs PH chỉ xem) |
| **Code** | 1 kind `family`; ownership theo studentId đang chọn; cả nộp bài lẫn xem đều familyProcedure |
| **Loại** | Cấu trúc tài liệu **lịch sử** — hành vi đúng là 1 TK làm cả; "PH chỉ xem" cũ đã nới (family nộp bài được) |
| **Nguồn** | role-matrix:25-55 · sessions.ts:30-37 · submission.ts familyProcedure |

### LỆCH-6 — AGENTS.md stack/UI + ticket HMAC
| | |
|---|---|
| **AGENTS nói** | Stack còn ghi "Mantine"; Astryx "đang thi công"; dev rules: copy "ticket HMAC chọn con" |
| **Architecture/code** | Mantine gỡ 09/08; family **không** ticket; switch client-side |
| **Loại** | AGENTS **stale một phần** (header 07/08 đã update family; bullet stack/ticket chưa) |
| **Nguồn** | AGENTS:17-22,59 · architecture:12-14,25-36 · sessions.ts:6-10 |

### LỆCH-7 — design-system §1–7 vs §8
| | |
|---|---|
| **§1–7** | Mô tả Mantine spacing/component (lịch sử) |
| **§8 + architecture** | Astryx xong; §1–7 **không còn hiệu lực** |
| **Loại** | Doc tự đánh dấu lịch sử — agent dễ đọc nhầm nếu bỏ qua banner §1 |
| **Nguồn** | design-system:17-21 |

### LỆCH-8 — class-unit-spec "HS migrate vẫn dùng loginCode" vs 07/08
| | |
|---|---|
| **Spec §5:169** | "HS migrate vẫn dùng loginCode cũ" (viết 27/07) |
| **Architecture 07/08** | loginCode thôi credential; audit prod: HS **chưa từng** tự login bằng loginCode |
| **Loại** | Câu trong class-unit-spec **chưa vá** sau gộp family |
| **Nguồn** | class-unit-spec:166-169 · architecture:28-31 · AGENTS:31-36 |

### LỆCH-9 — migration: schedule_slot / GV không migrate vs "lớp đang chạy đầy đủ"
| | |
|---|---|
| **Hợp đồng nhập** | Lớp running + phân công GV |
| **Thực tế script** | teacherId/markedById… **để trống**; schedule_slot **chưa** migrate → không tự sinh buổi mới |
| **Loại** | **Tồn đọng vận hành đã ghi** trong migration (không phải im lặng) — merge ERP cần biết |
| **Nguồn** | migration:114-118 |

### LỆCH-10 — Log Note "phải duyệt schema trước khi code" vs pilot đã có
| | |
|---|---|
| **Spec §7** | Đề xuất schema + chỗ tích hợp **duyệt trước khi code** |
| **role-matrix** | Pilot `record.ts` admin trên student-detail **đã có** |
| **Loại** | Có thể đã duyệt ngoài doc — **UNKNOWN** có ADR formal không (decisions/ trống) |
| **Nguồn** | class-unit-spec:245-248 · role-matrix:111 |

### Không lệch (đã verify code khớp spec)

| Chủ đề | Evidence |
|---|---|
| Không buổi bù | schema không isMakeup; chỉ cancel/planned |
| Unit 4 buổi + neo | `deriveSessionUnits`, `restampBatchUnits` |
| Family login only | `loginFamilyByPhone`; OTP procedures gỡ |
| Rewards v1 chỉ số dư | `rewards.ts` myStarBalance/starBalanceForChild only |
| Hủy buổi admin + ẩn nhật ký family | session-evidence + files.ts filter cancelled |

---

## 10. Sự cố / ràng buộc vận hành học được (trong docs)

| Nội dung | Ngày | Nguồn |
|---|---|---|
| Prod LIVE + journal merge email + bug tạo lớp | ~30/07 | migration:7-9 → `plans/journals/260730-0020-…` |
| Sửa ngày KG/unit bắt đầu sau khi có buổi → unit nhảy vọt + cửa sổ sinh buổi sai → **chặn sửa** | 01/08 | class-unit-spec:66-70 |
| GV nghỉ đột xuất + admin hủy muộn → mất bài (chấp nhận; thu hồi nếu chưa nộp) | 28/07 | class-unit-spec:146-148,297-300 |
| Ảnh nhật ký migrate: metadata OK, blob phải rsync tay file-store VPS | 30/07 | migration:96-113 |
| Lớp migrate thiếu schedule_slot → admin phải thêm lại khung lịch | 30/07 | migration:114-118 |
| Máy dùng chung family: **không PIN**, TTL 12h — owner chấp nhận | 07/08 | architecture:32-33, sessions.ts:8-10 |
| Data prod thật rất nhỏ lúc migrate (3 HS, 1 lớp running) | 29/07 | migration:49-50 |

---

## 11. Nợ kỹ thuật / chỗ tạm (docs thừa nhận)

| Nợ | Nguồn |
|---|---|
| StudentAccount.passwordHash / loginCode còn schema nhưng không login | auth-model, AGENTS 07/08 |
| v2: quà/badge/level/meeting/link/SSE chưa build | role-matrix |
| Log Note mới pilot 1 entity | class-unit-spec §7, role-matrix |
| decisions/ và product/ trống — quyết định phân tán AGENTS/spec/plans | decisions/README, product/README |
| design-system §1–7 lịch sử Mantine còn trong file | design-system:17-21 |
| AGENTS vẫn ghi "ticket HMAC chọn con" trong copy rules | AGENTS:59 |
| submission cũ không migrate | migration:90-94 |

---

## 12. Tóm tắt ưu tiên cho merge ERP (chỉ từ docs — không đề xuất)

1. **Giữ lý do** unit-theo-buổi (01/08) và **cấm port lại** unit-theo-tháng + entity buổi bù.
2. **Giữ** family SĐT+MK multi-child; **không** port lại OTP / loginCode-login / teacher-lite / facility RLS.
3. **class-unit-spec** là hợp đồng nghiệp vụ; overview/role-matrix/README còn câu stale — đừng tin wording "mùng 1".
4. **Migrate lessons:** ledger full; submission cũ bỏ; file blob rsync; schedule_slot/GV gán tay sau.
5. **decisions/** trống → khi merge, nguồn "vì sao" = class-unit-spec + architecture + plans/journals, không phải docs/decisions.

---

## Unknowns

- Journal `plans/journals/260730-0020-prod-merge-email-va-bug-tao-lop.md` **chưa đọc trong đợt này** — chi tiết bug tạo lớp / email prod = UNKNOWN tại J1.
- Verify tồn đọng migration (ảnh 31 + schedule_slot) **đã xong trên prod chưa** — doc ghi "cần kiểm, chưa xác nhận".
- Log Note pilot: có văn bản duyệt schema formal không — decisions/ trống.
- `docs/deployment.md` (434 dòng) **không** nằm list bắt buộc; runbook prod chi tiết = chưa khai thác hết.
- Mức độ "HS chưa từng login loginCode" (audit prod) — chỉ có claim trong AGENTS/architecture, không có raw audit trong docs/.

---

Status: DONE | Summary: Đã rút luật/unit/auth/migrate từ toàn bộ docs/ cốt lõi, gắn nguồn dòng, và đánh dấu 10 chỗ LỆCH (nổi bật: unit mùng-1 stale, loginCode checklist, buổi bù đã gỡ, family 07/08).
