# Phase 6 (part 1) — Đợt ghi danh + vận hành lớp: P1-01 + no-ui-path

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-06-dot-ghi-danh-van-hanh-lop.md`
**Ngày:** 2026-07-25 · **Branch:** `acceptance-journey-38-lms`

Phase 6 là đợt lớn nhất. Part 1 giao: journey P1-01 (đường thất bại phễu) + 4
luồng no-ui-path theo quyết định seed V5. **Part 2 còn lại:** P2-04, P2-06,
P2-08-GV (3 journey cần seed CurriculumUnit/Submission đã duyệt).

## Đã giao (part 1)

| Flow | Kết quả |
|---|---|
| P1-01 Quản lý phễu tuyển sinh | **journey xanh 4×** (crm-opportunity-lost) — create → detail → mark-lost |
| P2-01 Tạo lớp tự sinh lịch | no-ui-path (không màn tạo lớp) |
| P2-02 Điểm danh | no-ui-path (đòi ?session, không link in-app; S2 từ chối) |
| P2-03 Mở bài theo tiến độ | no-ui-path (open-tier không UI; S3 từ chối) |
| P2-05 Làm bài & nộp | no-ui-path (phụ thuộc open-tier P2-03) |

P1-05, P2-07 đã có journey từ trước. Sổ: **12 → 13/38**.

## P1-01: phủ hẹp có chủ ý (đường thất bại)

Journey chứng minh đường THẤT BẠI của phễu — phần crm-receipt không chạm:
1. sale tạo cơ hội qua "Thêm cơ hội" (opportunityCreate)
2. mở màn chi tiết `/crm/opportunities/:id` (opportunityGet)
3. đánh dấu mất kèm lý do (opportunityMarkLost)

**Assign (assignableStaff + opportunityAssign) để lại đợt sau:** control assign
chỉ hiện với vai quản lý (`isManager=GĐKD`, `opportunity-detail.tsx:104`) và cần
nhân sự assignable thật. Manifest ghi rõ phủ hẹp (như P2-07/P3-05/P4-01).

## 4 lỗi UI-contract khi build P1-01 (bài học lặp)

Mỗi journey lộ vài điểm lệch giữa "khai" và UI thật — đúng lý do plan này tồn
tại. Với P1-01:
1. **Nav**: dùng `menuNav` (helper chuẩn), không tự click button+link.
2. **Selector "Lý do mất" là combobox** (role=combobox "Lý do mất Required"),
   không phải button (khác class-picker) cũng không `getByLabel`.
3. **Mark-lost không đổi màn**: xem finding sản phẩm dưới.

## Finding sản phẩm mới: mark-lost từ màn chi tiết để lại màn cũ

`useOpportunityActions().markLostMutation.onSuccess = invalidateList` — CHỈ
invalidate `crm.opportunityList` (board), KHÔNG invalidate `crm.opportunityGet`
(màn chi tiết). Nên khi đánh dấu mất TỪ MÀN CHI TIẾT, mutation persist đúng
(DB + board cập nhật) nhưng **màn chi tiết vẫn hiện trạng thái mở** tới khi
reload tay. Journey xử đúng: reload rồi assert trạng thái mất (mạnh hơn — chứng
minh sống sót qua tải lại từ server), kèm comment. Bàn giao plan sửa:
`use-opportunity-actions.ts` nên invalidate cả `opportunityGet`.

## Falsification (chạy thật)

- Bỏ bước "Xác nhận" → cơ hội không mất → assert đỏ đúng (load-bearing) ✅
- 4 lần liên tiếp: 4/4 xanh (22.2–22.5s) ✅

## no-ui-path: tự kiểm grep (không tin report)

```
P2-01: rg "classBatch\.create|schedule\.generateSessions" apps/admin+lms → 0
P2-02: rg "attendance\?session=" apps/admin/src → chỉ ở *.test.tsx (không mã màn)
P2-03: rg "classSession\.assignUnit|assignUnit" apps/admin+lms → 0
P2-05: phụ thuộc open-tier P2-03; seed submission (S4) chỉ phục vụ chấm P2-06
```
Đều render `not-yet` + badge no-ui-path, chi tiết grep chỉ vào tab Builder (không
rò ra tab nghiệm thu). Theo nguyên tắc V5: seed các cơ chế này = giả xanh → không.

## Kiểm chứng

- P1-01: 4/4 xanh; full `ui-chromium` **21/21 xanh** (3.5 phút)
- `typecheck` 27/27 · `lint` sạch · `test` 2100 pass (23/23)
- `git diff packages/auth/src/index.ts` rỗng; 0 file sản phẩm bị chạm
- Sổ: **13/38 luồng đã chứng minh chạy**

## Part 2 còn lại (bản đồ sẵn để tiếp)

| Flow | Spec đề xuất | Seed (đã duyệt V5) | Ghi chú build |
|---|---|---|---|
| P2-04 Cung cấp bài tập PDF | `exercise-publish-close.journey.ui.spec.ts` | CurriculumUnit (trơ) + S1 classBatch | GĐĐT: `/teaching/exercises` create→publish→close (exercise.create/publish/close đã wired, `exercises.tsx`) |
| P2-06 Chấm bài & cộng sao | `grading-star-award.journey.ui.spec.ts` | S1 + S4 (`seedSubmittedSubmission` db.ts:536) | GV: `/teaching/grading` chấm submission đã seed → cộng sao; regression cần bắt = `submission.grade` |
| P2-08 (nửa GV) Gửi ảnh buổi | `session-evidence-publish.journey.ui.spec.ts` | S1 | GV: `/teaching/session-evidence` soạn+publish (nửa PH thuộc Phase 8) |

Cả 3 dùng `provisionStudentViaReceipt`/`seedClassBatch` sẵn có. P2-06 cần
`seedSubmittedSubmission` (đã có). P2-04 cần seed CurriculumUnit (trơ, đã duyệt).

## Finding sản phẩm tích luỹ (bàn giao plan sửa)

1. Ô học phí từ chối số tròn (min=1 step=100000)
2. `Cmc2026@` literal lặp 4 chỗ
3. recon rule `self_approved` dead-path-qua-UI + mô tả `exceeds_threshold` lệch code
4. **MỚI:** mark-lost từ màn chi tiết không refresh màn (invalidate thiếu opportunityGet)

## Câu hỏi chưa giải quyết

- Part 2 (P2-04/06/08) — tiếp khi phiên mới, bản đồ đã sẵn ở bảng trên.
- Assign của P1-01 (manager-gated) — gộp vào part 2 hay đợt admin sau?
