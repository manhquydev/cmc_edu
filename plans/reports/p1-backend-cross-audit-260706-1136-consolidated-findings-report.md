# P1 Backend — Cross-Audit hợp nhất (code thật ↔ toàn bộ docs), trừ UI

> Nguồn: 4 agent review song song (money · data-model · rbac/rls/security · api/traceability/test),
> + số liệu đo trực tiếp + verify tay của main agent. Intake #4. Branch `feat/p1-identity-enrollment`.
> Nguyên tắc: đọc code thật, không tin claim/tài liệu/"test pass". Mỗi finding có nguồn + mức tin.

## 1. Số liệu thật (đo trực tiếp)

| Chỉ số | Giá trị |
|---|---|
| Test | **94/94 pass** — api 56 (9 file, vs Postgres thật) · auth 8 · domain-finance 23 · domain-identity 7 |
| Coverage domain-finance | **100%** (v8) |
| Coverage `@cmc/api` | **KHÔNG đo được** — `@vitest/coverage-v8` chỉ có ở 2 package domain, thiếu ở `apps/api` → router-layer (mạch tiền/provisioning) không có coverage |
| LOC | src 2033 · test 1596 (test:src ≈ 0.78) |
| Harness | 4 intake · 10 story (8 P1 implemented) · 7 decision · 6 trace · entropy 15/100; chỉ US-010 orphaned (lùi P5) |
| Traceability | 8/8 hàng TL25 P1-01..08 có procedure + test DB thật (không phải "resolves OK") · P1-09 recon vắng (lùi P5) |

## 2. Đã xác nhận ĐÚNG (không sửa nhầm)
I1 (sale bị loại khỏi approve/cancel — registry+requirePermission) · **I4 netAmount đóng băng (traced mọi writer)** · I5 refund cap `FOR UPDATE` + append-only · I2 auto-O5+closedAt cùng tx · I3 revert phiếu-duy-nhất (đơn luồng) · ADR-A `active⇔approved` không có setter trực tiếp · ADR-0041 tách tx tiền + provisioning P2002-refetch cho ParentAccount/Student/StudentAccount · atomic claim `updateMany status=` chống double-approve/cancel/verify đồng thời · RBAC registry khớp **chính xác** TL14 §5 cho 6 permission P1 pinned, không hardcode role · child-data gate một nguồn (`getApprovedChildren`) loại `blocked_lms`, không có đường đọc trước approve · `lmsProcedure` không bị staff session thỏa mãn · phone unique toàn hệ · receipt code counter global.

## 3. Findings hợp nhất (dedupe, xếp severity)

### CRITICAL — 2 (auth substrate; tầng SSO đang là nợ P0 nhưng thiếu guard fail-closed)
| # | Finding | Nguồn | Loại |
|---|---|---|---|
| **C1** | Dev-session `x-dev-user` **không có env guard fail-closed** (context.ts chỉ TODO comment) → bất kỳ ai gửi `{roles:['super_admin'],facilityId:any}` qua mọi `requirePermission`/`scoped()` cho mọi cơ sở. | security + verify tay | **must-fix (cheap)** — thêm chặn `NODE_ENV==='production'` fail-closed; SSO thật vẫn theo lộ trình P0 |
| **C2** | `x-dev-lms-user` + `sessionToken=base64url(parentAccountId)` **chưa ký, không hết hạn, không verify** → impersonate PH bất kỳ → PII trẻ (enrollment.mine). OTP chỉ trang trí. | security + verify | **must-fix (cheap)** guard + đánh dấu session thật là nợ P0 |

### HIGH — 6
| # | Finding | Nguồn (corroboration) | Loại |
|---|---|---|---|
| **H1** | Ngưỡng mắt-thứ-hai ADR-B chỉ chặn *self-approve*, **không chặn over-threshold tổng quát** (sale tạo → GĐKD duyệt phiếu 500tr không cần GĐĐT). Giá trị X = placeholder 20tr. | money + review trước (×2) | **decision** (giá trị+cơ chế) + code · backlog#1 |
| **H2** | Enrollment **không có `@@unique(facilityId,studentId,classBatchId)` + không P2002** → replay approve-retry đồng thời tạo 2 `active`. (Verify: model chỉ có `@@index`.) | money+schema+api (×3) + verify | **fix** partial unique index + P2002 + test replay đồng thời · liên quan backlog#2 |
| **H3** | Không có `Receipt.studentId` → phiếu **renewal tạo Student MỚI** (`createdByReceiptId` unique theo phiếu) → phân mảnh lịch sử HS, phồng headcount. | schema | **decision/schema** thêm `Receipt.studentId`, renewal dùng lại Student |
| **H4** | **RLS chỉ ở tầng app (convention)**, không có Postgres RLS/policy (verify: 0 policy trong migration). TL30 T12 / I10 coi là bất biến cứng trên dữ liệu trẻ. | schema + verify | **decision (ADR)** enforce DB RLS hay chấp nhận app-level |
| **H5** | OTP **không rate-limit / không khóa brute-force / không cooldown** → brute 6 số trong TTL 5', spam OTP. TL30 T2/T14. | security | **fix** |
| **H6** | Huỷ đồng thời 2 phiếu trên 1 opp: read "phiếu approved khác" **không khóa** → cả hai bỏ qua revert → opp **kẹt O5 với 0 phiếu approved** (vi phạm I3). | money | **fix** khóa/serialize cancel |

