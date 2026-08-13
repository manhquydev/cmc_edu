# Validate — công nghiệm thu có đo được không

Góc: **công kiểm chứng của 6 phase có viết được lệnh/test cụ thể không.**
Không red-team. Không sửa code. Mọi kết luận gắn `file:dòng` và `DUNG` / `SAI` / `KHONG KIEM DUOC`.

Đã đọc: `plan.md`, 6 file phase, `reports/redteam-adjudication-260813-0849.md`.
Đo bằng code tại `/home/manhquy/Downloads/cmc_edu`. Không chạy `pnpm acceptance:report` vì lệnh đó **ghi** `acceptance-report/verification.json` — vòng này chỉ được ghi đúng một file.

---

## Kết luận ngắn

Hầu hết cổng **đo được** trên khung test đã có: Vitest + Postgres cho API, Vitest thuần cho `@cmc/domain-lms` / `@cmc/auth`, Playwright UI cho journey, `node:test` cho importer. Không có cổng nào đòi một loại runner mà repo chưa có.

Ba chỗ **không đo đủ** theo đúng chữ kế hoạch:

1. A4 «chạy tiến rồi lùi được» — `ADD VALUE` enum Postgres **không lùi**; repo không có migration down.
2. A5 «khoá ổn định được ghi trong phase» — phase **chưa ghi khoá**.
3. B1 «`acceptance:report` ≥ mức trước / 3 flow» — số 3 **SAI** (đếm trùng P1-07); journey proven sẽ vỡ ít nhất **4** luồng, không phải 2.

---

## (a) Khung test theo tầng

| Tầng | Runner | Thu thập | Lệnh chạy |
|---|---|---|---|
| Unit thuần | Vitest | `packages/domain-lms/**/*.test.ts`, `packages/auth/src/index.test.ts`, một số file API không đụng DB | `pnpm --filter @cmc/domain-lms test` · `pnpm --filter @cmc/auth test` |
| Integration API (Postgres thật) | Vitest, `fileParallelism: false` | `apps/api/src/**/*.test.ts` **gồm cả** `*.int.test.ts` (`apps/api/vitest.config.ts:26`) | `pnpm --filter @cmc/api test` (cần `APP_DATABASE_URL`, từ chối DB tên `cmc_prod` — `apps/api/src/test/db.ts:20-40`) |
| Component admin | Vitest + jsdom (opt-in) | `apps/admin/src/**/*.test.{ts,tsx}` | `pnpm --filter @cmc/admin test` |
| Script / importer | `node:test` | `scripts/*.test.mjs` (`scripts/package.json:8`) | `node --test scripts/import-curriculum-units.test.mjs` |
| E2E API (không browser) | Playwright project `api` | `apps/e2e/tests/*.spec.ts` không có `.ui` (`playwright.config.ts:112-114`) | `pnpm --filter @cmc/e2e test` |
| E2E UI / journey | Playwright `ui-chromium` | `*.ui.spec.ts` + `*.journey.ui.spec.ts` — **chỉ** khi `PLAYWRIGHT_UI=1` (`playwright.config.ts:117-125`) | `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` |
| Sổ nghiệm thu | `tsx` quét code + ingest journey JSON | `scripts/acceptance-report/verify.ts` | `pnpm acceptance:report` |

**Không có** script `test:int` riêng. Bốn file `*.int.test.ts` chỉ là quy ước tên trong `apps/api/src/lms-ops/` (lms-ops, grant-units, exercise-delivery, bright-ig-gaps). Cùng một `vitest run`.

Đếm (lúc đo): 125 `apps/api` `*.test.ts` không phải int + 4 int; ~30 `packages/**/*.test.ts`; 9 e2e API spec + 48 e2e UI spec.

Helper caller: `appRouter.createCaller(buildStaffContext(...))` / `buildLmsContext(...)` — `apps/api/src/test/db.ts`. Pattern mẫu: `generate-sessions.test.ts:27-47`, `assign-teacher.test.ts:11-41`, `block-lms.test.ts`.

CI `typecheck-and-test` (`.github/workflows/ci.yml:28-145`): `prisma migrate deploy` → `pnpm typecheck` → `pnpm test` (turbo, **loại e2e**). `pnpm acceptance:report` trong job này là **non-blocking** (`continue-on-error`, `:140-142`). Journey proven nằm ở required check `ui-e2e`.

`apps/lms` **không** có `test` script. LMS đo bằng Playwright UI.

Không có harness `prisma migrate down` / migrate-với-fixture. Invariant schema đo bằng test DB: `checkin/status-check.test.ts`, `security/append-only-privilege.test.ts`, replay SQL `finance/receipt-attribution-backfill.test.ts`.

---

## (b) Cổng trùng giữa các phase

| Cặp | Cùng đo gì | Có phải trùng độc hại? |
|---|---|---|
| A1 «Không sinh buổi đôi» ↔ A3 «Thêm lại khung → cùng id, số buổi không tăng» | Gỡ khung + thêm khung cùng thứ/giờ + sinh buổi + đếm | **DUNG trùng kịch bản.** A1 dừng ở «số không tăng». A3 thêm «cùng id + lý do `slot_removed`». Một file int có thể cover cả hai; A3 **phải** kế thừa case A1, không viết lại rồi quên id. |
| A2 «Đóng lớp không đổi trạng thái buổi» ↔ A3 «Đóng lớp ⇒ hủy `class_closed`» | Cùng procedure đóng lớp | **DUNG đảo chiều.** Test A2 sẽ **đỏ** sau A3 nếu không sửa/xóa. Phải ghi rõ: cổng A2 là tạm; A3 sở hữu test đóng lớp. |
| A2 «Mở lại lớp có quyền + audit» ↔ A3 «Mở lại lớp chỉ hồi `class_closed`» | Cùng procedure mở lại | Không trùng assertion. A2 = quyền/vết. A3 = tập buổi hồi. Giữ hai test. |
| A4 `on_hold` chặn ↔ B1 helper sở hữu | `approved-children.ts` | Không trùng cổng. A4 **cấm** sửa file này (`phase-a4:70-73,99`); B1 gọi hàm thuần A4 xuất. Thiếu hợp đồng hàm thì hai làn lệch — đo ở A4 «luật hợp thành». |
| A4 đăng nhập vòng đời ↔ B1 gỡ `loginStudent` | Đường login | **DUNG phụ thuộc thứ tự.** Test A4 «withdrawn không login» viết trên `loginStudent` (`lms-auth/router.ts:525-621`) sẽ **chết** khi B1 gỡ procedure. B1.5 phải chuyển assertion sang login gia đình. |
| plan.md cổng A1/A3 «khoá duy nhất + không tạo hàng mới» | Cùng invariant | A1 đo chỉ mục. A3 đo `UPDATE` cùng id. Không trùng lệnh. |

Không có cổng A5 trùng A1–A4. Không có cổng B1 trùng A2/A3.

