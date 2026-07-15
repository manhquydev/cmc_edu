# 0043 — Chấm công theo cặp vào/ra mỗi ngày (daily in/out pairing)

Date: 2026-07-13

## Status

Accepted — **IMPLEMENTED** (2026-07-13, plan `260713-1706-attendance-daily-inout-pairing`,
8 phase TDD, 3 vòng validate + 3 vòng red-team). Xem "Trạng thái triển khai" bên
dưới cho danh sách file thay đổi và các tinh chỉnh phát sinh từ red-team
(E1/E2/E3/F1/F2) không có trong bản thảo gốc.

## Context

Chủ sản phẩm rà soát luồng chấm công thực tế (đọc code, không đọc docs) và phát
hiện mô hình đang chạy khác với nghiệp vụ mong muốn. Nghiệp vụ đích:

- Nhân viên có 1 trang, bấm 1 nút "Chấm công".
- Trong mạng WiFi cơ sở → ghi nhận thẳng. Ngoài mạng → vẫn ghi nhận nhưng phải
  điền lý do và biến thành phiếu cần cấp trên duyệt.
- Một ngày chỉ quan tâm 2 mốc: lần bấm ĐẦU (vào) và lần bấm CUỐI (ra).
- Chống gian lận: người checkin ở nhà (ghi lý do) rồi lên công ty checkout để né
  duyệt — phiếu ngoài mạng KHÔNG bao giờ được tự duyệt.

Mô hình cũ (đang chạy) ghép từng dấu chấm với từng ca theo cửa sổ ±2 giờ
(`assignPunchesToShifts`, dùng chung payroll + KPI), từ chối thẳng lần bấm ngoài
mạng, và cho tạo phiếu chấm bù bằng cách nhập ngày quá khứ tùy ý. Cả ba điểm đều
lệch nghiệp vụ đích.

## Decision

Chuyển sang mô hình **"cặp vào/ra mỗi ngày"**:

### Ghi nhận

1. Mỗi lần bấm ghi 1 mốc thời gian (append-only). Trong ngày: **mốc đầu = giờ
   vào, mốc cuối = giờ ra**; các mốc giữa vẫn lưu nhưng không dùng để tính.
2. Bỏ cooldown 5 phút → chỉ chặn double-tap ~10 giây.
3. Nút bấm: bấm 1 phát → UI đổi sang trạng thái "đã ghi nhận" ~5 giây → tự về,
   bấm tiếp được.

### Trong / ngoài mạng

4. Bấm **trong** WiFi cơ sở → hợp lệ ngay, không phiếu.
5. Bấm **ngoài** mạng → **vẫn ghi nhận** (thay cho việc từ chối):
   - Lần bấm ngoài mạng đầu tiên trong ngày → yêu cầu điền lý do, tạo phiếu ngày
     đó.
   - Mọi lần bấm còn lại trong ngày (trong/ngoài mạng) gắn vào phiếu ngày đó;
     phiếu hiển thị giờ vào (mốc đầu) + giờ ra (mốc cuối).
   - Phiếu **luôn cần duyệt tay, không bao giờ tự duyệt** — kể cả checkout lại
     vào mạng công ty.
6. Ngày hoàn toàn trong mạng → không sinh phiếu.

### Tính công & muộn/sớm

7. Có cặp vào/ra trong ngày (hợp lệ, hoặc phiếu đã duyệt) = **tất cả ca đăng ký
   ngày đó có công hợp lệ** — kể cả nhiều ca cách quãng, chỉ cần 1 cặp bao trùm
   (chấp nhận nới lỏng: người về giữa buổi vẫn đủ công — ưu tiên đơn giản).
8. Muộn/sớm so với **khung ngoài cùng**: giờ vào vs giờ bắt đầu ca **sớm nhất**
   (vào sau = muộn); giờ ra vs giờ kết thúc ca **muộn nhất** (ra trước = về sớm).
   Cả ngày 1 kết luận chung áp cho toàn bộ ca ngày đó.
9. Đơn giá phạt muộn/sớm **giữ nguyên** (chính sách cơ sở, fallback 500đ/phút
   muộn · 1000đ/phút sớm) — chỉ đổi cách xác định số phút muộn/sớm.

### Duyệt & trách nhiệm

10. **Bỏ hẳn** form chấm bù bằng ngày tùy ý. Không bấm ngày nào = ngày đó không
    có công; nhân sự tự chịu trách nhiệm.