### MEDIUM — 11
M1 `apps/api` thiếu coverage provider → mục tiêu TL29 finance ≥90% **không đo được** (metrics+api+verify) · M2 **`ke_toan` có quyền `receiptApprove` mâu thuẫn TL11 §5** ("v2: GĐKD — ke_toan deferred"); TL14 §5 lại liệt kê ke_toan → **doc xung đột, cần chốt** · M3 đọc dữ liệu trẻ (enrollment.mine, verifyOtp) **không ghi audit** (TL08 §7) · M4 `refundCreate` **không idempotent / thiếu idempotencyKey** (TL11 §4) — 2 refund tuần tự trùng đều append · M5 `RefundRecord` thiếu `facilityId` · M6 `StudentLifecycle` không phân biệt void/archive vs withdrawn (QĐ0024) · M7 `timestamp` không `timestamptz` — rủi ro biên tháng lương ICT (TL10 §5) · M8 `activateEnrollmentForReceipt` `findFirst` **không orderBy/không lọc status** → sau cancel→re-enroll có thể trả nhầm hàng `withdrawn`, ghế mới không active · M9 cancel **over-withdraw** enrollment chung khi còn phiếu approved khác phủ · M10 **thiếu test RLS âm tính cho finance** (TL29 §4 bắt buộc, module ≥90%) · M11 OTP lưu plaintext.

### LOW — ~13 (batch)
Money tính bằng JS float trên Decimal (F6) · `amount` không max/2dp → overflow 500 & phiếu net=0 (F7) · outbox nhãn `pending` + trùng dòng khi retry (F8) · `computeNetAmount` **dead code**, đường discount chưa nối (F9) · kind `new` trùng khi race (analytics) (F10) · counter upsert lần-đầu đồng thời có thể 500 (F11) · phone existence oracle chéo cơ sở (thấp) · `classBatchId` chưa validate · `crm.opportunityList` chưa test · guardian approve/reject concurrency chưa test · `LoginOtpStatus.pending` vs doc `issued` (naming) · `enrollment.enroll` **nuốt lặng `opportunityId`** (không có cột) · scalar chưa FK (D5, phased — rủi ro ở migration thêm FK sau).

## 4. Đề xuất remediation (theo tranche)

**Tranche A — code fix rẻ, không cần quyết định (nên làm ngay):**
C1/C2 env-guard fail-closed · H2 enrollment unique+P2002+test · H5 OTP rate-limit · H6 cancel lock · M1 coverage provider cho api + đặt threshold · M3 audit đọc dữ liệu trẻ · M8/M9 enrollment orderBy+status / cancel scope · M10 test RLS finance · L: amount max+2dp (F7), computeNetAmount/discount (F9), outbox dedupe (F8).

**Tranche B — cần quyết định sản phẩm (chờ bạn):**
H1 ngưỡng X + cơ chế mắt-thứ-hai (backlog#1) · H3 renewal `Receipt.studentId` (backlog#2) · H4 DB-RLS vs app-RLS (ADR mới) · M2 ke_toan có ở cổng tiền không (chốt doc nào chuẩn — TL11 vs TL14) · M4 refund idempotency ở P1 hay pha outbox · M6 thêm `archived` lifecycle hay audit-only · M7 timestamptz (nên đổi sớm khi còn là substrate).

**Tranche C — nợ đã biết theo lộ trình (không phải lỗi mới):**
Entra SSO thật (thay dev-stub) · session thật có ký/hết hạn · FK cho scalar (ClassBatch/AppUser đến ở pha academic/user) · mã hoá cột PII (khi thêm cột) · US-010 recon (P5).

## 5. Kết luận
Lõi số học + bất biến đơn-luồng **vững & có test thật** (I1–I5, ADR-A/0041, RBAC/child-gate khớp doc). Rủi ro thật tập trung ở: (a) auth-substrate chưa fail-closed (C1/C2 — nợ SSO nhưng thiếu guard), (b) **cổng tiền over-threshold chưa thực thi tổng quát** (H1), (c) **enrollment thiếu unique → nhân đôi under replay** (H2) + renewal nhân đôi HS (H3), (d) **RLS chưa ở DB** (H4). Chưa "production-trustworthy" cho phần tiền/ghi danh tới khi H1–H4 + C1/C2 được xử. Test pass 94/94 nhưng coverage router-layer **không đo được** — không thể khẳng định đạt mục tiêu TL29.

## Câu hỏi chưa giải (cần bạn)
1. Ngưỡng X (VND) + cơ chế mắt-thứ-hai: chỉ GĐĐT/super_admin duyệt khi vượt, hay 2-chữ-ký co-sign?
2. HS ghi danh lại cùng lớp sau `withdrawn` — cho phép? (quyết định partial-unique). Renewal có dùng lại Student cũ (thêm `Receipt.studentId`)?
3. RLS: enforce Postgres RLS (an toàn hơn cho dữ liệu trẻ) hay ADR chấp nhận app-level giai đoạn này?
4. `ke_toan` ở cổng tiền: theo TL11 (deferred, chỉ GĐKD) hay TL14 §5 (có ke_toan)? — doc mâu thuẫn.
5. Refund idempotency + OTP hardening: làm trong P1 hay để pha sau?