---

## (c) `pnpm acceptance:report` và `flow-manifest.ts`

Ledger: **43** luồng (`flow-manifest.ts:1, 22-1034`). 36 có `journey:`. 6 `no-ui-path` (P2-01/02/03/05, P3-10/11). P2-09 built, **không** journey.

Hai số khác nhau (`verify.ts:314-332`, `flow-evidence.ts`):

| Số | Ý nghĩa | Làm tụt khi nào |
|---|---|---|
| built / partial / missing | Claim `trpc` + `uiRoutes` + `models` còn tồn tại | Gỡ procedure/model/route đã khai |
| proven | Spec chạy xanh trên **đúng HEAD** và flow đang `built` | Journey đỏ, hoặc claim thành `partial` |

Orphan procedure chưa khai / chưa `DOCUMENTED_GAPS` → `process.exitCode = 1` (`verify.ts:211-228,405-412`). Namespace `lmsAuth` đang whitelist (`verify.ts:41-43`). Xóa namespace trước khi sửa whitelist → tool **crash**, không phải «tụt 2 flow».

`acceptance:report` trong `typecheck-and-test` **không chặn merge**. Journey đỏ chặn ở `ui-e2e`.

### Plan «1 claim P1-07, 2 journey P1-07+P1-04, 3 flow» — SAI số học

| Lát | Plan (`plan.md:80,174`, `phase-b1:68,148`) | Đo được |
|---|---|---|
| Flow **khai** procedure B1 sẽ gỡ | 1 (P1-07) | **DUNG** — chỉ P1-07 khai `lmsAuth.requestOtpEmail` / `verifyOtpEmail` + model `LoginOtp` (`flow-manifest.ts:190-206`) |
| Flow **journey** chết nếu gỡ OTP / `loginStudent` / `resetChildPassword` | 2 (P1-07, P1-04) | **SAI — thiếu** |
| «3 flow» | 1+2 | **SAI** — đếm P1-07 hai lần. Unique ID trong câu đó = 2 |

Journey proven B1 làm đỏ nếu không viết lại (cùng ledger):

| Flow | Journey | Vì sao |
|---|---|---|
| P1-07 | `lms-parent-otp-login.journey.ui.spec.ts` `:205` | claim OTP + `LoginOtp` + `/parent/home` |
| P1-04 | `lms-student-activation.journey.ui.spec.ts` `:109` | lái `loginStudent` + `resetChildPassword` (`:6-14,72`) |
| P2-08 | `lms-parent-evidence-consent.journey.ui.spec.ts` `:543` | phiên PH + `/parent/evidence/:studentId` `:521` |
| P4-01 | `lms-stars-redeem-cycle.journey.ui.spec.ts` `:833` | phiên HS + `/student/gifts` `:816` |

Ngoài sổ nhưng vẫn `ui-e2e`: `enrollment.spec.ts:85-94`, `attendance-grading.spec.ts:108-121`, `lms-auth.spec.ts`, `kind-isolation.spec.ts`, helper `mint-lms-session.ts`, P1-06 dùng client PH.

**Đúng:** 1 flow phải sửa **claim** (P1-07). Ít nhất **4** journey proven phải viết lại. Unique ID ≥ 4. «3» không phải số đo.

### Phase nào cần flow mới?

| Phase | Cần flow mới? | Làm tụt số? |
|---|---|---|
| A1 | **Không.** Gắn procedure mới (`schedule.update/archive`, `classSession.assignTeacher`) vào P2-01 (`flow-manifest.ts:313-333`) hoặc `DOCUMENTED_GAPS`. P2-01 đã `no-ui-path` `:343-346` — A1 **không tăng proven**. | Orphan chưa khai → tool exit 1. Proven không đổi. |
| A2 | **Không bắt buộc.** `classBatch.close/reopen` cùng quy tắc P2-01 / gap. UI mới + journey mới **chỉ** nếu muốn nâng proven. | Đổi/gỡ `student.setLifecycle` (P4-05 `:927`) hoặc `enrollment.blockLms` (P1-05 `:126`) mà không sửa claim → `partial`. |
| A3 | **Không.** `classSession.cancel` đã thuộc P2-01 `:323`. `lmsOps.cancelSessionAndRestamp` đã là gap (`verify.ts:87-88`). | Không tụt nếu giữ tên procedure. |
| A4 | **Không.** Login thuộc `lmsAuth` (whitelist). Hồ sơ không cần flow. | Đổi tên `enrollment.blockLms` / `student.setLifecycle` mà quên claim → `partial` P1-05/P4-05. Proven của hai flow đó **không** lái hai procedure này. |
| A5 | **Không bắt buộc.** `curriculumUnit.list` đã là gap (`verify.ts:62-63`). Hiện bài trên buổi = cột thêm ở `classSession.get` (P2-01 đã khai `:327`). | Procedure CRUD bài mới phải claim/gap. |
| B1 | **Không thêm ID song song.** Sửa P1-07 (đổi procedure + model + route). Giữ P1-04 nếu còn `StudentAccount`. | **Có, nếu thiếu B1.5:** P1-07 → `partial`/`missing`; 4 journey proven đỏ. Xóa `/parent/*` `/student/*` còn làm `partial` P2-08, P4-01, P2-03, P2-05. |

Mốc «không tụt» (`plan.md:162`) đo được bằng chụp **trước khi sửa**:

```bash
cd /home/manhquy/Downloads/cmc_edu
pnpm acceptance:report
# đọc dòng: "N luồng (B built, …)" và "bằng chứng chạy — P/N luồng đã chứng minh chạy"
# lưu 2 số (built, proven) vào báo cáo phase; so lại sau mỗi PR
```

File `acceptance-report/verification.json` hiện tại **không** dùng làm mốc: `dirty: true`, SHA kết quả ≠ HEAD.

---

## Từng cổng «Kiểm chứng»

Quy ước: **ĐO ĐƯỢC** = viết được lệnh/test với assertion cụ thể. **KHÔNG ĐO ĐỦ** = có lệnh nhưng không phủ đúng chữ cổng. **KHÔNG ĐO ĐƯỢC** = không viết được assertion đóng.

### A1 — `phase-a1-nen-lich-buoi-an-toan.md:86-95`

#### 1. Không còn khoá bám id khung

**ĐO ĐƯỢC.** Tầng: schema + migration (CI `migrate deploy`) + rg.

```bash
# sau PR A1 — cả hai phải đúng
rg -n '@@unique\(\[classBatchId, sessionDate, startTime\]\)' \
  /home/manhquy/Downloads/cmc_edu/packages/db/prisma/schema.prisma
# kỳ vọng khớp schema.prisma:765 đổi sang 3 cột đó (hiện đang classBatchId, scheduleSlotId, sessionDate)

rg -n 'ClassSession_classBatchId_scheduleSlotId_sessionDate_key' \
  /home/manhquy/Downloads/cmc_edu/packages/db/prisma/migrations
# kỳ vọng: chỉ còn file migration CŨ (20260706170000 …:139-140); migration MỚI DROP index này
```