11. Phiếu ngoài mạng bị **từ chối** = ngày đó tạm không có công, nhưng nhân sự
    được **chỉnh lý do gửi lại** để duyệt lại (dùng cơ chế `resubmitted` sẵn có).
12. **Người duyệt phiếu = GĐ tương ứng theo track** (sale → GĐ Kinh doanh; giáo
    viên → GĐ Đào tạo), đồng bộ với duyệt ca đăng ký. Bỏ phụ thuộc trường
    `managerId` gán tay (dễ gán sai, không kiểm tra được đúng track).

## Alternatives Considered

1. **Giữ mô hình ghép ±2h từng ca.** Phản ánh chính xác từng ca nhưng phức tạp,
   không cho phép mô hình "1 cặp vào/ra/ngày" mà nghiệp vụ muốn, và vẫn từ chối
   bấm ngoài mạng. Bị bác vì lệch nghiệp vụ đích.
2. **Vào/ra tính riêng từng ca** (dùng 1 cặp giờ đối chiếu từng ca). Chi tiết hơn
   nhưng phức tạp và một lần bấm trễ làm nhiều ca cùng bị muộn. Bác — chọn "khung
   ngoài cùng" cho đơn giản.
3. **Mỗi ca cách quãng phải bấm riêng.** Chống gian lận về giữa buổi tốt hơn
   nhưng quay lại gần mô hình per-shift phức tạp. Bác — ưu tiên đơn giản.
4. **Duyệt phiếu theo `managerId` (như hiện tại).** Không phải đổi code duyệt
   nhưng phụ thuộc admin gán đúng managerId và không đảm bảo đúng track. Bác —
   chọn duyệt theo track cho nhất quán với duyệt ca.

## Consequences

Positive:

- Nghiệp vụ chấm công khớp mong muốn: minh bạch 2 mốc vào/ra, ngoài mạng vẫn ghi
  nhận có kiểm soát, chống được kịch bản gian lận checkin-nhà/checkout-công-ty.
- Duyệt phiếu nhất quán với duyệt ca (cùng mô hình track GĐKD/GĐĐT).
- Bỏ chấm bù ngày tùy ý → tăng trách nhiệm cá nhân, giảm bề mặt gian lận.

Tradeoffs:

- **Blast radius lớn**: viết lại lõi ghép công đang dùng chung cho cả **lương và
  KPI** (`assignPunchesToShifts`), đổi schema (cho phép bấm ngoài mạng + phiếu
  mang giờ vào/ra), làm lại trang chấm công. Không phải sửa nhỏ — cần TDD.
- Mô hình "1 cặp vào/ra bao trùm" nới lỏng: người đăng ký nhiều ca cách quãng chỉ
  cần bấm đầu buổi + cuối buổi là đủ công cả ngày (đã chấp nhận có ý thức).
- Đổi người duyệt từ managerId → track là thay đổi ủy quyền (authorization) —
  cần rà lại ai đang duyệt phiếu ở dữ liệu hiện có.

## Trạng thái triển khai (2026-07-13) — IMPLEMENTED

Đã triển khai đầy đủ qua 8 phase TDD (plan
`plans/260713-1706-attendance-daily-inout-pairing/plan.md`):

| Khía cạnh | Trước ADR 0043 | Sau (implemented) |
|---|---|---|
| Vào/ra | Không lưu; suy ra ±2h từng ca lúc tính lương (`assignPunchesToShifts`) | Mốc đầu/cuối mỗi ngày = vào/ra (`computeDayAttendance`, `packages/domain-payroll`) |
| Bấm ngoài mạng | Từ chối thẳng (`IP_NOT_ALLOWED`), không ghi | Vẫn ghi (`TimePunch.withinNetwork=false`) + tạo/nối phiếu (`checkInOut.punch` → `ensureDayTicket`) |
| Phiếu | `ManualAttendanceTicket`: ngày + lý do; duyệt = miễn cả ngày | Mang `checkInAt`/`checkOutAt` đóng băng khi duyệt (R1); duyệt = cặp giờ đó pair như punch thật |
| Chấm bù ngày tùy ý | Có (`manualPunch.create` nhập ngày) | Bỏ hẳn — phiếu chỉ sinh từ `checkInOut.punch` |
| Cooldown | 5 phút | 10 giây (`PUNCH_COOLDOWN_MS`) |
| Người duyệt phiếu | Quản lý trực tiếp (`managerId`) | GĐ theo track — `assertCanReviewTicket` + `resolveTargetRole`/`trackDirectorRole` (`apps/api/src/attendance/`) |
| Nút UI | Banner tĩnh | Đổi trạng thái "Đã chấm công ✓" 5s rồi tự về (`check-in-out.tsx`) |
| Gửi lại phiếu bị từ chối | Tạo dòng mới qua `manualPunch.create` | `manualPunch.resubmit` cập nhật dòng cũ (unique `appUserId+ticketDate` chặn dòng thứ 2) |

