# J4 — Sự cố vận hành thật · bug lặp · cutover · bảo mật · bẫy khi merge ERP

Nguồn: journals (+ plan liên quan khi **không có journal riêng**) trong  
`/home/manhquy/Downloads/cmc-lms/plans/journals/` và  
`plans/260729-1722-prod-migration-cutover/`, `plans/260801-2134-remediate-credential-security/`.  
Chỉ đọc. Phân loại theo BRIEF3. Không suy diễn ngoài bằng chứng.

**Ưu tiên journal đã đọc:**  
`2026-08-09-xu-ly-ton-dong…`, `2026-08-08-audit-docs…`, `2026-08-07-audit…-cutover…`,  
`260729-1722` (plan cutover), `260730-0020`, `260730-0050`, `260730-1508`,  
`260730-1711`, `260728-1243`, `260728-1700`, `260731-1115`,  
`260801-2134` (plan credential — **không có file journal cùng tên**),  
`260728-1901`, cộng phụ: `260729-1523`, `260729-1600`, `260731-2126`,  
`260801-0210`, `260728-1131`, `260728-1927`, `260730-2114`.

---

## 1. Sự cố PRODUCTION thật (1 dòng / sự cố)

| # | Sự cố | Nguyên nhân gốc | Ngày / nguồn |
|---|---|---|---|
| P1 | Email “đã gửi” (`emailSent=true` / SMTP 250 queued) nhưng PH/GV **không nhận** mail thật | `SMTP_URL` trỏ **sai tài khoản Brevo** (`a16728001` rỗng) thay account đã auth domain (`ad37d2001`); account rỗng queue rồi **chặn giao im lặng** | 29–30/07 · `260730-0020-prod-merge-email-va-bug-tao-lop.md:25-34` |
| P2 | Admin **không sửa được unit** lớp migrate | `seed-migrate` copy `status` verbatim → lớp cũ `'open'`; hệ mới chỉ thao tác khi `'running'`, **không có** đường `open→running` | 30/07 · `260730-0020:15-17` |
| P3 | Tạo lớp fail / dump JSON Zod khi nhập giờ `"8:30"` | Input giờ text tự do (không zero-pad) + regex backend + so sánh chuỗi; lỗi Zod dump raw ra UI | 30/07 · `260730-0020:18-21` |
| P4 | Đổi GV lớp migrate **không có tác dụng** trên buổi tương lai; SlotsTab trống | `seed-migrate` **không tạo `ScheduleSlot`** — `ensureSessionsUntil` / `editSlotTeacher` / UI slot đều key theo slot; UI “chọn lại” Mantine Select **không fire** onChange khi value trùng | 30/07 · `260730-1508-addslot-cascade-gv-slot-thieu.md:10-18` |
| P5 | Lớp migrate CMC-26-0002: 48/48 buổi `teacher_id=NULL`, không slot → **không GV nào mở nhật ký** | Cùng nợ migrate slot/GV (chưa backfill đủ) | 31/07 · `260731-1115-upload-anh-iphone-capture-va-buoi-huy.md:119-120` |
| P6 | GV iPhone **không tải được ảnh** buổi học trên prod; log **0** request upload | (a) `capture="environment"` ép camera, **bỏ thư viện** + vô hiệu `multiple`; (b) migrate Astryx: input `hidden`+`.click()`; (c) `uploadPhotos` `try/finally` **nuốt lỗi** | 31/07 · `260731-1115:10-23,88-96` |
| P7 | PH vẫn thấy / tải nhật ký buổi **đã hủy** (edge prod audit) | `publishedEvidenceWhere` / `principalCanAccessRef` **thiếu** filter `status ≠ cancelled` (PDF path đã có) | 31/07 · `260731-1115:26,69-73` |
| P8 | Cutover LMS mới live (29/07): disk server **80% đầy** trước deploy | VPS 160G còn ~32G; stack cũ+dev+Jenkins chồng | 29/07 · `plans/260729-1722-prod-migration-cutover/plan.md:19,67-69` |
| P9 | Cutover family+P0 (07/08): server **không git fetch** GitHub (repo private, không credential) | Deploy phải vòng **git bundle** scp + fetch local, không đụng auth prod | 07/08 · `2026-08-07-audit-ton-h-va-6-p0-…md:31-32,42` |
| P10 | Docs/`migration.md` ghi prod student=3 trong khi live đã 10+ — **lệch system-of-record** | Docs không cập nhật sau go-live ~30/07; audit 08/08 phải rebuild timeline từ journal | 08/08 · `2026-08-08-audit-docs-journal-dong-bo-5-diem-lech.md:18-25` |
| P11 | **Chưa xác nhận bằng chứng** rsync 31 blob ảnh nhật ký sang `FILE_STORE` prod | Script migrate metadata; blob rsync là bước tay — journal audit **không** có xác nhận SSH | 08/08 · `2026-08-08:44-49,57`; `docs/migration.md:97+` |
| P12 | Merge data: suýt gán **placeholder GV** `quynm` cho lớp không có GV hệ cũ + gán cả buổi quá khứ | Agent “bịa” để lấp chỗ trống thay vì để trống / hỏi owner | 30/07 · `260730-0020:9-11` |
| P13 | Key Brevo SMTP+API **lộ trong chat** — treo rotate | Secret trong hội thoại agent/ops | 30/07 · `260730-0020:56`; `260730-0050:49` (owner) |