Assertion DB (thêm vào `apps/api/src/class/generate-sessions.test.ts`, tầng integration):

```ts
// Hai khung khác id, cùng weekday+startTime, cùng ngày → createMany buổi thứ hai bị unique chặn
// (hôm nay khoá cũ CHO PHÉP — skipDuplicates chỉ nhìn slotId: schedule-router.ts:71-81)
```

#### 2. Gỡ khung không xóa hàng

**ĐO ĐƯỢC** sau khi A1 thêm procedure lưu trữ. Tầng: integration API. File mới / mở `apps/api/src/class/generate-sessions.test.ts`.

```ts
// arrange: classBatch.create slots Mon 18:00 → N buổi, giữ slotId + session.scheduleSlotId
const before = await testDbBypass(tx => tx.scheduleSlot.findUnique({ where: { id: slotId } }));
await gddt.schedule.archiveSlot({ scheduleSlotId: slotId }); // tên chốt khi thi hành
const slot = await testDbBypass(tx => tx.scheduleSlot.findUnique({ where: { id: slotId } }));
expect(slot).not.toBeNull();
expect(slot.archivedAt).not.toBeNull(); // hoặc cờ tương đương
const sessions = await testDbBypass(tx => tx.classSession.findMany({ where: { scheduleSlotId: slotId } }));
expect(sessions.length).toBeGreaterThan(0);
expect(sessions.every(s => s.scheduleSlotId === slotId)).toBe(true);
```

Chạy: `pnpm --filter @cmc/api test -- src/class/generate-sessions.test.ts`

Hôm nay **chưa có** API gỡ (`schedule-router.ts:31-93` chỉ `generateSessions`) — test viết RED rồi làm xanh là đúng.

#### 3. Không sinh buổi đôi

**ĐO ĐƯỢC.** Tầng: integration. Đúng kịch bản user nêu. Mở `generate-sessions.test.ts` cạnh case idempotent `:111-127`.

```ts
it('archive slot + add same weekday/time + generateSessions does not duplicate days', async () => {
  const created = await gddt.classBatch.create({
    courseId, startDate: '2026-08-03', endDate: '2026-08-31',
    slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
  });
  const n0 = await testDbBypass(tx => tx.classSession.count({ where: { classBatchId: created.classBatch.id } }));
  const slot = await testDbBypass(tx => tx.scheduleSlot.findFirst({ where: { classBatchId: created.classBatch.id } }));
  await gddt.schedule.archiveSlot({ scheduleSlotId: slot.id });
  await gddt.schedule.addSlot({ classBatchId: created.classBatch.id, weekday: 1, startTime: '18:00', endTime: '19:30' });
  const regen = await gddt.schedule.generateSessions({ classBatchId: created.classBatch.id });
  const n1 = await testDbBypass(tx => tx.classSession.count({ where: { classBatchId: created.classBatch.id } }));
  expect(n1).toBe(n0);
  expect(regen.sessionsCreated).toBe(0);
});
```

Case hiện có (`:111-127`) **chỉ** chứng minh re-run cùng khung — **không** đủ cổng này.

#### 4. Giáo viên buổi

**ĐO ĐƯỢC.** Tầng: schema + integration + backfill query.

```bash
rg -n 'teacherId' /home/manhquy/Downloads/cmc_edu/packages/db/prisma/schema.prisma
# hôm nay ClassSession KHÔNG có teacherId (schema.prisma:731-771); ClassBatch.teacherId:661
```

```ts
// sau backfill
const orphans = await testDbBypass(tx => tx.classSession.count({ where: { teacherId: null } }));
expect(orphans).toBe(0); // hoặc: lớp không GV thì null + API báo ra (E-6, phase-a1:103)

const created = await gddt.classBatch.create({ ..., teacherId: teacherAppUserId, slots: [...] });
const sessions = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId: created.classBatch.id } }));
expect(sessions.every(s => s.teacherId === teacherAppUserId)).toBe(true);
```

Pattern sẵn: `assign-teacher.test.ts:43-47` (đang gán **lớp**, chưa buổi).

#### 5. Đổi giáo viên một buổi

**ĐO ĐƯỢC.** Tầng: integration + registry unit. File mới `apps/api/src/class/assign-session-teacher.test.ts` copy `assign-teacher.test.ts`.

```ts
await gddt.classSession.assignTeacher({ sessionId: s1.id, teacherAppUserId: gvB.id });
const rows = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId } }));
expect(rows.find(r => r.id === s1.id)?.teacherId).toBe(gvB.id);
expect(rows.filter(r => r.id !== s1.id).every(r => r.teacherId !== gvB.id)).toBe(true);
const batch = await testDbBypass(tx => tx.classBatch.findUnique({ where: { id: classBatchId } }));
expect(batch.teacherId).not.toBe(gvB.id); // lớp không đổi

const logs = await testDbBypass(tx => tx.auditLog.findMany({ where: { entityId: s1.id, action: { contains: 'assignTeacher' } } }));
expect(logs).toHaveLength(1);

await expect(sale.classSession.assignTeacher(...)).rejects.toMatchObject({ code: 'FORBIDDEN' });
await expect(gv.classSession.assignTeacher(...)).rejects.toMatchObject({ code: 'FORBIDDEN' });
```

Registry: thêm key rồi `pnpm --filter @cmc/auth test` — pattern `packages/auth/src/index.test.ts:38-42`.

#### 6. Migration an toàn (dữ liệu mẫu trùng → dừng, không ghi nửa)

**KHÔNG ĐO ĐỦ.** Tầng đáng lẽ: SQL trong migration + test replay. Repo **không** có runner migrate-với-fixture (`@cmc/db` không có `test` script). CI `migrate deploy` chạy DB trống (`ci.yml:68-69`), không đụng dữ liệu mẫu.

Đo **được** phần invariant (pattern `status-check.test.ts`):

```ts
// Hôm nay unique cũ CHO PHÉP hai buổi cùng (lớp, ngày, startTime) khác slotId.
// Test cổng chặn: insert 2 hàng đó bằng testDbBypass, chạy đúng SQL CHECK của migration, kỳ vọng throw.
const dupes = await testDbBypass(async tx => tx.$queryRaw`
  SELECT "classBatchId", "sessionDate", "startTime", COUNT(*)::int AS n
  FROM "ClassSession" GROUP BY 1,2,3 HAVING COUNT(*) > 1`);
// script/migration: IF EXISTS dupes THEN RAISE EXCEPTION ...
```

«Dừng giữa chừng, không ghi nửa»: **ĐO ĐƯỢC** nếu CHECK + `DROP INDEX` + `CREATE UNIQUE` nằm **cùng transaction** Prisma (mặc định). `CREATE INDEX CONCURRENTLY` / một số `ALTER TYPE` không vào transaction — nếu A1 dùng vậy thì cổng này **KHÔNG ĐO ĐƯỢC** bằng test tự động.

