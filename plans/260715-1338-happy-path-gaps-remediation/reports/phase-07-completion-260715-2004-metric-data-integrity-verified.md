# Phase 7 (Metric & Data Integrity) — Hoàn tất

**Ngày:** 2026-07-15 · **TDD:** đỏ→xanh đủ cả 5 hạng mục · **Regression:** 820/820 API (93 file) + 239/239 admin UI (32 file) + 17/17 domain-finance · **Typecheck:** 26/26 package

## Thay đổi code

### 1. Trùng SĐT chưa chỉ rõ bé → CHẶN + xác nhận (PO round 3)
| File | Thay đổi |
|---|---|
| `apps/api/src/finance/router.ts` | `receiptCreate` thêm cổng chặn: phone có ≥1 Student thật (qua Guardian) && !studentId && !confirmNewStudent → trả `{status:'needs_confirmation', message, existingStudents}` (KHÔNG tạo receipt). Thêm field `confirmNewStudent` vào input. Cũ `dupWarning` (soft-warn) không còn bắn trùng lặp khi gate mới đã xử lý (tránh "vui lòng xác nhận" lặp lại ngay sau khi vừa xác nhận) |
| `apps/api/src/finance/router.ts` | `runMoneyTransaction`: `kind` đổi từ tính theo PHONE sang tính theo STUDENT (2 anh em chung SĐT giờ mỗi bé tính `new` độc lập, không bị gán nhầm `renewal`) |
| `packages/domain-finance/src/receipt-kind.ts` | Đổi tên tham số `hasPriorApprovedReceiptForPhone`→`hasPriorApprovedReceiptForStudent` (logic thuần không đổi, chỉ rõ nghĩa) |
| `apps/admin/src/pages/finance/receipt-create.tsx` | Thêm picker UI khi `needs_confirmation`: chọn bé đã có (gửi lại `studentId`) hoặc xác nhận bé mới (`confirmNewStudent:true`); nút đặt NGOÀI `Banner` (Astryx ẩn `children` sau nút thu gọn) |
| Test mới: `finance/duplicate-student-gate.test.ts` (5 test), `admin/.../receipt-create.test.tsx` (+3 test) |

### 2. `closedAt` không ghi đè khi opp đã O5
| File | Thay đổi |
|---|---|
| `apps/api/src/finance/router.ts` | `runMoneyTransaction`: chỉ set `closedAt` khi `opportunity.stage !== 'O5_ENROLLED'` — phiếu thứ 2 (vd anh em cùng 1 opportunity) không ghi đè thời điểm đóng gốc |

### 3. FinalGrade tự refresh sau sửa điểm danh
| File | Thay đổi |
|---|---|
| `apps/api/src/submission/router.ts` | `recomputeFinalGrade` export ra ngoài; đổi param `gradedAt`→`periodAnchor` (dùng chung cho cả grade lẫn attendance) |
| `apps/api/src/attendance/router.ts` | `mark`/`markAll` gọi `recomputeFinalGrade` sau khi ghi attendance, anchor = `session.endTime` (không phải "now" — sửa buổi cũ refresh đúng tháng cũ); `markAll` dedupe theo `studentId` (không lặp N lần/roster) |

### 4. `submit()` tái kiểm exercise còn mở
| File | Thay đổi |
|---|---|
| `apps/api/src/submission/router.ts` | `submit` gọi `assertExerciseOpenForStudent` (như `saveDraft`) — chặn nộp bài sau khi exercise đã `close` |

### 5. Tier B time-gate (mirror Tier A)
| File | Thay đổi |
|---|---|
| `apps/api/src/exercise/open-tier.ts` | Query Tier B thêm `classSession.endTime: {lt: now}` — buổi bù tương lai đánh `present` trước KHÔNG mở đơn vị bài học sớm |
| `apps/api/src/exercise/open-tier.test.ts` | Sửa lại 1 test cũ đang dùng `endTime: FUTURE` mà assert unit MỞ (đúng bug cần sửa, không phải regression — đổi sang `endTime: PAST`); thêm test mới cho case tương lai bị chặn |

## Bug thật phát hiện thêm ngoài dự kiến (không phải scope creep — sửa vì tính năng chính không chạy đúng nếu bỏ qua)
1. **`ParentAccount.phone` không chuẩn hoá khi tra cứu trong `receiptCreate`** — `ParentAccount` LUÔN lưu dạng đã `normalizeLoginPhone()` (provisioning), nhưng lookup cũ dùng `input.parentPhone` thô → không bao giờ khớp ParentAccount thật. Fix bằng helper `tryNormalizePhone` (fail-soft: phone không hợp lệ → coi như "không khớp", không chặn receiptCreate hiện có). Gate mới của Phase 7 phụ thuộc trực tiếp vào lookup đúng nên phải sửa cùng lúc.
2. **`Receipt.studentId` của phiếu GỐC (tạo student mới) luôn null** — chỉ phiếu renewal sau mới set field này, khiến query "phiếu approved trước đó của student X" luôn miss phiếu đầu tiên. Fix bằng `OR: [{studentId: X}, {student: {id: X}}]` (dùng quan hệ ngược `Receipt.student` từ `Student.createdByReceiptId`).
3. **Sweep 6 file test finance** (`cancel-refund`, `create-from-opp`, `receipt-get`, `receipt-list`, `renewal-reuse`, `rls-negative`) cần thêm type-narrowing cho union 3 nhánh mới của `ReceiptCreateResult` — phát hiện qua `pnpm typecheck` (không phải hạ tầng), không phải lỗi runtime nhưng bắt buộc để build sạch.

## Đối chiếu Success Criteria (phase-07-metric-data-integrity.md)
- [x] Trùng SĐT chưa chỉ rõ bé (tên giống HAY khác) không cờ → CHẶN; có `confirmNewStudent` → bé mới `kind='new'`; có `studentId` → renewal. Phone hoàn toàn mới không bị chặn.
- [x] `closedAt` không bị ghi đè khi opp đã O5.
- [x] FinalGrade tự refresh sau sửa điểm danh; report không còn "rate mới + score cũ".
- [x] `submit` bị chặn khi bài đóng.
- [x] Tier B chỉ mở khi buổi bù đã kết thúc.

## Unresolved questions
Không có.