**Không liệt kê là “prod incident” nếu chỉ là bug dev/pre-prod đã chặn trước ship** — chúng vào §2 / §4.

---

## 2. Bug nghiêm trọng lặp lại (dấu hiệu lỗi thiết kế)

| Pattern | Biểu hiện lặp | Gốc thiết kế | Nguồn |
|---|---|---|---|
| **Test xanh ≠ đúng** | Worker DONE + suite xanh; review chéo vẫn High; e2e bơm `setInputFiles` bỏ qua nút hỏng; test “xanh cả trước lẫn sau fix”; xanh-giả selector/`if(visible).catch` | Test assert sai chỗ / đi vòng path user / không fail-without-fix | `260728-1243:24-35`; `260731-1115:33-42`; `260729-1523:25-28` |
| **Review theo diff hẹp** | 3 dev DONE Đợt 1; CROSS-1/2 chỉ lộ khi review **toàn cụm** sau nhiều phiên | Không ai sở hữu “tương tác chéo mảnh” | `260728-1243:26-31,87-89` |
| **Vá tầng 1, bỏ tầng 2** | UI bảo toàn comment nhưng server `foreignStudentIds` chặn → 400 mọi lưu; vá summary/photos lệch field | Không áp cùng invariant dọc full path dữ liệu | `260728-1243:51-57`; `260728-1131:49-57` (summary null hóa) |
| **Hai con trỏ / một số** | MAX(position) vs tập live; remaining báo sai sau gap-aware | Một đại lượng phục vụ hai mục đích | `260728-1243:47-61` |
| **Migrate thiếu entity phụ** | Có ClassSession/Batch, **0 ScheduleSlot** → mọi feature “theo slot” im lặng chết | Migrate happy-path không checklist FK/table phụ thuộc | `260730-1508:10-18,41-45` |
| **Copy status / enum hệ cũ** | `'open'` vs `'running'` | Map state machine **mới**, không verbatim | `260730-0020:15-17` |
| **Date timezone** | Lệch ngày −1 mọi cột date (pg local-midnight vs Prisma UTC) | Chuẩn hóa ICT/UTC-midnight một chỗ | `260729-1523:6-8` |
| **TOCTOU preview→confirm** | `setLifecycle` cache `seen` **không namespace theo `next`** → commit mù đích khác | Key cache phải gồm **mọi biến** ảnh hưởng cảnh báo | `260730-1711:35-63` |
| **Hiểu nhầm transaction = chống race** | Plan “gộp $transaction = đóng TOCTOU” **SAI** dưới READ COMMITTED | Cần advisory lock / FOR UPDATE tường minh | `260730-2114:33-36,94-96` |
| **Silent state / self-healing UX** | Modal điểm không resync → ghi đè điểm; submit đọc closure null → bấm 2 lần; race phone write-back revert | Runtime state/race — red-team plan không đủ | `260728-1700:65-81`; `260730-2114:62-69` |
| **API contract thiếu field** | `deliveredForSession` không select `SessionExercise.id` → màn chấm không gọi API | Plan không đối chiếu select vs consumer | `260728-1700:39-45` (BLOCKER RT2, chặn trước cook) |
| **Optional chaining nuốt lỗi type** | `trpc.rewards?.myStarBalance` → sao PH luôn 0 im lặng | Optional chain che procedure sai | `260801-1348:27-28` |
| **Prisma object spread ghi đè key** | `{...where(), classSession:{...}}` xóa filter classSession trước | Phải `AND: [...]` | `260731-1115:71-73` |
| **Docs lag code / journal** | migration/roadmap/astryx status sai; e2e OTP còn sau gỡ OTP | Docs không system-of-record sau cutover | `2026-08-08:18-28,50-51` |
| **Working tree / DB / branch dùng chung** | Checkout xóa branch phiên khác; uncommitted mất tạm; dirty DB migrate; e2e thiếu `.env` → login 500 | Đa agent không worktree/DB/port riêng | `260729-1600:25-36,39-41`; `260729-1523:29-32`; `260730-1711:82-88` |