«Dữ liệu mẫu đã có buổi trùng»: **KHÔNG KIỂM ĐƯỢC** từ repo (không đọc DB triển khai; seed test tự tạo facility).

---

### A2 — `phase-a2-trang-thai-lop.md:97-105`

#### 1. Tập đóng (ghi ngoài tập → DB từ chối)

**ĐO ĐƯỢC.** Tầng: integration DB, không chỉ Zod. Pattern `apps/api/src/checkin/status-check.test.ts`.

```ts
await expect(
  testDbBypass(tx => tx.classBatch.update({
    where: { id: batchId },
    data: { status: 'weird' as never },
  })),
).rejects.toThrow(); // enum / CHECK
```

Hôm nay `status String @default("active")` (`schema.prisma:662-665`) — update `'weird'` **thành công**. Test RED là đúng.

#### 2. Ánh xạ 5 giá trị nguồn có trong phase và tài liệu quyết định

**ĐO ĐƯỢC** như cổng **tài liệu**, không phải test sản phẩm.

```bash
# năm giá trị nguồn phải có mặt trong phase
for v in running open planned closed cancelled; do
  rg -n "$v" /home/manhquy/Downloads/cmc_edu/plans/260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/phase-a2-trang-thai-lop.md
done
# bảng ánh xạ đã có phase-a2:52-59 — DUNG cho "có mặt trong phase"
```

«Tài liệu quyết định»: **KHÔNG KIỂM ĐƯỢC** hôm nay — chưa có file quyết định riêng cho bảng này (khác `plans/reports/decisions-owner-260812-cau-6-7.md` của B1). Sau khi ghi, lặp lệnh `rg` trên file đó.

Đây không phải cổng CI sản phẩm trừ khi họ thêm `node:test` đọc markdown.

#### 3. Quyền — GV và sale bị từ chối

**ĐO ĐƯỢC.** Tầng: registry unit + integration âm.

```ts
// packages/auth/src/index.test.ts
expect(can({ userId: 's', roles: ['sale'] }, 'class', 'close')).toBe(false); // tên key chốt khi thi hành — phase-a2:74-76
expect(can({ userId: 'g', roles: ['giao_vien'] }, 'class', 'close')).toBe(false);
expect(can({ userId: 's', roles: ['sale'] }, 'class', 'read')).toBe(true); // không dùng nhầm class.read :116

// apps/api — copy assign-teacher.test.ts:67-71
await expect(sale.classBatch.close({ classBatchId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
await expect(gv.classBatch.close({ classBatchId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
await expect(sale.classBatch.reopen({ classBatchId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
```

`PermissionGate` route quản trị: `apps/admin/src/lib/permission-gate.test.tsx` + khai trong `admin.routes.tsx` (mẫu finance `:48-81`).

Tên khoá **chưa chốt** (`phase-a2:74-76`) — test viết được với mọi tên thuộc nhóm đào tạo, không phải `class.read`.

#### 4. Ghi vết — đúng một bản ghi / lần, có người

**ĐO ĐƯỢC.** Tầng: integration. Pattern `cancel-session.ts:102-114`.

```ts
const before = await testDbBypass(tx => tx.auditLog.count({ where: { entityId: batchId } }));
await gddt.classBatch.close({ classBatchId: batchId });
const logs = await testDbBypass(tx => tx.auditLog.findMany({
  where: { entity: 'ClassBatch', entityId: batchId, action: { contains: 'close' } },
}));
expect(logs).toHaveLength(1);
expect(logs[0].actor).toBe('gddt-…');
await gddt.classBatch.reopen({ classBatchId: batchId });
const logs2 = await testDbBypass(tx => tx.auditLog.findMany({
  where: { entityId: batchId, action: { contains: 'reopen' } },
}));
expect(logs2).toHaveLength(1);
```

#### 5. Không rò sang A3 — đóng lớp không đổi trạng thái buổi

**ĐO ĐƯỢC ở A2. SAI nếu giữ nguyên sau A3.**

```ts
const before = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId } }));
await gddt.classBatch.close({ classBatchId });
const after = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId } }));
expect(after.map(s => s.status)).toEqual(before.map(s => s.status));
```

A3 bước 5 (`phase-a3:76-77`) **đảo** cổng này. Test phải chuyển sang A3 hoặc đánh dấu chỉ chạy trước A3.

---

### A3 — `phase-a3-ly-do-huy-va-hoi-sinh.md:80-90`

Mở rộng `apps/api/src/lms-ops/lms-ops.int.test.ts` (cancel hiện chỉ chiều hủy `:198-277`). `cancelSessionWithRestamp` hôm nay **không** nhận lý do (`cancel-session.ts:30-38`).

#### 1. Gỡ khung → tương lai `slot_removed`; quá khứ không đổi

**ĐO ĐƯỢC.** Tầng: integration.

```ts
// buổi quá khứ: sessionDate < hôm nay, status planned/confirmed (hoặc done)
// buổi tương lai: sessionDate > hôm nay
await gddt.schedule.archiveSlot({ scheduleSlotId });
const rows = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId } }));
expect(rows.filter(s => s.sessionDate > now).every(s => s.status === 'cancelled' && s.cancelReason === 'slot_removed')).toBe(true);
expect(rows.filter(s => s.sessionDate <= now).every(s => s.status !== 'cancelled' || s.cancelReason !== 'slot_removed')).toBe(true);
```

#### 2. Thêm lại khung → cùng id; số buổi không tăng

**ĐO ĐƯỢC.** Tầng: integration. Kế thừa A1.3.

```ts
const idsBefore = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId }, select: { id: true, status: true } }));
await gddt.schedule.addSlot({ classBatchId, weekday: 1, startTime: '18:00', endTime: '19:30' });
const after = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId } }));
expect(after).toHaveLength(idsBefore.length);
expect(new Set(after.map(s => s.id))).toEqual(new Set(idsBefore.map(s => s.id)));
expect(after.filter(s => idsBefore.find(b => b.id === s.id)?.status === 'cancelled')
  .every(s => s.status !== 'cancelled')).toBe(true); // những hàng slot_removed sống lại
```

#### 3. Không hồi sai — `manual` vẫn hủy

**ĐO ĐƯỢC.**

```ts
await gddt.classSession.cancel({ sessionId: futureId, reason: 'manual' });
await gddt.schedule.archiveSlot(...); // hoặc chỉ addSlot lại
await gddt.schedule.addSlot({ ..., weekday, startTime });
const row = await testDbBypass(tx => tx.classSession.findUnique({ where: { id: futureId } }));
expect(row.status).toBe('cancelled');
expect(row.cancelReason).toBe('manual');
```

