# Red-team — Bảo mật và phân quyền

Kế hoạch: `plans/260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/`
Đối chiếu: `cmc_edu` (cwd) và `cmc-lms` freeze `031d193`.
Góc: (a) B1 gỡ OTP / `resetChildPassword` / claim token / đọc chéo học sinh;
(b) A3 helper sở hữu nhật ký buổi + quy tắc công khai;
(c) A1 mở lại lớp / gỡ khung / SoD;
(d) danh mục bài học không RLS;
(e) GRANT `LoginOtp` sót sau DROP.
Chỉ đọc code. Không bịa phát hiện.

**Kết luận trước:** Hai chỗ làm **đổi cách thi hành**. Một: A3 dặn “nhận xét đi theo quy tắc công khai của nhật ký buổi” — quy tắc đó là **cả lớp**, không phải **từng con**; gắn nhận xét vào `listForChild` sẽ lộ nhận xét học sinh A cho phụ huynh học sinh B cùng lớp. Hai: B1 gộp `kind` **trước** khi gỡ `resetChildPassword`, và gỡ OTP **mà không có cột khóa** trên `ParentAccount` — phiên gia đình + mật khẩu mặc định `Cmc2026@` thành chiếm cả nhà. Token HMAC **không** giả mạo được nếu giữ `verifyLmsToken`. GRANT `LoginOtp` sót sau `DROP TABLE` **không** phải lỗ hổng. Danh mục bài học không RLS **không** rò dữ liệu học sinh giữa cơ sở.

---

## (a) B1 — gỡ OTP, `resetChildPassword`, claim token, đọc chéo HS

### A1. Gộp `kind` trước khi gỡ `resetChildPassword` mở cửa leo thang anh/em

**Câu bị sai** — `phase-b1-danh-tinh-gia-dinh.md:86-90`:

> 1. **B1.1** — Gộp `kind` về một giá trị gia đình; phiên đa con; mọi procedure nhận `studentId` tường minh + kiểm sở hữu qua **một** helper.
> 2. **B1.2** — Đăng nhập SĐT + mật khẩu; giới hạn thử; quên mật khẩu.
> 3. **B1.3** — Gỡ OTP, `loginStudent`, `resetChildPassword`; …

Kế hoạch nhận ra `resetChildPassword` là leo thang khi gộp (`phase-b1:38-39`) nhưng vẫn xếp gỡ nó **sau** khi gộp kind. Ranh giới #8 còn để mở “một PR lớn hay chuỗi PR”.

**Bằng chứng**

`resetChildPassword` chỉ chặn bằng `requireLmsParent` = `kind === 'parent'`, rồi đặt mật khẩu con và **tắt** `mustChangePassword`:

```627:651:apps/api/src/lms-auth/router.ts
  resetChildPassword: lmsProcedure
    .input(resetChildPasswordInput)
    .mutation(async ({ ctx, input }): Promise<{ ok: true }> => {
      const { parentAccountId } = requireLmsParent(ctx);
      // ...
          passwordHash: hashPassword(input.newPassword),
          mustChangePassword: false,
          loginAttempts: 0,
          loginLockedUntil: null,
```

```317:324:apps/api/src/trpc.ts
export function requireLmsParent(ctx: Context): { parentAccountId: string } {
  if (!ctx.lmsSubject) {
    throw unauthorized('LMS session required.');
  }
  if (ctx.lmsSubject.kind !== 'parent') {
    throw forbidden('Parent session required.');
  }
```

Hôm nay phiên `kind:'student'` bị e2e chặn (`apps/e2e/tests/kind-isolation.spec.ts:136-153`). Sau B1.1, một kind gia đình nếu được ánh xạ thành “cổng phụ huynh” thì **mọi** procedure parent-only còn sống (`resetChildPassword`, `guardian.setPhotoConsent`, `enrollment.mine`) mở cho cả nhà.

