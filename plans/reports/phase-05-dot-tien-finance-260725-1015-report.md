# Phase 5 — Đợt tiền (finance): XONG

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-05-dot-tien-finance.md`
**Ngày:** 2026-07-25 · **Branch:** `acceptance-journey-38-lms`

Đợt tiền theo bản đồ triage: P1-02/P1-03 đã có journey; **P1-09** viết mới;
**P1-08** không có đường UI → `statusReason`.

## Đã giao

| Flow | Kết quả | File |
|---|---|---|
| P1-09 Giám sát bất thường tài chính | **journey xanh 4×** | `apps/e2e/tests/journeys/recon-exceeds-threshold.journey.ui.spec.ts` |
| P1-08 Huỷ phiếu / hoàn tiền | `no-ui-path` + bằng chứng grep | `flow-manifest.ts` |
| Helper worker recon (S8) | mirror `drainEmailOutboxOnce` | `apps/e2e/src/db.ts` — `runReconcileFinanceFlagsOnce` |
| Helper provision (mở rộng) | thêm `feeVnd` + `approverRole`, trả `receiptId` | `provision-student-via-receipt.ts` |

## P1-09: đổi rule 1 → rule 2 vì rule 1 KHÔNG chạy được qua UI

Triage đề xuất chứng minh P1-09 bằng **rule 1 `self_approved`** (một GĐKD tự tạo
rồi tự duyệt phiếu của mình). **Tự kiểm cho thấy không chạy được qua UI** — đúng
lớp lỗi S7 đã ghi trong bộ nhớ:

- `finance/router.ts` tính `canApprove = notSelf && secondEyeOk && can(...)`
  (`toReceiptDto`, ~:174).
- `receipt-detail.tsx:272,293` ẩn nút "Duyệt & Kích hoạt" khi `!canApprove`.
- ⇒ Người tạo phiếu KHÔNG BAO GIỜ thấy nút duyệt phiếu của chính mình. Không có
  đường UI nào để một người tự-tạo-rồi-tự-duyệt → `self_approved` bất khả qua UI.

Chuyển sang **rule 2 `exceeds_threshold`** (phương án dự phòng triage đã ghi):
worker gắn cờ MỌI phiếu đã duyệt >20.000.000đ (`reconcile-finance-flags.ts`
rule 2 chỉ kiểm `netAmount > THRESHOLD`). Journey thuần UI, 2 vai thật:

1. sale tạo phiếu **>20M** qua Xếp lớp → tạo phiếu thu (fee `25000001`)
2. **GĐĐT** (second-eye) duyệt — vai duy nhất được duyệt phiếu >20M
   (`SECOND_EYE_ROLES = [giam_doc_dao_tao, super_admin]`)
3. chạy worker recon một lần (helper S8)
4. **GĐKD** mở `/ops/recon` (menuNav Tài chính & Điều hành → Đối soát) → THẤY cờ
   "Vượt ngưỡng phê duyệt" trỏ đúng phiếu

## Falsification sống (nằm trong spec)

Trước khi chạy worker: link cờ tới phiếu này **vắng** (`toHaveCount(0)`). Sau khi
chạy worker: **hiện** + thẻ cờ chứa cả deep-link tới phiếu VÀ nhãn "Vượt ngưỡng
phê duyệt". Tức worker chính là thứ làm cờ xuất hiện — không seed cờ giả. Cờ gắn
đúng phiếu của run (qua `href*=receiptId`), không phải "có cờ nào đó".

## P1-08: no-ui-path (tự kiểm lại, không tin report)

```
rg "trpc\.finance\.receiptCancel\b" apps/admin/src apps/lms/src → 0 matches
rg "trpc\.finance\.refundCreate\b"  apps/admin/src apps/lms/src → 0 matches
refund.tsx: không gọi tRPC nào (EmptyState "Tính năng chưa áp dụng")
```

Entry nav `/finance/refund` đã bị gỡ CÓ CHỦ Ý (nav-registry.ts, comment "Hoàn
tiền: màn chưa xây"). `statusReason.code='no-ui-path'` — renderer hiện badge
"Chưa có đường thao tác trên giao diện"; chi tiết grep chỉ vào tab Builder nội
bộ (không rò API surface ra tab nghiệm thu). Chờ plan sửa xây màn.

## DRY: helper provision mở rộng (consumer thứ 3)

`provisionStudentViaReceipt` giờ có `feeVnd` + `approverRole` (mặc định giữ hành
vi cũ: `3000001` + GĐKD), trả `receiptId`. Ba consumer: L-01, L-02 (mặc định),
P1-09 (>20M + GĐĐT). L-01/L-02 xanh 4× lại sau tham số hoá — không đổi hành vi.
Gotcha fee `min=1 step=100000` mã hoá một chỗ; P1-09 dùng `25000001`
(25000001−1 = 250×100000, đúng lattice).

## Kiểm chứng

- P1-09: 4/4 xanh liên tiếp; L-01/L-02 vẫn xanh sau tham số hoá
- Full `ui-chromium`: **20/20 xanh** (3.5 phút)
- `typecheck` 27/27 · `lint` sạch · `test` 2100 pass (23/23)
- `git diff packages/auth/src/index.ts` rỗng; 0 file sản phẩm bị chạm
- Sổ: **11 → 12/38 luồng đã chứng minh chạy**; P1-08 hiện no-ui-path có bằng chứng

## Đợt tiền: bức tranh đầy đủ

| Flow | Trạng thái |
|---|---|
| P1-02 Tạo phiếu học phí | proven (crm-receipt) |
| P1-03 Duyệt phiếu | proven (receipt-approve-negation) |
| P1-08 Huỷ/hoàn tiền | **no-ui-path** (màn chưa xây — plan sửa) |
| P1-09 Giám sát bất thường | **proven** (recon-exceeds-threshold) |

## Finding sản phẩm (bàn giao, không sửa ở plan này)

- **Rule 1 self_approved của recon là dead-path-qua-UI**: worker gắn cờ tự-duyệt
  nhưng UI chặn tự-duyệt (canApprove=notSelf) → cờ này chỉ có nghĩa nếu tự-duyệt
  xảy ra qua đường khác (API trực tiếp). Đáng rà: hoặc UI nên cho tự-duyệt dưới
  ngưỡng (để recon bắt), hoặc bỏ rule 1. Cộng dồn 2 finding cũ (fee số tròn;
  Cmc2026@ literal lặp).
- Mô tả UI `exceeds_threshold` ("...nhưng KHÔNG có GĐĐT/super_admin duyệt") lệch
  code (rule gắn cờ MỌI phiếu >20M kể cả đã second-eye) — doc UI nên sửa.

## Câu hỏi chưa giải quyết

- 2 finding sản phẩm trên vào danh sách plan sửa.
- Đợt tiếp theo (Phase 6 — ghi danh + vận hành lớp) là đợt lớn nhất, kỳ vọng
  nhiều flow đỏ nhất (cluster từng chết 16 ngày).