#### 4. Mở lại lớp — chỉ `class_closed` sống

**ĐO ĐƯỢC.**

```ts
// arrange 3 buổi tương lai: manual / ceiling / (sẽ thành class_closed khi đóng)
await gddt.classSession.cancel({ sessionId: m.id, reason: 'manual' });
await gddt.classSession.cancel({ sessionId: c.id, reason: 'ceiling' });
await gddt.classBatch.close({ classBatchId }); // A3: hủy phần còn lại = class_closed
await gddt.classBatch.reopen({ classBatchId });
const rows = await testDbBypass(tx => tx.classSession.findMany({ where: { id: { in: [m.id, c.id, closed.id] } } }));
expect(rows.find(r => r.id === closed.id)?.status).not.toBe('cancelled');
expect(rows.find(r => r.id === m.id)?.status).toBe('cancelled');
expect(rows.find(r => r.id === c.id)?.status).toBe('cancelled');
```

#### 5. Đóng băng — buổi đã điểm danh giữ dấu unit

**ĐO ĐƯỢC** sau khi chốt chính sách. Tầng: integration. Hiện đóng băng theo `done` **không** theo điểm danh (`stamp-sessions.ts:60-64`).

```ts
// dãy ≥ 8 buổi, stamp unit; điểm danh buổi giữa (attendance.mark) NHƯNG để status ≠ done
const unitBefore = mid.curriculumUnitId;
await gv.attendance.mark({ classSessionId: mid.id, ... });
await gddt.classSession.cancel({ sessionId: firstFuture.id, reason: 'manual' });
// + hồi sinh nếu có đường
const midAfter = await testDbBypass(tx => tx.classSession.findUnique({ where: { id: mid.id } }));
expect(midAfter.curriculumUnitId).toBe(unitBefore);
```

Chính sách «chốt khi thi hành» (`phase-a3:48-56`) — assertion trên **đúng** nếu họ giữ đề xuất điểm danh. Nếu đổi mốc, đổi expect, không đổi tầng.

#### 6. Dãy không liền mạch — báo ra, không im lặng sửa

**KHÔNG ĐO ĐỦ** hôm nay. «Báo ra» chưa có mã lỗi / shape (`phase-a3:52-53,89`).

Lệnh viết được **sau khi** chốt 1 mã (ví dụ `UNIT_STAMP_GAP`):

```ts
await expect(gddt.schedule.addSlot(...)).rejects.toMatchObject({
  code: 'BAD_REQUEST',
  message: expect.stringMatching(/UNIT_STAMP_GAP|dãy không liền/),
});
const stamps = await testDbBypass(tx => tx.classSession.findMany({ where: { classBatchId }, select: { id: true, curriculumUnitId: true } }));
expect(stamps).toEqual(stampsBefore); // không tự sửa
```

Không có mã lỗi → **KHÔNG ĐO ĐƯỢC** (không biết expect cái gì).

#### 7. Không đường hủy thiếu lý do — đo bằng kiểu

**ĐO ĐƯỢC.** Tầng: typecheck, không phải runtime.

```bash
pnpm --filter @cmc/api typecheck
```

Assertion: `cancelSessionWithRestamp` opts.reason **bắt buộc**, không `?`, không default (`cancel-session.ts:32-38` hôm nay không có field này). Caller `class-session-router.ts:298-303` và `lms-ops/router.ts:406-410` phải truyền tường minh — thiếu là TS2345.

Bổ sung (không thay typecheck): `expectTypeOf<Parameters<typeof cancelSessionWithRestamp>[1]>().toHaveProperty('reason')`.

---

### A4 — `phase-a4-vong-doi-va-ho-so-hoc-sinh.md:112-123`

Hàm thuần mới: `packages/domain-lms` (coverage 90% — `packages/domain-lms/vitest.config.ts:10-12`). A4 **không** sửa `approved-children.ts` (`phase-a4:99`).

#### 1. Migration tiến rồi lùi; không giá trị cũ; không hàng mồ côi

**KHÔNG ĐO ĐỦ.**

- `RENAME VALUE blocked_lms → on_hold`: lùi được bằng `RENAME` ngược. **ĐO ĐƯỢC** thủ công trên DB throwaway: `prisma migrate deploy` rồi SQL `ALTER TYPE ... RENAME VALUE`.
- `ADD VALUE` admitted / transferred / completed: Postgres **không drop** enum value. Repo **không** có down migration (chỉ `migration.sql` một chiều).
- «Chạy tiến rồi lùi được» cho **cả** migration A4: **SAI** nếu hiểu là `migrate down` toàn bộ.

Đo được phần dữ liệu sau deploy:

```sql
SELECT lifecycle::text, COUNT(*) FROM "Student" GROUP BY 1;
-- không còn 'blocked_lms'
SELECT COUNT(*) FROM "Student" WHERE lifecycle IS NULL; -- 0
```

Trong test: `pnpm --filter @cmc/api test -- src/enrollment/block-lms.test.ts` sau khi đổi mọi literal `blocked_lms` → `on_hold`.

#### 2. `completed` xem được điểm / nhận xét / bài đã nộp

**ĐO ĐƯỢC.** Tầng: integration. Mở `assessment/draft-confirm.test.ts:436`, `submission/list-for-child.test.ts:116`, `attendance/list-for-child.test.ts:74`.

```ts
await testDbBypass(tx => tx.student.update({ where: { id }, data: { lifecycle: 'completed' } }));
const grades = await parent.reportCard.getForChild({ studentId: id, period: '2026-08' });
const comments = await parent.assessment.listForChild({ studentId: id });
const work = await parent.submission.listForChild({ studentId: id });
expect(grades).toBeTruthy();
expect(comments.items.length).toBeGreaterThan(0);
expect(work.items.length).toBeGreaterThan(0);
```

`completed` **không** nằm tập chặn đề xuất (`phase-a4:40`) — `getApprovedChildren` (sau khi B1 gọi hàm A4) phải trả HS này.

#### 3. `completed` không nhận bài mới

**ĐO ĐƯỢC.** Tầng: integration. Mở `exercise/open-tier.test.ts:183-192` (hiện chỉ `blocked_lms`).

```ts
await testDbBypass(tx => tx.student.update({ where: { id }, data: { lifecycle: 'completed' } }));
const open = await listOpenExercisesForStudent(db, student);
expect(open).toEqual([]); // hoặc openForStudent FORBIDDEN
```

Hôm nay `open-tier.ts:79` chỉ chặn `blocked_lms` — completed **vẫn** mở bài. Test RED là đúng.

#### 4. `on_hold` chặn; bỏ `on_hold` mở lại ngay

**ĐO ĐƯỢC.** Pattern `block-lms.test.ts:48-76`.