**Hậu quả nếu thi hành nguyên văn (chuỗi PR B1.1 → B1.3):** một người cầm phiên gia đình (hoặc còn `loginStudent` trong cửa sổ đó) đặt mật khẩu mọi con, tắt bắt đổi mật khẩu, đọc/sửa dữ liệu anh chị em. Cửa sổ này biến mất nếu gỡ `resetChildPassword` **trong cùng một cut** với gộp kind.

Mức: **HIGH** — đổi thứ tự: gỡ `resetChildPassword` + `loginStudent` cùng lúc với gộp `kind`, không để chuỗi PR mở cửa sổ.

---

### A2. Gỡ OTP mà không có khóa trên `ParentAccount` — spray mật khẩu không trần

**Câu bị sai** — `plan.md:139` và `phase-b1:77, 87-88`:

> R4 | Bỏ OTP là bỏ luôn rate-limit tự nhiên của đăng nhập | B1 phải có chính sách giới hạn thử mật khẩu — nêu tường minh trong phase

> 6 | Chính sách giới hạn thử mật khẩu | Bỏ OTP là bỏ luôn rate-limit tự nhiên

> 2. **B1.2** — Đăng nhập SĐT + mật khẩu; giới hạn thử; quên mật khẩu.

Phase **không nêu tường minh** chính sách đó sống ở đâu. “Port luật” `cmc-lms` (`phase-b1:16-22`) sẽ **không** mang theo khóa: `loginFamilyByPhone` (`cmc-lms/apps/api/src/auth/sessions.ts:128-148`) không đếm lần thử.

**Bằng chứng**

OTP hôm nay có cooldown 30s, 5 request / 15 phút / số, 5 lần verify rồi khóa mã, trần email 200/giờ:

```53:67:apps/api/src/lms-auth/router.ts
const OTP_REQUEST_COOLDOWN_SECONDS = 30;
const MAX_OTP_VERIFY_ATTEMPTS = 5;
const OTP_RATE_LIMIT_MAX_PER_WINDOW = 5;
const OTP_RATE_LIMIT_WINDOW_MINUTES = 15;
```

Khóa mật khẩu học sinh nằm trên `StudentAccount`, **không** trên `ParentAccount`:

```485:490:packages/db/prisma/schema.prisma
  loginAttempts      Int       @default(0)
  loginLockedUntil   DateTime? @db.Timestamptz(3)
```

```452:463:packages/db/prisma/schema.prisma
model ParentAccount {
  id                   String                @id @default(uuid())
  phone                String                @unique
  email                String?               @unique
  passwordHash         String?
  isActive             Boolean               @default(true)
  tokenVersion         Int                   @default(0)
```

`loginStudent` khóa theo **từng** `StudentAccount` (`lms-auth/router.ts:576-591`). B1.3 gỡ đúng procedure đó. Không còn bảng `LoginOtp` thì cũng hết chỗ đếm OTP.

**Hậu quả:** đăng nhập gia đình là `publicProcedure` (SĐT + mật khẩu). Không cột khóa / không trần IP thì spray `Cmc2026@` (hoặc mật khẩu yếu) theo danh bạ SĐT không bị chặn — chỉ còn chi phí PBKDF2. Port nguyên `loginFamilyByPhone` của nguồn **lặp đúng lỗ** nguồn đang chạy.

Mức: **HIGH** — trước khi gỡ OTP phải thêm `loginAttempts` / `loginLockedUntil` (hoặc tương đương) trên `ParentAccount` và một hàm xác thực duy nhất dùng các cột đó. Không port `loginFamilyByPhone` như đang viết.

---

### A3. Backfill mật khẩu gia đình bằng `Cmc2026@` biến mặc định thành chiếm cả nhà

**Câu bị sai** — `plan.md:43-45` (dời cổng C0) cộng `phase-b1:73-75`:

> Cổng C0 chuyển sang Đợt 5, chạy trên dữ liệu **nguồn**