**Tinh chỉnh phát sinh từ red-team (không có trong bản thảo Decision gốc):**

- **E1** — `penaltyAmount` cap tại `baseSalary+kpiPartAmount` (không chỉ floor `totalNet`), tránh hiển thị số phạt "ảo" lớn hơn thực trừ (`assembleSlip`).
- **E2** — offsite ngày KHÔNG có đăng ký ca (kể cả `submitted`) → chỉ ghi punch, không phiếu, không ép lý do.
- **E3** — một ca chỉ được tính công nếu khung ca **giao** với cặp `[checkin,checkout]` (`start<checkout && end>checkin`), không phải "cứ có cặp là mọi ca đều có công" như bản thảo đầu — sửa cả nghịch lý "ca đã bỏ vẫn bị tính muộn theo khung ca đó".
- **F1** — phiếu đã `approved`/`rejected` bị "đóng băng": punch mới cùng ngày không ghi đè `checkInAt`/`checkOutAt` (conditional `updateMany WHERE status IN (pending,resubmitted)`), chặn gian lận checkin-nhà/checkout-công-ty-sau-khi-đã-duyệt.
- **F2** — điều kiện tạo phiếu tính cả ca `submitted` (chưa duyệt), không chỉ `approved`, để không mất công khi GĐ duyệt ca sau khi nhân sự đã chấm công offsite.
- **R2 dedup** — payroll và KPI dùng chung `resolveDayCredit` (`apps/api/src/attendance/resolve-day-credit.ts`) để không bao giờ lệch số ngày/ca hợp lệ giữa 2 module.
- **R5 (rủi ro chấp nhận, không vá)** — bỏ cờ `shortSpan`; bấm 2 lần cách ~10s là đủ cặp hợp lệ. Đánh đổi có ý thức cho "ưu tiên đơn giản".
- **Edge phụ (rà vòng 2, phase 8)** — `shift.createTemplate` chặn `endTime<=startTime` (overnight shift phá overlap/late) bằng Zod `.refine`.
- **Gap tồn đọng phát hiện lúc chạy `/test` thật (không phải red-team, phát hiện khi chạy suite thật lần đầu sau phase 8):** `apps/api/src/trpc-error-formatter.test.ts` (file ngoài `checkin/`, sót khỏi các lần grep trước) còn assert `IP_NOT_ALLOWED`/cooldown "5 minutes" của model cũ — đã viết lại theo `OFFSITE_REASON_REQUIRED`/10 giây thật.

**File chính đã đổi:** `packages/db/prisma/schema.prisma` + migration
`20260713110000_attendance_daily_inout`; `packages/domain-payroll/src/day-attendance.ts`
(thay `shift-attendance.ts`); `apps/api/src/checkin/router.ts`;
`apps/api/src/attendance/{resolve-day-credit,resolve-target-role}.ts` (mới, dùng
chung); `apps/api/src/payroll/router.ts`; `apps/api/src/kpi/auto-score.ts`;
`apps/admin/src/pages/attendance/check-in-out.tsx`.

**Docs đồng bộ trong phase 8:** TL27 (WF-P3-01/02 viết lại, gỡ banner
SUPERSEDED-PENDING), URL drift `/attendance/check-in-out` → `/hr/checkin` đã sửa
trong TL27. Sweep thêm TL10/11/14/19/20/22/25 + codebase-summary + uat-checklist-go-live
+ system-architecture cho hết tham chiếu model cũ.

**Verify thật (không phải chỉ typecheck):** `apps/e2e/tests/attendance-lifecycle.spec.ts`
chạy qua HTTP + DB thật (20/20 pass); `apps/api` 87 file/759 test pass; root `pnpm typecheck`
26/26 task xanh; `harness-cli story verify US-ATT-01`: pass.

## Follow-Up

- Nghỉ phép/ốm hợp lệ (ngày không đi làm không bị trừ) — ngoài phạm vi ADR này,
  cần quyết định + thiết kế riêng nếu có nhu cầu.
- Cân nhắc nhắc nhân viên cuối ngày nếu chưa checkout (tránh mất công vì quên) —
  nice-to-have, chưa làm.