```ts
await gdkd.student.setLifecycle({ studentId, lifecycle: 'on_hold' }); // input enum hôm nay: student/router.ts:125
await expect(parent.enrollment.mine()).resolves.toEqual(expect.not.arrayContaining([expect.objectContaining({ studentId })]));
await gdkd.student.setLifecycle({ studentId, lifecycle: 'active' });
const children = await getApprovedChildren(db, parentId); // sau B1: qua hàm thuần
expect(children.some(c => c.studentId === studentId)).toBe(true);
```

#### 5. Luật hợp thành — bốn tổ hợp

**ĐO ĐƯỢC** nhưng **KHÔNG ĐỦ** chữ luật completed.

Tầng: unit `packages/domain-lms/src/<ten-ham>.test.ts`.

```ts
// giả sử canAccessLms({ lifecycle, entitled }) — hợp đồng chưa ghi (phase-a4:70-73)
expect(canAccessLms({ lifecycleOk: true,  entitled: true  })).toEqual({ history: true,  newWork: true  });
expect(canAccessLms({ lifecycleOk: true,  entitled: false })).toEqual({ history: true,  newWork: false });
expect(canAccessLms({ lifecycleOk: false, entitled: true  })).toEqual({ history: false, newWork: false });
expect(canAccessLms({ lifecycleOk: false, entitled: false })).toEqual({ history: false, newWork: false });
```

Luật viết (`phase-a4:62-67`): `completed` + hết dải ⇒ **xem lịch sử**, không nhận bài mới. Đó **không** phải 1 trong 4 ô nếu `lifecycleOk` là boolean thô. Cần thêm:

```ts
expect(canAccessLms({ lifecycle: 'completed', entitled: true  })).toEqual({ history: true, newWork: false });
expect(canAccessLms({ lifecycle: 'completed', entitled: false })).toEqual({ history: true, newWork: false });
```

Bốn tổ hợp **đo được**; cổng «đủ luật đã viết» **KHÔNG ĐO ĐỦ** nếu chỉ 4 case.

Chạy: `pnpm --filter @cmc/domain-lms test`

#### 6. Không router nào tự diễn giải

**KHÔNG ĐO ĐỦ.** Không có test chứng minh *mọi* cổng. Đo được tập **đã biết** bằng rg:

```bash
rg -n "blocked_lms|'on_hold'|'withdrawn'|BLOCKED_TEACHING_LIFECYCLES" \
  /home/manhquy/Downloads/cmc_edu/apps/api/src \
  --glob '!**/*.test.ts'
# sau A4: literal tập chặn chỉ còn trong packages/domain-lms + migration
# hiện rải: approved-children.ts:50, on-roster.ts:11, open-tier.ts:79,164, student/router.ts:125
```

`on-roster.ts:11` là tập **thứ hai** ngoài `approved-children.ts`. A4 phải chuyển cả hai sang hàm chung; test rg là hàng rào, không phải chứng minh đóng.

#### 7. Đăng nhập — withdrawn không vào được

**ĐO ĐƯỢC.** Tầng: integration. `loginStudent` hôm nay **không** đọc lifecycle (`lms-auth/router.ts:525-621`) — test RED.

```ts
await testDbBypass(tx => tx.student.update({ where: { id }, data: { lifecycle: 'withdrawn' } }));
await expect(anon.lmsAuth.loginStudent({ phone, password })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
// sau B1: đổi sang loginFamilyByPhone / tên mới
```

Thêm 1 case / giá trị vòng đời (ràng buộc phase-a4:133). File: `lms-auth/login.test.ts` (OTP + picker `blocked_lms` đã có `:225-236`, **không** cover loginStudent).

#### 8. Hồ sơ — bốn trường; mã unique; nhập nguyên văn không sinh lại

**ĐO ĐƯỢC.** Tầng: schema + integration.

```bash
rg -n 'studentCode|dateOfBirth|gender|note' \
  /home/manhquy/Downloads/cmc_edu/packages/db/prisma/schema.prisma
# hôm nay Student chỉ fullName/lifecycle (schema.prisma:423-431)
```

```ts
const a = await createStudent({ studentCode: 'CMC-HS-001', ... });
await expect(createStudent({ studentCode: 'CMC-HS-001', ... })).rejects.toThrow(); // unique
const imported = await importStudentFromSource({ studentCode: '12A-0033', ... });
expect(imported.studentCode).toBe('12A-0033'); // không chạy counter
```

Mẫu counter: `ReceiptCodeCounter` / `ClassBatchCodeCounter` / `EmployeeCodeCounter` — **chưa** có cho HS. Test «không sinh lại khi nhập» cần đường import (Đợt 5) hoặc API create nhận `studentCode` optional.

Quy ước ngày (`phase-a4:101`): đối chiếu ICT midnight — pattern `generate-sessions.test.ts` ICT. 11 HS thật: **KHÔNG KIỂM ĐƯỢC** trong phase này (chưa nhập).

---

### A5 — `phase-a5-bai-hoc-trong-unit.md:85-96`

Importer: `packages/db/prisma/import-curriculum-units.mjs`. Test thuần đã có `scripts/import-curriculum-units.test.mjs:28-31` (240 dòng). CSV đo lại vòng này: 240 dòng; UCREA 36×90; Bright I.G 36×110; Black Hole 168×110; `ghi_chu` trống 210; `bai_hoc` trống 0.

Chạy thuần: `node --test scripts/import-curriculum-units.test.mjs`  
Chạy DB (seed): `DATABASE_URL=… node packages/db/prisma/import-curriculum-units.mjs`  
hoặc `npx tsx scripts/ensure-curriculum-units.ts`

#### 1. Idempotent — hai lần vẫn 96 unit + 240 bài

**ĐO ĐƯỢC.** Tầng: script + DB (test hiện **không** đụng DB — `import-curriculum-units.test.mjs:1-4`).

```ts
await importCurriculumUnits();
await importCurriculumUnits();
const units = await db.curriculumUnit.count();
const lessons = await db.curriculumLesson.count(); // tên bảng chốt khi thi hành
expect(units).toBe(96);
expect(lessons).toBe(240);
```

#### 2. Số bài/unit 1 / 2 / 4

**ĐO ĐƯỢC.**

```sql
SELECT u.program, COUNT(l.*)::float / COUNT(DISTINCT u.id)
FROM "CurriculumUnit" u JOIN "CurriculumLesson" l ON l.unit_id = u.id
GROUP BY 1;
-- UCREA 1, BRIGHT_IG 2, BLACK_HOLE 4
```

Hoặc đếm sau `groupCurriculumUnits` khi importer trả `lessons`.

#### 3. Thời lượng 90 / 110

**ĐO ĐƯỢC.** Cột CSV `thoi_luong_buoi_phut` (header dòng 1).

```ts
const { units } = loadCurriculumUnitsFromCsv(csvPath); // sau khi importer giữ duration
expect(units.filter(u => u.program === 'UCREA').every(u => u.durationMinutes === 90)).toBe(true);
expect(units.filter(u => u.program !== 'UCREA').every(u => u.durationMinutes === 110)).toBe(true);
```