---

## 3. Bài học migration & cutover prod — cái gì suýt hỏng

| Bài học | Chi tiết | Nguồn |
|---|---|---|
| **Giữ login-critical verbatim** | bcrypt hash HS/PH + loginCode chuỗi nguyên; staff SSO **không** migrate — seed superadmin mới | `260729-1722 plan:37-47,71-74` |
| **AUTH_SECRET sinh mới** | Không tái dùng JWT_SECRET cũ (cơ chế khác) | `plan:50-51` |
| **Wipe có cổng xác nhận** | Backup DB+file-store+certs **trước** `compose down -v` hệ cũ | `plan:57-65,71-76` |
| **Disk trước deploy** | 80% đầy → dọn trước; rủi ro ghi trong cutover | `plan:19,67` |
| **Domain gộp 1 host** | Chỉ `hoc.cmcvn.edu.vn` 3-zone; bỏ erp/teacher subdomain | `plan:72` |
| **Map status enum** | Không copy `'open'`; force `'running'` lúc migrate | `260730-0020:15-17` |
| **Checklist bảng phụ** | ClassBatch/Session **không đủ** — thiếu ScheduleSlot = nợ im lặng | `260730-1508:41-45,49-53` |
| **Date UTC-midnight** | Lệch −1 ngày nếu pg local vs Prisma UTC — đã vá seed-migrate | `260729-1523:6-8` |
| **emailSent ≠ delivered** | Verify transactional event log Brevo; `curl -4` nếu IP whitelist | `260730-0020:25-34` |
| **Không bịa data merge** | Placeholder GV bị owner bắt gỡ | `260730-0020:9-11` |
| **Blob ≠ row DB** | 31 ảnh: metadata migrate ≠ blob rsync; **UNKNOWN** đã rsync prod chưa (08/08) | `2026-08-08:48-49` |
| **Cutover không SSH git** | git bundle khi private + no credential | `2026-08-07:31-32` |
| **Backup tươi + rollback ref** | Pre-cutover SQL + git SHA cũ; không re-deploy khi prod == main | `2026-08-07:33-36,43,50` |
| **Zero-downtime khi no migration** | Feature-only deploy khác hẳn cutover schema (drop login_otp) | `260801-0210:38-42` vs `2026-08-07:34` |
| **Test state thật** | Prod chưa có lớp “chạy lâu” → lùi anchor mô phỏng trước khi tin code | `260730-0050:23-26` |
| **Journal = system of record prod** | Không cần creds live để audit “đã migrate chưa” nếu journal đầy đủ | `2026-08-08:21-25`; `2026-08-09:31` |
| **`.dockerignore` loại docs/** | Build sạch fail nếu CSV khung trong docs — suýt vỡ image | `260730-0020:12-14` |

---

## 4. Lỗ hổng bảo mật đã sửa (theo journal/plan)

| Finding | Mức | Fix | Nguồn | Trạng thái journal/plan |
|---|---|---|---|---|
| F1 default `Cmc2026@` hardcode login-phone | HIGH (scan) | Env `DEFAULT_STUDENT_PASSWORD` + fail-fast prod; script `rotate-default-password.ts`; PH đổi mk | `plans/260801-2134-…/plan.md:17-30,91-102`; `docs/auth-model.md:17-23`; `docs/deployment.md:36,172-189` | Code+docs có; **có chạy rotate trên prod?** → UNKNOWN (không journal xác nhận) |
| F2 seed admin fallback `Admin2026@` | MEDIUM | `SEED_ADMIN_PASSWORD` bắt buộc, abort seed | `260801-2134 plan:20,29`; seed tests | Đã code |
| Rate-limit: phát hiện stuffing, không chặn global | — | Log alert `LOGIN_SUCCESS_GLOBAL_ALERT` | plan phase-03; `deployment.md:38` | Đã code |
| Khóa PH không thu hồi session con (family mint student) | CRITICAL (red-team CRUD) | Cascade bump `tokenVersion` StudentAccount con | `260730-1711:17-20` | Đã sửa đợt CRUD |
| Race `student.create` ghi đè phone PH (silent revert) | HIGH | Omit field khi đã có giá trị | `260730-2114:62-69` | Đã sửa |
| Reset password token trên query string → nginx access log | CRITICAL (red-team) | Fragment `#token=` + replaceState | `260731-2126:25-29` | Đã sửa |
| Oracle dò mật khẩu qua mã lỗi reset | MEDIUM | Pre-check tokenVersion/isActive trước so password | `260731-2126:35-40` | Đã sửa |
| Feature flag `FORGOT_PASSWORD_ENABLED=false` chỉ ẩn UI — API public vẫn sống | HIGH deploy risk | Mở cổng đúng sau evidence SPF/DKIM (D17) | `260731-2126:77-86` | Đã lộ & xử design |
| Guard prune unit curriculum so order âm vs range dương = **guard chết** | CHẶN deploy | `Math.abs(orderGlobal)`; verify script đúng thứ tự prod | `260731-2126:49-63` | Đã vá vòng 2 |
| Chấm bài `draft` → khóa HS + publish cộng sao ảo | P0 audit | Guard grade chặn draft | `2026-08-07:17-18` | Đã vá P0 |
| Đổi `pdfRef` file đã giao = tráo đề | P0 | Reject fileUpdate pdfRef nếu đã SessionExercise | `2026-08-07:18` | Đã vá |
| fileReorder P2002/500 (archive giữ slot) | P0 | Renumber live+archived | `2026-08-07:19` | Đã vá |
| Nhật ký key session chéo buổi / writeDraft nuốt lỗi Safari | P0 | Key sessionId; báo lỗi ghi | `2026-08-07:20-22` | Đã vá |
| Buổi hủy vẫn lộ nhật ký PH | High edge | Filter cancelled + publish chặn | `260731-1115:69-73` | Đã vá |
| Brevo keys lộ chat | Ops | Owner rotate (treo) | `260730-0020:56` | **Owner action** — UNKNOWN đã rotate? |

---

## 5. Nợ kỹ thuật tự nhận (còn lại / từng ghi)

| Nợ | Ghi chú | Nguồn | Nhãn merge ERP |
|---|---|---|---|
| seed-migrate **không** tạo ScheduleSlot | Admin addSlot 1 lần; chờ backup DB “đúng” nếu backfill hàng loạt | `260730-1508:49-53` | ĐỪNG port migrate thiếu slot |
| Rsync 31 ảnh prod **chưa verify** | Metadata có, blob UNKNOWN | `2026-08-08:48-49` | Checklist blob bắt buộc |
| Rotate key Brevo | Lộ chat | `260730-0020:56` | Rotate trước go-live ERP |
| Rotate hash default prod (sau đổi env) | Script có; chạy prod = ops | `deployment.md:172-189` | Không coi env-only là “đã fix F1” |
| CurriculumLesson 0 reader | Seed có, UI không | `260728-1927:27-29` | THIẾU / reserved |
| `Grade.rubric`, `ClassSession.curriculumLessonId` | Cột chết tùy chọn | `260728-1927:29` | Không port UI rỗng |
| Huy hiệu / lên cấp / đổi quà / SSE / họp PH / liên kết con | v2 hoãn có chủ ý | `260730-1132:6-8,52-55` | **Không port “ma” từ role-matrix cũ** |
| a11y residual, font orphan, design-system §1–7 theo Astryx | Post Astryx | `2026-08-09:53-56` | UI debt |
| e2e non-idempotent journal / need drop+seed | Verify chuẩn | `2026-08-09:44-45` | CI isolation |
| grantPast double-submit overlap; FE unarchive nuốt lỗi | Polish | `260801-0210:45-48` | Nhỏ |
| Rate-limit in-memory 1 instance | Comment rate-limit | `deployment.md:44-50` | Multi-instance = SEAM |
| Partial unique indexes tay (`star_transaction`, `schedule_slot`) | `migrate dev` DROP nhầm | `260728-1927:32-37` | Migration tay + check script |
| Shared default password (0032) vẫn là model | Secret phân phát email | `260801-2134 plan:22-38` | SEAM policy vs ERP |

---

## 6. CẤM BẪY — ERP (`cmc_edu`) phải tránh khi merge

Danh sách hành động **cấm / bắt buộc tránh** khi port LMS → ERP:

### Cutover & dữ liệu
1. **Cấm** wipe hệ cũ trước backup DB + file-store + cert + env ra **ngoài** server.  
2. **Cấm** coi `emailSent` / SMTP 250 = mail đã tới — verify event log provider.  
3. **Cấm** copy nguyên `status`/enum lớp–buổi hệ cũ nếu state machine ERP khác.  
4. **Cấm** migrate chỉ entity “chính” mà quên **ScheduleSlot / teacherId / unit stamp / ledger reference**.  
5. **Cấm** bịa placeholder GV/HS/PH để “đủ data demo” trên prod.  
6. **Cấm** tuyên bố “ảnh/PDF đã chuyển” khi chỉ có row metadata — phải verify blob trên `FILE_STORE`.  
7. **Cấm** tái dùng secret JWT/AUTH/SMTP giữa hai stack khác cơ chế.  
8. **Cấm** hardcode default password vào image; **cấm** tin đổi env đã xoay hash cũ.  
9. **Cấm** cutover khi disk > ~80% không dọn.  
10. **Cấm** git fetch private mà không có deploy key — chuẩn bị bundle/CI artifact.

### Auth & bảo mật
11. **Cấm** token reset trên query string (log nginx).  
12. **Cấm** feature-flag chỉ ẩn UI trong khi API public còn sống.  
13. **Cấm** “guard” prune/xóa mà test không chạy đúng **thứ tự production** (đảo dấu, multi-step).  
14. **Cấm** khóa tài khoản PH mà không revoke phiên con / tokenVersion.  
15. **Cấm** tin `$transaction` = hết race — field unique (SĐT) cần **cùng** advisory lock mọi writer.  
16. **Cấm** preview→confirm TOCTOU mà cache key thiếu biến đích (`next` lifecycle, seen set…).

### Nghiệp vụ dạy-học khi dính ERP
17. **Cấm** dùng MAX(position) vừa khóa dãy vừa chọn bài phát — tách MAX vs gap live.  
18. **Cấm** đổi `pdfRef`/nội dung đề sau khi đã giao.  
19. **Cấm** chấm / cộng sao trên submission `draft`.  
20. **Cấm** filter roster điểm danh cho nhận xét nhật ký (vắng vẫn nhận xét/bài).  
21. **Cấm** upsert partial field ghi `null` field không gửi (summary/photos).  
22. **Cấm** Prisma spread object where ghi đè nested key — dùng `AND`.  
23. **Cấm** lộ nhật ký/PDF buổi `cancelled` cho gia đình.  
24. **Cấm** `capture="environment"` trên upload ảnh multi (iPhone chết thư viện).  
25. **Cấm** e2e `setInputFiles` làm bằng chứng nút upload — phải `filechooser` / device thật.

### Quy trình kỹ thuật (agent + team)
26. **Cấm** tin “DONE + test xanh” không code-review / không fail-without-fix.  
27. **Cấm** review chỉ diff hẹp sau nhiều PR cùng cụm — cần review chéo.  
28. **Cấm** shared working tree / shared test DB / shared branch giữa agent song song.  
29. **Cấm** `prisma migrate dev` trên bảng có **partial unique tay** (ScheduleSlot, StarTransaction).  
30. **Cấm** port lại module v2-hoãn (huy hiệu, SSE, facility, ERP finance LMS đã cắt).  
31. **Cấm** tin docs roadmap/migration nếu mâu thuẫn journal cutover — reconcile trước.  
32. **Cấm** rải “friendly error” 30 form — fix **1 seam** (`errorFormatter`, map P2025).  
33. **Cấm** optional chaining che API thiếu (`?.procedure`) trên path nghiệp vụ.  
34. **Cấm** seed e2e hardcode ngày tuyệt đối (time-bomb tuần sau).  
35. **Cấm** PR feature nhắm `main` khi `main` tụt develop (nuốt stack lạ).

### SEAM ERP đặc thù
36. **Cấm** bê nguyên “shared default password + email cho PH” sang ERP nếu ERP đã có IAM/consent thật — thiết kế lại.  
37. **Cấm** bê rate-limit in-memory khi ERP multi-instance.  
38. **Cấm** trộn ledger sao LMS với sổ tiền ERP thành một bảng không idempotency `(type, reference)`.  
39. **Cấm** đồng bộ facility/RLS cũ LMS đã bỏ — ownership tRPC, không RLS facility.

---

## LỆCH (tài liệu ↔ code/journal)

| Lệch | Chi tiết | Nguồn |
|---|---|---|
| migration.md student count | Snapshot 3 vs live 10+ sau go-live | `2026-08-08:18-25` (đã sửa docs 08/08) |
| design-system Astryx “CHƯA THI CÔNG” | Code đã Phase 0–4; 09/08 hoàn tất gỡ Mantine | `2026-08-08:26-28`; `2026-08-09:26-28` |
| Rsync 31 ảnh “có trong cutover plan” | Journal audit: **không evidence** hoàn tất | `2026-08-08:44-49` |
| Journal `260801-2134-…md` | User liệt kê; **file không tồn tại** — chỉ plan folder | list_dir journals |
| Rotate Brevo / rotate hash prod | Nhiều journal “owner treo”; không xác nhận done | `260730-0020:56` |
| e2e ph-dashboard OTP | Còn sau gỡ OTP 07/08; CI không chạy e2e → không tự fail | `2026-08-08:50-51` (sau 09/08 A đã dọn e2e) |

---

## Unknowns

1. Đã **rotate** Brevo SMTP/API keys sau lộ chat chưa?  
2. Đã **rsync** đủ 31 blob `session_evidence_photo` lên prod `FILE_STORE` chưa?  
3. Đã chạy `rotate-default-password.ts` trên prod sau F1 chưa?  
4. CMC-26-0002 đã backfill slot/teacher đủ chưa sau 31/07?  
5. Journal credential-security riêng: không có — chỉ plan; residual ops prod UNKNOWN.  
6. Health-watch Telegram / disk alert sau cutover: journal gợi ý theo dõi, không kết luận đã cấu hình.

---

Status: DONE | Summary: Rút 13 sự cố prod/ops, 15 pattern bug thiết kế lặp, bài học cutover (hash/slot/status/email/disk/bundle), lỗ hổng auth đã vá + ops còn treo, và 39 cấm bẫy khi merge LMS vào ERP.