> 4 | `ParentAccount.passwordHash` có thành NOT NULL không | Nếu có thì dữ liệu mẫu phải backfill trước

Kế hoạch không cấm lấy literal đang dùng cho học sinh.

**Bằng chứng**

Mọi `StudentAccount` mới nhận cùng một mật khẩu, bắt đổi lần đầu:

```302:312:apps/api/src/provisioning/provision-from-receipt.ts
      // The default password literal is intentionally
      // kept here in provisioning only — never hardcoded in tests or business
      // logic.
      return tx.studentAccount.create({
        data: {
          studentId,
          parentAccountId,
          passwordHash: hashPassword('Cmc2026@'),
          mustChangePassword: true,
        },
      });
```

Staff reset cũng về đúng literal đó (`apps/api/src/student/router.ts:60-97`). `loginStudent` khớp hash rồi `break` — nhà hai con chưa đổi thì vào con nào không xác định (`lms-auth/router.ts:561-572`).

`ParentAccount.passwordHash` hiện **nullable và không có đường login** nào đọc.

**Hậu quả nếu thi hành “đổi thẳng” + backfill mẫu bằng `Cmc2026@`:** SĐT + mật khẩu mặc định mở **phiên gia đình đa con**, không còn cổng `mustChangePassword` của học sinh (`trpc.ts:337-344` chỉ đọc `StudentAccount`). Đó là chiếm cả nhà, nặng hơn bug first-match hiện tại. `cmc_edu` chưa có user thật nên chưa thủng production — nhưng Đợt 5 nhập dữ liệu nguồn mà giữ literal này thì thủng.

Mức: **HIGH** — không chép `Cmc2026@` lên `ParentAccount.passwordHash`. Tài khoản mẫu / tài khoản chưa có mật khẩu thì vô hiệu hóa login (`isActive=false` hoặc từ chối hash null như `cmc-lms` `sessions.ts:135-138`), không phát mật khẩu dùng chung.

---

### A4. “Làm chết phiên cũ” liệt kê lựa chọn giả — cookie LMS không tồn tại; `tokenVersion` không tăng khi đổi mật khẩu

**Câu bị sai** — `phase-b1:73` và kiểm chứng `phase-b1:101`:

> 2 | Cơ chế làm chết phiên cũ | Bump `tokenVersion`, đổi tên cookie, hay từ chối claim lạ — phải chọn một

> Đổi mô hình làm phiên cũ hết hiệu lực

**Bằng chứng**

LMS **không có cookie**. Token nằm `localStorage` và gửi `Authorization: Bearer`:

```62:69:apps/lms/src/lib/trpc.ts
          if (!session?.sessionToken) return {};
          return { authorization: `Bearer ${session.sessionToken}` };
```

Cookie `cmc_staff_session` là staff, không phải LMS. Đổi tên cookie **không** thu hồi bearer.

`tokenVersion` chỉ tăng khi **tắt** tài khoản, không tăng khi đổi mật khẩu / reset / OTP:

```234:238:apps/api/src/parentAccount/router.ts
        data: input.isActive
          ? { isActive: true }
          : { isActive: false, tokenVersion: { increment: 1 } },
```

Token HMAC sống **7 ngày**, không `jti`, logout chỉ `localStorage.removeItem` (`apps/lms/src/lib/trpc.ts:53-55`). `assertLiveLmsSession` chỉ so `tv` với `ParentAccount.tokenVersion` (`apps/api/src/lms-auth/assert-live-session.ts:20-27`).

Nguồn không nhét ownership vào JWT — resolve từ DB mỗi request, TTL 12h:

```8:14:cmc-lms/apps/api/src/auth/jwt.ts
/** Claims trong JWT. Ownership (con của gia đình, lớp của GV) KHÔNG nằm trong token —
 * resolve từ DB mỗi request để thu hồi ngay khi đổi trạng thái. */
export interface SessionClaims {
  sub: string;
  kind: SessionKind;
  tokenVersion: number;
}
```