#### 4. Khoá ổn định — ghi trong phase; CSV xáo thứ tự vẫn khớp hàng cũ

**KHÔNG ĐO ĐƯỢC** nguyên văn hôm nay. Bước 2 (`phase-a5:81`) «Chọn và ghi ra» — phase **chưa** chọn `lessonCode` hay `(program, orderGlobal, topic_no)`.

Sau khi ghi khoá K:

```ts
const first = await importCurriculumUnits();
const shuffled = shuffleCsvRows(csvPath);
const second = await importCurriculumUnitsFrom(shuffled);
expect(second.lessons.map(l => l.id).sort()).toEqual(first.lessons.map(l => l.id).sort());
expect(await db.curriculumLesson.count()).toBe(240);
```

Cổng «khoá được ghi trong phase»:

```bash
rg -n 'lessonCode|topic_no|khoá ổn định' \
  /home/manhquy/Downloads/cmc_edu/plans/260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/phase-a5-bai-hoc-trong-unit.md
```

Hiện chỉ có *lựa chọn*, không có quyết định — lệnh trên **không** ra một khoá.

#### 5. Dấu bài — buổi hiện đúng bài theo dấu unit

**ĐO ĐƯỢC.** Tầng: integration stamp (`stamp-sessions.ts` + domain-lms) + UI admin.

```ts
// sau restamp: session.curriculumUnitId = U, session.lessonId = bài thứ k trong U
// k suy từ vị trí buổi trong unit (1/2/4) — cùng đường deriveSessionUnits
const s = await testDbBypass(tx => tx.classSession.findFirst({ where: { id }, include: { lesson: true, curriculumUnit: true } }));
expect(s.lesson.unitId).toBe(s.curriculumUnitId);
```

UI: `apps/admin/src/pages/classes/class-detail.tsx:309-322` đang hiện **unit picker**, chưa bài. Test component `class-detail.test.tsx` thêm assert text bài. `apps/admin` Vitest jsdom.

#### 6. Không fail-closed — unit không bài vẫn mở buổi

**ĐO ĐƯỢC.**

```ts
const unit = await seedCurriculumUnit({ ... }); // 0 lesson
const session = await seedClassSession({ curriculumUnitId: unit.id });
const dto = await gv.classSession.get({ sessionId: session.id });
expect(dto.id).toBe(session.id); // không throw
await expect(gv.attendance.listBySession({ sessionId: session.id })).resolves.toBeTruthy();
```

#### 7. Ghi chú trống — 210 dòng nhập không lỗi

**ĐO ĐƯỢC.**

```ts
const rows = readCurriculumCsv(csvPath);
expect(rows.filter(r => !(r.ghi_chu || '').trim())).toHaveLength(210);
await expect(importCurriculumUnits()).resolves.toBeTruthy();
```

Cột note phải nullable (ràng buộc 5, `phase-a5:72`).

---

### B1 — `phase-b1-danh-tinh-gia-dinh.md:135-142`

Bullet, không bảng. Tên procedure login **chưa chốt** (ranh giới 1–8, `:72-87`).

#### 1. Không còn `kind` parent/student trong mã và token

**ĐO ĐƯỢC.** Tầng: rg + unit token.

```bash
rg -n "kind: 'parent'|kind: 'student'|kind !== 'parent'" \
  /home/manhquy/Downloads/cmc_edu/apps /home/manhquy/Downloads/cmc_edu/packages \
  --glob '!**/plans/**' --glob '!**/*.md'
# hôm nay cứng ở session-token.ts:22,106 và parseLmsToken lms-session.tsx:50
```

```ts
// session-token.test.ts — kind claim chỉ còn 'family' (hoặc giá trị đã chốt)
const claims = verifyLmsToken(token, secret);
expect(claims.kind).toBe('family');
```

#### 2. Nhà 2 con cùng mật khẩu → đăng nhập xác định

**ĐO ĐƯỢC.** Tầng: integration. Đây là lý do thi hành (`lms-auth/router.ts:543-571` duyệt mọi `StudentAccount`, `break` ở lần khớp đầu).

```ts
// hai StudentAccount, cùng passwordHash mặc định Cmc2026@ (provision-from-receipt.ts:302-312)
const r1 = await anon.lmsAuth.loginFamily({ phone, password: shared });
const r2 = await anon.lmsAuth.loginFamily({ phone, password: shared });
expect(r1.sessionToken).toBeTruthy();
expect(r1.studentIds.sort()).toEqual([childA, childB].sort()); // phiên đa con, không chọn 1 đứa
expect(r1.studentId ?? null).toBeNull(); // hoặc picker bắt buộc — tùy ranh giới 1
```

Hôm nay `loginStudent` trả **một** `studentId` (`:612-620`) — nhà 2 con + cùng MK = **không xác định**. Test RED.

#### 3. Đổi con thì mọi màn đổi theo

**KHÔNG ĐO ĐỦ.** «Mọi màn» không đóng. Tầng e2e UI đo **được tập có journey**:

```bash
PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium -- \
  tests/journeys/lms-parent-otp-login.journey.ui.spec.ts \
  tests/journeys/lms-parent-evidence-consent.journey.ui.spec.ts \
  tests/journeys/lms-stars-redeem-cycle.journey.ui.spec.ts
```

Assertion viết lại: chọn con B → `/home`, evidence, gifts/exercise hiện **B**, không sót data A. Không chứng minh màn chưa có journey.

#### 4. Không chạm HS ngoài gia đình

**ĐO ĐƯỢC.** Tầng: integration âm. Đã có: `draft-confirm.test.ts:482`, `list-for-child.test.ts:159`, `photo-access`.

```ts
await expect(familyA.assessment.listForChild({ studentId: childOfB })).rejects.toMatchObject({ code: 'FORBIDDEN' });
```

Giữ nguyên sau khi gộp helper sở hữu.

#### 5. Đổi mô hình → phiên cũ hết hiệu lực

**ĐO ĐƯỢC nếu chọn tăng `tokenVersion`.** Pattern sẵn `parentAccount/set-active.test.ts:81-113`; bump thật ở `parentAccount/router.ts:220-239` (deactivate), **không** tăng khi đổi mật khẩu (đúng M-6 adjudication).

```ts
const old = signLmsToken({ parentAccountId, kind: 'parent', tokenVersion: 0 }, secret);
await migrateFamilyModel(); // phải increment tokenVersion mọi ParentAccount
await expect(callWithBearer(old)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
```

Nếu chọn «từ chối claim lạ ở `verifyLmsToken`» (`phase-b1:77`): unit `session-token.test.ts` — `kind: 'parent'` → `null`.

Ranh giới 2 **chưa chọn** — viết được 2 test, không viết được 1 test đúng trước quyết định.

#### 6. Journey LMS viết lại xanh; `acceptance:report` ≥ mức trước

**ĐO ĐƯỢC.**

```bash
# mốc trước (một lần, commit sạch):
pnpm acceptance:report   # ghi built=B0 proven=P0

# sau B1.5
PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium
pnpm acceptance:report   # built>=B0 và proven>=P0; P1-07 không còn requestOtpEmail/LoginOtp
```

Đồng thời phải sửa claim P1-07 + whitelist `verify.ts:41-43` + allowlist audit `trpc.ts:109-122,135` (`phase-b1:132-133`). Thiếu → tool exit 1 hoặc `partial`.

`parseLmsToken` (`lms-session.tsx:39-59`) `atob` cả token 3 phần — bắt buộc sửa trong phase (`phase-b1:152`); đo bằng unit frontend (hiện `apps/lms` **không** có test — phải thêm Vitest hoặc e2e).

---

## Cổng plan.md (toàn kế hoạch)

| Cổng | Đo được? | Lệnh |
|---|---|---|
| `typecheck-and-test` + `ui-e2e` xanh | **ĐO ĐƯỢC** | required checks trên PR; local: `pnpm typecheck && pnpm test` và `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` |
| `acceptance:report` không tụt | **ĐO ĐƯỢC** nếu chụp mốc trước | xem (c) |
| Không claim trỏ thủ tục/route đã gỡ | **ĐO ĐƯỢC** | `pnpm acceptance:report` — flow `partial`/`missing` + `JOURNEY MISSING` |

---

## Việc kế hoạch chưa chốt làm cổng chưa đóng

Các cổng trên **vẫn viết được test** sau khi chốt. Chúng không phải thiếu runner.

| Chưa chốt | Cổng bị treo |
|---|---|
| Tên procedure gỡ/sửa khung, đóng/mở lớp, gán GV buổi, login gia đình | A1.2–5, A2.3–5, A3.*, B1.2 — test dùng tên giả, đổi 1 chỗ khi chốt |
| Khoá quyền đóng lớp (`phase-a2:74-76`) | A2.3 — assertion `can(..., 'class.read') === false` vẫn viết được |
| Chính sách đóng băng + mã lỗi dãy lệch (`phase-a3:48-56,89`) | A3.5 đo được theo đề xuất; A3.6 **chưa** |
| Hợp đồng hàm thuần 2 cổng (`phase-a4:70-73`) | A4.5 chữ ký |
| Khoá bài học (`phase-a5:81`) | A5.4 |
| Claim token, giết phiên, 2 hợp đồng studentId (`phase-b1:72-101`) | B1.1, B1.3, B1.5 |

---

## Bảng tổng

| Phase | Cổng | Đo? | Tầng |
|---|---|---|---|
| A1 | Khoá không bám id khung | ĐO ĐƯỢC | schema / rg / int |
| A1 | Gỡ khung không xóa hàng | ĐO ĐƯỢC | int API |
| A1 | Không sinh buổi đôi | ĐO ĐƯỢC | int API |
| A1 | GV buổi sau backfill + sinh mới | ĐO ĐƯỢC | schema + int |
| A1 | Đổi GV một buổi + vết | ĐO ĐƯỢC | int + auth unit |
| A1 | Migration trùng → dừng sạch | KHÔNG ĐO ĐỦ | không harness fixture; CHECK SQL thì được |
| A2 | Tập đóng ở DB | ĐO ĐƯỢC | int DB |
| A2 | Bảng ánh xạ trong phase + quyết định | ĐO ĐƯỢC / chưa có file quyết định | rg tài liệu |
| A2 | GV+sale FORBIDDEN | ĐO ĐƯỢC | auth unit + int |
| A2 | Một audit / lần | ĐO ĐƯỢC | int |
| A2 | Đóng lớp không đụng buổi | ĐO ĐƯỢC (tạm; A3 đảo) | int |
| A3 | Gỡ khung → `slot_removed` | ĐO ĐƯỢC | int |
| A3 | Thêm khung → cùng id | ĐO ĐƯỢC | int |
| A3 | `manual` không hồi | ĐO ĐƯỢC | int |
| A3 | Reopen chỉ `class_closed` | ĐO ĐƯỢC | int |
| A3 | Điểm danh đóng băng unit | ĐO ĐƯỢC | int |
| A3 | Dãy lệch báo ra | KHÔNG ĐO ĐỦ | chưa mã lỗi |
| A3 | Hủy thiếu lý do | ĐO ĐƯỢC | `tsc` |
| A4 | Migrate tiến+lùi | KHÔNG ĐO ĐỦ | ADD VALUE không lùi |
| A4 | `completed` đọc lịch sử | ĐO ĐƯỢC | int listForChild |
| A4 | `completed` không bài mới | ĐO ĐƯỢC | int open-tier |
| A4 | `on_hold` on/off | ĐO ĐƯỢC | int |
| A4 | 4 tổ hợp | ĐO ĐƯỢC, thiếu case completed | domain-lms unit |
| A4 | Không router tự diễn giải | KHÔNG ĐO ĐỦ | rg, không đóng |
| A4 | withdrawn không login | ĐO ĐƯỢC | int login |
| A4 | 4 trường + mã unique | ĐO ĐƯỢC | schema + int |
| A5 | Import 2 lần 96+240 | ĐO ĐƯỢC | script+DB |
| A5 | 1/2/4 bài/unit | ĐO ĐƯỢC | SQL / node:test |
| A5 | 90 / 110 phút | ĐO ĐƯỢC | node:test (CSV đã đúng) |
| A5 | Khoá ổn định | KHÔNG ĐO ĐƯỢC | phase chưa ghi khoá |
| A5 | Dấu bài đúng unit | ĐO ĐƯỢC | int + admin component |
| A5 | Unit không bài vẫn mở | ĐO ĐƯỢC | int |
| A5 | 210 ghi chú trống | ĐO ĐƯỢC | node:test |
| B1 | Hết kind parent/student | ĐO ĐƯỢC | rg + token unit |
| B1 | 2 con cùng MK xác định | ĐO ĐƯỢC | int |
| B1 | Đổi con mọi màn | KHÔNG ĐO ĐỦ | e2e vài màn, không «mọi» |
| B1 | Không đụng HS ngoài nhà | ĐO ĐƯỢC | int âm |
| B1 | Phiên cũ chết | ĐO ĐƯỢC nếu chốt cơ chế | int tokenVersion |
| B1 | Journey + report ≥ mốc | ĐO ĐƯỢC | ui-e2e + acceptance:report |

---

Status: DONE_WITH_CONCERNS
Summary: Khung test đủ để đo gần hết cổng bằng lệnh cụ thể; ba lỗ đo là migrate-lùi enum A4, khoá bài A5 chưa ghi, và số «3 flow» của B1 sai (ít nhất 4 journey proven). A2 «đóng lớp không đụng buổi» sẽ bị A3 đảo — phải chuyển ownership test.