`verifyLmsToken` **không** giả mạo được nếu thiếu `LMS_SESSION_SECRET` (HMAC + `timingSafeEqual`, `session-token.ts:81-106`; boot-check từ chối secret mặc định khi production, `boot-checks.ts:104-118`).

**Hậu quả:** chọn “đổi tên cookie” = phiên `kind:'parent'|'student'` còn hạn 7 ngày vẫn gọi API. Đổi mật khẩu gia đình mà không tăng `tv` = token đã đánh cắp (XSS / máy dùng chung) còn sống đủ một tuần. Nhét `studentIds[]` vào claim (ranh giới #1 còn mở) thì gỡ `Guardian` không thu hồi đến khi hết hạn.

Mức: **HIGH** — bỏ lựa chọn cookie. Cutover: tăng `tokenVersion` mọi `ParentAccount` **hoặc** `verifyLmsToken` chỉ nhận `kind:'family'`. Mọi đổi mật khẩu / quên mật khẩu / staff reset phải `increment tokenVersion`. Claim chỉ `parentAccountId` + `kind` + `tv`; danh sách con lấy từ `getApprovedChildren` mỗi request như nguồn.

---

### A5. Nhét `family` vào registry 9 vai trò nhân sự

**Câu bị sai** — `phase-b1:74`:

> 3 | `family` đứng ở đâu trong registry quyền | Registry hiện có 9 vai trò nhân sự; principal gia đình chưa có chỗ

**Bằng chứng**

```9:20:packages/auth/src/index.ts
/** The 9 official roles (docs/14 §1). Do not add roles here without an ADR. */
export const ROLES = [
  'super_admin',
  // ...
] as const;
```

LMS **không** đi qua `can()`. `lmsProcedure` là không gian định danh riêng, “không có SYSTEM/super_admin bypass” (`trpc.ts:257-262`). `x-dev-user` parse `roles: z.array(z.enum(ROLES))` (`context.ts:31-36`).

**Hậu quả nếu “cho family một chỗ” bằng cách thêm vào `ROLES`:** header giả lập staff / `can()` có thể nhận principal gia đình như nhân sự. Đó không phải chỗ đứng.

Mức: **MEDIUM** — gia đình ở lại `lmsProcedure`. Không thêm `family` vào `ROLES` / `PERMISSIONS`. Ranh giới #3 chốt “không vào registry”, không phải “thêm vai thứ 10”.

---

### Không tìm thấy (a)

- **Giả mạo claim HMAC:** không tìm thấy đường giả mạo không cần `LMS_SESSION_SECRET`. Payload hoán đổi / chữ ký sai bị `verifyLmsToken` từ chối.
- **Đọc chéo gia đình hôm nay qua helper sở hữu:** `getApprovedChildren` lọc `parentAccountId` trên token đã ký + `Guardian` đã duyệt (`approved-children.ts:39-57`). Không có sink API `studentIds[0]` (đính chính `plan.md:76` đúng). Phụ huynh nhà A không đọc được HS nhà B **nếu** B1 giữ helper này và không tin `studentIds` trong JWT.
- **Gỡ `resetChildPassword` tự tạo lỗ mới:** không. Lỗ là **giữ** nó sau khi gộp kind (A1 ở trên). Gỡ là đúng.

---

## (b) A3 — helper nhật ký buổi và quy tắc công khai

### B1. “Đi theo quy tắc công khai nhật ký buổi” lộ nhận xét cả lớp

**Câu bị sai** — `phase-a3-bai-hoc-va-nhan-xet.md:89-92, 118-119, 111`:

> 2 | Phụ huynh chỉ xem được nhận xét **của con mình** | Đi qua đúng helper kiểm sở hữu đang dùng cho nhật ký buổi
> 3 | Nhận xét đi theo **quy tắc công khai của nhật ký buổi** đang có | Không tạo cơ chế hiển thị thứ hai

> Nhận xét lộ sang gia đình khác | Dùng lại helper sở hữu của nhật ký buổi; test âm bắt buộc

> Phụ huynh nhà A **không** đọc được nhận xét của học sinh nhà B (test âm)
> Nhận xét tuân theo đúng quy tắc công khai của nhật ký buổi

Hai ràng buộc **mâu thuẫn**. Helper sở hữu ≠ quy tắc công khai.

**Bằng chứng**

Nhật ký buổi là **một hàng / một buổi**, không phải một hàng / một học sinh. `listForChild` sau khi qua `getApprovedChildren` trả **mọi** evidence `published` của **mọi** lớp học sinh đó từng ghi danh — không lọc `studentId` trên nội dung, không lọc `Attendance`, không lọc `enrollment.status`:

```403:415:apps/api/src/session-evidence/router.ts
        const evidenceRows = await tx.sessionEvidence.findMany({
          where: {
            status: 'published',
            classSession: {
              classBatchId: { in: classBatchIds },
              status: { not: 'cancelled' },
            },
          },
```

```395:399:apps/api/src/session-evidence/router.ts
        const enrollments = await tx.enrollment.findMany({
          where: { studentId: input.studentId, facilityId: student.facilityId },
          select: { classBatchId: true },
        });
```

`canAccessSessionPhoto` còn rộng hơn: **bất kỳ** con đã duyệt của cùng phụ huynh đang ghi danh lớp đó + `photoConsent` (`photo-access.ts:50-80`). Đó là ACL ảnh lớp, không phải ACL nhận xét từng em.

`getApprovedChildren` **an toàn** cho câu “phụ huynh này có được **gọi tên** `studentId` này không”:

```48:51:apps/api/src/guardian/approved-children.ts
        where: {
          parentAccountId,
          student: { lifecycle: { notIn: ['blocked_lms', 'withdrawn'] } },
        },
```

Mẫu đúng cho dữ liệu **từng học sinh** đã có — `assessment.listForChild` lọc `studentId` sau cùng một helper (`assessment/router.ts:416-444`).

Nguồn **tách** hai lớp: nhật ký class-wide + nhận xét lọc theo con:

```493:496:cmc-lms/apps/api/src/routers/session-evidence.ts
          comments: { where: { studentId: { in: studentIds } }, select: { id: true, studentId: true, participation: true, strength: true, needsImprovement: true, teacherNote: true, student: { select: { id: true, fullName: true } } } },
```

`detailForPrincipal` lọc `comments.where.studentId = input.studentId` (`cmc-lms/.../session-evidence.ts:520`).

**Hậu quả nếu thi hành nguyên văn ràng buộc 3** (`include: { comments: true }` trên query `listForChild`, hoặc `canAccessSessionPhoto === true` ⇒ được đọc comments): phụ huynh học sinh B gọi `listForChild({ studentId: B })`, qua cổng lớp, nhận `participation` / `strength` / `needsImprovement` / `teacherNote` của học sinh A cùng lớp. Test âm “nhà lạ không Guardian” **vẫn xanh** — lỗ là **bạn cùng lớp**, không phải người ngoài.

`getApprovedChildren` không cứu được vì nó chỉ trả lời “B có phải con tôi không”, không lọc hàng nhận xét.

Mức: **HIGH** (đổi thi hành) — port **luật nguồn**: journal `published` + buổi không hủy cho phép xem **tóm tắt/ảnh lớp**; nhận xét `where studentId = con được duyệt`. ACL nhận xét = `assessment.listForChild`, không phải `listForChild` / `photo-access.ts`. Test âm bắt buộc: hai phụ huynh **cùng lớp**, không phải chỉ “nhà lạ”.

---

### B2. Helper sở hữu chưa biết tập chặn 6 giá trị — A3 “dùng lại” sẽ lệch A2

**Câu bị sai** — `phase-a3:91` “helper đang dùng cho nhật ký buổi” đọc như helper ổn định. A3 phụ thuộc A2 (`phase-a3:5`) nhưng không nói phải đổi tập `notIn`.

**Bằng chứng**

```50:50:apps/api/src/guardian/approved-children.ts
          student: { lifecycle: { notIn: ['blocked_lms', 'withdrawn'] } },
```

A2 chốt chặn `on_hold` / `withdrawn` / `transferred`; `completed` **không** chặn (`phase-a2:33-38`, `plan.md:120`). `cmc-lms` đã làm đúng:

```17:21:cmc-lms/apps/api/src/auth/sessions.ts
export const BLOCKED_LMS_LIFECYCLE = new Set<StudentLifecycle>([
  'on_hold',
  'withdrawn',
  'transferred',
]);
```

`plan.md:25` còn viết A không đụng `guardian/` — sai: A2 **bắt buộc** sửa đúng file B1 cũng sửa.

**Hậu quả:** A3 gắn nhận xét vào helper cũ → HS `transferred` vẫn đọc nhận xét; sau A2 nếu merge nuốt mất dòng `notIn` thì `on_hold` lọt. `completed` nếu lỡ bị nhét vào tập chặn thì mất đúng lịch sử A2 muốn giữ.

Mức: **MEDIUM** — A2 phải đổi `getApprovedChildren` (và `open-tier.ts:79,164`) **trước** A3. Một hàm thuần “tập chặn LMS”, không hard-code trong từng router.

---

### Không tìm thấy (b)

- **`getApprovedChildren` tự thủng sang nhà khác:** không. Cổng là `parentAccountId` + `Guardian` đã duyệt. Pending/rejected không tạo hàng (`approved-children.ts:1-5`).
- **Gắn RLS + `facilityId` cho bảng nhận xét** (ràng buộc A3 #1): đúng hướng; không phát hiện kế hoạch bỏ RLS trên nhận xét.
- **`internalNote` nhật ký lộ ra LMS:** không, nếu A3 không serialize field đó. Invariant đã có test (`session-evidence/publish.test.ts:319`).

---

## (c) A1 — mở lại lớp, gỡ khung, SoD

### C1. “`requirePermission` + AuditLog” không chỉ định khóa — `class.read` sẽ đưa GV/sale vào đường hồi sinh

**Câu bị sai** — `phase-a1:65-66`:

> 6. **Quyền + audit** — mở lại lớp và gỡ khung đều là thao tác vận hành: `requirePermission` + ghi `AuditLog`, theo khuôn `cmc_edu`

Không nói `module.action` nào.

**Bằng chứng**

Hủy buổi hôm nay là `schedule.generate` = **chỉ** `giam_doc_dao_tao`:

```292:292:apps/api/src/class/class-session-router.ts
  cancel: requirePermission('schedule', 'generate')
```

```122:122:packages/auth/src/index.ts
  'schedule.generate': ['giam_doc_dao_tao'],
```

Tạo lớp / gán GV: `class.create` = GĐĐT (`index.ts:112`; `class-batch-router.ts:56-59,145,351`).

`class.read` rộng hơn — GĐKD, GĐĐT, sale, **giáo viên** (`index.ts:116`). Giáo viên **không** hủy buổi được (`class-read-permission.test.ts` + comment `class-session-router.ts:1-7`).

Không có procedure close / reopen / xóa `ScheduleSlot` (`schema.prisma:662-665`: `status` closed “Not exercised by any P2-Foundation procedure yet”).

Nguồn: `close` / `reopen` / `removeSlot` / `cancelSession` **đều** `adminProcedure` — cùng một admin, không SoD hai người (`cmc-lms/apps/api/src/routers/class-batch.ts:680,771,950,1218`).

SoD thật trong `cmc_edu` chỉ ở tiền (`finance.receiptApprove` cấm `sale`, `index.ts:91-93`) và `enrollment.grantUnits` cấm sale (`index.ts:96-97`). `payslip.finalize` / `payslip.reopen` **chung roster** (`index.ts:156-158`).

**Hậu quả nếu “thao tác vận hành” bị gắn `class.read`:** giáo viên / sale / GĐKD mở lại lớp, hồi sinh buổi `class_closed` / `slot_removed`. Giáo viên không hủy được buổi hôm nay — cho họ reopen là **mũ mới**, không phải giữ nguyên SoD. AuditLog không chặn: `audit.list` chỉ `super_admin` (`index.ts:109`), GĐĐT còn không đọc được vết của chính mình.

**Hậu quả nếu bịa SoD “người hủy không được mở lại”:** không có căn cứ trong hai repo; trái nguồn (cùng admin undo).

Mức: **HIGH** — chốt khóa trước khi viết:
- gỡ/thêm khung + hủy/hồi `slot_removed` → `schedule.generate` (GĐĐT);
- đóng/mở lớp → `class.create` (GĐĐT), cùng kiểu reuse đã dùng cho `assignTeacher`.

Không đưa `giao_vien` vào khóa nào. Không tạo `class.reopen` với roster khác `class.create` trừ khi chủ hệ thống ra quyết định mới. AuditLog là vết, không phải cổng.

---

### Không tìm thấy (c)

- **Vi phạm SoD đang có:** không. Không có SoD học vụ cancel ↔ restore ở `cmc_edu` hay `cmc-lms`. Giữ GĐĐT cho cả hủy và hồi **không** phá ADR-B.
- **Giáo viên đóng/mở lớp hôm nay:** không — không có đường đóng, và GV không có `class.create` / `schedule.generate`.

---

## (d) Danh mục bài học toàn cục, không RLS

### Không tìm thấy rò dữ liệu học sinh giữa cơ sở

**Câu kế hoạch** — `phase-a3:44`, `plan.md:52`:

> Bảng bài học là **danh mục toàn cục** — không `facilityId`, không RLS | Cùng quy ước với `CurriculumUnit` và thư viện bài tập (QĐ 0021/0022)

Câu này **đúng** với code, không phải lỗ.

**Bằng chứng**

`CurriculumUnit` / `Exercise` / `ExerciseFolder` cố ý không RLS (`schema.prisma:777-809`; migration T2-I `20260706190000_t2i_exercise_foundation/migration.sql:71-85`). CSV bài học là `chu_de` / `bai_hoc` / tư duy / ghi chú Play Kit — **không** tên, SĐT, điểm, ảnh HS.

`curriculumUnit.list` = `exercise.manage` = GĐĐT (`exercise/router.ts:120-126`; `index.ts:124`). Giáo viên bị FORBIDDEN (`exercise/publish.test.ts:193-194`). Đóng dấu unit lên buổi: tra unit global, **ghi** session trong `withFacility` + `where: { facilityId }` (`class-session-router.ts:335-366`). `ClassSession` / `SessionEvidence` có RLS.

`cmc_app` không có `GRANT UPDATE` trên `CurriculumUnit` — importer/update chạy role privileged.

**Hậu quả nếu làm đúng ràng buộc 1:** mọi cơ sở thấy cùng giáo trình. Đó là QĐ 0021, không phải rò PII. Nhận xét HS nằm bảng **khác**, có `facilityId` + RLS (ràng buộc A3 #1) — đúng chỗ cô lập.

Lỗ **chỉ** xuất hiện nếu API mới `curriculumLesson.findMany({ include: { classSessions: { include: attendances } } })` kèm bypass RLS. Đó là bug API, không phải hệ quả của “không RLS trên danh mục”.

Mức: **không tìm thấy** (dữ liệu học sinh). Không đổi thi hành: tạo `CurriculumLesson` giống T2-I — không ENABLE RLS, không GRANT UPDATE trừ khi `cmc_app` phải sửa tại chỗ; đóng dấu bài đi đường `assignUnit` đã có.

---

## (e) DROP `LoginOtp` và GRANT privilege-hardening

### Không tìm thấy lỗ hổng GRANT sót sau DROP TABLE

**Câu bị phóng đại** — `plan.md:138` và `phase-b1:109`:

> R3 | Gỡ `LoginOtp` bỏ sót `GRANT` trong migration privilege-hardening | Migration drop phải gỡ cả grant; có bước kiểm boot-check

> Gỡ `LoginOtp` bỏ sót `GRANT` | Migration drop gỡ cả grant; boot-check phải qua

**Bằng chứng**

GRANT sống:

```52:52:packages/db/prisma/migrations/20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql
GRANT UPDATE ON "LoginOtp" TO "cmc_app";
```

Postgres gắn ACL vào OID bảng. `DROP TABLE "LoginOtp"` xóa quan hệ **và** GRANT. File migration cũ là sổ cái đã chạy, không phải GRANT đứng độc lập.

Tạo lại bảng cùng tên sau này nhận default Wave-A `SELECT, INSERT` only (`privilege_hardening/migration.sql:26-27`) — `GRANT UPDATE` lịch sử **không** tự dán lại.

Nguồn chỉ:

```1:3:cmc-lms/packages/db/prisma/migrations/20260807140000_drop_login_otp/migration.sql
DROP TABLE IF EXISTS "login_otp";
```

Không REVOKE, không từng có GRANT trong repo đó.

Boot-check **không** soi GRANT. `assertForceRlsOnAllRlsTables` chỉ quét bảng `relrowsecurity = true` (`boot-checks.ts:36-51`). `LoginOtp` chưa bao giờ bật RLS — drop không làm fail boot-check.

`REVOKE … ON "LoginOtp"` **sau** DROP thì lỗi `undefined_table`.

**Hậu quả nếu tin R3:** tốn công sửa migration cũ (cấm — checksum) hoặc viết REVOKE vô nghĩa. Không mở cửa đọc OTP của cơ sở khác, không để `cmc_app` UPDATE bảng đã chết.

Mức: **không tìm thấy** (lỗ GRANT). Hygiene: migration mới = `DROP TABLE IF EXISTS "LoginOtp"` (+ drop enum `LoginOtpStatus` nếu muốn catalog sạch). Đừng sửa file Wave-A. “Boot-check GRANT” không tồn tại — đừng bịa thêm trừ khi muốn inventory privilege riêng.

---

## Việc phải đổi khi thi hành

| # | Đổi gì | Vì sao |
|---|---|---|
| 1 | A3: nhận xét lọc `studentId`; test âm **cùng lớp** | Quy tắc nhật ký là cả lớp |
| 2 | B1: gỡ `resetChildPassword` + `loginStudent` **cùng cut** với gộp `kind` | Tránh cửa sổ leo thang |
| 3 | B1: khóa thử trên `ParentAccount` trước khi gỡ OTP | OTP đang là trần duy nhất phía phụ huynh |
| 4 | B1: không backfill `Cmc2026@` lên mật khẩu gia đình | Biến mặc định thành chiếm nhà |
| 5 | B1: tăng `tv` lúc cutover và lúc đổi mật khẩu; claim không chứa `studentIds` | Cookie không tồn tại; HMAC tái sử dụng 7 ngày |
| 6 | B1: `family` không vào `ROLES` | Trộn LMS với `can()` |
| 7 | A1: khóa `schedule.generate` / `class.create`; không `class.read` | GV/sale không được hồi sinh buổi |
| 8 | A2 trước A3: đổi tập chặn trong `getApprovedChildren` | Helper A3 đang đọc `blocked_lms` |

Không đổi: RLS danh mục bài học; REVOKE `LoginOtp` trước DROP; bịa SoD hai người cho đóng/mở lớp.
